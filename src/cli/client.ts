import { createShopifyAdminClient, type ShopifyAdminApiVersion } from '../adminClient'

export type CliClientOptions = {
  shopDomain?: string
  graphqlEndpoint?: string
  accessToken?: string
  apiVersion?: ShopifyAdminApiVersion
  headers?: Record<string, string>
  verbose?: boolean
}

export const createCliClientFromEnv = ({
  shopDomain,
  graphqlEndpoint,
  accessToken,
  apiVersion,
  headers,
  verbose,
}: CliClientOptions) => {
  const resolvedGraphqlEndpoint = graphqlEndpoint ?? process.env.GRAPHQL_ENDPOINT
  const resolvedShopDomain = shopDomain ?? process.env.SHOPIFY_SHOP
  const resolvedAccessToken = accessToken ?? process.env.SHOPIFY_ACCESS_TOKEN
  const resolvedApiVersionRaw = apiVersion ?? process.env.SHOPIFY_API_VERSION
  const resolvedApiVersion =
    typeof resolvedApiVersionRaw === 'string' && resolvedApiVersionRaw.trim().length > 0
      ? (resolvedApiVersionRaw.trim() as ShopifyAdminApiVersion)
      : '2026-04'

  if (!resolvedGraphqlEndpoint && !resolvedShopDomain) {
    throw new Error(
      'Missing shop domain: pass --shop, set SHOPIFY_SHOP, or set GRAPHQL_ENDPOINT',
    )
  }

  return createShopifyAdminClient({
    shopDomain: resolvedShopDomain,
    graphqlEndpoint: resolvedGraphqlEndpoint,
    accessToken: resolvedAccessToken,
    apiVersion: resolvedApiVersion,
    headers,
    verbose,
  })
}
