import { CliError } from '../errors'
import { coerceGid } from '../gid'
import { buildInput } from '../input'
import { printConnection, printJson } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { maybeFailOnUserErrors } from '../userErrors'

import { applySelect, parseCsv, parseFirst, parseIds, requireId } from './_shared'

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

const getDraftOrderSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return draftOrderFullSelection
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
  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'DraftOrder')
    const selection = applySelect(getDraftOrderSelection(ctx.view), args.select)

    const result = await runQuery(ctx, { draftOrder: { __args: { id }, ...selection } })
    if (result === undefined) return
    if (ctx.quiet) return console.log(result.draftOrder?.id ?? '')
    printJson(result.draftOrder)
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const query = args.query as any
    const reverse = args.reverse as any
    const sortKey = args.sort as any

    const nodeSelection = applySelect(getDraftOrderSelection(ctx.view), args.select)
    const result = await runQuery(ctx, {
      draftOrders: {
        __args: { first, after, query, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({ connection: result.draftOrders, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'count') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const query = args.query as any

    const result = await runQuery(ctx, { draftOrdersCount: { __args: { query }, count: true, precision: true } })
    if (result === undefined) return
    if (ctx.quiet) return console.log(result.draftOrdersCount?.count ?? '')
    printJson(result.draftOrdersCount)
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
    printJson(result.draftOrderCreate)
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
    printJson(result.draftOrderUpdate)
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
    printJson(result.draftOrderDelete)
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
    printJson(result.draftOrderDuplicate)
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
        calculatedDraftOrder: { id: true, lineItemsSubtotalPrice: { shopMoney: { amount: true, currencyCode: true } } },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.draftOrderCalculate, failOnUserErrors: ctx.failOnUserErrors })
    printJson(result.draftOrderCalculate)
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
    printJson(result.draftOrderComplete)
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
    printJson(result.draftOrderCreateFromOrder)
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
      printJson(result.draftOrderInvoicePreview)
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
    printJson(result.draftOrderInvoiceSend)
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
    printJson(payload)
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
    printJson(result.draftOrderBulkDelete)
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
    printJson(result.draftOrderTag)
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
    printJson(result.draftOrderAvailableDeliveryOptions)
    return
  }

  throw new CliError(`Unknown verb for draft-orders: ${verb}`, 2)
}
