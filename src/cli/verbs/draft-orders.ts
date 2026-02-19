import { CliError } from '../errors'
import { coerceGid } from '../gid'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { buildListNextPageArgs, parseCsv, parseFirst, parseIds, requireId } from './_shared'

const draftOrderSummarySelection = {
  id: true,
  status: true,
  email: true,
  createdAt: true,
  updatedAt: true,
  tags: true,
} as const

const draftOrderFullSelection = {
  ...draftOrderSummarySelection,
  completedAt: true,
  invoiceSentAt: true,
  currencyCode: true,
} as const

const calculatedDraftOrderSummarySelection = {
  currencyCode: true,
  presentmentCurrencyCode: true,
  taxesIncluded: true,
  discountCodes: true,
  appliedDiscount: {
    title: true,
    description: true,
    value: true,
    valueType: true,
    amountSet: { shopMoney: { amount: true, currencyCode: true } },
  },
  lineItemsSubtotalPrice: { shopMoney: { amount: true, currencyCode: true } },
  subtotalPriceSet: { shopMoney: { amount: true, currencyCode: true } },
  totalLineItemsPriceSet: { shopMoney: { amount: true, currencyCode: true } },
  totalDiscountsSet: { shopMoney: { amount: true, currencyCode: true } },
  totalShippingPriceSet: { shopMoney: { amount: true, currencyCode: true } },
  totalTaxSet: { shopMoney: { amount: true, currencyCode: true } },
  totalPriceSet: { shopMoney: { amount: true, currencyCode: true } },
  shippingLine: {
    title: true,
    originalPriceSet: { shopMoney: { amount: true, currencyCode: true } },
    discountedPriceSet: { shopMoney: { amount: true, currencyCode: true } },
  },
  taxLines: {
    title: true,
    ratePercentage: true,
    priceSet: { shopMoney: { amount: true, currencyCode: true } },
  },
  lineItems: {
    uuid: true,
    title: true,
    name: true,
    quantity: true,
    sku: true,
    requiresShipping: true,
    taxable: true,
    isGiftCard: true,
    originalUnitPriceSet: { shopMoney: { amount: true, currencyCode: true } },
    approximateDiscountedUnitPriceSet: { shopMoney: { amount: true, currencyCode: true } },
    originalTotalSet: { shopMoney: { amount: true, currencyCode: true } },
    discountedTotalSet: { shopMoney: { amount: true, currencyCode: true } },
    totalDiscountSet: { shopMoney: { amount: true, currencyCode: true } },
    variantTitle: true,
    variant: { id: true, title: true },
    product: { id: true, title: true },
  },
} as const

const getDraftOrderSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return draftOrderFullSelection
  if (view === 'raw') return {} as const
  return draftOrderSummarySelection
}

export const runDraftOrders = async ({
  ctx,
  verb,
  argv,
}: {
  ctx: CommandContext
  verb: string
  argv: string[]
}) => {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(
      [
        'Usage:',
        '  shop draft-orders <verb> [flags]',
        '',
        'Verbs:',
        '  get|list|count',
        '  create|update|delete|duplicate|calculate|complete',
        '  create-from-order',
        '  preview-invoice|send-invoice',
        '  bulk-add-tags|bulk-remove-tags|bulk-delete',
        '  saved-searches|tags|delivery-options',
        '',
        'Common output flags:',
        '  --view summary|ids|full|raw',
        '  --select <path>        (repeatable; dot paths; adds to base view selection)',
        '  --selection <graphql>  (selection override; can be @file.gql)',
      ].join('\n'),
    )
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'DraftOrder')
    const selection = resolveSelection({
      resource: 'draft-orders',
      view: ctx.view,
      baseSelection: getDraftOrderSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { draftOrder: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.draftOrder, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const query = args.query as any
    const reverse = args.reverse as any
    const sortKey = args.sort as any

    const nodeSelection = resolveSelection({
      resource: 'draft-orders',
      view: ctx.view,
      baseSelection: getDraftOrderSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })
    const result = await runQuery(ctx, {
      draftOrders: {
        __args: { first, after, query, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({
      connection: result.draftOrders,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: buildListNextPageArgs('draft-orders', { first, query, sort: sortKey, reverse }),
    })
    return
  }

  if (verb === 'count') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const query = args.query as any

    const result = await runQuery(ctx, { draftOrdersCount: { __args: { query }, count: true, precision: true } })
    if (result === undefined) return
    if (ctx.quiet) return console.log(result.draftOrdersCount?.count ?? '')
    printJson(result.draftOrdersCount, ctx.format !== 'raw')
    return
  }

  if (verb === 'create') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      draftOrderCreate: {
        __args: { input: built.input },
        draftOrder: draftOrderSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.draftOrderCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.draftOrderCreate?.draftOrder?.id ?? '')
    printJson(result.draftOrderCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'DraftOrder')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      draftOrderUpdate: {
        __args: { id, input: built.input },
        draftOrder: draftOrderSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.draftOrderUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.draftOrderUpdate?.draftOrder?.id ?? '')
    printJson(result.draftOrderUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'DraftOrder')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      draftOrderDelete: {
        __args: { input: { id } },
        deletedId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.draftOrderDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.draftOrderDelete?.deletedId ?? '')
    printJson(result.draftOrderDelete, ctx.format !== 'raw')
    return
  }

  if (verb === 'duplicate') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'DraftOrder')

    const result = await runMutation(ctx, {
      draftOrderDuplicate: {
        __args: { id },
        draftOrder: draftOrderSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.draftOrderDuplicate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.draftOrderDuplicate?.draftOrder?.id ?? '')
    printJson(result.draftOrderDuplicate, ctx.format !== 'raw')
    return
  }

  if (verb === 'calculate') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      draftOrderCalculate: {
        __args: { input: built.input },
        calculatedDraftOrder: calculatedDraftOrderSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.draftOrderCalculate, failOnUserErrors: ctx.failOnUserErrors })
    printJson(result.draftOrderCalculate, ctx.format !== 'raw')
    return
  }

  if (verb === 'complete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'DraftOrder')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })

    const result = await runMutation(ctx, {
      draftOrderComplete: {
        __args: { id, ...(built.used ? built.input : {}) },
        draftOrder: draftOrderSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.draftOrderComplete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.draftOrderComplete?.draftOrder?.id ?? '')
    printJson(result.draftOrderComplete, ctx.format !== 'raw')
    return
  }

  if (verb === 'create-from-order') {
    const args = parseStandardArgs({ argv, extraOptions: { 'order-id': { type: 'string' } } })
    const orderId = (args as any)['order-id'] as string | undefined
    if (!orderId) throw new CliError('Missing --order-id', 2)

    const result = await runMutation(ctx, {
      draftOrderCreateFromOrder: {
        __args: { orderId: coerceGid(orderId, 'Order') },
        draftOrder: draftOrderSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.draftOrderCreateFromOrder, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.draftOrderCreateFromOrder?.draftOrder?.id ?? '')
    printJson(result.draftOrderCreateFromOrder, ctx.format !== 'raw')
    return
  }

  if (verb === 'preview-invoice' || verb === 'send-invoice') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'DraftOrder')

    const email = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })

    if (verb === 'preview-invoice') {
      const result = await runMutation(ctx, {
        draftOrderInvoicePreview: {
          __args: { id, ...(email.used ? { email: email.input } : {}) },
          previewHtml: true,
          previewSubject: true,
          userErrors: { field: true, message: true },
        },
      })
      if (result === undefined) return
      maybeFailOnUserErrors({ payload: result.draftOrderInvoicePreview, failOnUserErrors: ctx.failOnUserErrors })
      if (ctx.quiet) return console.log(result.draftOrderInvoicePreview?.previewHtml ?? '')
      printJson(result.draftOrderInvoicePreview, ctx.format !== 'raw')
      return
    }

    const result = await runMutation(ctx, {
      draftOrderInvoiceSend: {
        __args: { id, ...(email.used ? { email: email.input } : {}) },
        draftOrder: { id: true, status: true, updatedAt: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.draftOrderInvoiceSend, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.draftOrderInvoiceSend?.draftOrder?.id ?? '')
    printJson(result.draftOrderInvoiceSend, ctx.format !== 'raw')
    return
  }

  if (verb === 'bulk-add-tags' || verb === 'bulk-remove-tags') {
    const args = parseStandardArgs({
      argv,
      extraOptions: { ids: { type: 'string', multiple: true } },
    })
    const ids = parseIds((args as any).ids, 'DraftOrder')
    const tags = parseCsv(args.tags, '--tags')

    const mutationField = verb === 'bulk-add-tags' ? 'draftOrderBulkAddTags' : 'draftOrderBulkRemoveTags'

    const result = await runMutation(ctx, {
      [mutationField]: {
        __args: { ids, tags },
        job: { id: true, done: true },
        userErrors: { field: true, message: true },
      },
    } as any)
    if (result === undefined) return

    const payload = (result as any)[mutationField]
    maybeFailOnUserErrors({ payload, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(payload?.job?.id ?? '')
    printJson(payload, ctx.format !== 'raw')
    return
  }

  if (verb === 'bulk-delete') {
    const args = parseStandardArgs({
      argv,
      extraOptions: { ids: { type: 'string', multiple: true } },
    })
    if (!args.yes) throw new CliError('Refusing to bulk-delete without --yes', 2)
    const ids = parseIds((args as any).ids, 'DraftOrder')

    const result = await runMutation(ctx, {
      draftOrderBulkDelete: {
        __args: { ids },
        job: { id: true, done: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.draftOrderBulkDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.draftOrderBulkDelete?.job?.id ?? '')
    printJson(result.draftOrderBulkDelete, ctx.format !== 'raw')
    return
  }

  if (verb === 'saved-searches') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const reverse = args.reverse as any

    const result = await runQuery(ctx, {
      draftOrderSavedSearches: {
        __args: { first, after, reverse },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: { id: true, name: true, query: true },
      },
    })
    if (result === undefined) return
    printConnection({
      connection: result.draftOrderSavedSearches,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: { base: 'shop draft-orders saved-searches', first, reverse },
    })
    return
  }

  if (verb === 'tags') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'DraftOrderTag')
    const result = await runQuery(ctx, {
      draftOrderTag: { __args: { id }, id: true, title: true, handle: true },
    })
    if (result === undefined) return
    if (ctx.quiet) return console.log(result.draftOrderTag?.id ?? '')
    printJson(result.draftOrderTag, ctx.format !== 'raw')
    return
  }

  if (verb === 'delivery-options') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runQuery(ctx, {
      draftOrderAvailableDeliveryOptions: {
        __args: { input: built.input },
        availableShippingRates: {
          title: true,
          handle: true,
          code: true,
          source: true,
          price: { amount: true, currencyCode: true },
        },
        availableLocalDeliveryRates: {
          title: true,
          handle: true,
          code: true,
          source: true,
          price: { amount: true, currencyCode: true },
        },
        availableLocalPickupOptions: {
          title: true,
          handle: true,
          code: true,
          instructions: true,
          locationId: true,
          source: true,
        },
        pageInfo: { hasNextPage: true, endCursor: true },
      },
    })
    if (result === undefined) return
    printJson(result.draftOrderAvailableDeliveryOptions, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for draft-orders: ${verb}`, 2)
}
