import { createShopifyAdminClient, type ShopifyAdminApiVersion } from '../adminClient'

export type CliClientOptions = {
  shopDomain?: string
  accessToken?: string
  apiVersion?: ShopifyAdminApiVersion
}

export const createCliClientFromEnv = ({
  shopDomain,
  accessToken,
  apiVersion,
}: CliClientOptions) => {
  const resolvedShopDomain =
    shopDomain ?? process.env.SHOP_DOMAIN ?? process.env.SHOPIFY_SHOP
  const resolvedAccessToken = accessToken ?? process.env.SHOPIFY_ACCESS_TOKEN

  if (!resolvedShopDomain) {
    throw new Error(
      'Missing shop domain: pass --shop-domain or set SHOP_DOMAIN (or SHOPIFY_SHOP)',
    )
  }
  if (!resolvedAccessToken) {
    throw new Error(
      'Missing access token: pass --access-token or set SHOPIFY_ACCESS_TOKEN',
    )
  }

  return createShopifyAdminClient({
    shopDomain: resolvedShopDomain,
    accessToken: resolvedAccessToken,
    apiVersion: apiVersion ?? '2026-04',
  })
}

