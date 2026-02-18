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
  verbose?: boolean
}

const normalizeShopDomain = (shopDomain: string) => {
  let normalized = shopDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '')
  if (!normalized.endsWith('.myshopify.com')) {
    normalized = `${normalized}.myshopify.com`
  }
  return normalized
}

const resolveGraphqlEndpoint = ({
  graphqlEndpoint,
  shopDomain,
  apiVersion,
}: {
  graphqlEndpoint?: string
  shopDomain?: string
  apiVersion?: ShopifyAdminApiVersion
}) => {
  if (graphqlEndpoint) return graphqlEndpoint
  if (!shopDomain) {
    throw new Error(
      'Missing shop domain: pass --shop, set SHOPIFY_SHOP, or set GRAPHQL_ENDPOINT',
    )
  }
  const normalizedShopDomain = normalizeShopDomain(shopDomain)
  if (apiVersion) {
    return `https://${normalizedShopDomain}/admin/api/${apiVersion}/graphql.json`
  }
  return `https://${normalizedShopDomain}/admin/api/graphql.json`
}

export const createShopifyAdminClient = ({
  shopDomain,
  graphqlEndpoint,
  accessToken,
  apiVersion,
  fetch: _fetch,
  headers,
  verbose,
}: CreateShopifyAdminClientOptions): Client => {
  const url = resolveGraphqlEndpoint({ graphqlEndpoint, shopDomain, apiVersion })
  const fetchImpl = _fetch ?? fetch

  const resolvedHeaders = () => ({
    'Content-Type': 'application/json',
    ...(accessToken ? { 'X-Shopify-Access-Token': accessToken } : {}),
    ...(headers ?? {}),
  })

  if (verbose) {
    return createClient({
      url,
      fetcher: async (body) => {
        const headersObj = resolvedHeaders()
        console.error(`POST ${url}`)
        console.error('Headers:')
        for (const [name, value] of Object.entries(headersObj)) {
          console.error(`  ${name}: ${value}`)
        }
        console.error('Body:')
        console.error(JSON.stringify(body, null, 2))
        console.error('')

        const res = await fetchImpl(url, {
          method: 'POST',
          headers: headersObj,
          body: JSON.stringify(body),
        })

        if (!res.ok) {
          throw new Error(`${res.statusText}: ${await res.text()}`)
        }
        return res.json()
      },
    })
  }

  return createClient({
    url,
    fetch: fetchImpl,
    headers: resolvedHeaders,
  })
}

export type RawGraphQLClient = {
  request: (req: RawGraphQLRequest) => Promise<RawGraphQLResponse>
}

export const createRawGraphQLClient = ({
  shopDomain,
  graphqlEndpoint,
  accessToken,
  apiVersion,
  fetch: _fetch,
  headers,
  verbose,
}: CreateShopifyAdminClientOptions): RawGraphQLClient => {
  const url = resolveGraphqlEndpoint({ graphqlEndpoint, shopDomain, apiVersion })
  const fetchImpl = _fetch ?? fetch

  return {
    request: async (req: RawGraphQLRequest): Promise<RawGraphQLResponse> => {
      const reqHeaders = {
        'Content-Type': 'application/json',
        ...(accessToken ? { 'X-Shopify-Access-Token': accessToken } : {}),
        ...(headers ?? {}),
      }

      if (verbose) {
        console.error(`POST ${url}`)
        console.error('Headers:')
        for (const [name, value] of Object.entries(reqHeaders)) {
          console.error(`  ${name}: ${value}`)
        }
        console.error('Body:')
        console.error(JSON.stringify(req, null, 2))
        console.error('')
      }

      const res = await fetchImpl(url, {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify(req),
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`)
      }

      return res.json() as Promise<RawGraphQLResponse>
    },
  }
}
