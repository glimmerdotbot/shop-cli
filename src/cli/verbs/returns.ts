import { CliError } from '../errors'
import { coerceGid } from '../gid'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { parseCsv, parseFirst, parseIds, requireId } from './_shared'

const moneyV2Selection = { amount: true, currencyCode: true } as const
const moneyBagSelection = {
  shopMoney: moneyV2Selection,
  presentmentMoney: moneyV2Selection,
} as const

const returnSummarySelection = {
  id: true,
  name: true,
  status: true,
  createdAt: true,
  order: { id: true, name: true },
  totalQuantity: true,
  returnLineItems: {
    __args: { first: 20 },
    nodes: {
      __typename: true,
      id: true,
      quantity: true,
      returnReason: true,
      returnReasonNote: true,
      on_ReturnLineItem: {
        fulfillmentLineItem: {
          lineItem: { id: true, title: true },
        },
      },
    },
  },
} as const

const returnFullSelection = {
  ...returnSummarySelection,
  decline: {
    reason: true,
    note: true,
  },
  reverseFulfillmentOrders: {
    __args: { first: 5 },
    nodes: {
      id: true,
      status: true,
      reverseDeliveries: {
        __args: { first: 5 },
        nodes: {
          id: true,
          deliverable: {
            on_ReverseDeliveryShippingDeliverable: {
              label: { id: true },
              tracking: { number: true, url: true },
            },
          },
        },
      },
    },
  },
  refunds: {
    __args: { first: 5 },
    nodes: {
      id: true,
      totalRefundedSet: moneyBagSelection,
    },
  },
  exchangeLineItems: {
    __args: { first: 10 },
    nodes: {
      id: true,
      lineItem: { id: true, title: true },
    },
  },
} as const

const refundSummarySelection = {
  id: true,
  createdAt: true,
  totalRefundedSet: moneyBagSelection,
} as const

const calculatedReturnSelection = {
  id: true,
  returnLineItems: {
    id: true,
    quantity: true,
    subtotalSet: moneyBagSelection,
    fulfillmentLineItem: {
      id: true,
      lineItem: { id: true, title: true },
    },
  },
  exchangeLineItems: {
    id: true,
    quantity: true,
    subtotalSet: moneyBagSelection,
  },
  returnShippingFee: {
    amountSet: moneyBagSelection,
  },
} as const

const returnReasonDefinitionSelection = {
  id: true,
  name: true,
  handle: true,
} as const

const returnableFulfillmentSelection = {
  id: true,
  fulfillment: { id: true, status: true },
  returnableFulfillmentLineItems: {
    __args: { first: 20 },
    nodes: {
      quantity: true,
      fulfillmentLineItem: {
        id: true,
        lineItem: { id: true, title: true },
      },
    },
  },
} as const

const getReturnSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return returnFullSelection
  if (view === 'raw') return {} as const
  return returnSummarySelection
}

const requireOrderId = (value: unknown) => {
  if (typeof value !== 'string' || !value) throw new CliError('Missing --order-id', 2)
  return coerceGid(value, 'Order')
}

const requireReturnLineItemId = (value: unknown) => {
  if (typeof value !== 'string' || !value) throw new CliError('Missing --return-line-item-id', 2)
  return coerceGid(value, 'ReturnLineItem')
}

const parseQuantity = (value: unknown, flag: string) => {
  if (value === undefined || value === null || value === '') throw new CliError(`Missing ${flag}`, 2)
  const n = Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw new CliError(`${flag} must be a positive integer`, 2)
  }
  return n
}

export const runReturns = async ({
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
        '  shop returns <verb> [flags]',
        '',
        'Verbs:',
        '  create|get|calculate|cancel|close|reopen|process|refund|request|approve-request|decline-request',
        '  remove-item|reason-definitions|returnable-fulfillments',
        '',
        'State machine:',
        '  REQUESTED → APPROVED → OPEN → IN_PROGRESS → CLOSED',
        '      ↓           ↓        ↓',
        '   DECLINED    CANCELLED  CANCELLED',
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
    const id = requireId(args.id, 'Return')
    const selection = resolveSelection({
      resource: 'returns',
      view: ctx.view,
      baseSelection: getReturnSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { return: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.return, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'reason-definitions') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        ids: { type: 'string', multiple: true },
        handles: { type: 'string' },
      },
    })
    const first = parseFirst(args.first)
    const after = args.after as any
    const query = args.query as any
    const reverse = args.reverse as any
    const ids = args.ids ? parseIds(args.ids, 'ReturnReasonDefinition') : undefined
    const handles = args.handles ? parseCsv(args.handles, '--handles') : undefined

    const result = await runQuery(ctx, {
      returnReasonDefinitions: {
        __args: { first, after, query, reverse, ids, handles },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: returnReasonDefinitionSelection,
      },
    })
    if (result === undefined) return
    printConnection({
      connection: result.returnReasonDefinitions,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: {
        base: 'shop returns reason-definitions',
        first,
        query,
        reverse,
        extraFlags: [
          ...(ids && ids.length > 0 ? [{ flag: '--ids', value: ids.join(',') }] : []),
          ...(handles && handles.length > 0 ? [{ flag: '--handles', value: handles.join(',') }] : []),
        ],
      },
    })
    return
  }

  if (verb === 'returnable-fulfillments') {
    const args = parseStandardArgs({ argv, extraOptions: { 'order-id': { type: 'string' } } })
    const orderId = requireOrderId(args['order-id'])
    const first = parseFirst(args.first)
    const after = args.after as any
    const reverse = args.reverse as any

    const result = await runQuery(ctx, {
      returnableFulfillments: {
        __args: { first, after, reverse, orderId },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: returnableFulfillmentSelection,
      },
    })
    if (result === undefined) return
    printConnection({
      connection: result.returnableFulfillments,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: {
        base: 'shop returns returnable-fulfillments',
        first,
        reverse,
        extraFlags: [{ flag: '--order-id', value: orderId }],
      },
    })
    return
  }

  if (verb === 'calculate') {
    const args = parseStandardArgs({ argv, extraOptions: { 'order-id': { type: 'string' } } })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const orderId = args['order-id'] ? requireOrderId(args['order-id']) : undefined
    const input = {
      ...built.input,
      ...(orderId ? { orderId } : {}),
    }
    if (!input.orderId) throw new CliError('Missing --order-id (or input.orderId)', 2)

    const result = await runQuery(ctx, {
      returnCalculate: {
        __args: { input },
        ...calculatedReturnSelection,
      },
    })
    if (result === undefined) return
    printNode({ node: result.returnCalculate, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'create' || verb === 'request') {
    const args = parseStandardArgs({ argv, extraOptions: { 'order-id': { type: 'string' }, 'notify-customer': { type: 'boolean' } } })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const orderId = args['order-id'] ? requireOrderId(args['order-id']) : undefined
    const input = {
      ...built.input,
      ...(orderId ? { orderId } : {}),
      ...(verb === 'create' && args['notify-customer'] ? { notifyCustomer: true } : {}),
    }
    if (!input.orderId) throw new CliError('Missing --order-id (or input.orderId)', 2)

    const mutationField = verb === 'create' ? 'returnCreate' : 'returnRequest'
    const mutationArgs = verb === 'create' ? { returnInput: input } : { input }

    const result = await runMutation(ctx, {
      [mutationField]: {
        __args: mutationArgs,
        return: returnSummarySelection,
        userErrors: { field: true, message: true },
      },
    } as any)
    if (result === undefined) return
    const payload = (result as any)[mutationField]
    maybeFailOnUserErrors({ payload, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(payload?.return?.id ?? '')
    printJson(payload, ctx.format !== 'raw')
    return
  }

  if (verb === 'approve-request') {
    const args = parseStandardArgs({ argv, extraOptions: { 'notify-customer': { type: 'boolean' } } })
    const id = requireId(args.id, 'Return')

    const result = await runMutation(ctx, {
      returnApproveRequest: {
        __args: { input: { id, ...(args['notify-customer'] ? { notifyCustomer: true } : {}) } },
        return: returnSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.returnApproveRequest, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.returnApproveRequest?.return?.id ?? '')
    printJson(result.returnApproveRequest, ctx.format !== 'raw')
    return
  }

  if (verb === 'decline-request') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'decline-reason': { type: 'string' },
        'decline-note': { type: 'string' },
        'notify-customer': { type: 'boolean' },
      },
    })
    const id = requireId(args.id, 'Return')
    const declineReason = args['decline-reason'] as string | undefined
    if (!declineReason) throw new CliError('Missing --decline-reason', 2)

    const input: any = { id, declineReason }
    if (args['decline-note']) input.declineNote = args['decline-note']
    if (args['notify-customer']) input.notifyCustomer = true

    const result = await runMutation(ctx, {
      returnDeclineRequest: {
        __args: { input },
        return: returnSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.returnDeclineRequest, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.returnDeclineRequest?.return?.id ?? '')
    printJson(result.returnDeclineRequest, ctx.format !== 'raw')
    return
  }

  if (verb === 'cancel' || verb === 'close' || verb === 'reopen') {
    const args = parseStandardArgs({ argv, extraOptions: { 'notify-customer': { type: 'boolean' } } })
    const id = requireId(args.id, 'Return')
    const mutationField =
      verb === 'cancel' ? 'returnCancel' : verb === 'close' ? 'returnClose' : 'returnReopen'
    const mutationArgs =
      verb === 'cancel' && args['notify-customer']
        ? { id, notifyCustomer: true }
        : { id }

    const result = await runMutation(ctx, {
      [mutationField]: {
        __args: mutationArgs,
        return: returnSummarySelection,
        userErrors: { field: true, message: true },
      },
    } as any)
    if (result === undefined) return
    const payload = (result as any)[mutationField]
    maybeFailOnUserErrors({ payload, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(payload?.return?.id ?? '')
    printJson(payload, ctx.format !== 'raw')
    return
  }

  if (verb === 'process') {
    const args = parseStandardArgs({ argv, extraOptions: { 'notify-customer': { type: 'boolean' } } })
    const id = requireId(args.id, 'Return')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const input = {
      ...built.input,
      returnId: id,
      ...(args['notify-customer'] ? { notifyCustomer: true } : {}),
    }

    const result = await runMutation(ctx, {
      returnProcess: {
        __args: { input },
        return: returnSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.returnProcess, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.returnProcess?.return?.id ?? '')
    printJson(result.returnProcess, ctx.format !== 'raw')
    return
  }

  if (verb === 'refund') {
    const args = parseStandardArgs({ argv, extraOptions: { 'notify-customer': { type: 'boolean' } } })
    const id = requireId(args.id, 'Return')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const input = {
      ...built.input,
      returnId: id,
      ...(args['notify-customer'] ? { notifyCustomer: true } : {}),
    }

    const result = await runMutation(ctx, {
      returnRefund: {
        __args: { returnRefundInput: input },
        refund: refundSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.returnRefund, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.returnRefund?.refund?.id ?? '')
    printJson(result.returnRefund, ctx.format !== 'raw')
    return
  }

  if (verb === 'remove-item') {
    const args = parseStandardArgs({
      argv,
      extraOptions: { 'return-line-item-id': { type: 'string' }, quantity: { type: 'string' } },
    })
    const id = requireId(args.id, 'Return')
    const returnLineItemId = requireReturnLineItemId(args['return-line-item-id'])
    const quantity = parseQuantity(args.quantity, '--quantity')

    const result = await runMutation(ctx, {
      removeFromReturn: {
        __args: {
          returnId: id,
          returnLineItems: [{ returnLineItemId, quantity }],
        },
        return: returnSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.removeFromReturn, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.removeFromReturn?.return?.id ?? '')
    printJson(result.removeFromReturn, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for returns: ${verb}`, 2)
}
