import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { maybeFailOnUserErrors } from '../userErrors'

import { applySelect, parseFirst, requireId } from './_shared'

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
  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Article')
    const selection = applySelect(getArticleSelection(ctx.view), args.select)

    const result = await runQuery(ctx, { article: { __args: { id }, ...selection } })
    if (result === undefined) return
    if (ctx.quiet) return console.log(result.article?.id ?? '')
    printJson(result.article)
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const query = args.query as any
    const reverse = args.reverse as any
    const sortKey = args.sort as any

    const nodeSelection = applySelect(getArticleSelection(ctx.view), args.select)
    const result = await runQuery(ctx, {
      articles: {
        __args: { first, after, query, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({ connection: result.articles, format: ctx.format, quiet: ctx.quiet })
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
    printJson(result.articleCreate)
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
    printJson(result.articleUpdate)
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
    printJson(result.articleDelete)
    return
  }

  throw new CliError(`Unknown verb for articles: ${verb}`, 2)
}

