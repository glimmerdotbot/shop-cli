import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'
import { parsePublishDate } from '../workflows/products/publishablePublish'

import { buildListNextPageArgs, parseFirst, requireId } from './_shared'

const blogSummarySelection = {
  id: true,
  title: true,
  handle: true,
  updatedAt: true,
} as const

const blogFullSelection = {
  ...blogSummarySelection,
  templateSuffix: true,
  tags: true,
} as const

const getBlogSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return blogFullSelection
  if (view === 'raw') return {} as const
  return blogSummarySelection
}

export const runBlogs = async ({
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
        '  shop blogs <verb> [flags]',
        '',
        'Verbs:',
        '  create|get|list|update|delete|publish|unpublish|count',
        '',
        'Common output flags:',
        '  --view summary|ids|full|raw',
        '  --select <path>        (repeatable; dot paths; adds to base view selection)',
        '  --selection <graphql>  (selection override; can be @file.gql)',
        '',
        'Notes:',
        '  Shopify blogs do not have a direct published/unpublished state.',
        '  blogs publish/unpublish updates isPublished for all articles in the blog.',
      ].join('\n'),
    )
    return
  }

  if (verb === 'count') {
    const args = parseStandardArgs({ argv, extraOptions: { limit: { type: 'string' } } })
    const query = args.query as any
    const limitRaw = (args as any).limit as any
    const limit =
      limitRaw === undefined || limitRaw === null || limitRaw === ''
        ? undefined
        : Number(limitRaw)

    if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0)) {
      throw new CliError('--limit must be a positive number', 2)
    }

    const result = await runQuery(ctx, {
      blogsCount: {
        __args: {
          ...(query ? { query } : {}),
          ...(limit !== undefined ? { limit: Math.floor(limit) } : {}),
        },
        count: true,
        precision: true,
      },
    })
    if (result === undefined) return
    if (ctx.quiet) return console.log(result.blogsCount?.count ?? '')
    printJson(result.blogsCount, ctx.format !== 'raw')
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

    if (ctx.dryRun) {
      throw new CliError('blogs publish/unpublish is not supported in --dry-run mode (requires pagination)', 2)
    }

    const id = requireId(args.id, 'Blog')
    const publishDate =
      verb === 'publish' ? parsePublishDate({ at: (args as any).at, now: (args as any).now }) : undefined

    const desired = verb === 'publish'
      ? { isPublished: true, ...(publishDate ? { publishDate } : {}) }
      : { isPublished: false }

    const updated: any[] = []
    let after: string | undefined = undefined

    for (;;) {
      const page = await runQuery(ctx, {
        blog: {
          __args: { id },
          id: true,
          articles: {
            __args: { first: 50, after },
            pageInfo: { hasNextPage: true, endCursor: true },
            nodes: { id: true, isPublished: true },
          },
        },
      })
      if (page === undefined) return
      const connection = page.blog?.articles
      const nodes = connection?.nodes ?? []

      for (const a of nodes) {
        const articleId = a?.id
        if (!articleId) continue
        const result = await runMutation(ctx, {
          articleUpdate: {
            __args: { id: articleId, article: desired },
            article: { id: true, isPublished: true, publishedAt: true, updatedAt: true },
            userErrors: { field: true, message: true },
          },
        })
        if (result === undefined) return
        maybeFailOnUserErrors({ payload: result.articleUpdate, failOnUserErrors: ctx.failOnUserErrors })
        updated.push(result.articleUpdate)
      }

      if (!connection?.pageInfo?.hasNextPage) break
      after = connection.pageInfo.endCursor as any
      if (!after) break
    }

    if (ctx.quiet) {
      for (const u of updated) {
        const aid = u?.article?.id
        if (aid) process.stdout.write(`${aid}\n`)
      }
      return
    }

    printJson(updated, ctx.format !== 'raw')
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Blog')
    const selection = resolveSelection({
      resource: 'blogs',
      view: ctx.view,
      baseSelection: getBlogSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { blog: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.blog, format: ctx.format, quiet: ctx.quiet })
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
      resource: 'blogs',
      view: ctx.view,
      baseSelection: getBlogSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })
    const result = await runQuery(ctx, {
      blogs: {
        __args: { first, after, query, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({
      connection: result.blogs,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: buildListNextPageArgs('blogs', { first, query, sort: sortKey, reverse }),
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
      blogCreate: {
        __args: { blog: built.input },
        blog: blogSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.blogCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.blogCreate?.blog?.id ?? '')
    printJson(result.blogCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Blog')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      blogUpdate: {
        __args: { id, blog: built.input },
        blog: blogSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.blogUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.blogUpdate?.blog?.id ?? '')
    printJson(result.blogUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Blog')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      blogDelete: {
        __args: { id },
        deletedBlogId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.blogDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.blogDelete?.deletedBlogId ?? '')
    printJson(result.blogDelete, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for blogs: ${verb}`, 2)
}
