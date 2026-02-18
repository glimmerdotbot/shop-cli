import { CliError } from '../errors'
import { printNode } from '../output'
import { parseStandardArgs, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'

const shopifyPaymentsAccountSummarySelection = {
  id: true,
  activated: true,
  balance: { amount: true, currencyCode: true },
  accountOpenerName: true,
} as const

const shopifyPaymentsAccountFullSelection = {
  ...shopifyPaymentsAccountSummarySelection,
  bankAccounts: {
    __args: { first: 10 },
    nodes: {
      id: true,
      bankName: true,
      country: true,
      currency: true,
      accountNumberLastDigits: true,
      createdAt: true,
    },
    pageInfo: { hasNextPage: true, endCursor: true },
  },
} as const

const getAccountSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return shopifyPaymentsAccountFullSelection
  if (view === 'raw') return {} as const
  return shopifyPaymentsAccountSummarySelection
}

export const runShopifyPayments = async ({
  ctx,
  verb,
  argv,
}: {
  ctx: CommandContext
  verb: string
  argv: string[]
}) => {
  if (verb !== 'account' && verb !== 'get') {
    throw new CliError(`Unknown verb for shopify-payments: ${verb}`, 2)
  }

  const args = parseStandardArgs({ argv, extraOptions: {} })
  const selection = resolveSelection({
    view: ctx.view,
    baseSelection: getAccountSelection(ctx.view) as any,
    select: args.select,
    selection: (args as any).selection,
    ensureId: ctx.quiet,
  })

  const result = await runQuery(ctx, { shopifyPaymentsAccount: selection })
  if (result === undefined) return
  printNode({ node: result.shopifyPaymentsAccount, format: ctx.format, quiet: ctx.quiet })
}
