import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'
import { parsePublishDate } from '../workflows/products/publishablePublish'

import { buildListNextPageArgs, parseFirst, requireId } from './_shared'

const articleSummarySelection = {
  id: true,
  title: true,
  handle: true,
  isPublished: true,
  publishedAt: true,
  updatedAt: true,
} as const

const articleFullSelection = {
  ...articleSummarySelection,
  createdAt: true,
  tags: true,
} as const

const getArticleSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return articleFullSelection
  if (view === 'raw') return {} as const
  return articleSummarySelection
}

export const runArticles = async ({
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
        '  shop articles <verb> [flags]',
        '',
        'Verbs:',
        '  create|get|list|update|delete|publish|unpublish',
        '  authors|tags',
        '',
        'Common output flags:',
        '  --view summary|ids|full|raw',
        '  --select <path>        (repeatable; dot paths; adds to base view selection)',
        '  --selection <graphql>  (selection override; can be @file.gql)',
      ].join('\n'),
    )
    return
  }

  if (verb === 'authors') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const reverse = args.reverse as any

    const result = await runQuery(ctx, {
      articleAuthors: {
        __args: { first, after, reverse },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: { name: true },
      },
    })
    if (result === undefined) return
    printConnection({
      connection: result.articleAuthors,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: { base: 'shop articles authors', first, reverse: reverse === true },
    })
    return
  }

  if (verb === 'tags') {
    const args = parseStandardArgs({ argv, extraOptions: { limit: { type: 'string' } } })
    const sort = args.sort as any
    const limitRaw = (args as any).limit as any
    if (limitRaw === undefined || limitRaw === null || limitRaw === '') throw new CliError('Missing --limit', 2)
    const limit = Number(limitRaw)
    if (!Number.isFinite(limit) || !Number.isInteger(limit) || limit <= 0) throw new CliError('--limit must be a positive integer', 2)

    const result = await runQuery(ctx, {
      articleTags: {
        __args: { ...(sort ? { sort } : {}), limit: Math.floor(limit) },
      },
    })
    if (result === undefined) return
    if (ctx.quiet) return
    printJson(result.articleTags, ctx.format !== 'raw')
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
    const id = requireId(args.id, 'Article')

    const publishDate =
      verb === 'publish' ? parsePublishDate({ at: (args as any).at, now: (args as any).now }) : undefined

    const article = verb === 'publish'
      ? { isPublished: true, ...(publishDate ? { publishDate } : {}) }
      : { isPublished: false }

    const result = await runMutation(ctx, {
      articleUpdate: {
        __args: { id, article },
        article: articleSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.articleUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.articleUpdate?.article?.id ?? '')
    printJson(result.articleUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Article')
    const selection = resolveSelection({
      resource: 'articles',
      view: ctx.view,
      baseSelection: getArticleSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { article: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.article, format: ctx.format, quiet: ctx.quiet })
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
      resource: 'articles',
      view: ctx.view,
      baseSelection: getArticleSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })
    const result = await runQuery(ctx, {
      articles: {
        __args: { first, after, query, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({
      connection: result.articles,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: buildListNextPageArgs('articles', { first, query, sort: sortKey, reverse }),
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
      articleCreate: {
        __args: { article: built.input },
        article: articleSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.articleCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.articleCreate?.article?.id ?? '')
    printJson(result.articleCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Article')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      articleUpdate: {
        __args: { id, article: built.input },
        article: articleSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.articleUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.articleUpdate?.article?.id ?? '')
    printJson(result.articleUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Article')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      articleDelete: {
        __args: { id },
        deletedArticleId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.articleDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.articleDelete?.deletedArticleId ?? '')
    printJson(result.articleDelete, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for articles: ${verb}`, 2)
}
