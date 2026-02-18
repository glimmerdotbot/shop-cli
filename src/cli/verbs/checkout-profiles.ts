import { CliError } from '../errors'
import { printConnection, printNode } from '../output'
import { parseStandardArgs, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'

import { buildListNextPageArgs, parseFirst, requireId } from './_shared'

const checkoutProfileSummarySelection = {
  id: true,
  name: true,
  isPublished: true,
  updatedAt: true,
} as const

const checkoutProfileFullSelection = {
  ...checkoutProfileSummarySelection,
  createdAt: true,
  editedAt: true,
  typOspPagesActive: true,
} as const

const getCheckoutProfileSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return checkoutProfileFullSelection
  if (view === 'raw') return {} as const
  return checkoutProfileSummarySelection
}

export const runCheckoutProfiles = async ({
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
        '  shop checkout-profiles <verb> [flags]',
        '',
        'Verbs:',
        '  get|list',
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
    const id = requireId(args.id, 'CheckoutProfile')
    const selection = resolveSelection({
      resource: 'checkout-profiles',
      view: ctx.view,
      baseSelection: getCheckoutProfileSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { checkoutProfile: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.checkoutProfile, format: ctx.format, quiet: ctx.quiet })
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
      resource: 'checkout-profiles',
      view: ctx.view,
      baseSelection: getCheckoutProfileSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      checkoutProfiles: {
        __args: { first, after, query, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return

    printConnection({
      connection: result.checkoutProfiles,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: buildListNextPageArgs('checkout-profiles', { first, query, sort: sortKey, reverse }),
    })
    return
  }

  throw new CliError(`Unknown verb for checkout-profiles: ${verb}`, 2)
}

