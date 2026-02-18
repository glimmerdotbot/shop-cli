import { CliError } from '../errors'
import { printConnection, printNode } from '../output'
import { parseStandardArgs, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { coerceGid } from '../gid'

import { parseFirst } from './_shared'

const businessEntitySummarySelection = {
  id: true,
  displayName: true,
  companyName: true,
  primary: true,
  archived: true,
  address: { country: true, city: true, provinceCode: true },
} as const

const businessEntityFullSelection = {
  ...businessEntitySummarySelection,
  address: {
    ...businessEntitySummarySelection.address,
    address1: true,
    address2: true,
    zip: true,
  },
  shopifyPaymentsAccount: { id: true, activated: true },
} as const

const getBusinessEntitySelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return businessEntityFullSelection
  if (view === 'raw') return {} as const
  return businessEntitySummarySelection
}

export const runBusinessEntities = async ({
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

    const selection = resolveSelection({
      view: ctx.view,
      baseSelection: getBusinessEntitySelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { businessEntities: selection })
    if (result === undefined) return
    const nodes = (result.businessEntities ?? []).slice(0, first)
    printConnection({ connection: { nodes }, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const idRaw = args.id as string | undefined

    const selection = resolveSelection({
      view: ctx.view,
      baseSelection: getBusinessEntitySelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      businessEntity: { __args: { ...(idRaw ? { id: coerceGid(idRaw, 'BusinessEntity') } : {}) }, ...selection },
    })
    if (result === undefined) return
    printNode({ node: result.businessEntity, format: ctx.format, quiet: ctx.quiet })
    return
  }

  throw new CliError(`Unknown verb for business-entities: ${verb}`, 2)
}

