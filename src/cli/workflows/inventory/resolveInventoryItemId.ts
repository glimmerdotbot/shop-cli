import { CliError } from '../../errors'
import { coerceGid } from '../../gid'
import { runQuery, type CommandContext } from '../../router'

export const resolveInventoryItemId = async ({
  ctx,
  inventoryItemId,
  variantId,
}: {
  ctx: CommandContext
  inventoryItemId?: string
  variantId?: string
}): Promise<string> => {
  if (inventoryItemId && variantId) {
    throw new CliError('Pass only one of --inventory-item-id or --variant-id', 2)
  }

  if (inventoryItemId) return coerceGid(inventoryItemId, 'InventoryItem')

  if (!variantId) {
    throw new CliError('Missing --inventory-item-id or --variant-id', 2)
  }

  if (ctx.dryRun) {
    throw new CliError(
      '--dry-run with --variant-id is not supported (pass --inventory-item-id instead)',
      2,
    )
  }

  const id = coerceGid(variantId, 'ProductVariant')
  const result = await runQuery(ctx, {
    productVariant: { __args: { id }, inventoryItem: { id: true } },
  })
  const inventoryItemGid = result?.productVariant?.inventoryItem?.id
  if (!inventoryItemGid) {
    throw new CliError(`Could not resolve inventory item for variant: ${variantId}`, 2)
  }
  return inventoryItemGid
}

