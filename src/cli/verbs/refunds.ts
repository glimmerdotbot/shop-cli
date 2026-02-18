import { randomUUID } from 'node:crypto'

import { CliError } from '../errors'
import { coerceGid } from '../gid'
import { buildInput } from '../input'
import { printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { requireId } from './_shared'

const refundSummarySelection = {
  id: true,
  createdAt: true,
  note: true,
  totalRefundedSet: { shopMoney: { amount: true, currencyCode: true } },
  order: { id: true, name: true },
  refundLineItems: {
    __args: { first: 20 },
    nodes: {
      lineItem: { id: true, title: true },
      quantity: true,
      restockType: true,
      subtotalSet: { shopMoney: { amount: true, currencyCode: true } },
    },
  },
} as const

const refundFullSelection = {
  ...refundSummarySelection,
  duties: {
    originalDuty: { id: true },
    amountSet: { shopMoney: { amount: true, currencyCode: true } },
  },
  transactions: {
    __args: { first: 20 },
    id: true,
    kind: true,
    status: true,
    amountSet: { shopMoney: { amount: true, currencyCode: true } },
    gateway: true,
  },
  refundShippingLines: {
    __args: { first: 20 },
    nodes: {
      shippingLine: { title: true },
      subtotalAmountSet: { shopMoney: { amount: true, currencyCode: true } },
    },
  },
} as const

const getRefundSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return refundFullSelection
  if (view === 'raw') return {} as const
  return refundSummarySelection
}

const suggestedRefundSummarySelection = {
  amountSet: { shopMoney: { amount: true, currencyCode: true } },
  maximumRefundableSet: { shopMoney: { amount: true, currencyCode: true } },
  refundLineItems: {
    lineItem: { id: true, title: true },
    quantity: true,
    restockType: true,
    subtotalSet: { shopMoney: { amount: true, currencyCode: true } },
  },
  shipping: {
    amountSet: { shopMoney: { amount: true, currencyCode: true } },
    maximumRefundableSet: { shopMoney: { amount: true, currencyCode: true } },
    taxSet: { shopMoney: { amount: true, currencyCode: true } },
  },
} as const

const suggestedRefundFullSelection = {
  ...suggestedRefundSummarySelection,
  discountedSubtotalSet: { shopMoney: { amount: true, currencyCode: true } },
  subtotalSet: { shopMoney: { amount: true, currencyCode: true } },
  totalDutiesSet: { shopMoney: { amount: true, currencyCode: true } },
  totalTaxesSet: { shopMoney: { amount: true, currencyCode: true } },
} as const

const getSuggestedRefundSelection = (view: CommandContext['view']) => {
  if (view === 'full') return suggestedRefundFullSelection
  if (view === 'raw') return {} as const
  return suggestedRefundSummarySelection
}

const applyRestock = (input: any, restock: boolean | undefined) => {
  if (!restock) return input
  if (!input || typeof input !== 'object') return input
  if (!Array.isArray(input.refundLineItems)) return input
  return {
    ...input,
    refundLineItems: input.refundLineItems.map((item: any) => ({
      ...item,
      restockType: item.restockType ?? 'RETURN',
    })),
  }
}

export const runRefunds = async ({
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
        '  shop refunds <verb> [flags]',
        '',
        'Verbs:',
        '  create|get|calculate',
        '',
        'Common output flags:',
        '  --view summary|ids|full|raw',
        '  --select <path>        (repeatable; dot paths; adds to base view selection)',
        '  --selection <graphql>  (selection override; can be @file.gql)',
        '',
        'Notes:',
        '  create requires --order-id and --input (refund details).',
        '  --notify sends a refund notification email.',
        '  --restock sets restockType=RETURN for refundLineItems without restockType.',
      ].join('\n'),
    )
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Refund')
    const selection = resolveSelection({
      resource: 'refunds',
      view: ctx.view,
      baseSelection: getRefundSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { refund: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.refund, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'calculate') {
    const args = parseStandardArgs({ argv, extraOptions: { 'order-id': { type: 'string' } } })
    const orderIdRaw = args['order-id'] as string | undefined
    if (!orderIdRaw) throw new CliError('Missing --order-id', 2)
    const orderId = coerceGid(orderIdRaw, 'Order')

    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const selection = resolveSelection({
      resource: 'refunds',
      typeName: 'SuggestedRefund',
      view: ctx.view,
      baseSelection: getSuggestedRefundSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: false,
    })

    const result = await runQuery(ctx, {
      order: { __args: { id: orderId }, suggestedRefund: { __args: built.input, ...selection } },
    })
    if (result === undefined) return
    printJson(result.order?.suggestedRefund, ctx.format !== 'raw')
    return
  }

  if (verb === 'create') {
    const args = parseStandardArgs({
      argv,
      extraOptions: { 'order-id': { type: 'string' }, notify: { type: 'boolean' }, restock: { type: 'boolean' } },
    })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const orderIdRaw = (args['order-id'] as string | undefined) ?? built.input?.orderId
    if (!orderIdRaw) throw new CliError('Missing --order-id', 2)
    let input = { ...built.input, orderId: coerceGid(orderIdRaw, 'Order') }

    if (args.notify) {
      input = { ...input, notify: true }
    }

    input = applyRestock(input, args.restock as any)

    const result = await runMutation(ctx, {
      refundCreate: {
        __directives: { idempotent: { key: randomUUID() } },
        __args: { input },
        refund: refundSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.refundCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.refundCreate?.refund?.id ?? '')
    printJson(result.refundCreate, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for refunds: ${verb}`, 2)
}
