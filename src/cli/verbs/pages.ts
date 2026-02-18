import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'
import { parsePublishDate } from '../workflows/products/publishablePublish'

import { buildListNextPageArgs, parseFirst, requireId } from './_shared'

const pageSummarySelection = {
  id: true,
  title: true,
  handle: true,
  isPublished: true,
  publishedAt: true,
  updatedAt: true,
} as const

const pageFullSelection = {
  ...pageSummarySelection,
  createdAt: true,
  publishDate: true,
  templateSuffix: true,
} as const

const getPageSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return pageFullSelection
  if (view === 'raw') return {} as const
  return pageSummarySelection
}

export const runPages = async ({
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
        '  shop pages <verb> [flags]',
        '',
        'Verbs:',
        '  create|get|list|update|delete|publish|unpublish',
        '',
        'Common output flags:',
        '  --view summary|ids|full|raw',
        '  --select <path>        (repeatable; dot paths; adds to base view selection)',
        '  --selection <graphql>  (selection override; can be @file.gql)',
      ].join('\n'),
    )
    return
  }

  if (verb === 'publish' || verb === 'unpublish') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        at: { type: 'string' },
        now: { type: 'boolean' },
      },
    })
    const id = requireId(args.id, 'Page')

    const publishDate =
      verb === 'publish' ? parsePublishDate({ at: (args as any).at, now: (args as any).now }) : undefined

    const page = verb === 'publish'
      ? { isPublished: true, ...(publishDate ? { publishDate } : {}) }
      : { isPublished: false }

    const result = await runMutation(ctx, {
      pageUpdate: {
        __args: { id, page },
        page: pageSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.pageUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.pageUpdate?.page?.id ?? '')
    printJson(result.pageUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Page')
    const selection = resolveSelection({
      resource: 'pages',
      view: ctx.view,
      baseSelection: getPageSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { page: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.page, format: ctx.format, quiet: ctx.quiet })
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
      resource: 'pages',
      view: ctx.view,
      baseSelection: getPageSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })
    const result = await runQuery(ctx, {
      pages: {
        __args: { first, after, query, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({
      connection: result.pages,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: buildListNextPageArgs('pages', { first, query, sort: sortKey, reverse }),
    })
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
      pageCreate: {
        __args: { page: built.input },
        page: pageSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.pageCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.pageCreate?.page?.id ?? '')
    printJson(result.pageCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Page')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      pageUpdate: {
        __args: { id, page: built.input },
        page: pageSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.pageUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.pageUpdate?.page?.id ?? '')
    printJson(result.pageUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Page')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      pageDelete: {
        __args: { id },
        deletedPageId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.pageDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.pageDelete?.deletedPageId ?? '')
    printJson(result.pageDelete, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for pages: ${verb}`, 2)
}
