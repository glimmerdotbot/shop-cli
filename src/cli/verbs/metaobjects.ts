import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { parseFirst, requireId } from './_shared'

const metaobjectSummarySelection = {
  id: true,
  displayName: true,
  handle: true,
  updatedAt: true,
  createdAt: true,
} as const

const metaobjectFullSelection = {
  ...metaobjectSummarySelection,
} as const

const getMetaobjectSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return metaobjectFullSelection
  if (view === 'raw') return {} as const
  return metaobjectSummarySelection
}

export const runMetaobjects = async ({
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
        '  shop metaobjects <verb> [flags]',
        '',
        'Verbs:',
        '  create|get|list|update|delete',
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
    const id = requireId(args.id, 'Metaobject')
    const selection = resolveSelection({
      view: ctx.view,
      baseSelection: getMetaobjectSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { metaobject: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.metaobject, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({ argv, extraOptions: { type: { type: 'string' } } })
    const type = args.type as string | undefined
    if (!type) throw new CliError('Missing --type', 2)

    const first = parseFirst(args.first)
    const after = args.after as any
    const query = args.query as any
    const reverse = args.reverse as any
    const sortKey = args.sort as any

    const nodeSelection = resolveSelection({
      view: ctx.view,
      baseSelection: getMetaobjectSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      ensureId: ctx.quiet,
    })
    const result = await runQuery(ctx, {
      metaobjects: {
        __args: { type, first, after, query, reverse, ...(sortKey ? { sortKey } : {}) },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({ connection: result.metaobjects, format: ctx.format, quiet: ctx.quiet })
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
      metaobjectCreate: {
        __args: { metaobject: built.input },
        metaobject: metaobjectSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.metaobjectCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.metaobjectCreate?.metaobject?.id ?? '')
    printJson(result.metaobjectCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Metaobject')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      metaobjectUpdate: {
        __args: { id, metaobject: built.input },
        metaobject: metaobjectSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.metaobjectUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.metaobjectUpdate?.metaobject?.id ?? '')
    printJson(result.metaobjectUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Metaobject')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      metaobjectDelete: {
        __args: { id },
        deletedId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.metaobjectDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.metaobjectDelete?.deletedId ?? '')
    printJson(result.metaobjectDelete, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for metaobjects: ${verb}`, 2)
}
