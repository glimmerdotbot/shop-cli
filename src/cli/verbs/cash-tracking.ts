import { CliError } from '../errors'
import { printConnection, printNode } from '../output'
import { parseStandardArgs, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'

import { parseFirst, requireId } from './_shared'

const cashTrackingSessionSummarySelection = {
  id: true,
  registerName: true,
  openingTime: true,
  closingTime: true,
  cashTrackingEnabled: true,
  location: { id: true, name: true },
  openingBalance: { amount: true, currencyCode: true },
  expectedBalance: { amount: true, currencyCode: true },
  closingBalance: { amount: true, currencyCode: true },
  totalDiscrepancy: { amount: true, currencyCode: true },
} as const

const cashTrackingSessionFullSelection = {
  ...cashTrackingSessionSummarySelection,
  openingNote: true,
  closingNote: true,
  openingStaffMember: { id: true, name: true, email: true },
  closingStaffMember: { id: true, name: true, email: true },
  netCashSales: { amount: true, currencyCode: true },
  totalCashSales: { amount: true, currencyCode: true },
  totalCashRefunds: { amount: true, currencyCode: true },
  totalAdjustments: { amount: true, currencyCode: true },
} as const

const getSessionSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return cashTrackingSessionFullSelection
  if (view === 'raw') return {} as const
  return cashTrackingSessionSummarySelection
}

export const runCashTracking = async ({
  ctx,
  verb,
  argv,
}: {
  ctx: CommandContext
  verb: string
  argv: string[]
}) => {
  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'CashTrackingSession')

    const selection = resolveSelection({
      view: ctx.view,
      baseSelection: getSessionSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { cashTrackingSession: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.cashTrackingSession, format: ctx.format, quiet: ctx.quiet })
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
      view: ctx.view,
      baseSelection: getSessionSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      cashTrackingSessions: {
        __args: { first, after, query, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({ connection: result.cashTrackingSessions, format: ctx.format, quiet: ctx.quiet })
    return
  }

  throw new CliError(`Unknown verb for cash-tracking: ${verb}`, 2)
}

