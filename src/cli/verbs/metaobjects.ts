import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { maybeFailOnUserErrors } from '../userErrors'

import { applySelect, parseFirst, requireId } from './_shared'

const metaobjectSummarySelection = {
  id: true,
  displayName: true,
  handle: true,
  updatedAt: true,
  createdAt: true,
} as const

const getMetaobjectSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
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
  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Metaobject')
    const selection = applySelect(getMetaobjectSelection(ctx.view), args.select)

    const result = await runQuery(ctx, { metaobject: { __args: { id }, ...selection } })
    if (result === undefined) return
    if (ctx.quiet) return console.log(result.metaobject?.id ?? '')
    printJson(result.metaobject)
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

    const nodeSelection = applySelect(getMetaobjectSelection(ctx.view), args.select)
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
    printJson(result.metaobjectCreate)
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
    printJson(result.metaobjectUpdate)
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
    printJson(result.metaobjectDelete)
    return
  }

  throw new CliError(`Unknown verb for metaobjects: ${verb}`, 2)
}

