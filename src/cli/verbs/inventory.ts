import { randomUUID } from 'node:crypto'

import { CliError } from '../errors'
import { coerceGid } from '../gid'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { maybeFailOnUserErrors } from '../userErrors'
import { resolveInventoryItemId } from '../workflows/inventory/resolveInventoryItemId'
import { printConnection, printJson, printNode } from '../output'

import { buildListNextPageArgs, parseFirst, parseIntFlag, parseJsonArg, parseTextArg, requireLocationId } from './_shared'

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
        '  properties|level',
        '  activate|deactivate|bulk-toggle-activation',
        '  set-on-hand-quantities|set-scheduled-changes|transfer-set-items',
        '',
        'Notes:',
        '  - set/adjust support --inventory-item-id or --variant-id',
        '  - move requires --from-location-id, --to-location-id, and --reference-document-uri',
      ].join('\n'),
    )
    return
  }

  const parseOptionalInt = (value: unknown, flag: string) => {
    if (value === undefined) return undefined
    return parseIntFlag(flag, value)
  }

  const requireInventoryLevelId = (value: unknown) => {
    if (typeof value !== 'string' || !value) throw new CliError('Missing --inventory-level-id', 2)
    return coerceGid(value, 'InventoryLevel')
  }

  const requireInventoryTransferId = (value: unknown) => {
    if (typeof value !== 'string' || !value) throw new CliError('Missing --transfer-id', 2)
    return coerceGid(value, 'InventoryTransfer')
  }

  const inventoryLevelSelection = {
    id: true,
    updatedAt: true,
    item: { id: true, sku: true, tracked: true },
    location: { id: true, name: true },
    quantities: {
      __args: { names: ['available', 'on_hand'] },
      name: true,
      quantity: true,
      updatedAt: true,
    },
  } as const

  if (verb === 'properties') {
    const result = await runQuery(ctx, {
      inventoryProperties: {
        quantityNames: {
          name: true,
          displayName: true,
          isInUse: true,
          belongsTo: true,
          comprises: true,
        },
      },
    })
    if (result === undefined) return
    printJson(result.inventoryProperties, ctx.format !== 'raw')
    return
  }

  if (verb === 'level') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireInventoryLevelId((args as any).id)
    const result = await runQuery(ctx, { inventoryLevel: { __args: { id }, ...inventoryLevelSelection } })
    if (result === undefined) return
    printNode({ node: result.inventoryLevel, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'activate') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'inventory-item-id': { type: 'string' },
        'variant-id': { type: 'string' },
        'location-id': { type: 'string' },
        available: { type: 'string' },
        'on-hand': { type: 'string' },
        'stock-at-legacy-location': { type: 'string' },
      },
    })

    const locationId = requireLocationId(args['location-id'])
    const inventoryItemId = await resolveInventoryItemId({
      ctx,
      inventoryItemId: args['inventory-item-id'] as any,
      variantId: args['variant-id'] as any,
    })

    const available = parseOptionalInt((args as any).available, '--available')
    const onHand = parseOptionalInt((args as any)['on-hand'], '--on-hand')
    const stockAtLegacyLocation = (() => {
      const raw = (args as any)['stock-at-legacy-location'] as string | undefined
      if (raw === undefined) return undefined
      const v = raw.trim().toLowerCase()
      if (v === 'true' || v === '1' || v === 'yes') return true
      if (v === 'false' || v === '0' || v === 'no') return false
      throw new CliError('--stock-at-legacy-location must be true|false', 2)
    })()

    const result = await runMutation(ctx, {
      inventoryActivate: {
        __directives: { idempotent: { key: randomUUID() } },
        __args: {
          inventoryItemId,
          locationId,
          ...(available === undefined ? {} : { available }),
          ...(onHand === undefined ? {} : { onHand }),
          ...(stockAtLegacyLocation === undefined ? {} : { stockAtLegacyLocation }),
        },
        inventoryLevel: inventoryLevelSelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.inventoryActivate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.inventoryActivate?.inventoryLevel?.id ?? '')
    printJson(result.inventoryActivate, ctx.format !== 'raw')
    return
  }

  if (verb === 'deactivate') {
    const args = parseStandardArgs({ argv, extraOptions: { 'inventory-level-id': { type: 'string' } } })
    const inventoryLevelIdRaw = (args as any)['inventory-level-id'] as string | undefined
    if (!inventoryLevelIdRaw) throw new CliError('Missing --inventory-level-id', 2)
    const inventoryLevelId = requireInventoryLevelId(inventoryLevelIdRaw)

    const result = await runMutation(ctx, {
      inventoryDeactivate: {
        __args: { inventoryLevelId },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.inventoryDeactivate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet || ctx.view === 'ids') {
      process.stdout.write(`${inventoryLevelId}\n`)
      return
    }

    const out = { inventoryLevelId, deactivated: true }
    printNode({ node: out, format: ctx.format, quiet: false })
    return
  }

  if (verb === 'bulk-toggle-activation') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'inventory-item-id': { type: 'string' },
        'variant-id': { type: 'string' },
        updates: { type: 'string' },
        'location-id': { type: 'string' },
        activate: { type: 'string' },
      },
    })

    const inventoryItemId = await resolveInventoryItemId({
      ctx,
      inventoryItemId: args['inventory-item-id'] as any,
      variantId: args['variant-id'] as any,
    })

    const updatesRaw = (args as any).updates as string | undefined
    const parsedUpdates = updatesRaw ? parseJsonArg(updatesRaw, '--updates') : undefined

    const inventoryItemUpdates = (() => {
      if (Array.isArray(parsedUpdates)) return parsedUpdates

      const locationIdRaw = (args as any)['location-id'] as string | undefined
      const activateRaw = (args as any).activate as string | undefined
      if (locationIdRaw && activateRaw !== undefined) {
        const v = activateRaw.trim().toLowerCase()
        const activate =
          v === 'true' || v === '1' || v === 'yes'
            ? true
            : v === 'false' || v === '0' || v === 'no'
              ? false
              : (() => {
                  throw new CliError('--activate must be true|false', 2)
                })()

        return [{ locationId: coerceGid(locationIdRaw, 'Location'), activate }]
      }

      throw new CliError('Missing --updates or (--location-id and --activate)', 2)
    })()

    const result = await runMutation(ctx, {
      inventoryBulkToggleActivation: {
        __args: { inventoryItemId, inventoryItemUpdates },
        inventoryItem: { id: true, sku: true, tracked: true },
        inventoryLevels: { id: true },
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.inventoryBulkToggleActivation, failOnUserErrors: ctx.failOnUserErrors })
    printJson(result.inventoryBulkToggleActivation, ctx.format !== 'raw')
    return
  }

  if (verb === 'set-on-hand-quantities') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'inventory-item-id': { type: 'string' },
        'variant-id': { type: 'string' },
        'location-id': { type: 'string' },
        'on-hand': { type: 'string' },
        'set-quantities': { type: 'string' },
        reason: { type: 'string' },
        'reference-document-uri': { type: 'string' },
      },
    })

    const reason = ((args as any).reason as string | undefined) ?? 'correction'
    const referenceDocumentUri = (args as any)['reference-document-uri'] as string | undefined

    const setQuantitiesRaw = (args as any)['set-quantities'] as string | undefined
    const parsed = setQuantitiesRaw ? parseJsonArg(setQuantitiesRaw, '--set-quantities') : undefined
    if (parsed !== undefined && !Array.isArray(parsed)) {
      throw new CliError('--set-quantities must be a JSON array', 2)
    }

    const setQuantities = (() => {
      if (Array.isArray(parsed)) return parsed
      return undefined
    })()

    const locationIdRaw = (args as any)['location-id'] as string | undefined
    const onHandRaw = (args as any)['on-hand'] as any

    const builtSetQuantities =
      setQuantities ??
      (locationIdRaw && onHandRaw !== undefined
        ? [
            {
              inventoryItemId: '__RESOLVE__',
              locationId: requireLocationId(locationIdRaw),
              quantity: parseIntFlag('--on-hand', onHandRaw),
            },
          ]
        : undefined)

    const finalSetQuantities = builtSetQuantities

    if (!finalSetQuantities) throw new CliError('Missing --set-quantities (or --location-id and --on-hand)', 2)

    for (const q of finalSetQuantities) {
      if (q && typeof q === 'object' && (q as any).inventoryItemId === '__RESOLVE__') {
        const inventoryItemId = await resolveInventoryItemId({
          ctx,
          inventoryItemId: (args as any)['inventory-item-id'] as any,
          variantId: (args as any)['variant-id'] as any,
        })
        ;(q as any).inventoryItemId = inventoryItemId
      }
    }

    const result = await runMutation(ctx, {
      inventorySetOnHandQuantities: {
        __directives: { idempotent: { key: randomUUID() } },
        __args: { input: { reason, ...(referenceDocumentUri ? { referenceDocumentUri } : {}), setQuantities: finalSetQuantities } },
        inventoryAdjustmentGroup: { id: true, reason: true, createdAt: true },
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.inventorySetOnHandQuantities,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.inventorySetOnHandQuantities?.inventoryAdjustmentGroup?.id ?? '')
    printJson(result.inventorySetOnHandQuantities, ctx.format !== 'raw')
    return
  }

  if (verb === 'set-scheduled-changes') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        reason: { type: 'string' },
        items: { type: 'string' },
        'reference-document-uri': { type: 'string' },
      },
    })

    const reason = ((args as any).reason as string | undefined) ?? 'correction'
    const referenceDocumentUriRaw = (args as any)['reference-document-uri'] as unknown
    if (referenceDocumentUriRaw === undefined) throw new CliError('Missing --reference-document-uri', 2)
    const referenceDocumentUri = parseTextArg(referenceDocumentUriRaw, '--reference-document-uri')

    const itemsRaw = (args as any).items as unknown
    if (itemsRaw === undefined) throw new CliError('Missing --items', 2)
    const items = parseJsonArg(itemsRaw, '--items')

    if (!Array.isArray(items)) throw new CliError('--items must be a JSON array', 2)

    const result = await runMutation(ctx, {
      inventorySetScheduledChanges: {
        __directives: { idempotent: { key: randomUUID() } },
        __args: { input: { reason, items, referenceDocumentUri } },
        scheduledChanges: { expectedAt: true },
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.inventorySetScheduledChanges,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    printJson(result.inventorySetScheduledChanges, ctx.format !== 'raw')
    return
  }

  if (verb === 'transfer-set-items') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'transfer-id': { type: 'string' },
        'line-items': { type: 'string' },
      },
    })

    const transferIdRaw = (args as any)['transfer-id'] as string | undefined
    if (!transferIdRaw) throw new CliError('Missing --transfer-id', 2)
    const transferId = requireInventoryTransferId(transferIdRaw)

    if ((args as any)['line-items'] === undefined) throw new CliError('Missing --line-items', 2)
    const lineItems = parseJsonArg((args as any)['line-items'], '--line-items')

    if (!Array.isArray(lineItems)) throw new CliError('--line-items must be a JSON array', 2)

    const result = await runMutation(ctx, {
      inventoryTransferSetItems: {
        __directives: { idempotent: { key: randomUUID() } },
        __args: { input: { id: transferId, lineItems } },
        inventoryTransfer: { id: true, status: true },
        updatedLineItems: { inventoryItemId: true, deltaQuantity: true, newQuantity: true },
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.inventoryTransferSetItems,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.inventoryTransferSetItems?.inventoryTransfer?.id ?? '')
    printJson(result.inventoryTransferSetItems, ctx.format !== 'raw')
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'location-id': { type: 'string' },
      },
    })
    const locationId = requireLocationId(args['location-id'])
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
    printConnection({
      connection,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: buildListNextPageArgs(
        'inventory',
        { first, query },
        [{ flag: '--location-id', value: locationId }],
      ),
    })
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

  const locationId = verb === 'move' ? undefined : requireLocationId(args['location-id'])
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

    const fromLocationId = requireLocationId(fromLocationIdRaw, '--from-location-id')
    const toLocationId = requireLocationId(toLocationIdRaw, '--to-location-id')

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
