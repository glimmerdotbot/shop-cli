import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import {
  buildListNextPageArgs,
  parseCsv,
  parseFirst,
  parseJsonArg,
  parseTextArg,
  requireId,
} from './_shared'

const orderSummarySelection = {
  id: true,
  name: true,
  displayFinancialStatus: true,
  displayFulfillmentStatus: true,
  processedAt: true,
  updatedAt: true,
} as const

const orderFullSelection = {
  ...orderSummarySelection,
  createdAt: true,
  tags: true,
} as const

const getOrderSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return orderFullSelection
  if (view === 'raw') return {} as const
  return orderSummarySelection
}

export const runOrders = async ({
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
        '  shop orders <verb> [flags]',
        '',
        'Verbs:',
        '  create|get|list|count|update|delete',
        '  add-tags|remove-tags|cancel|close|mark-paid|add-note|fulfill',
        '',
        'Common output flags:',
        '  --view summary|ids|full|raw',
        '  --select <path>        (repeatable; dot paths; adds to base view selection)',
        '  --selection <graphql>  (selection override; can be @file.gql)',
      ].join('\n'),
    )
    return
  }

  if (verb === 'count') {
    const args = parseStandardArgs({ argv, extraOptions: { limit: { type: 'string' } } })
    const query = args.query as any
    const limitRaw = args.limit as any
    const limit =
      limitRaw === undefined || limitRaw === null || limitRaw === ''
        ? undefined
        : Number(limitRaw)

    if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0)) {
      throw new CliError('--limit must be a positive number', 2)
    }

    const result = await runQuery(ctx, {
      ordersCount: {
        __args: {
          ...(query ? { query } : {}),
          ...(limit !== undefined ? { limit: Math.floor(limit) } : {}),
        },
        count: true,
        precision: true,
      },
    })
    if (result === undefined) return
    if (ctx.quiet) return console.log(result.ordersCount?.count ?? '')
    printJson(result.ordersCount, ctx.format !== 'raw')
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Order')
    const selection = resolveSelection({
      resource: 'orders',
      view: ctx.view,
      baseSelection: getOrderSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { order: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.order, format: ctx.format, quiet: ctx.quiet })
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
      resource: 'orders',
      view: ctx.view,
      baseSelection: getOrderSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      orders: {
        __args: { first, after, query, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return

    printConnection({
      connection: result.orders,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: buildListNextPageArgs('orders', { first, query, sort: sortKey, reverse }),
    })
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
      orderCreate: {
        __args: { order: built.input },
        order: orderSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.orderCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.orderCreate?.order?.id ?? '')
    printJson(result.orderCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'add-tags' || verb === 'remove-tags') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id as any, 'Order')
    const tags = parseCsv(args.tags as any, '--tags')

    const mutationField = verb === 'add-tags' ? 'tagsAdd' : 'tagsRemove'
    const request: any = {
      [mutationField]: {
        __args: { id, tags },
        node: { id: true },
        userErrors: { field: true, message: true },
      },
    }

    const result = await runMutation(ctx, request)
    if (result === undefined) return
    const payload = result[mutationField]
    maybeFailOnUserErrors({ payload, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(payload?.node?.id ?? '')
    printJson(payload, ctx.format !== 'raw')
    return
  }

  if (verb === 'cancel') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        refund: { type: 'boolean' },
        restock: { type: 'string' },
        reason: { type: 'string' },
        'notify-customer': { type: 'boolean' },
        'staff-note': { type: 'string' },
        'refund-method': { type: 'string' },
      },
    })
    const orderId = requireId(args.id as any, 'Order')

    const restockRaw = (args as any).restock as string | undefined
    const restock =
      restockRaw === undefined
        ? true
        : (() => {
            const v = restockRaw.trim().toLowerCase()
            if (v === 'true' || v === '1' || v === 'yes') return true
            if (v === 'false' || v === '0' || v === 'no') return false
            throw new CliError('--restock must be true|false', 2)
          })()

    const reason = ((args as any).reason as string | undefined) ?? 'OTHER'
    const refund = ((args as any).refund as boolean | undefined) ?? false
    const notifyCustomer = ((args as any)['notify-customer'] as boolean | undefined) ?? false
    const staffNote = (args as any)['staff-note'] as string | undefined
    const refundMethodRaw = (args as any)['refund-method'] as any
    const refundMethod =
      refundMethodRaw !== undefined ? parseJsonArg(refundMethodRaw, '--refund-method', { allowEmpty: true }) : undefined

    const result = await runMutation(ctx, {
      orderCancel: {
        __args: {
          orderId,
          refund,
          restock,
          reason,
          notifyCustomer,
          ...(staffNote ? { staffNote } : {}),
          ...(refundMethod ? { refundMethod } : {}),
        },
        job: { id: true, done: true },
        orderCancelUserErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return

    maybeFailOnUserErrors({
      payload: { userErrors: result.orderCancel?.orderCancelUserErrors },
      failOnUserErrors: ctx.failOnUserErrors,
    })

    if (ctx.quiet) return console.log(result.orderCancel?.job?.id ?? '')
    printJson(result.orderCancel, ctx.format !== 'raw')
    return
  }

  if (verb === 'close') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id as any, 'Order')

    const result = await runMutation(ctx, {
      orderClose: {
        __args: { input: { id } },
        order: orderSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.orderClose, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.orderClose?.order?.id ?? '')
    printJson(result.orderClose, ctx.format !== 'raw')
    return
  }

  if (verb === 'mark-paid') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id as any, 'Order')

    const result = await runMutation(ctx, {
      orderMarkAsPaid: {
        __args: { input: { id } },
        order: orderSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.orderMarkAsPaid, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.orderMarkAsPaid?.order?.id ?? '')
    printJson(result.orderMarkAsPaid, ctx.format !== 'raw')
    return
  }

  if (verb === 'add-note') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        note: { type: 'string' },
      },
    })
    const id = requireId(args.id as any, 'Order')
    const note = parseTextArg((args as any).note, '--note')

    const result = await runMutation(ctx, {
      orderUpdate: {
        __args: { input: { id, note } },
        order: orderSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.orderUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.orderUpdate?.order?.id ?? '')
    printJson(result.orderUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'fulfill') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        message: { type: 'string' },
        'fulfillment-order-id': { type: 'string', multiple: true },
        'tracking-company': { type: 'string' },
        'tracking-number': { type: 'string' },
        'tracking-url': { type: 'string' },
        'notify-customer': { type: 'boolean' },
      },
    })
    const orderId = requireId(args.id as any, 'Order')

    const desiredFulfillmentOrderIds = ((args as any)['fulfillment-order-id'] as string[] | undefined) ?? []
    const trackingInfoInput = (() => {
      const trackingInfo: Record<string, any> = {}
      const company = (args as any)['tracking-company'] as string | undefined
      const number = (args as any)['tracking-number'] as string | undefined
      const url = (args as any)['tracking-url'] as string | undefined
      if (company) trackingInfo.company = company
      if (number) trackingInfo.number = number
      if (url) trackingInfo.url = url
      return Object.keys(trackingInfo).length > 0 ? trackingInfo : undefined
    })()

    const result = await runQuery(ctx, {
      order: {
        __args: { id: orderId },
        id: true,
        name: true,
        fulfillmentOrders: {
          __args: { first: 50, displayable: true },
          nodes: {
            id: true,
            status: true,
            assignedLocation: { location: { id: true, name: true } },
          },
        },
      },
    })
    if (result === undefined) return
    const fulfillmentOrders = result.order?.fulfillmentOrders?.nodes ?? []
    if (!result.order) throw new CliError('Order not found', 2)
    if (fulfillmentOrders.length === 0) throw new CliError('No fulfillment orders found for this order', 2)

    const normalizedTargetIds =
      desiredFulfillmentOrderIds.length > 0
        ? desiredFulfillmentOrderIds.map((id) => requireId(id, 'FulfillmentOrder'))
        : fulfillmentOrders.map((fo: any) => fo?.id).filter(Boolean)

    const chosen = fulfillmentOrders.filter((fo: any) => normalizedTargetIds.includes(fo?.id))
    if (chosen.length === 0) throw new CliError('No matching fulfillment orders found for --fulfillment-order-id', 2)

    const groups = new Map<string, string[]>()
    for (const fo of chosen) {
      const locationId = fo?.assignedLocation?.location?.id as string | undefined
      if (!locationId) throw new CliError(`Fulfillment order ${fo?.id ?? '(missing id)'} is missing an assigned location`, 2)
      const list = groups.get(locationId) ?? []
      list.push(fo.id)
      groups.set(locationId, list)
    }

    const payloads: any[] = []
    for (const [locationId, fulfillmentOrderIds] of groups.entries()) {
      const fulfillment: any = {
        lineItemsByFulfillmentOrder: fulfillmentOrderIds.map((fulfillmentOrderId) => ({ fulfillmentOrderId })),
        ...(trackingInfoInput ? { trackingInfo: trackingInfoInput } : {}),
        ...(args['notify-customer'] ? { notifyCustomer: true } : {}),
      }

      const created = await runMutation(ctx, {
        fulfillmentCreateV2: {
          __args: { fulfillment, ...(args.message ? { message: args.message as any } : {}) },
          fulfillment: {
            id: true,
            status: true,
            name: true,
            trackingInfo: { company: true, number: true, url: true },
          },
          userErrors: { field: true, message: true },
        },
      })
      if (created === undefined) return
      maybeFailOnUserErrors({ payload: created.fulfillmentCreateV2, failOnUserErrors: ctx.failOnUserErrors })
      payloads.push({ locationId, ...created.fulfillmentCreateV2 })
    }

    if (ctx.quiet) {
      for (const p of payloads) {
        if (p?.fulfillment?.id) process.stdout.write(`${p.fulfillment.id}\n`)
      }
      return
    }

    printJson(payloads.length === 1 ? payloads[0] : payloads, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Order')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const input = { ...built.input, id }

    const result = await runMutation(ctx, {
      orderUpdate: {
        __args: { input },
        order: orderSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.orderUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.orderUpdate?.order?.id ?? '')
    printJson(result.orderUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Order')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      orderDelete: {
        __args: { orderId: id },
        deletedId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.orderDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.orderDelete?.deletedId ?? '')
    printJson(result.orderDelete, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for orders: ${verb}`, 2)
}
