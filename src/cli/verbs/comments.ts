import { CliError } from '../errors'
import { printConnection, printJson } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { maybeFailOnUserErrors } from '../userErrors'

import { applySelect, parseFirst, requireId } from './_shared'

const commentSummarySelection = {
  id: true,
  status: true,
  isPublished: true,
  createdAt: true,
  updatedAt: true,
} as const

const commentFullSelection = {
  ...commentSummarySelection,
  body: true,
  author: { name: true, email: true },
} as const

const getCommentSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return commentFullSelection
  return commentSummarySelection
}

export const runComments = async ({
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
    const id = requireId(args.id, 'Comment')
    const selection = applySelect(getCommentSelection(ctx.view), args.select)

    const result = await runQuery(ctx, { comment: { __args: { id }, ...selection } })
    if (result === undefined) return
    if (ctx.quiet) return console.log(result.comment?.id ?? '')
    printJson(result.comment)
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const query = args.query as any
    const reverse = args.reverse as any
    const sortKey = args.sort as any

    const nodeSelection = applySelect(getCommentSelection(ctx.view), args.select)
    const result = await runQuery(ctx, {
      comments: {
        __args: { first, after, query, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({ connection: result.comments, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Comment')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      commentDelete: {
        __args: { id },
        deletedCommentId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.commentDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.commentDelete?.deletedCommentId ?? '')
    printJson(result.commentDelete)
    return
  }

  throw new CliError(`Unknown verb for comments: ${verb}`, 2)
}

