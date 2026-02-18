import { CliError } from '../errors'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'
import { coerceGid } from '../gid'

import { parseFirst, requireId } from './_shared'

const abandonedCheckoutSummarySelection = {
  id: true,
  name: true,
  createdAt: true,
  completedAt: true,
  abandonedCheckoutUrl: true,
  customer: { id: true, email: true, displayName: true },
  totalPriceSet: { shopMoney: { amount: true, currencyCode: true } },
} as const

const abandonedCheckoutFullSelection = {
  ...abandonedCheckoutSummarySelection,
  updatedAt: true,
  subtotalPriceSet: { shopMoney: { amount: true, currencyCode: true } },
  totalDiscountSet: { shopMoney: { amount: true, currencyCode: true } },
  lineItems: {
    __args: { first: 25 },
    nodes: {
      id: true,
      title: true,
      quantity: true,
      originalUnitPriceSet: { shopMoney: { amount: true, currencyCode: true } },
      variant: { id: true, title: true },
      product: { id: true, title: true },
    },
    pageInfo: { hasNextPage: true, endCursor: true },
  },
} as const

const getAbandonedCheckoutSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return abandonedCheckoutFullSelection
  if (view === 'raw') return {} as const
  return abandonedCheckoutSummarySelection
}

const abandonmentSummarySelection = {
  id: true,
  abandonmentType: true,
  createdAt: true,
  updatedAt: true,
  emailState: true,
  emailSentAt: true,
  lastActivityDate: true,
  hasCompletedOrder: true,
  hasDraftOrder: true,
  customer: { id: true, email: true, displayName: true },
  abandonedCheckoutPayload: { id: true, name: true, abandonedCheckoutUrl: true },
} as const

export const runAbandonedCheckouts = async ({
  ctx,
  verb,
  argv,
}: {
  ctx: CommandContext
  verb: string
  argv: string[]
}) => {
  if (verb === 'list') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const query = args.query as any
    const reverse = args.reverse as any
    const sortKey = args.sort as any

    const nodeSelection = resolveSelection({
      view: ctx.view,
      baseSelection: getAbandonedCheckoutSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      abandonedCheckouts: {
        __args: { first, after, query, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({ connection: result.abandonedCheckouts, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'count') {
    const args = parseStandardArgs({ argv, extraOptions: { limit: { type: 'string' } } })
    const query = args.query as any
    const limitRaw = (args as any).limit as any
    const limit =
      limitRaw === undefined || limitRaw === null || limitRaw === ''
        ? undefined
        : Number(limitRaw)

    if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0)) {
      throw new CliError('--limit must be a positive number', 2)
    }

    const result = await runQuery(ctx, {
      abandonedCheckoutsCount: {
        __args: {
          ...(query ? { query } : {}),
          ...(limit !== undefined ? { limit: Math.floor(limit) } : {}),
        },
        count: true,
        precision: true,
      },
    })
    if (result === undefined) return
    if (ctx.quiet) return console.log(result.abandonedCheckoutsCount?.count ?? '')
    printJson(result.abandonedCheckoutsCount, ctx.format !== 'raw')
    return
  }

  if (verb === 'abandonment') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Abandonment')
    const selection = resolveSelection({
      view: ctx.view,
      baseSelection: abandonmentSummarySelection as any,
      select: args.select,
      selection: (args as any).selection,
      ensureId: ctx.quiet,
    })
    const result = await runQuery(ctx, { abandonment: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.abandonment, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'abandonment-by-checkout') {
    const args = parseStandardArgs({ argv, extraOptions: { 'checkout-id': { type: 'string' } } })
    const checkoutIdRaw = (args as any)['checkout-id'] as string | undefined
    if (!checkoutIdRaw) throw new CliError('Missing --checkout-id', 2)
    const abandonedCheckoutId = coerceGid(checkoutIdRaw, 'AbandonedCheckout')

    const selection = resolveSelection({
      view: ctx.view,
      baseSelection: abandonmentSummarySelection as any,
      select: args.select,
      selection: (args as any).selection,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      abandonmentByAbandonedCheckoutId: { __args: { abandonedCheckoutId }, ...selection },
    })
    if (result === undefined) return
    printNode({
      node: result.abandonmentByAbandonedCheckoutId,
      format: ctx.format,
      quiet: ctx.quiet,
    })
    return
  }

  if (verb === 'update-email-state') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        state: { type: 'string' },
        'email-sent-at': { type: 'string' },
        reason: { type: 'string' },
      },
    })
    const id = requireId(args.id, 'Abandonment')
    const emailState = (args as any).state as string | undefined
    if (!emailState) throw new CliError('Missing --state', 2)

    const emailSentAt = (args as any)['email-sent-at'] as string | undefined
    const emailStateChangeReason = (args as any).reason as string | undefined

    const result = await runMutation(ctx, {
      abandonmentEmailStateUpdate: {
        __args: {
          id,
          emailState,
          ...(emailSentAt ? { emailSentAt } : {}),
          ...(emailStateChangeReason ? { emailStateChangeReason } : {}),
        },
        abandonment: abandonmentSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.abandonmentEmailStateUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.abandonmentEmailStateUpdate?.abandonment?.id ?? '')
    printJson(result.abandonmentEmailStateUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update-activity-delivery-status') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'abandonment-id': { type: 'string' },
        'marketing-activity-id': { type: 'string' },
        status: { type: 'string' },
        'delivered-at': { type: 'string' },
        reason: { type: 'string' },
      },
    })

    const abandonmentIdRaw = (args as any)['abandonment-id'] as string | undefined
    const marketingActivityIdRaw = (args as any)['marketing-activity-id'] as string | undefined
    const deliveryStatus = (args as any).status as string | undefined
    if (!abandonmentIdRaw) throw new CliError('Missing --abandonment-id', 2)
    if (!marketingActivityIdRaw) throw new CliError('Missing --marketing-activity-id', 2)
    if (!deliveryStatus) throw new CliError('Missing --status', 2)

    const abandonmentId = coerceGid(abandonmentIdRaw, 'Abandonment')
    const marketingActivityId = coerceGid(marketingActivityIdRaw, 'MarketingActivity')
    const deliveredAt = (args as any)['delivered-at'] as string | undefined
    const deliveryStatusChangeReason = (args as any).reason as string | undefined

    const result = await runMutation(ctx, {
      abandonmentUpdateActivitiesDeliveryStatuses: {
        __args: {
          abandonmentId,
          marketingActivityId,
          deliveryStatus,
          ...(deliveredAt ? { deliveredAt } : {}),
          ...(deliveryStatusChangeReason ? { deliveryStatusChangeReason } : {}),
        },
        abandonment: abandonmentSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.abandonmentUpdateActivitiesDeliveryStatuses,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.abandonmentUpdateActivitiesDeliveryStatuses?.abandonment?.id ?? '')
    printJson(result.abandonmentUpdateActivitiesDeliveryStatuses, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for abandoned-checkouts: ${verb}`, 2)
}
