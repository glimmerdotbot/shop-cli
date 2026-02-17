import { CliError } from './errors'

export type ShopifyGidType =
  | 'Product'
  | 'Collection'
  | 'Customer'
  | 'Order'
  | 'ProductVariant'
  | 'InventoryItem'
  | 'Location'
  | 'File'

export const isGid = (value: string) => value.startsWith('gid://')

export const coerceGid = (value: string, type: ShopifyGidType) => {
  if (isGid(value)) return value
  if (!/^\d+$/.test(value)) {
    throw new CliError(
      `Expected a numeric ID or full GID for ${type}. Got: ${value}`,
      2,
    )
  }
  return `gid://shopify/${type}/${value}`
}
