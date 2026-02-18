import { CliError } from '../errors'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { parseFirst, requireId } from './_shared'

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
  if (view === 'raw') return {} as const
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
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(
      [
        'Usage:',
        '  shop comments <verb> [flags]',
        '',
        'Verbs:',
        '  get|list|delete',
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
    const id = requireId(args.id, 'Comment')
    const selection = resolveSelection({
      view: ctx.view,
      baseSelection: getCommentSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { comment: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.comment, format: ctx.format, quiet: ctx.quiet })
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
      view: ctx.view,
      baseSelection: getCommentSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      ensureId: ctx.quiet,
    })
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
    printJson(result.commentDelete, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for comments: ${verb}`, 2)
}
