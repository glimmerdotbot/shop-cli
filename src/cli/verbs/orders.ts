import { CliError } from '../errors'
import { coerceGid } from '../gid'
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

const parseCustomIdInput = ({
  namespace,
  key,
  value,
}: {
  namespace?: unknown
  key?: unknown
  value?: unknown
}) => {
  const customKey = typeof key === 'string' ? key : undefined
  const customValue = typeof value === 'string' ? value : undefined
  if (!customKey || !customValue) return undefined
  const ns = typeof namespace === 'string' && namespace ? namespace : undefined
  return { ...(ns ? { namespace: ns } : {}), key: customKey, value: customValue }
}

const requireOrderIdFlag = (value: unknown, flag = '--order-id') => {
  if (typeof value !== 'string' || !value) throw new CliError(`Missing ${flag}`, 2)
  return coerceGid(value, 'Order')
}

const requirePaymentReferenceId = (value: unknown) => {
  if (typeof value !== 'string' || !value) throw new CliError('Missing --payment-reference-id', 2)
  return value
}

const parseBoolFlag = (value: unknown, flag: string) => {
  if (value === undefined) return undefined
  if (typeof value !== 'string') throw new CliError(`${flag} must be true|false`, 2)
  const v = value.trim().toLowerCase()
  if (v === 'true' || v === '1' || v === 'yes') return true
  if (v === 'false' || v === '0' || v === 'no') return false
  throw new CliError(`${flag} must be true|false`, 2)
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
        '  by-identifier|pending-count',
        '  payment-status|capture|create-manual-payment|invoice-send|open',
        '  customer-set|customer-remove|risk-assessment-create',
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

  if (verb === 'pending-count') {
    const result = await runQuery(ctx, { pendingOrdersCount: { count: true, precision: true } })
    if (result === undefined) return
    if (ctx.quiet) return console.log(result.pendingOrdersCount?.count ?? '')
    printJson(result.pendingOrdersCount, ctx.format !== 'raw')
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

  if (verb === 'by-identifier') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'custom-id-namespace': { type: 'string' },
        'custom-id-key': { type: 'string' },
        'custom-id-value': { type: 'string' },
      },
    })

    const idRaw = args.id as string | undefined
    const customId = parseCustomIdInput({
      namespace: (args as any)['custom-id-namespace'],
      key: (args as any)['custom-id-key'],
      value: (args as any)['custom-id-value'],
    })
    if (!idRaw && !customId) throw new CliError('Missing --id or --custom-id-key/--custom-id-value', 2)

    const identifier: any = {
      ...(idRaw ? { id: coerceGid(idRaw, 'Order') } : {}),
      ...(customId ? { customId } : {}),
    }

    const selection = resolveSelection({
      resource: 'orders',
      view: ctx.view,
      baseSelection: getOrderSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { orderByIdentifier: { __args: { identifier }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.orderByIdentifier, format: ctx.format, quiet: ctx.quiet })
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

  if (verb === 'payment-status') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'payment-reference-id': { type: 'string' },
        'order-id': { type: 'string' },
      },
    })
    const orderId =
      (args as any)['order-id'] !== undefined
        ? requireOrderIdFlag((args as any)['order-id'], '--order-id')
        : requireOrderIdFlag(args.id, '--id')

    const paymentReferenceId =
      (args as any)['payment-reference-id'] !== undefined
        ? requirePaymentReferenceId((args as any)['payment-reference-id'])
        : (() => {
            throw new CliError('Missing --payment-reference-id', 2)
          })()

    const result = await runQuery(ctx, {
      orderPaymentStatus: {
        __args: { orderId, paymentReferenceId },
        paymentReferenceId: true,
        status: true,
        errorMessage: true,
        translatedErrorMessage: true,
        transactions: { id: true, kind: true, status: true, amount: true, createdAt: true },
      },
    })
    if (result === undefined) return
    if (ctx.quiet) return console.log(result.orderPaymentStatus?.status ?? '')
    printJson(result.orderPaymentStatus, ctx.format !== 'raw')
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

  if (verb === 'capture') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'parent-transaction-id': { type: 'string' },
        amount: { type: 'string' },
        currency: { type: 'string' },
        'final-capture': { type: 'string' },
      },
    })
    const id = requireId(args.id, 'Order')

    const parentTransactionIdRaw = (args as any)['parent-transaction-id'] as string | undefined
    const parentTransactionId =
      parentTransactionIdRaw !== undefined
        ? coerceGid(parentTransactionIdRaw, 'OrderTransaction')
        : (() => {
            throw new CliError('Missing --parent-transaction-id', 2)
          })()

    const amount =
      (args as any).amount !== undefined
        ? parseTextArg((args as any).amount, '--amount')
        : (() => {
            throw new CliError('Missing --amount', 2)
          })()

    const currency = (args as any).currency !== undefined ? parseTextArg((args as any).currency, '--currency') : undefined
    const finalCapture = parseBoolFlag((args as any)['final-capture'], '--final-capture')

    const result = await runMutation(ctx, {
      orderCapture: {
        __args: {
          input: {
            id,
            parentTransactionId,
            amount,
            ...(currency ? { currency: currency as any } : {}),
            ...(finalCapture === undefined ? {} : { finalCapture }),
          },
        },
        transaction: { id: true, kind: true, status: true, amount: true, createdAt: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.orderCapture, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.orderCapture?.transaction?.id ?? '')
    printJson(result.orderCapture, ctx.format !== 'raw')
    return
  }

  if (verb === 'create-manual-payment') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        amount: { type: 'string' },
        currency: { type: 'string' },
        'payment-method-name': { type: 'string' },
        'processed-at': { type: 'string' },
      },
    })
    const id = requireId(args.id, 'Order')

    const amountRaw = (args as any).amount as string | undefined
    const currencyRaw = (args as any).currency as string | undefined
    const amount = amountRaw ? parseTextArg(amountRaw, '--amount') : undefined
    const currencyCode = currencyRaw ? parseTextArg(currencyRaw, '--currency') : undefined
    if (amount !== undefined && !currencyCode) {
      throw new CliError('Missing --currency (required with --amount)', 2)
    }

    const paymentMethodName = (args as any)['payment-method-name'] as string | undefined
    const processedAt = (args as any)['processed-at'] as string | undefined

    const result = await runMutation(ctx, {
      orderCreateManualPayment: {
        __args: {
          id,
          ...(amount !== undefined && currencyCode ? { amount: { amount, currencyCode } } : {}),
          ...(paymentMethodName ? { paymentMethodName } : {}),
          ...(processedAt ? { processedAt } : {}),
        },
        order: orderSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.orderCreateManualPayment, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.orderCreateManualPayment?.order?.id ?? '')
    printJson(result.orderCreateManualPayment, ctx.format !== 'raw')
    return
  }

  if (verb === 'invoice-send') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        email: { type: 'string' },
      },
    })
    const id = requireId(args.id, 'Order')
    const emailRaw = (args as any).email as string | undefined
    const email = emailRaw ? parseJsonArg(emailRaw, '--email') : undefined
    if (email !== undefined && (email === null || typeof email !== 'object' || Array.isArray(email))) {
      throw new CliError('--email must be a JSON object', 2)
    }

    const result = await runMutation(ctx, {
      orderInvoiceSend: {
        __args: { id, ...(email ? { email } : {}) },
        order: orderSummarySelection,
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.orderInvoiceSend, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.orderInvoiceSend?.order?.id ?? '')
    printJson(result.orderInvoiceSend, ctx.format !== 'raw')
    return
  }

  if (verb === 'open') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Order')

    const result = await runMutation(ctx, {
      orderOpen: {
        __args: { input: { id } },
        order: orderSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.orderOpen, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.orderOpen?.order?.id ?? '')
    printJson(result.orderOpen, ctx.format !== 'raw')
    return
  }

  if (verb === 'customer-set') {
    const args = parseStandardArgs({ argv, extraOptions: { 'customer-id': { type: 'string' } } })
    const orderId = requireId(args.id as any, 'Order')
    const customerIdRaw = (args as any)['customer-id'] as string | undefined
    if (!customerIdRaw) throw new CliError('Missing --customer-id', 2)
    const customerId = coerceGid(customerIdRaw, 'Customer')

    const result = await runMutation(ctx, {
      orderCustomerSet: {
        __args: { orderId, customerId },
        order: orderSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.orderCustomerSet, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.orderCustomerSet?.order?.id ?? '')
    printJson(result.orderCustomerSet, ctx.format !== 'raw')
    return
  }

  if (verb === 'customer-remove') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const orderId = requireId(args.id as any, 'Order')

    const result = await runMutation(ctx, {
      orderCustomerRemove: {
        __args: { orderId },
        order: orderSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.orderCustomerRemove, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.orderCustomerRemove?.order?.id ?? '')
    printJson(result.orderCustomerRemove, ctx.format !== 'raw')
    return
  }

  if (verb === 'risk-assessment-create') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'risk-level': { type: 'string' },
        facts: { type: 'string' },
      },
    })
    const orderId = requireId(args.id as any, 'Order')

    const riskLevel = (args as any)['risk-level'] as string | undefined
    const factsRaw = (args as any).facts as string | undefined

    const orderRiskAssessmentInput: any = {
      orderId,
      riskLevel,
      facts: factsRaw ? parseJsonArg(factsRaw, '--facts') : undefined,
    }

    if (!orderRiskAssessmentInput.riskLevel) throw new CliError('Missing --risk-level', 2)
    if (!Array.isArray(orderRiskAssessmentInput.facts) || orderRiskAssessmentInput.facts.length === 0) {
      throw new CliError('Missing --facts', 2)
    }

    const result = await runMutation(ctx, {
      orderRiskAssessmentCreate: {
        __args: { orderRiskAssessmentInput },
        orderRiskAssessment: { riskLevel: true, facts: { sentiment: true, description: true } },
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.orderRiskAssessmentCreate, failOnUserErrors: ctx.failOnUserErrors })
    printJson(result.orderRiskAssessmentCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'create-mandate-payment') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'mandate-id': { type: 'string' },
        'payment-schedule-id': { type: 'string' },
        'idempotency-key': { type: 'string' },
        amount: { type: 'string' },
        'auto-capture': { type: 'string' },
      },
    })

    const id = requireId(args.id, 'Order')
    const mandateIdRaw = (args as any)['mandate-id'] as string | undefined
    if (!mandateIdRaw) throw new CliError('Missing --mandate-id', 2)
    const mandateId = coerceGid(mandateIdRaw, 'PaymentMandate')

    const idempotencyKey = (args as any)['idempotency-key'] as string | undefined
    if (!idempotencyKey) throw new CliError('Missing --idempotency-key', 2)

    const paymentScheduleIdRaw = (args as any)['payment-schedule-id'] as string | undefined
    const paymentScheduleId = paymentScheduleIdRaw
      ? coerceGid(paymentScheduleIdRaw, 'PaymentSchedule')
      : undefined

    const amount = (args as any).amount !== undefined ? parseJsonArg((args as any).amount, '--amount') : undefined

    const autoCaptureRaw = (args as any)['auto-capture'] as string | undefined
    const autoCapture =
      autoCaptureRaw === undefined
        ? undefined
        : (() => {
            const v = autoCaptureRaw.trim().toLowerCase()
            if (v === 'true' || v === '1' || v === 'yes') return true
            if (v === 'false' || v === '0' || v === 'no') return false
            throw new CliError('--auto-capture must be true|false', 2)
          })()

    const result = await runMutation(ctx, {
      orderCreateMandatePayment: {
        __args: {
          id,
          ...(paymentScheduleId ? { paymentScheduleId } : {}),
          idempotencyKey,
          mandateId,
          ...(amount ? { amount } : {}),
          ...(autoCapture === undefined ? {} : { autoCapture }),
        },
        job: { id: true, done: true },
        paymentReferenceId: true,
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.orderCreateMandatePayment,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) {
      return console.log(result.orderCreateMandatePayment?.paymentReferenceId ?? result.orderCreateMandatePayment?.job?.id ?? '')
    }
    printJson(result.orderCreateMandatePayment, ctx.format !== 'raw')
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

  if (verb === 'transaction-void') {
    const args = parseStandardArgs({ argv, extraOptions: { 'parent-transaction-id': { type: 'string' } } })
    const parentTransactionIdRaw = (args as any)['parent-transaction-id'] as string | undefined
    if (!parentTransactionIdRaw) throw new CliError('Missing --parent-transaction-id', 2)
    const parentTransactionId = coerceGid(parentTransactionIdRaw, 'OrderTransaction')

    const result = await runMutation(ctx, {
      transactionVoid: {
        __args: { parentTransactionId },
        transaction: { id: true, kind: true, status: true, createdAt: true },
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.transactionVoid, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.transactionVoid?.transaction?.id ?? '')
    printJson(result.transactionVoid, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for orders: ${verb}`, 2)
}
