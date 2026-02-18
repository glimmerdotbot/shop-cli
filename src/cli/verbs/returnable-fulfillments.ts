import { CliError } from '../errors'
import { printNode } from '../output'
import { parseStandardArgs, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'

import { requireId } from './_shared'

const returnableFulfillmentSummarySelection = {
  id: true,
  fulfillment: { id: true, status: true },
} as const

const returnableFulfillmentFullSelection = {
  ...returnableFulfillmentSummarySelection,
  returnableFulfillmentLineItems: {
    __args: { first: 50 },
    nodes: {
      quantity: true,
      fulfillmentLineItem: {
        id: true,
        lineItem: { id: true, title: true },
      },
    },
  },
} as const

const getReturnableFulfillmentSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return returnableFulfillmentFullSelection
  if (view === 'raw') return {} as const
  return returnableFulfillmentSummarySelection
}

export const runReturnableFulfillments = async ({
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
        '  shop returnable-fulfillments <verb> [flags]',
        '',
        'Verbs:',
        '  get',
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
    const id = requireId(args.id, 'ReturnableFulfillment')
    const selection = resolveSelection({
      resource: 'returnable-fulfillments',
      view: ctx.view,
      baseSelection: getReturnableFulfillmentSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      returnableFulfillment: {
        __args: { id },
        ...selection,
      },
    })
    if (result === undefined) return
    printNode({ node: result.returnableFulfillment, format: ctx.format, quiet: ctx.quiet })
    return
  }

  throw new CliError(`Unknown verb for returnable-fulfillments: ${verb}`, 2)
}

