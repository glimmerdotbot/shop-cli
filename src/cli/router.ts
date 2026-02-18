import { parseArgs } from 'node:util'

import type { Client } from '../generated/admin-2026-04'
import { generateMutationOp, generateQueryOp } from '../generated/admin-2026-04'
import { GenqlError } from '../generated/admin-2026-04'

import { CliError } from './errors'
import { printJsonError, setGlobalOutputFormat, type OutputFormat } from './output'
import { getFields, getType } from './introspection'
import { printFieldsTable } from './introspection/format'
import { resourceToType } from './introspection/resources'
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
import { runCustomerPaymentMethods } from './verbs/customer-payment-methods'
import { runCustomerPrivacy } from './verbs/customer-privacy'
import { runCustomerSegments } from './verbs/customer-segments'
import { runCustomers } from './verbs/customers'
import { runDelegateTokens } from './verbs/delegate-tokens'
import { runDeliveryCustomizations } from './verbs/delivery-customizations'
import { runDeliveryProfiles } from './verbs/delivery-profiles'
import { runDraftOrders } from './verbs/draft-orders'
import { runEvents } from './verbs/events'
import { runFiles } from './verbs/files'
import { runFulfillmentServices } from './verbs/fulfillment-services'
import { runGiftCards } from './verbs/gift-cards'
import { runInventoryItems } from './verbs/inventory-items'
import { runInventoryShipments } from './verbs/inventory-shipments'
import { runInventoryTransfers } from './verbs/inventory-transfers'
import { runInventory } from './verbs/inventory'
import { runLocations } from './verbs/locations'
import { runOrderEdit } from './verbs/order-edit'
import { runMarketingActivities } from './verbs/marketing-activities'
import { runOrders } from './verbs/orders'
import { runFulfillmentOrders } from './verbs/fulfillment-orders'
import { runFulfillments } from './verbs/fulfillments'
import { runPaymentTerms } from './verbs/payment-terms'
import { runPriceLists } from './verbs/price-lists'
import { runProductVariants } from './verbs/product-variants'
import { runProducts } from './verbs/products'
import { runPublications } from './verbs/publications'
import { runMarkets } from './verbs/markets'
import { runMenus } from './verbs/menus'
import { runMetafieldDefinitions } from './verbs/metafield-definitions'
import { runMetaobjectDefinitions } from './verbs/metaobject-definitions'
import { runMetaobjects } from './verbs/metaobjects'
import { runPages } from './verbs/pages'
import { runRefunds } from './verbs/refunds'
import { runSavedSearches } from './verbs/saved-searches'
import { runSegments } from './verbs/segments'
import { runScriptTags } from './verbs/script-tags'
import { runSellingPlanGroups } from './verbs/selling-plan-groups'
import { runSubscriptionBilling } from './verbs/subscription-billing'
import { runSubscriptionContracts } from './verbs/subscription-contracts'
import { runSubscriptionDrafts } from './verbs/subscription-drafts'
import { runServerPixels } from './verbs/server-pixels'
import { runShopConfig } from './verbs/shop'
import { runShopifyFunctions } from './verbs/shopify-functions'
import { runStoreCredit } from './verbs/store-credit'
import { runThemes } from './verbs/themes'
import { runTranslations } from './verbs/translations'
import { runUrlRedirects } from './verbs/url-redirects'
import { runValidations } from './verbs/validations'
import { runWebPixels } from './verbs/web-pixels'
import { runWebhooks } from './verbs/webhooks'
import { runReturns } from './verbs/returns'
import { runAppBilling } from './verbs/app-billing'
import { runApps } from './verbs/apps'
import { runBackup } from './verbs/backup'
import { runChannels } from './verbs/channels'
import { runFileSavedSearches } from './verbs/file-saved-searches'
import { runGraphQL } from './verbs/graphql'
import { runLocales } from './verbs/locales'
import { runDiscountsAutomatic } from './verbs/discounts-automatic'
import { runDiscountsCode } from './verbs/discounts-code'
import { runAbandonedCheckouts } from './verbs/abandoned-checkouts'
import { runPaymentCustomizations } from './verbs/payment-customizations'
import { runTaxonomy } from './verbs/taxonomy'
import { runStaff } from './verbs/staff'
import { runMetafieldDefinitionTools } from './verbs/metafield-definition-tools'
import { runMetafields } from './verbs/metafields'
import { runMetaobjectDefinitionTools } from './verbs/metaobject-definition-tools'
import { runStorefrontAccessTokens } from './verbs/storefront-access-tokens'
import { runFulfillmentConstraintRules } from './verbs/fulfillment-constraint-rules'
import { runShopifyPayments } from './verbs/shopify-payments'
import { runBusinessEntities } from './verbs/business-entities'
import { runShopPolicies } from './verbs/shop-policies'
import { runCashTracking } from './verbs/cash-tracking'
import { runPointOfSale } from './verbs/point-of-sale'
import { runCustomerAccountPages } from './verbs/customer-account-pages'
import { runDeliveryPromises } from './verbs/delivery-promises'
import { runDisputes } from './verbs/disputes'
import { runFlow } from './verbs/flow'
import { runMobilePlatformApplications } from './verbs/mobile-platform-applications'
import { runShippingPackages } from './verbs/shipping-packages'
import { runShop } from './verbs/shop-utils'
import { runStagedUploads } from './verbs/staged-uploads'
import { runTags } from './verbs/tags'
import { runTax } from './verbs/tax'
import { runTypes } from './verbs/types'
import { runWebPresences } from './verbs/web-presences'

export type CliView = 'summary' | 'ids' | 'full' | 'raw' | 'all'

export type CommandContext = {
  client: Client
  format: OutputFormat
  quiet: boolean
  view: CliView
  dryRun: boolean
  failOnUserErrors: boolean
  warnMissingAccessToken: boolean
  // Raw GraphQL client options (for graphql command)
  shopDomain?: string
  graphqlEndpoint?: string
  accessToken?: string
  apiVersion?: string
  headers?: Record<string, string>
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
  shopDomain,
  graphqlEndpoint,
  accessToken,
  apiVersion,
  headers,
}: RunCommandArgs) => {
  setGlobalOutputFormat(format)
  const ctx: CommandContext = {
    client,
    format,
    quiet,
    view,
    dryRun,
    failOnUserErrors,
    warnMissingAccessToken,
    shopDomain,
    graphqlEndpoint,
    accessToken,
    apiVersion,
    headers,
  }

  if (verb === 'fields') {
    const typeName = resourceToType[resource]
    if (!typeName) {
      throw new CliError(`No field introspection available for resource: ${resource}`, 2)
    }

    const type = getType(typeName)
    if (!type) {
      throw new CliError(`Unknown GraphQL type for resource "${resource}": ${typeName}`, 2)
    }

    const fields = getFields(typeName)

    if (ctx.format === 'json' || ctx.format === 'raw' || ctx.format === 'jsonl') {
      const pretty = ctx.format === 'json'
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ resource, typeName, fields }, null, pretty ? 2 : 0))
      return
    }

    printFieldsTable({ resource, typeName, fields })
    return
  }

  if (resource === 'products') return runProducts({ ctx, verb, argv })
  if (resource === 'product-variants') return runProductVariants({ ctx, verb, argv })
  if (resource === 'collections') return runCollections({ ctx, verb, argv })
  if (resource === 'customers') return runCustomers({ ctx, verb, argv })
  if (resource === 'orders') return runOrders({ ctx, verb, argv })
  if (resource === 'order-edit') return runOrderEdit({ ctx, verb, argv })
  if (resource === 'inventory') return runInventory({ ctx, verb, argv })
  if (resource === 'abandoned-checkouts') return runAbandonedCheckouts({ ctx, verb, argv })
  if (resource === 'returns') return runReturns({ ctx, verb, argv })
  if (resource === 'fulfillment-orders') return runFulfillmentOrders({ ctx, verb, argv })
  if (resource === 'fulfillments') return runFulfillments({ ctx, verb, argv })
  if (resource === 'fulfillment-services') return runFulfillmentServices({ ctx, verb, argv })
  if (resource === 'fulfillment-constraint-rules') return runFulfillmentConstraintRules({ ctx, verb, argv })
  if (resource === 'inventory-items') return runInventoryItems({ ctx, verb, argv })
  if (resource === 'inventory-shipments') return runInventoryShipments({ ctx, verb, argv })
  if (resource === 'inventory-transfers') return runInventoryTransfers({ ctx, verb, argv })
  if (resource === 'files') return runFiles({ ctx, verb, argv })
  if (resource === 'locations') return runLocations({ ctx, verb, argv })
  if (resource === 'staff') return runStaff({ ctx, verb, argv })
  if (resource === 'storefront-access-tokens') return runStorefrontAccessTokens({ ctx, verb, argv })
  if (resource === 'gift-cards') return runGiftCards({ ctx, verb, argv })
  if (resource === 'discounts-automatic') return runDiscountsAutomatic({ ctx, verb, argv })
  if (resource === 'discounts-code') return runDiscountsCode({ ctx, verb, argv })
  if (resource === 'payment-customizations') return runPaymentCustomizations({ ctx, verb, argv })
  if (resource === 'price-lists') return runPriceLists({ ctx, verb, argv })
  if (resource === 'refunds') return runRefunds({ ctx, verb, argv })
  if (resource === 'payment-terms') return runPaymentTerms({ ctx, verb, argv })
  if (resource === 'taxonomy') return runTaxonomy({ ctx, verb, argv })
  if (resource === 'shopify-payments') return runShopifyPayments({ ctx, verb, argv })
  if (resource === 'business-entities') return runBusinessEntities({ ctx, verb, argv })
  if (resource === 'shop-policies') return runShopPolicies({ ctx, verb, argv })
  if (resource === 'cash-tracking') return runCashTracking({ ctx, verb, argv })
  if (resource === 'point-of-sale') return runPointOfSale({ ctx, verb, argv })
  if (resource === 'customer-account-pages') return runCustomerAccountPages({ ctx, verb, argv })
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
  if (resource === 'customer-privacy') return runCustomerPrivacy({ ctx, verb, argv })
  if (resource === 'customer-payment-methods') return runCustomerPaymentMethods({ ctx, verb, argv })
  if (resource === 'customer-segments') return runCustomerSegments({ ctx, verb, argv })
  if (resource === 'store-credit') return runStoreCredit({ ctx, verb, argv })
  if (resource === 'delegate-tokens') return runDelegateTokens({ ctx, verb, argv })
  if (resource === 'themes') return runThemes({ ctx, verb, argv })
  if (resource === 'cart-transforms') return runCartTransforms({ ctx, verb, argv })
  if (resource === 'validations') return runValidations({ ctx, verb, argv })
  if (resource === 'checkout-branding') return runCheckoutBranding({ ctx, verb, argv })
  if (resource === 'delivery-profiles') return runDeliveryProfiles({ ctx, verb, argv })
  if (resource === 'delivery-customizations') return runDeliveryCustomizations({ ctx, verb, argv })
  if (resource === 'delivery-promises') return runDeliveryPromises({ ctx, verb, argv })
  if (resource === 'shipping-packages') return runShippingPackages({ ctx, verb, argv })
  if (resource === 'mobile-platform-applications') return runMobilePlatformApplications({ ctx, verb, argv })
  if (resource === 'tax') return runTax({ ctx, verb, argv })
  if (resource === 'tags') return runTags({ ctx, verb, argv })
  if (resource === 'flow') return runFlow({ ctx, verb, argv })
  if (resource === 'disputes') return runDisputes({ ctx, verb, argv })
  if (resource === 'web-pixels') return runWebPixels({ ctx, verb, argv })
  if (resource === 'server-pixels') return runServerPixels({ ctx, verb, argv })
  if (resource === 'marketing-activities') return runMarketingActivities({ ctx, verb, argv })
  if (resource === 'bulk-operations') return runBulkOperations({ ctx, verb, argv })
  if (resource === 'app-billing') return runAppBilling({ ctx, verb, argv })
  if (resource === 'apps') return runApps({ ctx, verb, argv })
  if (resource === 'backup') return runBackup({ ctx, verb, argv })
  if (resource === 'channels') return runChannels({ ctx, verb, argv })
  if (resource === 'config') return runShopConfig({ ctx, verb, argv })
  if (resource === 'file-saved-searches') return runFileSavedSearches({ ctx, verb, argv })
  if (resource === 'locales') return runLocales({ ctx, verb, argv })
  if (resource === 'metafield-definition-tools') return runMetafieldDefinitionTools({ ctx, verb, argv })
  if (resource === 'metaobject-definition-tools') return runMetaobjectDefinitionTools({ ctx, verb, argv })
  if (resource === 'metafields') return runMetafields({ ctx, verb, argv })
  if (resource === 'shop') return runShop({ ctx, verb, argv })
  if (resource === 'staged-uploads') return runStagedUploads({ ctx, verb, argv })
  if (resource === 'web-presences') return runWebPresences({ ctx, verb, argv })
  if (resource === 'translations') return runTranslations({ ctx, verb, argv })
  if (resource === 'events') return runEvents({ ctx, verb, argv })
  if (resource === 'functions') return runShopifyFunctions({ ctx, verb, argv })
  if (resource === 'graphql') return runGraphQL({ ctx, verb, argv })
  if (resource === 'types') return runTypes({ verb, argv })

  throw new CliError(`Unknown resource: ${resource}`, 2)
}

const hasNotAuthorizedError = (err: GenqlError) =>
  err.errors.some(
    (error) =>
      typeof error?.message === 'string' &&
      error.message.toLowerCase().includes('not authorized'),
  )

type GraphqlErrorLike = {
  message?: string
  path?: Array<string | number>
  extensions?: Record<string, unknown>
}

const isAccessDeniedError = (error: GraphqlErrorLike) =>
  typeof (error as any)?.extensions?.code === 'string' && (error as any).extensions.code === 'ACCESS_DENIED'

const normalizeErrorPath = (path: unknown): string[] => {
  if (!Array.isArray(path)) return []
  return path.filter((p) => typeof p === 'string') as string[]
}

const hasAnySelectedFields = (selection: Record<string, unknown>) =>
  Object.keys(selection).some((k) => k !== '__args')

const deleteSelectionAtPath = (root: Record<string, any>, path: string[]): boolean => {
  if (path.length === 0) return false

  const stack: Array<{ parent: Record<string, any>; key: string; node: Record<string, any> }> = []
  let cursor: any = root

  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i]!
    const next = cursor?.[key]
    if (typeof next !== 'object' || next === null || Array.isArray(next)) return false
    stack.push({ parent: cursor, key, node: next })
    cursor = next
  }

  const leafKey = path[path.length - 1]!
  if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor)) return false
  if (!(leafKey in cursor)) return false

  delete cursor[leafKey]

  // If we deleted the only selected field(s) under some object selection, delete that object too.
  let child: Record<string, any> = cursor
  for (let i = stack.length - 1; i >= 0; i--) {
    if (hasAnySelectedFields(child)) break
    const { parent, key } = stack[i]!
    delete parent[key]
    child = parent
  }

  return true
}

const pruneAccessDeniedFields = (
  request: Record<string, any>,
  errors: GraphqlErrorLike[],
  pruned: Map<string, string | undefined>,
): boolean => {
  let changed = false

  for (const error of errors) {
    if (!isAccessDeniedError(error)) continue
    const path = normalizeErrorPath(error.path)
    if (path.length === 0) continue

    const removed = deleteSelectionAtPath(request, path)
    if (!removed) continue

    const requiredAccess = typeof (error as any)?.extensions?.requiredAccess === 'string'
      ? ((error as any).extensions.requiredAccess as string)
      : undefined

    pruned.set(path.join('.'), requiredAccess)
    changed = true
  }

  return changed
}

const runWithAccessDeniedPruning = async (
  ctx: CommandContext,
  request: any,
  op: 'query' | 'mutation',
): Promise<any> => {
  const pruned = new Map<string, string | undefined>()
  let lastGenqlError: GenqlError | undefined

  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const result =
        op === 'query' ? await ctx.client.query(request) : await ctx.client.mutation(request)

      if (!ctx.quiet && pruned.size > 0) {
        const details = Array.from(pruned.entries())
          .map(([path, requiredAccess]) =>
            requiredAccess ? `${path} (${requiredAccess})` : path,
          )
          .join(', ')
        console.error(`Omitted ${pruned.size} access-denied field(s): ${details}`)
      }

      return result
    } catch (err) {
      if (!(err instanceof GenqlError)) throw err
      lastGenqlError = err

      const changed = pruneAccessDeniedFields(request as any, err.errors as any, pruned)
      if (!changed) throw err

      if (typeof request !== 'object' || request === null || Object.keys(request).length === 0) {
        throw err
      }
    }
  }

  if (lastGenqlError) throw lastGenqlError
  throw new Error('Internal error: pruning retry loop exhausted without an error')
}

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
      include: { type: 'string', multiple: true },
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
    if (ctx.view === 'all') return await runWithAccessDeniedPruning(ctx, request, 'query')
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
    if (ctx.view === 'all') return await runWithAccessDeniedPruning(ctx, request, 'mutation')
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
