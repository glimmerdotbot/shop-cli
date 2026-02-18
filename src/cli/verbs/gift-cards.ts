import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { parseCsv, parseFirst, parseIds, requireId } from './_shared'

const giftCardSummarySelection = {
  id: true,
  balance: { amount: true, currencyCode: true },
  initialValue: { amount: true, currencyCode: true },
  lastCharacters: true,
  expiresOn: true,
  enabled: true,
  createdAt: true,
  updatedAt: true,
} as const

const giftCardFullSelection = {
  ...giftCardSummarySelection,
  deactivatedAt: true,
  maskedCode: true,
  note: true,
  templateSuffix: true,
  customer: { id: true, displayName: true, email: true },
  order: { id: true, name: true },
  recipientAttributes: {
    message: true,
    preferredName: true,
    sendNotificationAt: true,
    recipient: { id: true, displayName: true, email: true, firstName: true, lastName: true },
  },
} as const

const giftCardConfigurationSelection = {
  expirationConfiguration: { expirationUnit: true, expirationValue: true },
  issueLimit: { amount: true, currencyCode: true },
  purchaseLimit: { amount: true, currencyCode: true },
} as const

const giftCardTransactionSelection = {
  id: true,
  amount: { amount: true, currencyCode: true },
  processedAt: true,
  note: true,
  giftCard: { id: true },
} as const

const getGiftCardSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return giftCardFullSelection
  if (view === 'raw') return {} as const
  return giftCardSummarySelection
}

const parseMoneyInput = (flag: string, value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) throw new CliError(`Missing ${flag}`, 2)
  const raw = value.trim()

  if (raw.startsWith('{')) {
    let parsed: any
    try {
      parsed = JSON.parse(raw)
    } catch (err) {
      throw new CliError(`${flag} must be valid JSON: ${(err as Error).message}`, 2)
    }
    if (parsed === null || typeof parsed !== 'object') {
      throw new CliError(`${flag} must be a JSON object with amount and currencyCode`, 2)
    }
    if (parsed.amount === undefined || parsed.currencyCode === undefined) {
      throw new CliError(`${flag} must include amount and currencyCode`, 2)
    }
    return parsed
  }

  const parts = raw.split(/[,:\s]+/).map((part) => part.trim()).filter(Boolean)
  if (parts.length !== 2) {
    throw new CliError(`${flag} must be in the form "amount,currency" (for example 10.00,USD)`, 2)
  }

  const [amount, currencyCode] = parts
  if (!amount || !currencyCode) {
    throw new CliError(`${flag} must include amount and currency`, 2)
  }

  return { amount, currencyCode: currencyCode.toUpperCase() }
}

const ensureObjectInput = (value: any, label: string) => {
  if (value === null || typeof value !== 'object') throw new CliError(`${label} must be an object`, 2)
  return value as Record<string, any>
}

export const runGiftCards = async ({
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
        'Usage: shop gift-cards <verb> [flags]',
        '',
        'Verbs:',
        '  create            Create a gift card',
        '  get               Get a gift card by ID',
        '  list              List gift cards',
        '  count             Count gift cards',
        '  update            Update a gift card',
        '  credit            Credit a gift card',
        '  debit             Debit a gift card',
        '  deactivate        Deactivate a gift card',
        '  notify-customer   Send a gift card notification to the customer',
        '  notify-recipient  Send a gift card notification to the recipient',
        '  config            Get gift card configuration',
        '',
        'Common output flags:',
        '  --view summary|ids|full|raw',
        '  --select <path>        (repeatable; dot paths; adds to base view selection)',
        '  --selection <graphql>  (selection override; can be @file.gql)',
        '',
        'Special flags:',
        '  --credit-amount <amount,currency>  (credit)',
        '  --debit-amount <amount,currency>   (debit)',
      ].join('\n'),
    )
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'GiftCard')
    const selection = resolveSelection({
      resource: 'gift-cards',
      view: ctx.view,
      baseSelection: getGiftCardSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { giftCard: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.giftCard, format: ctx.format, quiet: ctx.quiet })
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
      resource: 'gift-cards',
      view: ctx.view,
      baseSelection: getGiftCardSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      giftCards: {
        __args: { first, after, query, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({ connection: result.giftCards, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'count') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const query = args.query as any

    const result = await runQuery(ctx, { giftCardsCount: { __args: { query }, count: true, precision: true } })
    if (result === undefined) return
    if (ctx.quiet) return console.log(result.giftCardsCount?.count ?? '')
    printJson(result.giftCardsCount, ctx.format !== 'raw')
    return
  }

  if (verb === 'config') {
    const result = await runQuery(ctx, { giftCardConfiguration: giftCardConfigurationSelection })
    if (result === undefined) return
    printJson(result.giftCardConfiguration, ctx.format !== 'raw')
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
      giftCardCreate: {
        __args: { input: built.input },
        giftCard: giftCardSummarySelection,
        giftCardCode: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.giftCardCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.giftCardCreate?.giftCard?.id ?? '')
    printJson(result.giftCardCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'GiftCard')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      giftCardUpdate: {
        __args: { id, input: built.input },
        giftCard: giftCardSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.giftCardUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.giftCardUpdate?.giftCard?.id ?? '')
    printJson(result.giftCardUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'credit') {
    const args = parseStandardArgs({ argv, extraOptions: { 'credit-amount': { type: 'string' } } })
    const id = requireId(args.id, 'GiftCard')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })

    const creditInput = built.used ? ensureObjectInput(built.input, 'Gift card credit input') : {}
    if (args['credit-amount'] !== undefined) {
      creditInput.creditAmount = parseMoneyInput('--credit-amount', args['credit-amount'])
    }
    if (creditInput.creditAmount === undefined) {
      throw new CliError('Missing --credit-amount or creditAmount in --input/--set', 2)
    }

    const result = await runMutation(ctx, {
      giftCardCredit: {
        __args: { id, creditInput },
        giftCardCreditTransaction: giftCardTransactionSelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.giftCardCredit, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.giftCardCredit?.giftCardCreditTransaction?.id ?? '')
    printJson(result.giftCardCredit, ctx.format !== 'raw')
    return
  }

  if (verb === 'debit') {
    const args = parseStandardArgs({ argv, extraOptions: { 'debit-amount': { type: 'string' } } })
    const id = requireId(args.id, 'GiftCard')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })

    const debitInput = built.used ? ensureObjectInput(built.input, 'Gift card debit input') : {}
    if (args['debit-amount'] !== undefined) {
      debitInput.debitAmount = parseMoneyInput('--debit-amount', args['debit-amount'])
    }
    if (debitInput.debitAmount === undefined) {
      throw new CliError('Missing --debit-amount or debitAmount in --input/--set', 2)
    }

    const result = await runMutation(ctx, {
      giftCardDebit: {
        __args: { id, debitInput },
        giftCardDebitTransaction: giftCardTransactionSelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.giftCardDebit, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.giftCardDebit?.giftCardDebitTransaction?.id ?? '')
    printJson(result.giftCardDebit, ctx.format !== 'raw')
    return
  }

  if (verb === 'deactivate') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'GiftCard')

    const result = await runMutation(ctx, {
      giftCardDeactivate: {
        __args: { id },
        giftCard: giftCardSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.giftCardDeactivate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.giftCardDeactivate?.giftCard?.id ?? '')
    printJson(result.giftCardDeactivate, ctx.format !== 'raw')
    return
  }

  if (verb === 'notify-customer') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'GiftCard')

    const result = await runMutation(ctx, {
      giftCardSendNotificationToCustomer: {
        __args: { id },
        giftCard: giftCardSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.giftCardSendNotificationToCustomer, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.giftCardSendNotificationToCustomer?.giftCard?.id ?? '')
    printJson(result.giftCardSendNotificationToCustomer, ctx.format !== 'raw')
    return
  }

  if (verb === 'notify-recipient') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'GiftCard')

    const result = await runMutation(ctx, {
      giftCardSendNotificationToRecipient: {
        __args: { id },
        giftCard: giftCardSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.giftCardSendNotificationToRecipient, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.giftCardSendNotificationToRecipient?.giftCard?.id ?? '')
    printJson(result.giftCardSendNotificationToRecipient, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for gift-cards: ${verb}`, 2)
}
