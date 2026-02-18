import { createShopifyAdminClient, type ShopifyAdminApiVersion } from '../adminClient'

export type CliClientOptions = {
  shopDomain?: string
  graphqlEndpoint?: string
  accessToken?: string
  apiVersion?: ShopifyAdminApiVersion
  headers?: Record<string, string>
}

export const createCliClientFromEnv = ({
  shopDomain,
  graphqlEndpoint,
  accessToken,
  apiVersion,
  headers,
}: CliClientOptions) => {
  const resolvedGraphqlEndpoint = graphqlEndpoint ?? process.env.GRAPHQL_ENDPOINT
  const resolvedShopDomain =
    shopDomain ?? process.env.SHOP_DOMAIN ?? process.env.SHOPIFY_SHOP
  const resolvedAccessToken = accessToken ?? process.env.SHOPIFY_ACCESS_TOKEN

  if (!resolvedGraphqlEndpoint && !resolvedShopDomain) {
    throw new Error(
      'Missing shop domain: pass --shop-domain, set SHOP_DOMAIN (or SHOPIFY_SHOP), or set GRAPHQL_ENDPOINT',
    )
  }

  return createShopifyAdminClient({
    shopDomain: resolvedShopDomain,
    graphqlEndpoint: resolvedGraphqlEndpoint,
    accessToken: resolvedAccessToken,
    apiVersion: apiVersion ?? '2026-04',
    headers,
  })
}
