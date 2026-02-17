import { randomUUID } from 'node:crypto'

import { CliError } from '../errors'
import { coerceGid } from '../gid'
import { parseStandardArgs, runMutation, type CommandContext } from '../router'
import { maybeFailOnUserErrors } from '../userErrors'
import { resolveInventoryItemId } from '../workflows/inventory/resolveInventoryItemId'
import { printJson } from '../output'

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
  locationId,
}: {
  inventoryItemId: string
  locationId: string
}) => ({
  id: true,
  reason: true,
  createdAt: true,
  referenceDocumentUri: true,
  changes: {
    __args: {
      inventoryItemIds: [inventoryItemId],
      locationIds: [locationId],
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
  if (verb !== 'set' && verb !== 'adjust') {
    throw new CliError(`Unknown verb for inventory: ${verb}`, 2)
  }

  const args = parseStandardArgs({
    argv,
    extraOptions: {
      'inventory-item-id': { type: 'string' },
      'variant-id': { type: 'string' },
      'location-id': { type: 'string' },
      available: { type: 'string' },
      delta: { type: 'string' },
      reason: { type: 'string' },
      'reference-document-uri': { type: 'string' },
    },
  })

  const locationId = requireLocationId(args['location-id'] as any)
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
                locationId,
                quantity: available,
                changeFromQuantity: null,
              },
            ],
          },
        },
        inventoryAdjustmentGroup: inventoryAdjustmentGroupSelection({
          inventoryItemId,
          locationId,
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
                locationId,
                delta,
                changeFromQuantity: null,
              },
            ],
          },
        },
        inventoryAdjustmentGroup: inventoryAdjustmentGroupSelection({
          inventoryItemId,
          locationId,
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
}

