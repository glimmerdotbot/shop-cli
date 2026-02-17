import { createClient, type Client } from './generated/admin-2026-04'
export { GenqlError } from './generated/admin-2026-04'

export type ShopifyAdminApiVersion = '2026-04' | (string & {})

export type CreateShopifyAdminClientOptions = {
  shopDomain: string
  accessToken: string
  apiVersion?: ShopifyAdminApiVersion
  fetch?: typeof fetch
}

const normalizeShopDomain = (shopDomain: string) => {
  return shopDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '')
}

export const createShopifyAdminClient = ({
  shopDomain,
  accessToken,
  apiVersion = '2026-04',
  fetch,
}: CreateShopifyAdminClientOptions): Client => {
  const normalizedShopDomain = normalizeShopDomain(shopDomain)
  const url = `https://${normalizedShopDomain}/admin/api/${apiVersion}/graphql.json`

  return createClient({
    url,
    fetch,
    headers: () => ({
      'X-Shopify-Access-Token': accessToken,
    }),
  })
}
