import { createClient, type Client } from './generated/admin-2026-04'
export { GenqlError } from './generated/admin-2026-04'

export type ShopifyAdminApiVersion = '2026-04' | (string & {})

export type RawGraphQLRequest = {
  query: string
  variables?: Record<string, unknown>
  operationName?: string
}

export type RawGraphQLResponse = {
  data?: unknown
  errors?: Array<{ message: string; locations?: Array<{ line: number; column: number }>; path?: Array<string | number> }>
  extensions?: unknown
}

export type CreateShopifyAdminClientOptions = {
  shopDomain?: string
  graphqlEndpoint?: string
  accessToken?: string
  apiVersion?: ShopifyAdminApiVersion
  fetch?: typeof fetch
  headers?: Record<string, string>
}

const normalizeShopDomain = (shopDomain: string) => {
  return shopDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '')
}

const resolveGraphqlEndpoint = ({
  graphqlEndpoint,
  shopDomain,
  apiVersion,
}: {
  graphqlEndpoint?: string
  shopDomain?: string
  apiVersion: ShopifyAdminApiVersion
}) => {
  if (graphqlEndpoint) return graphqlEndpoint
  if (!shopDomain) {
    throw new Error(
      'Missing shop domain: pass --shop-domain, set SHOP_DOMAIN (or SHOPIFY_SHOP), or set GRAPHQL_ENDPOINT',
    )
  }
  const normalizedShopDomain = normalizeShopDomain(shopDomain)
  return `https://${normalizedShopDomain}/admin/api/${apiVersion}/graphql.json`
}

export const createShopifyAdminClient = ({
  shopDomain,
  graphqlEndpoint,
  accessToken,
  apiVersion = '2026-04',
  fetch,
  headers,
}: CreateShopifyAdminClientOptions): Client => {
  const url = resolveGraphqlEndpoint({ graphqlEndpoint, shopDomain, apiVersion })

  return createClient({
    url,
    fetch,
    headers: () => ({
      ...(accessToken ? { 'X-Shopify-Access-Token': accessToken } : {}),
      ...(headers ?? {}),
    }),
  })
}

export type RawGraphQLClient = {
  request: (req: RawGraphQLRequest) => Promise<RawGraphQLResponse>
}

export const createRawGraphQLClient = ({
  shopDomain,
  graphqlEndpoint,
  accessToken,
  apiVersion = '2026-04',
  fetch: _fetch,
  headers,
}: CreateShopifyAdminClientOptions): RawGraphQLClient => {
  const url = resolveGraphqlEndpoint({ graphqlEndpoint, shopDomain, apiVersion })
  const fetchImpl = _fetch ?? fetch

  return {
    request: async (req: RawGraphQLRequest): Promise<RawGraphQLResponse> => {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { 'X-Shopify-Access-Token': accessToken } : {}),
          ...(headers ?? {}),
        },
        body: JSON.stringify(req),
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`)
      }

      return res.json() as Promise<RawGraphQLResponse>
    },
  }
}
