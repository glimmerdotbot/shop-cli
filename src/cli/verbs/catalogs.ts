import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { maybeFailOnUserErrors } from '../userErrors'

import { applySelect, parseFirst, requireId } from './_shared'

const catalogSummarySelection = {
  id: true,
  title: true,
  status: true,
} as const

const getCatalogSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  return catalogSummarySelection
}

export const runCatalogs = async ({
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
    const id = requireId(args.id, 'Catalog')
    const selection = applySelect(getCatalogSelection(ctx.view), args.select)

    const result = await runQuery(ctx, { catalog: { __args: { id }, ...selection } })
    if (result === undefined) return
    if (ctx.quiet) return console.log(result.catalog?.id ?? '')
    printJson(result.catalog)
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const query = args.query as any
    const reverse = args.reverse as any
    const sortKey = args.sort as any
    const type = args.type as any

    const nodeSelection = applySelect(getCatalogSelection(ctx.view), args.select)
    const result = await runQuery(ctx, {
      catalogs: {
        __args: { first, after, query, reverse, sortKey, ...(type ? { type } : {}) },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({ connection: result.catalogs, format: ctx.format, quiet: ctx.quiet })
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
      catalogCreate: {
        __args: { input: built.input },
        catalog: catalogSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.catalogCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.catalogCreate?.catalog?.id ?? '')
    printJson(result.catalogCreate)
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Catalog')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      catalogUpdate: {
        __args: { id, input: built.input },
        catalog: catalogSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.catalogUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.catalogUpdate?.catalog?.id ?? '')
    printJson(result.catalogUpdate)
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Catalog')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const extra = buildInput({
      inputArg: undefined,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })

    const result = await runMutation(ctx, {
      catalogDelete: {
        __args: { id, ...(extra.used ? extra.input : {}) },
        deletedId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.catalogDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.catalogDelete?.deletedId ?? '')
    printJson(result.catalogDelete)
    return
  }

  throw new CliError(`Unknown verb for catalogs: ${verb}`, 2)
}

