import { CliError } from '../errors'
import { coerceGid } from '../gid'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { parseFirst, requireId } from './_shared'

const subscriptionContractSummarySelection = {
  id: true,
  status: true,
  customer: { id: true, displayName: true, email: true },
  nextBillingDate: true,
  billingPolicy: {
    interval: true,
    intervalCount: true,
    minCycles: true,
    maxCycles: true,
  },
  deliveryPolicy: {
    interval: true,
    intervalCount: true,
  },
  lines: {
    __args: { first: 10 },
    nodes: {
      id: true,
      variantId: true,
      title: true,
      variantTitle: true,
      quantity: true,
      currentPrice: { amount: true, currencyCode: true },
    },
  },
  currencyCode: true,
  createdAt: true,
} as const

const subscriptionContractFullSelection = {
  ...subscriptionContractSummarySelection,
  originOrder: { id: true, name: true },
  deliveryMethod: {
    on_SubscriptionDeliveryMethodShipping: {
      address: {
        firstName: true,
        lastName: true,
        address1: true,
        city: true,
        provinceCode: true,
        countryCode: true,
        zip: true,
      },
      shippingOption: { title: true, presentmentTitle: true },
    },
    on_SubscriptionDeliveryMethodLocalDelivery: {
      address: { address1: true, city: true },
      localDeliveryOption: { title: true },
    },
    on_SubscriptionDeliveryMethodPickup: {
      pickupOption: { title: true, locationId: true },
    },
  },
  customerPaymentMethod: {
    id: true,
    instrument: {
      on_CustomerCreditCard: { lastDigits: true, brand: true, expiryYear: true, expiryMonth: true },
      on_CustomerPaypalBillingAgreement: { paypalAccountEmail: true },
    },
  },
  discounts: {
    __args: { first: 5 },
    nodes: {
      id: true,
      title: true,
      value: {
        on_SubscriptionDiscountFixedAmountValue: { amount: { amount: true, currencyCode: true } },
        on_SubscriptionDiscountPercentageValue: { percentage: true },
      },
    },
  },
  orders: {
    __args: { first: 5 },
    nodes: {
      id: true,
      name: true,
      createdAt: true,
    },
  },
  billingAttempts: {
    __args: { first: 5 },
    nodes: {
      id: true,
      ready: true,
      errorCode: true,
      errorMessage: true,
      createdAt: true,
    },
  },
} as const

const subscriptionDraftSummarySelection = {
  id: true,
  customer: { id: true, displayName: true, email: true },
  currencyCode: true,
  billingPolicy: {
    interval: true,
    intervalCount: true,
  },
  deliveryPolicy: {
    interval: true,
    intervalCount: true,
  },
  lines: {
    __args: { first: 10 },
    nodes: {
      id: true,
      title: true,
      quantity: true,
      variantId: true,
    },
  },
} as const

const getSubscriptionContractSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return subscriptionContractFullSelection
  if (view === 'raw') return {} as const
  return subscriptionContractSummarySelection
}

const requireCustomerId = (value: unknown) => {
  if (typeof value !== 'string' || !value) throw new CliError('Missing --customer-id', 2)
  return coerceGid(value, 'Customer')
}

const requireLineId = (value: unknown) => {
  if (typeof value !== 'string' || !value) throw new CliError('Missing --line-id', 2)
  return coerceGid(value, 'SubscriptionLine')
}

export const runSubscriptionContracts = async ({
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
        '  shop subscription-contracts <verb> [flags]',
        '',
        'Verbs:',
        '  get|list|create|atomic-create|update|activate|pause|cancel|expire|fail',
        '  set-next-billing|change-product',
        '',
        'State machine:',
        '  ACTIVE ↔ PAUSED',
        '     ↓       ↓',
        '  CANCELLED  CANCELLED',
        '     │',
        '  EXPIRED / FAILED',
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
    const id = requireId(args.id, 'SubscriptionContract')
    const selection = resolveSelection({
      resource: 'subscription-contracts',
      view: ctx.view,
      baseSelection: getSubscriptionContractSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { subscriptionContract: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.subscriptionContract, format: ctx.format, quiet: ctx.quiet })
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
      resource: 'subscription-contracts',
      view: ctx.view,
      baseSelection: getSubscriptionContractSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      subscriptionContracts: {
        __args: { first, after, query, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({ connection: result.subscriptionContracts, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'create') {
    const args = parseStandardArgs({ argv, extraOptions: { 'customer-id': { type: 'string' } } })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const customerId = args['customer-id'] ? requireCustomerId(args['customer-id']) : undefined
    const input = { ...built.input, ...(customerId ? { customerId } : {}) }

    const result = await runMutation(ctx, {
      subscriptionContractCreate: {
        __args: { input },
        draft: subscriptionDraftSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.subscriptionContractCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.subscriptionContractCreate?.draft?.id ?? '')
    printJson(result.subscriptionContractCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'atomic-create') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      subscriptionContractAtomicCreate: {
        __args: { input: built.input },
        contract: subscriptionContractSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.subscriptionContractAtomicCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.subscriptionContractAtomicCreate?.contract?.id ?? '')
    printJson(result.subscriptionContractAtomicCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const contractId = requireId(args.id, 'SubscriptionContract')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })

    const createDraftResult = await runMutation(ctx, {
      subscriptionContractUpdate: {
        __args: { contractId },
        draft: subscriptionDraftSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (createDraftResult === undefined) return
    maybeFailOnUserErrors({ payload: createDraftResult.subscriptionContractUpdate, failOnUserErrors: ctx.failOnUserErrors })

    const draftId = createDraftResult.subscriptionContractUpdate?.draft?.id
    if (!draftId) {
      if (ctx.quiet) return
      printJson(createDraftResult.subscriptionContractUpdate, ctx.format !== 'raw')
      return
    }

    if (!built.used) {
      if (ctx.quiet) return console.log(draftId)
      printJson(createDraftResult.subscriptionContractUpdate, ctx.format !== 'raw')
      return
    }

    const updateResult = await runMutation(ctx, {
      subscriptionDraftUpdate: {
        __args: { draftId, input: built.input },
        draft: subscriptionDraftSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (updateResult === undefined) return
    maybeFailOnUserErrors({ payload: updateResult.subscriptionDraftUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(updateResult.subscriptionDraftUpdate?.draft?.id ?? '')
    printJson(updateResult.subscriptionDraftUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'activate' || verb === 'pause' || verb === 'cancel' || verb === 'expire' || verb === 'fail') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const subscriptionContractId = requireId(args.id, 'SubscriptionContract')
    const mutationField =
      verb === 'activate'
        ? 'subscriptionContractActivate'
        : verb === 'pause'
          ? 'subscriptionContractPause'
          : verb === 'cancel'
            ? 'subscriptionContractCancel'
            : verb === 'expire'
              ? 'subscriptionContractExpire'
              : 'subscriptionContractFail'

    const result = await runMutation(ctx, {
      [mutationField]: {
        __args: { subscriptionContractId },
        contract: subscriptionContractSummarySelection,
        userErrors: { field: true, message: true },
      },
    } as any)
    if (result === undefined) return
    const payload = (result as any)[mutationField]
    maybeFailOnUserErrors({ payload, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(payload?.contract?.id ?? '')
    printJson(payload, ctx.format !== 'raw')
    return
  }

  if (verb === 'set-next-billing') {
    const args = parseStandardArgs({ argv, extraOptions: { date: { type: 'string' } } })
    const subscriptionContractId = requireId(args.id, 'SubscriptionContract')
    const date = args.date as string | undefined
    if (!date) throw new CliError('Missing --date', 2)

    const result = await runMutation(ctx, {
      subscriptionContractSetNextBillingDate: {
        __args: { contractId: subscriptionContractId, date },
        contract: subscriptionContractSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.subscriptionContractSetNextBillingDate,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.subscriptionContractSetNextBillingDate?.contract?.id ?? '')
    printJson(result.subscriptionContractSetNextBillingDate, ctx.format !== 'raw')
    return
  }

  if (verb === 'change-product') {
    const args = parseStandardArgs({ argv, extraOptions: { 'line-id': { type: 'string' } } })
    const subscriptionContractId = requireId(args.id, 'SubscriptionContract')
    const lineId = requireLineId(args['line-id'])
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      subscriptionContractProductChange: {
        __args: { subscriptionContractId, lineId, input: built.input },
        contract: subscriptionContractSummarySelection,
        lineUpdated: { id: true, title: true, quantity: true, variantId: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.subscriptionContractProductChange, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.subscriptionContractProductChange?.contract?.id ?? '')
    printJson(result.subscriptionContractProductChange, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for subscription-contracts: ${verb}`, 2)
}
