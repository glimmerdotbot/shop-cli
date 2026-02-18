import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { parseFirst, parseJsonArg, requireId } from './_shared'

const storeCreditAccountSelection = {
  id: true,
  balance: { amount: true, currencyCode: true },
  owner: {
    on_Customer: { id: true, displayName: true, email: true },
    on_CompanyLocation: { id: true, name: true },
  },
  transactions: {
    __args: { first: 10 },
    nodes: {
      __typename: true,
      amount: { amount: true, currencyCode: true },
      createdAt: true,
    },
  },
} as const

const getStoreCreditSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'raw') return {} as const
  return storeCreditAccountSelection
}

export const runStoreCredit = async ({
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
        '  shop store-credit <verb> [flags]',
        '',
        'Verbs:',
        '  get|credit|debit',
        '',
        'Common output flags:',
        '  --view summary|ids|raw',
        '  --select <path>        (repeatable; dot paths; adds to base view selection)',
        '  --selection <graphql>  (selection override; can be @file.gql)',
      ].join('\n'),
    )
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: { 'owner-id': { type: 'string' } } })
    const idArg = args.id as string | undefined
    const ownerIdArg = args['owner-id'] as string | undefined
    if (!idArg && !ownerIdArg) throw new CliError('Missing --id or --owner-id', 2)

    const selection = resolveSelection({
      resource: 'store-credit',
      typeName: 'StoreCreditAccount',
      view: ctx.view,
      baseSelection: getStoreCreditSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    if (idArg) {
      const id = requireId(idArg, 'StoreCreditAccount')
      const result = await runQuery(ctx, { storeCreditAccount: { __args: { id }, ...selection } })
      if (result === undefined) return
      printNode({ node: result.storeCreditAccount, format: ctx.format, quiet: ctx.quiet })
      return
    }

    const ownerId = ownerIdArg as string
    const first = parseFirst(args.first)
    const result = await runQuery(ctx, {
      node: {
        __args: { id: ownerId },
        on_Customer: {
          storeCreditAccounts: {
            __args: { first },
            pageInfo: { hasNextPage: true, endCursor: true },
            nodes: selection,
          },
        },
        on_CompanyLocation: {
          storeCreditAccounts: {
            __args: { first },
            pageInfo: { hasNextPage: true, endCursor: true },
            nodes: selection,
          },
        },
      },
    })
    if (result === undefined) return
    const connection =
      (result.node as any)?.storeCreditAccounts ??
      (result.node as any)?.['storeCreditAccounts'] ??
      (result.node as any)?.['storeCreditAccounts']

    if (!connection) {
      throw new CliError('Owner does not have store credit accounts or ID is invalid', 2)
    }

    printConnection({ connection, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'credit' || verb === 'debit') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'owner-id': { type: 'string' },
        amount: { type: 'string' },
        currency: { type: 'string' },
        'expires-at': { type: 'string' },
        notify: { type: 'boolean' },
      },
    })

    const id = (args.id as string | undefined) ?? (args['owner-id'] as string | undefined)
    if (!id) throw new CliError('Missing --id or --owner-id', 2)

    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })

    const amount = args.amount as string | undefined
    const currency = args.currency as string | undefined
    const amountNumber = amount !== undefined ? Number(amount) : undefined
    if (amount !== undefined && !Number.isFinite(amountNumber)) {
      throw new CliError('--amount must be a number', 2)
    }

    const moneyInput = amountNumber !== undefined
      ? {
          amount: amountNumber,
          currencyCode: currency ?? undefined,
        }
      : undefined

    if (!built.used && !moneyInput) {
      throw new CliError('Missing --amount or --input/--set', 2)
    }

    if (verb === 'credit') {
      const creditInput = built.used ? (built.input as any) : {}
      if (moneyInput && !creditInput.creditAmount) creditInput.creditAmount = moneyInput
      if (args['expires-at'] && creditInput.expiresAt === undefined) {
        creditInput.expiresAt = args['expires-at']
      }
      if (args.notify !== undefined && creditInput.notify === undefined) {
        creditInput.notify = Boolean(args.notify)
      }

      const result = await runMutation(ctx, {
        storeCreditAccountCredit: {
          __args: { id, creditInput },
          storeCreditAccountTransaction: { id: true, amount: { amount: true, currencyCode: true } },
          userErrors: { field: true, message: true },
        },
      })
      if (result === undefined) return
      maybeFailOnUserErrors({ payload: result.storeCreditAccountCredit, failOnUserErrors: ctx.failOnUserErrors })
      if (ctx.quiet) return console.log(result.storeCreditAccountCredit?.storeCreditAccountTransaction?.id ?? '')
      printJson(result.storeCreditAccountCredit, ctx.format !== 'raw')
      return
    }

    const debitInput = built.used ? (built.input as any) : {}
    if (moneyInput && !debitInput.debitAmount) debitInput.debitAmount = moneyInput

    const result = await runMutation(ctx, {
      storeCreditAccountDebit: {
        __args: { id, debitInput },
        storeCreditAccountTransaction: { id: true, amount: { amount: true, currencyCode: true } },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.storeCreditAccountDebit, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.storeCreditAccountDebit?.storeCreditAccountTransaction?.id ?? '')
    printJson(result.storeCreditAccountDebit, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for store-credit: ${verb}`, 2)
}
