import { CliError } from '../errors'
import { printConnection, printNode } from '../output'
import { parseStandardArgs, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'

import { parseFirst, requireId } from './_shared'

const staffMemberSummarySelection = {
  id: true,
  name: true,
  email: true,
  active: true,
  isShopOwner: true,
  accountType: true,
} as const

const staffMemberFullSelection = {
  ...staffMemberSummarySelection,
  firstName: true,
  lastName: true,
  phone: true,
  locale: true,
} as const

const getStaffMemberSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return staffMemberFullSelection
  if (view === 'raw') return {} as const
  return staffMemberSummarySelection
}

export const runStaff = async ({
  ctx,
  verb,
  argv,
}: {
  ctx: CommandContext
  verb: string
  argv: string[]
}) => {
  if (verb === 'me') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const selection = resolveSelection({
      resource: 'staff',
      view: ctx.view,
      baseSelection: getStaffMemberSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { currentStaffMember: selection })
    if (result === undefined) return
    printNode({ node: result.currentStaffMember, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'StaffMember')

    const selection = resolveSelection({
      resource: 'staff',
      view: ctx.view,
      baseSelection: getStaffMemberSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { staffMember: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.staffMember, format: ctx.format, quiet: ctx.quiet })
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
      resource: 'staff',
      view: ctx.view,
      baseSelection: getStaffMemberSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      staffMembers: {
        __args: { first, after, query, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({ connection: result.staffMembers ?? { nodes: [], pageInfo: undefined }, format: ctx.format, quiet: ctx.quiet })
    return
  }

  throw new CliError(`Unknown verb for staff: ${verb}`, 2)
}
