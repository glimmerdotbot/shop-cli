import { CliError } from '../errors'
import { printNode } from '../output'
import { parseStandardArgs, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'

import { requireId } from './_shared'

const deviceSelection = {
  id: true,
} as const

export const runPointOfSale = async ({
  ctx,
  verb,
  argv,
}: {
  ctx: CommandContext
  verb: string
  argv: string[]
}) => {
  if (verb !== 'get') throw new CliError(`Unknown verb for point-of-sale: ${verb}`, 2)

  const args = parseStandardArgs({ argv, extraOptions: {} })
  const id = requireId(args.id, 'PointOfSaleDevice')

  const selection = resolveSelection({
    resource: 'point-of-sale',
    view: ctx.view,
    baseSelection: deviceSelection as any,
    select: args.select,
    selection: (args as any).selection,
    include: args.include,
    ensureId: ctx.quiet,
  })

  const result = await runQuery(ctx, { pointOfSaleDevice: { __args: { id }, ...selection } })
  if (result === undefined) return
  printNode({ node: result.pointOfSaleDevice, format: ctx.format, quiet: ctx.quiet })
}
