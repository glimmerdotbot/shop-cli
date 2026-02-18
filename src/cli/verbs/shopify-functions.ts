import { CliError } from '../errors'
import { printConnection, printNode } from '../output'
import { parseStandardArgs, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'

import { buildListNextPageArgs, parseFirst } from './_shared'

const shopifyFunctionSelection = {
  id: true,
  title: true,
  apiType: true,
  app: { id: true, title: true },
  appBridge: { detailsPath: true, createPath: true },
  useCreationUi: true,
} as const

const getShopifyFunctionSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'raw') return {} as const
  return shopifyFunctionSelection
}

export const runShopifyFunctions = async ({
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
        '  shop functions <verb> [flags]',
        '',
        'Verbs:',
        '  get|list',
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
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = args.id as string | undefined
    if (!id) throw new CliError('Missing --id', 2)

    const selection = resolveSelection({
      resource: 'functions',
      view: ctx.view,
      baseSelection: getShopifyFunctionSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { shopifyFunction: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.shopifyFunction, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({ argv, extraOptions: { 'api-type': { type: 'string' }, 'use-creation-ui': { type: 'boolean' } } })
    const first = parseFirst(args.first)
    const after = args.after as any
    const reverse = args.reverse as any
    const apiType = args['api-type'] as string | undefined
    const useCreationUi = args['use-creation-ui'] as boolean | undefined

    const nodeSelection = resolveSelection({
      resource: 'functions',
      view: ctx.view,
      baseSelection: getShopifyFunctionSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      shopifyFunctions: {
        __args: { first, after, reverse, ...(apiType ? { apiType } : {}), ...(useCreationUi === undefined ? {} : { useCreationUi }) },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({
      connection: result.shopifyFunctions,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: buildListNextPageArgs(
        'functions',
        { first, reverse },
        [
          ...(apiType ? [{ flag: '--api-type', value: apiType }] : []),
          ...(useCreationUi === true ? [{ flag: '--use-creation-ui', value: true }] : []),
        ],
      ),
    })
    return
  }

  throw new CliError(`Unknown verb for functions: ${verb}`, 2)
}
