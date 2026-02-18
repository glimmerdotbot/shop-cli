import { randomUUID } from 'node:crypto'

import { CliError } from '../errors'
import { coerceGid } from '../gid'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { maybeFailOnUserErrors } from '../userErrors'
import { resolveInventoryItemId } from '../workflows/inventory/resolveInventoryItemId'
import { printConnection, printJson } from '../output'

import { parseFirst } from './_shared'

const parseIntFlag = (flag: string, value: unknown) => {
  if (value === undefined || value === null || value === '') {
    throw new CliError(`Missing ${flag}`, 2)
  }
  const n = Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new CliError(`${flag} must be an integer`, 2)
  }
  return n
}

const requireLocationId = (id: string | undefined) => {
  if (!id) throw new CliError('Missing --location-id', 2)
  return coerceGid(id, 'Location')
}

const inventoryAdjustmentGroupSelection = ({
  inventoryItemId,
  locationIds,
}: {
  inventoryItemId: string
  locationIds: string[]
}) => ({
  id: true,
  reason: true,
  createdAt: true,
  referenceDocumentUri: true,
  changes: {
    __args: {
      inventoryItemIds: [inventoryItemId],
      locationIds,
      quantityNames: ['available'],
    },
    name: true,
    delta: true,
    quantityAfterChange: true,
    item: { id: true },
    location: { id: true, name: true },
  },
})

export const runInventory = async ({
  ctx,
  verb,
  argv,
}: {
  ctx: CommandContext
  verb: string
  argv: string[]
}) => {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(
      [
        'Usage:',
        '  shop inventory <verb> [flags]',
        '',
        'Verbs:',
        '  list|set|adjust|move',
        '',
        'Notes:',
        '  - set/adjust support --inventory-item-id or --variant-id',
        '  - move requires --from-location-id, --to-location-id, and --reference-document-uri',
      ].join('\n'),
    )
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'location-id': { type: 'string' },
      },
    })
    const locationId = requireLocationId(args['location-id'] as any)
    const first = parseFirst(args.first)
    const after = args.after as any
    const query = args.query as any

    const result = await runQuery(ctx, {
      location: {
        __args: { id: locationId },
        id: true,
        name: true,
        inventoryLevels: {
          __args: { first, after, query },
          pageInfo: { hasNextPage: true, endCursor: true },
          nodes: {
            id: true,
            updatedAt: true,
            item: { id: true, sku: true, tracked: true },
            quantities: { __args: { names: ['available'] }, name: true, quantity: true, updatedAt: true },
          },
        },
      },
    })
    if (result === undefined) return
    const connection = result.location?.inventoryLevels ?? { nodes: [], pageInfo: undefined }
    printConnection({ connection, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb !== 'set' && verb !== 'adjust' && verb !== 'move') {
    throw new CliError(`Unknown verb for inventory: ${verb}`, 2)
  }

  const args = parseStandardArgs({
    argv,
    extraOptions: {
      'inventory-item-id': { type: 'string' },
      'variant-id': { type: 'string' },
      'location-id': { type: 'string' },
      'from-location-id': { type: 'string' },
      'to-location-id': { type: 'string' },
      available: { type: 'string' },
      delta: { type: 'string' },
      quantity: { type: 'string' },
      'quantity-name': { type: 'string' },
      reason: { type: 'string' },
      'reference-document-uri': { type: 'string' },
    },
  })

  const locationId = verb === 'move' ? undefined : requireLocationId(args['location-id'] as any)
  const inventoryItemId = await resolveInventoryItemId({
    ctx,
    inventoryItemId: args['inventory-item-id'] as any,
    variantId: args['variant-id'] as any,
  })

  const reason = (args.reason as string | undefined) ?? 'correction'
  const referenceDocumentUri = args['reference-document-uri'] as string | undefined

  if (verb === 'set') {
    const available = parseIntFlag('--available', args.available)

    const result = await runMutation(ctx, {
      inventorySetQuantities: {
        __directives: { idempotent: { key: randomUUID() } },
        __args: {
          input: {
            name: 'available',
            reason,
            ...(referenceDocumentUri ? { referenceDocumentUri } : {}),
            quantities: [
              {
                inventoryItemId,
                locationId: locationId!,
                quantity: available,
                changeFromQuantity: null,
              },
            ],
          },
        },
        inventoryAdjustmentGroup: inventoryAdjustmentGroupSelection({
          inventoryItemId,
          locationIds: [locationId!],
        }),
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return

    maybeFailOnUserErrors({
      payload: result.inventorySetQuantities,
      failOnUserErrors: ctx.failOnUserErrors,
    })

    if (ctx.quiet) return console.log(result.inventorySetQuantities?.inventoryAdjustmentGroup?.id ?? '')
    printJson(result.inventorySetQuantities)
    return
  }

  if (verb === 'adjust') {
    const delta = parseIntFlag('--delta', args.delta)

    const result = await runMutation(ctx, {
      inventoryAdjustQuantities: {
        __directives: { idempotent: { key: randomUUID() } },
        __args: {
          input: {
            name: 'available',
            reason,
            ...(referenceDocumentUri ? { referenceDocumentUri } : {}),
            changes: [
              {
                inventoryItemId,
                locationId: locationId!,
                delta,
                changeFromQuantity: null,
              },
            ],
          },
        },
        inventoryAdjustmentGroup: inventoryAdjustmentGroupSelection({
          inventoryItemId,
          locationIds: [locationId!],
        }),
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return

    maybeFailOnUserErrors({
      payload: result.inventoryAdjustQuantities,
      failOnUserErrors: ctx.failOnUserErrors,
    })

    if (ctx.quiet) return console.log(result.inventoryAdjustQuantities?.inventoryAdjustmentGroup?.id ?? '')
    printJson(result.inventoryAdjustQuantities)
    return
  }

  if (verb === 'move') {
    const fromLocationIdRaw = (args as any)['from-location-id'] as string | undefined
    const toLocationIdRaw = (args as any)['to-location-id'] as string | undefined
    if (!fromLocationIdRaw) throw new CliError('Missing --from-location-id', 2)
    if (!toLocationIdRaw) throw new CliError('Missing --to-location-id', 2)

    const fromLocationId = coerceGid(fromLocationIdRaw, 'Location')
    const toLocationId = coerceGid(toLocationIdRaw, 'Location')

    const quantity = parseIntFlag('--quantity', (args as any).quantity)
    const quantityName = ((args as any)['quantity-name'] as string | undefined) ?? 'available'

    if (!referenceDocumentUri) {
      throw new CliError('Missing --reference-document-uri (required for inventory move)', 2)
    }

    const result = await runMutation(ctx, {
      inventoryMoveQuantities: {
        __directives: { idempotent: { key: randomUUID() } },
        __args: {
          input: {
            reason,
            referenceDocumentUri,
            changes: [
              {
                inventoryItemId,
                quantity,
                from: { locationId: fromLocationId, name: quantityName, changeFromQuantity: null },
                to: { locationId: toLocationId, name: quantityName, changeFromQuantity: null },
              },
            ],
          },
        },
        inventoryAdjustmentGroup: inventoryAdjustmentGroupSelection({
          inventoryItemId,
          locationIds: [fromLocationId, toLocationId],
        }),
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return

    maybeFailOnUserErrors({
      payload: result.inventoryMoveQuantities,
      failOnUserErrors: ctx.failOnUserErrors,
    })

    if (ctx.quiet) return console.log(result.inventoryMoveQuantities?.inventoryAdjustmentGroup?.id ?? '')
    printJson(result.inventoryMoveQuantities)
    return
  }
}
