import { CliError } from '../errors'
import { printConnection, printNode } from '../output'
import { parseStandardArgs, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'

import { parseFirst, requireId } from './_shared'

const pageSummarySelection = {
  id: true,
  handle: true,
  title: true,
} as const

const getPageSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'raw') return {} as const
  return pageSummarySelection
}

export const runCustomerAccountPages = async ({
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
    const id = requireId(args.id, 'CustomerAccountPage')

    const selection = resolveSelection({
      resource: 'customer-account-pages',
      view: ctx.view,
      baseSelection: getPageSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { customerAccountPage: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.customerAccountPage, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const reverse = args.reverse as any

    const nodeSelection = resolveSelection({
      resource: 'customer-account-pages',
      view: ctx.view,
      baseSelection: getPageSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      customerAccountPages: {
        __args: { first, after, reverse },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({ connection: result.customerAccountPages, format: ctx.format, quiet: ctx.quiet })
    return
  }

  throw new CliError(`Unknown verb for customer-account-pages: ${verb}`, 2)
}
