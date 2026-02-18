import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { maybeFailOnUserErrors } from '../userErrors'

import { applySelect, parseFirst, requireId } from './_shared'

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
  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Blog')
    const selection = applySelect(getBlogSelection(ctx.view), args.select)

    const result = await runQuery(ctx, { blog: { __args: { id }, ...selection } })
    if (result === undefined) return
    if (ctx.quiet) return console.log(result.blog?.id ?? '')
    printJson(result.blog)
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const query = args.query as any
    const reverse = args.reverse as any
    const sortKey = args.sort as any

    const nodeSelection = applySelect(getBlogSelection(ctx.view), args.select)
    const result = await runQuery(ctx, {
      blogs: {
        __args: { first, after, query, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({ connection: result.blogs, format: ctx.format, quiet: ctx.quiet })
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
    printJson(result.blogCreate)
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
    printJson(result.blogUpdate)
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
    printJson(result.blogDelete)
    return
  }

  throw new CliError(`Unknown verb for blogs: ${verb}`, 2)
}

