import { parseArgs } from 'node:util'

import type { Client } from '../generated/admin-2026-04'
import { generateMutationOp, generateQueryOp } from '../generated/admin-2026-04'
import { GenqlError } from '../generated/admin-2026-04'

import { CliError } from './errors'
import { printJsonError } from './output'
import { runArticles } from './verbs/articles'
import { runBlogs } from './verbs/blogs'
import { runBulkOperations } from './verbs/bulk-operations'
import { runCarrierServices } from './verbs/carrier-services'
import { runCartTransforms } from './verbs/cart-transforms'
import { runCatalogs } from './verbs/catalogs'
import { runCheckoutBranding } from './verbs/checkout-branding'
import { runCollections } from './verbs/collections'
import { runComments } from './verbs/comments'
import { runCompanies } from './verbs/companies'
import { runCompanyContacts } from './verbs/company-contacts'
import { runCompanyLocations } from './verbs/company-locations'
import { runCustomers } from './verbs/customers'
import { runDelegateTokens } from './verbs/delegate-tokens'
import { runDeliveryCustomizations } from './verbs/delivery-customizations'
import { runDeliveryProfiles } from './verbs/delivery-profiles'
import { runDraftOrders } from './verbs/draftOrders'
import { runEvents } from './verbs/events'
import { runFiles } from './verbs/files'
import { runInventoryItems } from './verbs/inventory-items'
import { runInventoryShipments } from './verbs/inventory-shipments'
import { runInventory } from './verbs/inventory'
import { runOrderEdit } from './verbs/order-edit'
import { runMarketingActivities } from './verbs/marketing-activities'
import { runOrders } from './verbs/orders'
import { runFulfillmentOrders } from './verbs/fulfillment-orders'
import { runFulfillments } from './verbs/fulfillments'
import { runProductVariants } from './verbs/product-variants'
import { runProducts } from './verbs/products'
import { runPublications } from './verbs/publications'
import { runMarkets } from './verbs/markets'
import { runMenus } from './verbs/menus'
import { runMetafieldDefinitions } from './verbs/metafieldDefinitions'
import { runMetaobjectDefinitions } from './verbs/metaobjectDefinitions'
import { runMetaobjects } from './verbs/metaobjects'
import { runPages } from './verbs/pages'
import { runSavedSearches } from './verbs/saved-searches'
import { runSegments } from './verbs/segments'
import { runScriptTags } from './verbs/script-tags'
import { runSellingPlanGroups } from './verbs/sellingPlanGroups'
import { runSubscriptionBilling } from './verbs/subscription-billing'
import { runSubscriptionContracts } from './verbs/subscription-contracts'
import { runSubscriptionDrafts } from './verbs/subscription-drafts'
import { runServerPixels } from './verbs/server-pixels'
import { runShopConfig } from './verbs/shop'
import { runShopifyFunctions } from './verbs/shopify-functions'
import { runStoreCredit } from './verbs/store-credit'
import { runThemes } from './verbs/themes'
import { runTranslations } from './verbs/translations'
import { runUrlRedirects } from './verbs/urlRedirects'
import { runValidations } from './verbs/validations'
import { runWebPixels } from './verbs/web-pixels'
import { runWebhooks } from './verbs/webhooks'
import { runReturns } from './verbs/returns'
import { runAppBilling } from './verbs/app-billing'

export type CliView = 'summary' | 'ids' | 'full' | 'raw'

export type CommandContext = {
  client: Client
  format: 'json' | 'table' | 'raw'
  quiet: boolean
  view: CliView
  dryRun: boolean
  failOnUserErrors: boolean
  warnMissingAccessToken: boolean
}

export type RunCommandArgs = CommandContext & {
  resource: string
  verb: string
  argv: string[]
}

export const runCommand = async ({
  client,
  resource,
  verb,
  argv,
  format,
  quiet,
  view,
  dryRun,
  failOnUserErrors,
  warnMissingAccessToken,
}: RunCommandArgs) => {
  const ctx: CommandContext = {
    client,
    format,
    quiet,
    view,
    dryRun,
    failOnUserErrors,
    warnMissingAccessToken,
  }

  if (resource === 'products') return runProducts({ ctx, verb, argv })
  if (resource === 'product-variants') return runProductVariants({ ctx, verb, argv })
  if (resource === 'collections') return runCollections({ ctx, verb, argv })
  if (resource === 'customers') return runCustomers({ ctx, verb, argv })
  if (resource === 'orders') return runOrders({ ctx, verb, argv })
  if (resource === 'order-edit') return runOrderEdit({ ctx, verb, argv })
  if (resource === 'inventory') return runInventory({ ctx, verb, argv })
  if (resource === 'returns') return runReturns({ ctx, verb, argv })
  if (resource === 'fulfillment-orders') return runFulfillmentOrders({ ctx, verb, argv })
  if (resource === 'fulfillments') return runFulfillments({ ctx, verb, argv })
  if (resource === 'inventory-items') return runInventoryItems({ ctx, verb, argv })
  if (resource === 'inventory-shipments') return runInventoryShipments({ ctx, verb, argv })
  if (resource === 'files') return runFiles({ ctx, verb, argv })
  if (resource === 'publications') return runPublications({ ctx, verb, argv })
  if (resource === 'articles') return runArticles({ ctx, verb, argv })
  if (resource === 'blogs') return runBlogs({ ctx, verb, argv })
  if (resource === 'pages') return runPages({ ctx, verb, argv })
  if (resource === 'comments') return runComments({ ctx, verb, argv })
  if (resource === 'menus') return runMenus({ ctx, verb, argv })
  if (resource === 'catalogs') return runCatalogs({ ctx, verb, argv })
  if (resource === 'markets') return runMarkets({ ctx, verb, argv })
  if (resource === 'draft-orders') return runDraftOrders({ ctx, verb, argv })
  if (resource === 'url-redirects') return runUrlRedirects({ ctx, verb, argv })
  if (resource === 'segments') return runSegments({ ctx, verb, argv })
  if (resource === 'saved-searches') return runSavedSearches({ ctx, verb, argv })
  if (resource === 'script-tags') return runScriptTags({ ctx, verb, argv })
  if (resource === 'carrier-services') return runCarrierServices({ ctx, verb, argv })
  if (resource === 'webhooks') return runWebhooks({ ctx, verb, argv })
  if (resource === 'subscription-contracts') return runSubscriptionContracts({ ctx, verb, argv })
  if (resource === 'subscription-billing') return runSubscriptionBilling({ ctx, verb, argv })
  if (resource === 'subscription-drafts') return runSubscriptionDrafts({ ctx, verb, argv })
  if (resource === 'metafield-definitions') return runMetafieldDefinitions({ ctx, verb, argv })
  if (resource === 'metaobjects') return runMetaobjects({ ctx, verb, argv })
  if (resource === 'metaobject-definitions') return runMetaobjectDefinitions({ ctx, verb, argv })
  if (resource === 'selling-plan-groups') return runSellingPlanGroups({ ctx, verb, argv })
  if (resource === 'companies') return runCompanies({ ctx, verb, argv })
  if (resource === 'company-contacts') return runCompanyContacts({ ctx, verb, argv })
  if (resource === 'company-locations') return runCompanyLocations({ ctx, verb, argv })
  if (resource === 'store-credit') return runStoreCredit({ ctx, verb, argv })
  if (resource === 'delegate-tokens') return runDelegateTokens({ ctx, verb, argv })
  if (resource === 'themes') return runThemes({ ctx, verb, argv })
  if (resource === 'cart-transforms') return runCartTransforms({ ctx, verb, argv })
  if (resource === 'validations') return runValidations({ ctx, verb, argv })
  if (resource === 'checkout-branding') return runCheckoutBranding({ ctx, verb, argv })
  if (resource === 'delivery-profiles') return runDeliveryProfiles({ ctx, verb, argv })
  if (resource === 'delivery-customizations') return runDeliveryCustomizations({ ctx, verb, argv })
  if (resource === 'web-pixels') return runWebPixels({ ctx, verb, argv })
  if (resource === 'server-pixels') return runServerPixels({ ctx, verb, argv })
  if (resource === 'marketing-activities') return runMarketingActivities({ ctx, verb, argv })
  if (resource === 'bulk-operations') return runBulkOperations({ ctx, verb, argv })
  if (resource === 'app-billing') return runAppBilling({ ctx, verb, argv })
  if (resource === 'config') return runShopConfig({ ctx, verb, argv })
  if (resource === 'translations') return runTranslations({ ctx, verb, argv })
  if (resource === 'events') return runEvents({ ctx, verb, argv })
  if (resource === 'functions') return runShopifyFunctions({ ctx, verb, argv })

  throw new CliError(`Unknown resource: ${resource}`, 2)
}

const hasNotAuthorizedError = (err: GenqlError) =>
  err.errors.some(
    (error) =>
      typeof error?.message === 'string' &&
      error.message.toLowerCase().includes('not authorized'),
  )

export const parseStandardArgs = ({
  argv,
  extraOptions,
}: {
  argv: string[]
  extraOptions: Record<string, any>
}): any => {
  const parsed = parseArgs({
    args: argv,
    allowPositionals: false,
    options: {
      ...extraOptions,
      input: { type: 'string' },
      set: { type: 'string', multiple: true },
      'set-json': { type: 'string', multiple: true },
      select: { type: 'string', multiple: true },
      selection: { type: 'string' },
      id: { type: 'string' },
      ids: { type: 'string', multiple: true },
      yes: { type: 'boolean' },
      help: { type: 'boolean' },
      h: { type: 'boolean' },
      query: { type: 'string' },
      first: { type: 'string' },
      after: { type: 'string' },
      sort: { type: 'string' },
      reverse: { type: 'boolean' },
      type: { type: 'string' },
      key: { type: 'string' },
      namespace: { type: 'string' },
      topic: { type: 'string' },
      'owner-type': { type: 'string' },
      'order-id': { type: 'string' },
      'variant-ids': { type: 'string', multiple: true },
      tags: { type: 'string' },
      status: { type: 'string' },
      'new-title': { type: 'string' },
    },
  })
  return parsed.values
}

export const runQuery = async (ctx: CommandContext, request: any): Promise<any> => {
  if (ctx.dryRun) {
    // dry-run output is always a stable JSON payload
    // (format/quiet are handled by the command wrapper, not by the request generator)
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(generateQueryOp(request), null, 2))
    return undefined
  }
  try {
    return await ctx.client.query(request)
  } catch (err) {
    if (err instanceof GenqlError) {
      if (ctx.warnMissingAccessToken && hasNotAuthorizedError(err)) {
        console.error('SHOPIFY_ACCESS_TOKEN not set')
      }
      printJsonError({ errors: err.errors, data: err.data })
      throw new CliError('GraphQL query failed', 1)
    }
    throw err
  }
}

export const runMutation = async (ctx: CommandContext, request: any): Promise<any> => {
  if (ctx.dryRun) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(generateMutationOp(request), null, 2))
    return undefined
  }
  try {
    return await ctx.client.mutation(request)
  } catch (err) {
    if (err instanceof GenqlError) {
      if (ctx.warnMissingAccessToken && hasNotAuthorizedError(err)) {
        console.error('SHOPIFY_ACCESS_TOKEN not set')
      }
      printJsonError({ errors: err.errors, data: err.data })
      throw new CliError('GraphQL mutation failed', 1)
    }
    throw err
  }
}
