import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { CommandContext } from '../cli/router'
import { runDraftOrders } from '../cli/verbs/draft-orders'
import { runMarkets } from '../cli/verbs/markets'
import { runMetaobjects } from '../cli/verbs/metaobjects'
import { runSellingPlanGroups } from '../cli/verbs/selling-plan-groups'
import { runThemes } from '../cli/verbs/themes'
import { runUrlRedirects } from '../cli/verbs/url-redirects'

const makeCtx = ({
  quiet = false,
  view = 'summary',
  format = 'json',
  query,
  mutation,
}: {
  quiet?: boolean
  view?: CommandContext['view']
  format?: CommandContext['format']
  query?: (request: any) => Promise<any>
  mutation?: (request: any) => Promise<any>
}): CommandContext =>
  ({
    client: {
      query: query ?? (async () => ({})),
      mutation: mutation ?? (async () => ({})),
    },
    format,
    quiet,
    view,
    dryRun: false,
    failOnUserErrors: true,
    warnMissingAccessToken: false,
  }) as any

describe('return-value-audit-discounts-and-misc', () => {
  const originalWrite = process.stdout.write.bind(process.stdout)
  const originalLog = console.log
  let stdout = ''

  beforeEach(() => {
    stdout = ''
    ;(process.stdout as any).write = (chunk: unknown) => {
      stdout += typeof chunk === 'string' ? chunk : Buffer.from(chunk as any).toString('utf8')
      return true
    }
    ;(console as any).log = (...args: unknown[]) => {
      stdout += args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ') + '\n'
    }
  })

  afterEach(() => {
    ;(process.stdout as any).write = originalWrite
    ;(console as any).log = originalLog
  })

  it('selling-plan-groups remove-variants --quiet prints group id', async () => {
    const ctx = makeCtx({
      quiet: true,
      mutation: async () => ({
        sellingPlanGroupRemoveProductVariants: { removedProductVariantIds: ['gid://shopify/ProductVariant/2'], userErrors: [] },
      }),
      query: async () => {
        throw new Error('unexpected query')
      },
    })

    await runSellingPlanGroups({
      ctx,
      verb: 'remove-variants',
      argv: ['--id', 'gid://shopify/SellingPlanGroup/1', '--variant-ids', 'gid://shopify/ProductVariant/2'],
    })

    expect(stdout).toBe('gid://shopify/SellingPlanGroup/1\n')
  })

  it('themes files-delete --quiet prints deleted filenames', async () => {
    const ctx = makeCtx({
      quiet: true,
      mutation: async () => ({
        themeFilesDelete: {
          deletedThemeFiles: [{ filename: 'assets/a.liquid' }, { filename: 'assets/b.liquid' }],
          userErrors: [],
        },
      }),
    })

    await runThemes({
      ctx,
      verb: 'files-delete',
      argv: ['--id', 'gid://shopify/OnlineStoreTheme/1', '--files', 'assets/a.liquid,assets/b.liquid'],
    })

    expect(stdout).toBe('assets/a.liquid\nassets/b.liquid\n')
  })

  it('url-redirects import-submit --quiet prints import id (not job id)', async () => {
    const ctx = makeCtx({
      quiet: true,
      mutation: async () => ({
        urlRedirectImportSubmit: { job: { id: 'gid://shopify/Job/9', done: false }, userErrors: [] },
      }),
      query: async () => {
        throw new Error('unexpected query')
      },
    })

    await runUrlRedirects({
      ctx,
      verb: 'import-submit',
      argv: ['--id', 'gid://shopify/UrlRedirectImport/1'],
    })

    expect(stdout).toBe('gid://shopify/UrlRedirectImport/1\n')
  })

  it('url-redirects import-submit returns urlRedirectImport (and job) in normal mode', async () => {
    const ctx = makeCtx({
      quiet: false,
      view: 'summary',
      mutation: async () => ({
        urlRedirectImportSubmit: { job: { id: 'gid://shopify/Job/9', done: false }, userErrors: [] },
      }),
      query: async () => ({
        urlRedirectImport: {
          id: 'gid://shopify/UrlRedirectImport/1',
          finished: false,
          count: 0,
          createdCount: 0,
          updatedCount: 0,
          failedCount: 0,
        },
      }),
    })

    await runUrlRedirects({
      ctx,
      verb: 'import-submit',
      argv: ['--id', 'gid://shopify/UrlRedirectImport/1'],
    })

    const parsed = JSON.parse(stdout)
    expect(parsed.urlRedirectImport?.id).toBe('gid://shopify/UrlRedirectImport/1')
    expect(parsed.job?.id).toBe('gid://shopify/Job/9')
  })

  it('metaobjects bulk-delete includes requestedCount for --ids', async () => {
    const ctx = makeCtx({
      quiet: false,
      mutation: async () => ({
        metaobjectBulkDelete: { job: { id: 'gid://shopify/Job/1', done: false }, userErrors: [] },
      }),
      query: async () => {
        throw new Error('unexpected query')
      },
    })

    await runMetaobjects({
      ctx,
      verb: 'bulk-delete',
      argv: ['--yes', '--ids', 'gid://shopify/Metaobject/1', '--ids', 'gid://shopify/Metaobject/2'],
    })

    const parsed = JSON.parse(stdout)
    expect(parsed.requestedCount).toBe(2)
    expect(parsed.where?.ids?.length).toBe(2)
    expect(parsed.job?.id).toBe('gid://shopify/Job/1')
  })

  it('draft-orders calculate requests a full calculatedDraftOrder summary', async () => {
    const capture: { request?: any } = {}
    const ctx = makeCtx({
      quiet: false,
      mutation: async (request) => {
        capture.request = request
        return { draftOrderCalculate: { calculatedDraftOrder: null, userErrors: [] } }
      },
    })

    await runDraftOrders({
      ctx,
      verb: 'calculate',
      argv: ['--input', '{"lineItems":[{"quantity":1}]}'],
    })

    expect(capture.request?.draftOrderCalculate?.calculatedDraftOrder?.totalPriceSet).toBeTruthy()
    expect(capture.request?.draftOrderCalculate?.calculatedDraftOrder?.lineItems).toBeTruthy()
    expect(capture.request?.draftOrderCalculate?.calculatedDraftOrder?.taxLines).toBeTruthy()
  })

  it('markets regions-create returns created region objects (matched by code)', async () => {
    const ctx = makeCtx({
      quiet: false,
      mutation: async () => ({
        marketRegionsCreate: { market: { id: 'gid://shopify/Market/1' }, userErrors: [] },
      }),
      query: async () => ({
        market: {
          conditions: {
            regionsCondition: {
              applicationLevel: 'ALL',
              regions: {
                nodes: [
                  { id: 'gid://shopify/MarketRegionCountry/US', code: 'US', name: 'United States' },
                  { id: 'gid://shopify/MarketRegionCountry/CA', code: 'CA', name: 'Canada' },
                ],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        },
      }),
    })

    await runMarkets({
      ctx,
      verb: 'regions-create',
      argv: ['--id', 'gid://shopify/Market/1', '--country-codes', 'US'],
    })

    const parsed = JSON.parse(stdout)
    expect(parsed.regions).toHaveLength(1)
    expect(parsed.regions[0].code).toBe('US')
    expect(parsed.regions[0].id).toBe('gid://shopify/MarketRegionCountry/US')
  })
})
