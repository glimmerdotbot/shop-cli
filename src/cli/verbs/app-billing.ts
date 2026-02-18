import { CliError } from '../errors'
import { buildInput } from '../input'
import { printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { parseCsv, parseJsonArg, requireId } from './_shared'

const appInstallationSelection = {
  id: true,
  activeSubscriptions: {
    id: true,
    name: true,
    status: true,
  },
} as const

const getAppInstallationSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'raw') return {} as const
  return appInstallationSelection
}

const parseMoneyInput = ({ amount, currency }: { amount?: string; currency?: string }) => {
  if (!amount) return undefined
  const num = Number(amount)
  if (!Number.isFinite(num)) throw new CliError('--amount must be a number', 2)
  return { amount: num, currencyCode: currency }
}

export const runAppBilling = async ({
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
        '  shop app-billing <verb> [flags]',
        '',
        'Verbs:',
        '  create-one-time|create-subscription|cancel-subscription',
        '  update-line-item|extend-trial|create-usage-record',
        '  get-installation|list-subscriptions',
        '',
        'Plan 5 verbs:',
        '  purchase-one-time-create|subscription-create',
        '  subscription-trial-extend|usage-record-create',
        '  uninstall|revoke-access-scopes',
      ].join('\n'),
    )
    return
  }

  if (verb === 'purchase-one-time-create') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        name: { type: 'string' },
        amount: { type: 'string' },
        currency: { type: 'string' },
        'return-url': { type: 'string' },
        test: { type: 'boolean' },
      },
    })

    const name = args.name as string | undefined
    const returnUrl = args['return-url'] as string | undefined
    const amountRaw = args.amount as string | undefined
    const currency = args.currency as string | undefined
    const test = args.test as boolean | undefined

    if (!name) throw new CliError('Missing --name', 2)
    if (!returnUrl) throw new CliError('Missing --return-url', 2)
    if (!amountRaw) throw new CliError('Missing --amount', 2)
    if (!currency) throw new CliError('Missing --currency', 2)

    const amount = Number(amountRaw)
    if (!Number.isFinite(amount)) throw new CliError('--amount must be a number', 2)

    const result = await runMutation(ctx, {
      appPurchaseOneTimeCreate: {
        __args: { name, returnUrl, price: { amount, currencyCode: currency }, ...(test === undefined ? {} : { test }) },
        appPurchaseOneTime: { id: true, name: true, status: true },
        confirmationUrl: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.appPurchaseOneTimeCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.appPurchaseOneTimeCreate?.appPurchaseOneTime?.id ?? '')
    printJson(result.appPurchaseOneTimeCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'subscription-create') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        name: { type: 'string' },
        'return-url': { type: 'string' },
        'line-items': { type: 'string' },
        test: { type: 'boolean' },
        'trial-days': { type: 'string' },
        'replacement-behavior': { type: 'string' },
      },
    })

    const name = args.name as string | undefined
    const returnUrl = args['return-url'] as string | undefined
    if (!name) throw new CliError('Missing --name', 2)
    if (!returnUrl) throw new CliError('Missing --return-url', 2)

    const lineItemsRaw = (args as any)['line-items'] as string | undefined
    const parsedLineItems = lineItemsRaw ? parseJsonArg(lineItemsRaw, '--line-items') : []
    if (!Array.isArray(parsedLineItems)) throw new CliError('--line-items must be a JSON array', 2)

    const trialDaysRaw = (args as any)['trial-days'] as string | undefined
    const trialDays =
      trialDaysRaw === undefined ? undefined : Number.isFinite(Number(trialDaysRaw)) ? Math.floor(Number(trialDaysRaw)) : undefined
    if (trialDaysRaw !== undefined && trialDays === undefined) throw new CliError('--trial-days must be an integer', 2)

    const replacementBehavior = (args as any)['replacement-behavior'] as any
    const test = args.test as boolean | undefined

    const result = await runMutation(ctx, {
      appSubscriptionCreate: {
        __args: {
          name,
          returnUrl,
          lineItems: parsedLineItems as any,
          ...(replacementBehavior ? { replacementBehavior } : {}),
          ...(test === undefined ? {} : { test }),
          ...(trialDays === undefined ? {} : { trialDays }),
        },
        appSubscription: { id: true, name: true, status: true },
        confirmationUrl: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.appSubscriptionCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.appSubscriptionCreate?.appSubscription?.id ?? '')
    printJson(result.appSubscriptionCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'subscription-trial-extend') {
    const args = parseStandardArgs({ argv, extraOptions: { days: { type: 'string' } } })
    const id = requireId(args.id, 'AppSubscription')
    const days = Number(args.days)
    if (!Number.isFinite(days) || days <= 0) throw new CliError('--days must be a positive integer', 2)

    const result = await runMutation(ctx, {
      appSubscriptionTrialExtend: {
        __args: { id, days: Math.floor(days) },
        appSubscription: { id: true, name: true, status: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.appSubscriptionTrialExtend, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.appSubscriptionTrialExtend?.appSubscription?.id ?? '')
    printJson(result.appSubscriptionTrialExtend, ctx.format !== 'raw')
    return
  }

  if (verb === 'usage-record-create') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'subscription-line-item-id': { type: 'string' },
        description: { type: 'string' },
        amount: { type: 'string' },
        currency: { type: 'string' },
        'idempotency-key': { type: 'string' },
      },
    })
    const subscriptionLineItemId = (args as any)['subscription-line-item-id'] as string | undefined
    const description = args.description as string | undefined
    const amountRaw = args.amount as string | undefined
    const currency = args.currency as string | undefined
    const idempotencyKey = (args as any)['idempotency-key'] as string | undefined

    if (!subscriptionLineItemId) throw new CliError('Missing --subscription-line-item-id', 2)
    if (!description) throw new CliError('Missing --description', 2)
    if (!amountRaw) throw new CliError('Missing --amount', 2)
    if (!currency) throw new CliError('Missing --currency', 2)

    const amount = Number(amountRaw)
    if (!Number.isFinite(amount)) throw new CliError('--amount must be a number', 2)

    const result = await runMutation(ctx, {
      appUsageRecordCreate: {
        __args: {
          subscriptionLineItemId,
          description,
          price: { amount, currencyCode: currency },
          ...(idempotencyKey ? { idempotencyKey } : {}),
        },
        appUsageRecord: { id: true, description: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.appUsageRecordCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.appUsageRecordCreate?.appUsageRecord?.id ?? '')
    printJson(result.appUsageRecordCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'uninstall') {
    const result = await runMutation(ctx, {
      appUninstall: {
        app: { id: true, handle: true, apiKey: true },
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.appUninstall, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.appUninstall?.app?.id ?? '')
    printJson(result.appUninstall, ctx.format !== 'raw')
    return
  }

  if (verb === 'revoke-access-scopes') {
    const args = parseStandardArgs({ argv, extraOptions: { scopes: { type: 'string' } } })
    const raw = (args as any).scopes as string | undefined
    if (!raw) throw new CliError('Missing --scopes', 2)
    const scopes = parseCsv(raw, '--scopes')

    const result = await runMutation(ctx, {
      appRevokeAccessScopes: {
        __args: { scopes },
        revoked: { handle: true, description: true },
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.appRevokeAccessScopes, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.appRevokeAccessScopes?.revoked ?? '')
    printJson(result.appRevokeAccessScopes, ctx.format !== 'raw')
    return
  }

  if (verb === 'create-one-time') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        name: { type: 'string' },
        amount: { type: 'string' },
        currency: { type: 'string' },
        'return-url': { type: 'string' },
        test: { type: 'boolean' },
      },
    })

    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    const input = built.used ? (built.input as any) : {}

    const name = (args.name as string | undefined) ?? input.name
    const returnUrl = (args['return-url'] as string | undefined) ?? input.returnUrl
    const test = args.test !== undefined ? Boolean(args.test) : input.test

    const price =
      input.price ??
      parseMoneyInput({ amount: args.amount as string | undefined, currency: args.currency as string | undefined })

    if (!name || !returnUrl || !price) {
      throw new CliError('Missing required fields (name, returnUrl, price)', 2)
    }

    const result = await runMutation(ctx, {
      appPurchaseOneTimeCreate: {
        __args: { name, price, returnUrl, ...(test === undefined ? {} : { test }) },
        appPurchaseOneTime: { id: true, name: true, status: true },
        confirmationUrl: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.appPurchaseOneTimeCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.appPurchaseOneTimeCreate?.appPurchaseOneTime?.id ?? '')
    printJson(result.appPurchaseOneTimeCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'create-subscription') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const input = built.input as any
    const { lineItems, name, returnUrl, replacementBehavior, test, trialDays } = input

    if (!lineItems || !name || !returnUrl) {
      throw new CliError('Subscription input must include lineItems, name, and returnUrl', 2)
    }

    const result = await runMutation(ctx, {
      appSubscriptionCreate: {
        __args: {
          lineItems,
          name,
          returnUrl,
          ...(replacementBehavior ? { replacementBehavior } : {}),
          ...(test === undefined ? {} : { test }),
          ...(trialDays === undefined ? {} : { trialDays }),
        },
        appSubscription: { id: true, name: true, status: true },
        confirmationUrl: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.appSubscriptionCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.appSubscriptionCreate?.appSubscription?.id ?? '')
    printJson(result.appSubscriptionCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'cancel-subscription') {
    const args = parseStandardArgs({ argv, extraOptions: { prorate: { type: 'boolean' } } })
    const id = requireId(args.id, 'AppSubscription')
    const prorate = args.prorate as boolean | undefined

    const result = await runMutation(ctx, {
      appSubscriptionCancel: {
        __args: { id, ...(prorate === undefined ? {} : { prorate }) },
        appSubscription: { id: true, name: true, status: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.appSubscriptionCancel, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.appSubscriptionCancel?.appSubscription?.id ?? '')
    printJson(result.appSubscriptionCancel, ctx.format !== 'raw')
    return
  }

  if (verb === 'update-line-item') {
    const args = parseStandardArgs({
      argv,
      extraOptions: { 'line-item-id': { type: 'string' }, amount: { type: 'string' }, currency: { type: 'string' } },
    })
    const lineItemId = args['line-item-id'] ?? args.id
    if (!lineItemId) throw new CliError('Missing --line-item-id', 2)

    const cappedAmount = parseMoneyInput({
      amount: args.amount as string | undefined,
      currency: args.currency as string | undefined,
    })

    const inputCapped = args.input ? parseJsonArg(args.input, '--input', { allowEmpty: true }) : undefined
    const money = inputCapped ?? cappedAmount
    if (!money) throw new CliError('Missing --amount/--currency or --input', 2)

    const result = await runMutation(ctx, {
      appSubscriptionLineItemUpdate: {
        __args: { id: lineItemId as string, cappedAmount: money },
        appSubscription: { id: true, name: true },
        confirmationUrl: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.appSubscriptionLineItemUpdate,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    printJson(result.appSubscriptionLineItemUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'extend-trial') {
    const args = parseStandardArgs({ argv, extraOptions: { days: { type: 'string' } } })
    const id = requireId(args.id, 'AppSubscription')
    const days = Number(args.days)
    if (!Number.isFinite(days) || days <= 0) throw new CliError('--days must be a positive integer', 2)

    const result = await runMutation(ctx, {
      appSubscriptionTrialExtend: {
        __args: { id, days: Math.floor(days) },
        appSubscription: { id: true, name: true, status: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.appSubscriptionTrialExtend, failOnUserErrors: ctx.failOnUserErrors })
    printJson(result.appSubscriptionTrialExtend, ctx.format !== 'raw')
    return
  }

  if (verb === 'create-usage-record') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'subscription-line-item-id': { type: 'string' },
        description: { type: 'string' },
        amount: { type: 'string' },
        currency: { type: 'string' },
        'idempotency-key': { type: 'string' },
      },
    })
    const subscriptionLineItemId = args['subscription-line-item-id'] as string | undefined
    if (!subscriptionLineItemId) throw new CliError('Missing --subscription-line-item-id', 2)

    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    const input = built.used ? (built.input as any) : {}

    const description = (args.description as string | undefined) ?? input.description
    const idempotencyKey = (args['idempotency-key'] as string | undefined) ?? input.idempotencyKey
    const price =
      input.price ??
      parseMoneyInput({ amount: args.amount as string | undefined, currency: args.currency as string | undefined })

    if (!description || !price) {
      throw new CliError('Missing required fields (description, price)', 2)
    }

    const result = await runMutation(ctx, {
      appUsageRecordCreate: {
        __args: {
          subscriptionLineItemId,
          description,
          price,
          ...(idempotencyKey ? { idempotencyKey } : {}),
        },
        appUsageRecord: { id: true, description: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.appUsageRecordCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.appUsageRecordCreate?.appUsageRecord?.id ?? '')
    printJson(result.appUsageRecordCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'get-installation' || verb === 'list-subscriptions') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = args.id ? requireId(args.id, 'AppInstallation') : undefined

    const selection = resolveSelection({
      resource: 'app-billing',
      typeName: 'AppInstallation',
      view: ctx.view,
      baseSelection: getAppInstallationSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { appInstallation: { __args: { ...(id ? { id } : {}) }, ...selection } })
    if (result === undefined) return

    if (verb === 'get-installation') {
      printNode({ node: result.appInstallation, format: ctx.format, quiet: ctx.quiet })
      return
    }

    const subscriptions = result.appInstallation?.activeSubscriptions ?? []
    printJson(subscriptions, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for app-billing: ${verb}`, 2)
}
