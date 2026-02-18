import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { parseFirst, requireId } from './_shared'

const catalogSummarySelection = {
  id: true,
  title: true,
  status: true,
} as const

const getCatalogSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'raw') return {} as const
  return catalogSummarySelection
}

export const runCatalogs = async ({
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
        '  shop catalogs <verb> [flags]',
        '',
        'Verbs:',
        '  create|get|list|update|delete',
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
    const id = requireId(args.id, 'Catalog')
    const selection = resolveSelection({
      resource: 'catalogs',
      view: ctx.view,
      baseSelection: getCatalogSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { catalog: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.catalog, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const query = args.query as any
    const reverse = args.reverse as any
    const sortKey = args.sort as any
    const type = args.type as any

    const nodeSelection = resolveSelection({
      resource: 'catalogs',
      view: ctx.view,
      baseSelection: getCatalogSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })
    const result = await runQuery(ctx, {
      catalogs: {
        __args: { first, after, query, reverse, sortKey, ...(type ? { type } : {}) },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({ connection: result.catalogs, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'create') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      catalogCreate: {
        __args: { input: built.input },
        catalog: catalogSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.catalogCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.catalogCreate?.catalog?.id ?? '')
    printJson(result.catalogCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Catalog')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      catalogUpdate: {
        __args: { id, input: built.input },
        catalog: catalogSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.catalogUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.catalogUpdate?.catalog?.id ?? '')
    printJson(result.catalogUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Catalog')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const extra = buildInput({
      inputArg: undefined,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })

    const result = await runMutation(ctx, {
      catalogDelete: {
        __args: { id, ...(extra.used ? extra.input : {}) },
        deletedId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.catalogDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.catalogDelete?.deletedId ?? '')
    printJson(result.catalogDelete, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for catalogs: ${verb}`, 2)
}
