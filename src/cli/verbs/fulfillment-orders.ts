import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import {
  buildListNextPageArgs,
  parseDateTime,
  parseFirst,
  parseIds,
  requireId,
  requireLocationId,
} from './_shared'

const fulfillmentOrderSummarySelection = {
  id: true,
  status: true,
  requestStatus: true,
  order: { id: true, name: true },
  assignedLocation: {
    name: true,
    location: { id: true },
  },
  fulfillAt: true,
  fulfillBy: true,
  supportedActions: { action: true, externalUrl: true },
  lineItems: {
    __args: { first: 20 },
    nodes: {
      id: true,
      totalQuantity: true,
      remainingQuantity: true,
      sku: true,
      lineItem: { id: true, title: true },
    },
  },
} as const

const fulfillmentOrderFullSelection = {
  ...fulfillmentOrderSummarySelection,
  destination: {
    firstName: true,
    lastName: true,
    address1: true,
    city: true,
    provinceCode: true,
    countryCode: true,
    zip: true,
    phone: true,
  },
  fulfillmentHolds: {
    id: true,
    reason: true,
    reasonNotes: true,
    displayReason: true,
    heldByRequestingApp: true,
    heldByApp: { id: true, title: true },
  },
  merchantRequests: {
    __args: { first: 5 },
    nodes: {
      id: true,
      kind: true,
      message: true,
      requestedAt: true,
      responseData: true,
    },
  },
  fulfillments: {
    __args: { first: 5 },
    nodes: {
      id: true,
      status: true,
      trackingInfo: {
        company: true,
        number: true,
        url: true,
      },
    },
  },
  locationsForMove: {
    __args: { first: 10 },
    nodes: {
      location: { id: true, name: true },
      message: true,
      movable: true,
    },
  },
} as const

const getFulfillmentOrderSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return fulfillmentOrderFullSelection
  if (view === 'raw') return {} as const
  return fulfillmentOrderSummarySelection
}

const parseLineItemsInput = (input: any) => {
  if (input === undefined) return undefined
  if (Array.isArray(input)) return input
  if (input && typeof input === 'object' && 'fulfillmentOrderLineItems' in input) {
    return input.fulfillmentOrderLineItems
  }
  return input
}

export const runFulfillmentOrders = async ({
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
        '  shop fulfillment-orders <verb> [flags]',
        '',
        'Verbs:',
        '  get|list|accept-request|reject-request|submit-request',
        '  accept-cancellation|reject-cancellation|submit-cancellation|cancel|close|open',
        '  hold|release-hold|reschedule|move|split|merge|report-progress|mark-prepared',
        '  set-deadline|reroute',
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
    const id = requireId(args.id, 'FulfillmentOrder')
    const selection = resolveSelection({
      resource: 'fulfillment-orders',
      view: ctx.view,
      baseSelection: getFulfillmentOrderSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { fulfillmentOrder: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.fulfillmentOrder, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        status: { type: 'string' },
        'location-ids': { type: 'string', multiple: true },
        'include-closed': { type: 'boolean' },
      },
    })
    const first = parseFirst(args.first)
    const after = args.after as any
    const reverse = args.reverse as any
    const sortKey = args.sort as any
    const includeClosed = args['include-closed'] as any

    const locationIds = args['location-ids']
      ? parseIds(args['location-ids'], 'Location')
      : []

    const queryParts: string[] = []
    if (args.query) queryParts.push(String(args.query))
    if (args.status) queryParts.push(`status:${args.status}`)
    for (const id of locationIds) queryParts.push(`assigned_location_id:${id}`)
    const query = queryParts.length > 0 ? queryParts.join(' ') : undefined

    const nodeSelection = resolveSelection({
      resource: 'fulfillment-orders',
      view: ctx.view,
      baseSelection: getFulfillmentOrderSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      fulfillmentOrders: {
        __args: { first, after, query, reverse, sortKey, includeClosed },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({
      connection: result.fulfillmentOrders,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: buildListNextPageArgs(
        'fulfillment-orders',
        { first, query, sort: sortKey, reverse },
        includeClosed ? [{ flag: '--include-closed', value: true }] : undefined,
      ),
    })
    return
  }

  if (verb === 'accept-request') {
    const args = parseStandardArgs({
      argv,
      extraOptions: { message: { type: 'string' }, 'estimated-shipped-at': { type: 'string' } },
    })
    const id = requireId(args.id, 'FulfillmentOrder')
    const message = args.message as string | undefined
    const estimatedShippedAt = args['estimated-shipped-at'] as string | undefined

    const result = await runMutation(ctx, {
      fulfillmentOrderAcceptFulfillmentRequest: {
        __args: { id, message, estimatedShippedAt },
        fulfillmentOrder: fulfillmentOrderSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.fulfillmentOrderAcceptFulfillmentRequest,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.fulfillmentOrderAcceptFulfillmentRequest?.fulfillmentOrder?.id ?? '')
    printJson(result.fulfillmentOrderAcceptFulfillmentRequest, ctx.format !== 'raw')
    return
  }

  if (verb === 'reject-request') {
    const args = parseStandardArgs({
      argv,
      extraOptions: { message: { type: 'string' }, reason: { type: 'string' } },
    })
    const id = requireId(args.id, 'FulfillmentOrder')
    const message = args.message as string | undefined
    const reason = args.reason as string | undefined

    const result = await runMutation(ctx, {
      fulfillmentOrderRejectFulfillmentRequest: {
        __args: { id, message, reason },
        fulfillmentOrder: fulfillmentOrderSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.fulfillmentOrderRejectFulfillmentRequest,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.fulfillmentOrderRejectFulfillmentRequest?.fulfillmentOrder?.id ?? '')
    printJson(result.fulfillmentOrderRejectFulfillmentRequest, ctx.format !== 'raw')
    return
  }

  if (verb === 'submit-request') {
    const args = parseStandardArgs({
      argv,
      extraOptions: { message: { type: 'string' }, 'notify-customer': { type: 'boolean' } },
    })
    const id = requireId(args.id, 'FulfillmentOrder')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })

    const fulfillmentOrderLineItems = built.used ? parseLineItemsInput(built.input) : undefined

    const result = await runMutation(ctx, {
      fulfillmentOrderSubmitFulfillmentRequest: {
        __args: {
          id,
          message: args.message as any,
          notifyCustomer: args['notify-customer'] ? true : undefined,
          ...(fulfillmentOrderLineItems ? { fulfillmentOrderLineItems } : {}),
        },
        submittedFulfillmentOrder: fulfillmentOrderSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.fulfillmentOrderSubmitFulfillmentRequest,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) {
      return console.log(result.fulfillmentOrderSubmitFulfillmentRequest?.submittedFulfillmentOrder?.id ?? '')
    }
    printJson(result.fulfillmentOrderSubmitFulfillmentRequest, ctx.format !== 'raw')
    return
  }

  if (verb === 'accept-cancellation') {
    const args = parseStandardArgs({ argv, extraOptions: { message: { type: 'string' } } })
    const id = requireId(args.id, 'FulfillmentOrder')

    const result = await runMutation(ctx, {
      fulfillmentOrderAcceptCancellationRequest: {
        __args: { id, message: args.message as any },
        fulfillmentOrder: fulfillmentOrderSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.fulfillmentOrderAcceptCancellationRequest,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.fulfillmentOrderAcceptCancellationRequest?.fulfillmentOrder?.id ?? '')
    printJson(result.fulfillmentOrderAcceptCancellationRequest, ctx.format !== 'raw')
    return
  }

  if (verb === 'reject-cancellation') {
    const args = parseStandardArgs({ argv, extraOptions: { message: { type: 'string' } } })
    const id = requireId(args.id, 'FulfillmentOrder')

    const result = await runMutation(ctx, {
      fulfillmentOrderRejectCancellationRequest: {
        __args: { id, message: args.message as any },
        fulfillmentOrder: fulfillmentOrderSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.fulfillmentOrderRejectCancellationRequest,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.fulfillmentOrderRejectCancellationRequest?.fulfillmentOrder?.id ?? '')
    printJson(result.fulfillmentOrderRejectCancellationRequest, ctx.format !== 'raw')
    return
  }

  if (verb === 'submit-cancellation') {
    const args = parseStandardArgs({ argv, extraOptions: { message: { type: 'string' } } })
    const id = requireId(args.id, 'FulfillmentOrder')

    const result = await runMutation(ctx, {
      fulfillmentOrderSubmitCancellationRequest: {
        __args: { id, message: args.message as any },
        fulfillmentOrder: fulfillmentOrderSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.fulfillmentOrderSubmitCancellationRequest,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.fulfillmentOrderSubmitCancellationRequest?.fulfillmentOrder?.id ?? '')
    printJson(result.fulfillmentOrderSubmitCancellationRequest, ctx.format !== 'raw')
    return
  }

  if (verb === 'cancel' || verb === 'close' || verb === 'open') {
    const args = parseStandardArgs({ argv, extraOptions: { message: { type: 'string' } } })
    const id = requireId(args.id, 'FulfillmentOrder')
    const mutationField =
      verb === 'cancel' ? 'fulfillmentOrderCancel' : verb === 'close' ? 'fulfillmentOrderClose' : 'fulfillmentOrderOpen'

    const mutationArgs =
      verb === 'close'
        ? { id, message: args.message as any }
        : { id }

    const result = await runMutation(ctx, {
      [mutationField]: {
        __args: mutationArgs,
        fulfillmentOrder: fulfillmentOrderSummarySelection,
        userErrors: { field: true, message: true },
      },
    } as any)
    if (result === undefined) return
    const payload = (result as any)[mutationField]
    maybeFailOnUserErrors({ payload, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(payload?.fulfillmentOrder?.id ?? '')
    printJson(payload, ctx.format !== 'raw')
    return
  }

  if (verb === 'hold') {
    const args = parseStandardArgs({
      argv,
      extraOptions: { reason: { type: 'string' }, notes: { type: 'string' } },
    })
    const id = requireId(args.id, 'FulfillmentOrder')
    const reason = args.reason as string | undefined
    if (!reason) throw new CliError('Missing --reason', 2)

    const fulfillmentHold = {
      reason,
      ...(args.notes ? { reasonNotes: args.notes } : {}),
    }

    const result = await runMutation(ctx, {
      fulfillmentOrderHold: {
        __args: { id, fulfillmentHold },
        fulfillmentOrder: fulfillmentOrderSummarySelection,
        fulfillmentHold: { id: true, reason: true, reasonNotes: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.fulfillmentOrderHold, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.fulfillmentOrderHold?.fulfillmentOrder?.id ?? '')
    printJson(result.fulfillmentOrderHold, ctx.format !== 'raw')
    return
  }

  if (verb === 'release-hold') {
    const args = parseStandardArgs({ argv, extraOptions: { 'hold-ids': { type: 'string', multiple: true } } })
    const id = requireId(args.id, 'FulfillmentOrder')
    const holdIds = args['hold-ids'] ? parseIds(args['hold-ids'], 'FulfillmentHold') : undefined

    const result = await runMutation(ctx, {
      fulfillmentOrderReleaseHold: {
        __args: { id, ...(holdIds ? { holdIds } : {}) },
        fulfillmentOrder: fulfillmentOrderSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.fulfillmentOrderReleaseHold, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.fulfillmentOrderReleaseHold?.fulfillmentOrder?.id ?? '')
    printJson(result.fulfillmentOrderReleaseHold, ctx.format !== 'raw')
    return
  }

  if (verb === 'reschedule') {
    const args = parseStandardArgs({ argv, extraOptions: { 'fulfill-at': { type: 'string' } } })
    const id = requireId(args.id, 'FulfillmentOrder')
    const fulfillAt = parseDateTime(args['fulfill-at'], '--fulfill-at')

    const result = await runMutation(ctx, {
      fulfillmentOrderReschedule: {
        __args: { id, fulfillAt },
        fulfillmentOrder: fulfillmentOrderSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.fulfillmentOrderReschedule, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.fulfillmentOrderReschedule?.fulfillmentOrder?.id ?? '')
    printJson(result.fulfillmentOrderReschedule, ctx.format !== 'raw')
    return
  }

  if (verb === 'move') {
    const args = parseStandardArgs({ argv, extraOptions: { 'location-id': { type: 'string' } } })
    const id = requireId(args.id, 'FulfillmentOrder')
    const newLocationId = requireLocationId(args['location-id'])
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    const fulfillmentOrderLineItems = built.used ? parseLineItemsInput(built.input) : undefined

    const result = await runMutation(ctx, {
      fulfillmentOrderMove: {
        __args: {
          id,
          newLocationId,
          ...(fulfillmentOrderLineItems ? { fulfillmentOrderLineItems } : {}),
        },
        movedFulfillmentOrder: fulfillmentOrderSummarySelection,
        originalFulfillmentOrder: fulfillmentOrderSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.fulfillmentOrderMove, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.fulfillmentOrderMove?.movedFulfillmentOrder?.id ?? '')
    printJson(result.fulfillmentOrderMove, ctx.format !== 'raw')
    return
  }

  if (verb === 'split') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const fulfillmentOrderSplits = Array.isArray(built.input)
      ? built.input
      : built.input.fulfillmentOrderSplits ?? built.input

    const result = await runMutation(ctx, {
      fulfillmentOrderSplit: {
        __args: { fulfillmentOrderSplits },
        fulfillmentOrderSplits: {
          fulfillmentOrder: fulfillmentOrderSummarySelection,
          remainingFulfillmentOrder: fulfillmentOrderSummarySelection,
          replacementFulfillmentOrder: fulfillmentOrderSummarySelection,
        },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.fulfillmentOrderSplit, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.fulfillmentOrderSplit?.fulfillmentOrderSplits?.[0]?.fulfillmentOrder?.id ?? '')
    printJson(result.fulfillmentOrderSplit, ctx.format !== 'raw')
    return
  }

  if (verb === 'merge') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    let fulfillmentOrderMergeInputs: any

    if (built.used) {
      fulfillmentOrderMergeInputs = Array.isArray(built.input)
        ? built.input
        : built.input.fulfillmentOrderMergeInputs ?? built.input
    } else {
      const ids = parseIds(args.ids as any, 'FulfillmentOrder')
      fulfillmentOrderMergeInputs = [
        {
          mergeIntents: ids.map((id) => ({ fulfillmentOrderId: id })),
        },
      ]
    }

    const result = await runMutation(ctx, {
      fulfillmentOrderMerge: {
        __args: { fulfillmentOrderMergeInputs },
        fulfillmentOrderMerges: {
          fulfillmentOrder: fulfillmentOrderSummarySelection,
        },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.fulfillmentOrderMerge, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.fulfillmentOrderMerge?.fulfillmentOrderMerges?.[0]?.fulfillmentOrder?.id ?? '')
    printJson(result.fulfillmentOrderMerge, ctx.format !== 'raw')
    return
  }

  if (verb === 'report-progress') {
    const args = parseStandardArgs({ argv, extraOptions: { message: { type: 'string' } } })
    const id = requireId(args.id, 'FulfillmentOrder')
    const progressReport = args.message ? { reasonNotes: args.message } : undefined

    const result = await runMutation(ctx, {
      fulfillmentOrderReportProgress: {
        __args: { id, progressReport },
        fulfillmentOrder: fulfillmentOrderSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.fulfillmentOrderReportProgress, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.fulfillmentOrderReportProgress?.fulfillmentOrder?.id ?? '')
    printJson(result.fulfillmentOrderReportProgress, ctx.format !== 'raw')
    return
  }

  if (verb === 'mark-prepared') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'FulfillmentOrder')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })

    const input = built.used
      ? built.input
      : { lineItemsByFulfillmentOrder: [{ fulfillmentOrderId: id }] }

    const result = await runMutation(ctx, {
      fulfillmentOrderLineItemsPreparedForPickup: {
        __args: { input },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.fulfillmentOrderLineItemsPreparedForPickup,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return
    printJson(result.fulfillmentOrderLineItemsPreparedForPickup, ctx.format !== 'raw')
    return
  }

  if (verb === 'set-deadline') {
    const args = parseStandardArgs({ argv, extraOptions: { deadline: { type: 'string' } } })
    const fulfillmentOrderIds = parseIds(args.ids as any, 'FulfillmentOrder')
    const fulfillmentDeadline = parseDateTime(args.deadline, '--deadline')

    const result = await runMutation(ctx, {
      fulfillmentOrdersSetFulfillmentDeadline: {
        __args: { fulfillmentOrderIds, fulfillmentDeadline },
        success: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.fulfillmentOrdersSetFulfillmentDeadline,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return
    printJson(result.fulfillmentOrdersSetFulfillmentDeadline, ctx.format !== 'raw')
    return
  }

  if (verb === 'reroute') {
    const args = parseStandardArgs({ argv, extraOptions: { 'location-id': { type: 'string' } } })
    const fulfillmentOrderIds = parseIds(args.ids as any, 'FulfillmentOrder')
    const locationId = requireLocationId(args['location-id'])

    const result = await runMutation(ctx, {
      fulfillmentOrdersReroute: {
        __args: { fulfillmentOrderIds, includedLocationIds: [locationId] },
        movedFulfillmentOrders: fulfillmentOrderSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.fulfillmentOrdersReroute, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) {
      const ids = (result.fulfillmentOrdersReroute?.movedFulfillmentOrders ?? []).map((fo: any) => fo?.id)
      for (const id of ids) if (id) console.log(id)
      return
    }
    printJson(result.fulfillmentOrdersReroute, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for fulfillment-orders: ${verb}`, 2)
}
