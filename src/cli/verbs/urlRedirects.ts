import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { maybeFailOnUserErrors } from '../userErrors'

import { applySelect, parseFirst, requireId } from './_shared'

const urlRedirectSummarySelection = {
  id: true,
  path: true,
  target: true,
} as const

const getUrlRedirectSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  return urlRedirectSummarySelection
}

export const runUrlRedirects = async ({
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
    const id = requireId(args.id, 'UrlRedirect')
    const selection = applySelect(getUrlRedirectSelection(ctx.view), args.select)

    const result = await runQuery(ctx, { urlRedirect: { __args: { id }, ...selection } })
    if (result === undefined) return
    if (ctx.quiet) return console.log(result.urlRedirect?.id ?? '')
    printJson(result.urlRedirect)
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const query = args.query as any
    const reverse = args.reverse as any
    const sortKey = args.sort as any

    const nodeSelection = applySelect(getUrlRedirectSelection(ctx.view), args.select)
    const result = await runQuery(ctx, {
      urlRedirects: {
        __args: { first, after, query, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({ connection: result.urlRedirects, format: ctx.format, quiet: ctx.quiet })
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
      urlRedirectCreate: {
        __args: { urlRedirect: built.input },
        urlRedirect: urlRedirectSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.urlRedirectCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.urlRedirectCreate?.urlRedirect?.id ?? '')
    printJson(result.urlRedirectCreate)
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'UrlRedirect')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      urlRedirectUpdate: {
        __args: { id, urlRedirect: built.input },
        urlRedirect: urlRedirectSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.urlRedirectUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.urlRedirectUpdate?.urlRedirect?.id ?? '')
    printJson(result.urlRedirectUpdate)
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'UrlRedirect')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      urlRedirectDelete: {
        __args: { id },
        deletedUrlRedirectId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.urlRedirectDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.urlRedirectDelete?.deletedUrlRedirectId ?? '')
    printJson(result.urlRedirectDelete)
    return
  }

  throw new CliError(`Unknown verb for url-redirects: ${verb}`, 2)
}

