import { CliError } from '../errors'
import { coerceGid } from '../gid'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { buildListNextPageArgs, parseFirst, parseIds, requireId } from './_shared'

const urlRedirectSummarySelection = {
  id: true,
  path: true,
  target: true,
} as const

const urlRedirectFullSelection = {
  ...urlRedirectSummarySelection,
} as const

const getUrlRedirectSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return urlRedirectFullSelection
  if (view === 'raw') return {} as const
  return urlRedirectSummarySelection
}

const savedSearchSummarySelection = {
  id: true,
  name: true,
  query: true,
} as const

const getSavedSearchSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'raw') return {} as const
  return savedSearchSummarySelection
}

const urlRedirectImportSummarySelection = {
  id: true,
  finished: true,
  count: true,
  createdCount: true,
  updatedCount: true,
  failedCount: true,
} as const

const urlRedirectImportFullSelection = {
  ...urlRedirectImportSummarySelection,
  finishedAt: true,
  previewRedirects: { path: true, target: true },
} as const

const getUrlRedirectImportSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return urlRedirectImportFullSelection
  if (view === 'raw') return {} as const
  return urlRedirectImportSummarySelection
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
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(
      [
        'Usage:',
        '  shop url-redirects <verb> [flags]',
        '',
        'Verbs:',
        '  create|get|list|count|saved-searches|update|delete',
        '  import-create|import-submit|import-get',
        '  bulk-delete-all|bulk-delete-ids|bulk-delete-saved-search|bulk-delete-search',
        '',
        'Common output flags:',
        '  --view summary|ids|full|raw',
        '  --select <path>        (repeatable; dot paths; adds to base view selection)',
        '  --selection <graphql>  (selection override; can be @file.gql)',
      ].join('\n'),
    )
    return
  }

  if (verb === 'count') {
    const args = parseStandardArgs({
      argv,
      extraOptions: { limit: { type: 'string' }, 'saved-search-id': { type: 'string' } },
    })
    const query = args.query as any
    const limitRaw = (args as any).limit as any
    const savedSearchIdRaw = (args as any)['saved-search-id'] as any

    const limit =
      limitRaw === undefined || limitRaw === null || limitRaw === ''
        ? undefined
        : Number(limitRaw)

    if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0)) {
      throw new CliError('--limit must be a positive number', 2)
    }

    const savedSearchId = savedSearchIdRaw
      ? coerceGid(String(savedSearchIdRaw), 'SavedSearch')
      : undefined

    const result = await runQuery(ctx, {
      urlRedirectsCount: {
        __args: {
          ...(query ? { query } : {}),
          ...(savedSearchId ? { savedSearchId } : {}),
          ...(limit !== undefined ? { limit: Math.floor(limit) } : {}),
        },
        count: true,
        precision: true,
      },
    })
    if (result === undefined) return
    if (ctx.quiet) return console.log(result.urlRedirectsCount?.count ?? '')
    printJson(result.urlRedirectsCount, ctx.format !== 'raw')
    return
  }

  if (verb === 'saved-searches') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const reverse = args.reverse as any

    const nodeSelection = resolveSelection({
      typeName: 'SavedSearch',
      view: ctx.view,
      baseSelection: getSavedSearchSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      urlRedirectSavedSearches: {
        __args: { first, after, reverse },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return

    printConnection({
      connection: result.urlRedirectSavedSearches,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: { base: 'shop url-redirects saved-searches', first, reverse: reverse === true },
    })
    return
  }

  if (verb === 'import-create') {
    const args = parseStandardArgs({ argv, extraOptions: { url: { type: 'string' } } })
    const url = (args as any).url as string | undefined
    if (!url) throw new CliError('Missing --url', 2)

    const result = await runMutation(ctx, {
      urlRedirectImportCreate: {
        __args: { url },
        urlRedirectImport: {
          id: true,
          finished: true,
          count: true,
          createdCount: true,
          updatedCount: true,
          failedCount: true,
          finishedAt: true,
          previewRedirects: { path: true, target: true },
        },
        userErrors: { code: true, field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.urlRedirectImportCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.urlRedirectImportCreate?.urlRedirectImport?.id ?? '')
    printJson(result.urlRedirectImportCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'import-submit') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'UrlRedirectImport')

    const result = await runMutation(ctx, {
      urlRedirectImportSubmit: {
        __args: { id },
        job: { id: true, done: true },
        userErrors: { code: true, field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.urlRedirectImportSubmit, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(id ?? '')

    const selection = resolveSelection({
      typeName: 'UrlRedirectImport',
      view: ctx.view,
      baseSelection: getUrlRedirectImportSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: true,
    })

    const importResult = await runQuery(ctx, { urlRedirectImport: { __args: { id }, ...selection } })
    if (importResult === undefined) return

    printJson(
      {
        urlRedirectImport: importResult.urlRedirectImport ?? null,
        job: result.urlRedirectImportSubmit?.job ?? null,
        userErrors: result.urlRedirectImportSubmit?.userErrors ?? [],
      },
      ctx.format !== 'raw',
    )
    return
  }

  if (verb === 'import-get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'UrlRedirectImport')

    const selection = resolveSelection({
      typeName: 'UrlRedirectImport',
      view: ctx.view,
      baseSelection: getUrlRedirectImportSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { urlRedirectImport: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.urlRedirectImport, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'bulk-delete-all' || verb === 'bulk-delete-ids' || verb === 'bulk-delete-saved-search' || verb === 'bulk-delete-search') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'saved-search-id': { type: 'string' },
        search: { type: 'string' },
      },
    })

    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    if (verb === 'bulk-delete-all') {
      const countResult = await runQuery(ctx, {
        urlRedirectsCount: { count: true, precision: true },
      })
      const result = await runMutation(ctx, {
        urlRedirectBulkDeleteAll: {
          job: { id: true, done: true },
          userErrors: { field: true, message: true },
        },
      })
      if (result === undefined) return
      maybeFailOnUserErrors({ payload: result.urlRedirectBulkDeleteAll, failOnUserErrors: ctx.failOnUserErrors })
      if (ctx.quiet) return console.log(result.urlRedirectBulkDeleteAll?.job?.id ?? '')
      printJson(
        {
          job: result.urlRedirectBulkDeleteAll?.job ?? null,
          count: countResult?.urlRedirectsCount ?? null,
          userErrors: result.urlRedirectBulkDeleteAll?.userErrors ?? [],
        },
        ctx.format !== 'raw',
      )
      return
    }

    if (verb === 'bulk-delete-ids') {
      const ids = parseIds(args.ids, 'UrlRedirect')
      const result = await runMutation(ctx, {
        urlRedirectBulkDeleteByIds: {
          __args: { ids },
          job: { id: true, done: true },
          userErrors: { code: true, field: true, message: true },
        },
      })
      if (result === undefined) return
      maybeFailOnUserErrors({ payload: result.urlRedirectBulkDeleteByIds, failOnUserErrors: ctx.failOnUserErrors })
      if (ctx.quiet) return console.log(result.urlRedirectBulkDeleteByIds?.job?.id ?? '')
      printJson(
        {
          job: result.urlRedirectBulkDeleteByIds?.job ?? null,
          requestedIds: ids,
          requestedCount: ids.length,
          userErrors: result.urlRedirectBulkDeleteByIds?.userErrors ?? [],
        },
        ctx.format !== 'raw',
      )
      return
    }

    if (verb === 'bulk-delete-saved-search') {
      const raw = (args as any)['saved-search-id'] as string | undefined
      if (!raw) throw new CliError('Missing --saved-search-id', 2)
      const savedSearchId = coerceGid(raw, 'SavedSearch')

      const countResult = await runQuery(ctx, {
        urlRedirectsCount: { __args: { savedSearchId }, count: true, precision: true },
      })
      const result = await runMutation(ctx, {
        urlRedirectBulkDeleteBySavedSearch: {
          __args: { savedSearchId },
          job: { id: true, done: true },
          userErrors: { code: true, field: true, message: true },
        },
      })
      if (result === undefined) return
      maybeFailOnUserErrors({
        payload: result.urlRedirectBulkDeleteBySavedSearch,
        failOnUserErrors: ctx.failOnUserErrors,
      })
      if (ctx.quiet) return console.log(result.urlRedirectBulkDeleteBySavedSearch?.job?.id ?? '')
      printJson(
        {
          job: result.urlRedirectBulkDeleteBySavedSearch?.job ?? null,
          count: countResult?.urlRedirectsCount ?? null,
          savedSearchId,
          userErrors: result.urlRedirectBulkDeleteBySavedSearch?.userErrors ?? [],
        },
        ctx.format !== 'raw',
      )
      return
    }

    const search = (args as any).search as string | undefined
    if (!search) throw new CliError('Missing --search', 2)

    const countResult = await runQuery(ctx, {
      urlRedirectsCount: { __args: { query: search }, count: true, precision: true },
    })
    const result = await runMutation(ctx, {
      urlRedirectBulkDeleteBySearch: {
        __args: { search },
        job: { id: true, done: true },
        userErrors: { code: true, field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.urlRedirectBulkDeleteBySearch,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.urlRedirectBulkDeleteBySearch?.job?.id ?? '')
    printJson(
      {
        job: result.urlRedirectBulkDeleteBySearch?.job ?? null,
        count: countResult?.urlRedirectsCount ?? null,
        search,
        userErrors: result.urlRedirectBulkDeleteBySearch?.userErrors ?? [],
      },
      ctx.format !== 'raw',
    )
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'UrlRedirect')
    const selection = resolveSelection({
      resource: 'url-redirects',
      view: ctx.view,
      baseSelection: getUrlRedirectSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { urlRedirect: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.urlRedirect, format: ctx.format, quiet: ctx.quiet })
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
      resource: 'url-redirects',
      view: ctx.view,
      baseSelection: getUrlRedirectSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })
    const result = await runQuery(ctx, {
      urlRedirects: {
        __args: { first, after, query, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({
      connection: result.urlRedirects,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: buildListNextPageArgs('url-redirects', { first, query, sort: sortKey, reverse }),
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
      urlRedirectCreate: {
        __args: { urlRedirect: built.input },
        urlRedirect: urlRedirectSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.urlRedirectCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.urlRedirectCreate?.urlRedirect?.id ?? '')
    printJson(result.urlRedirectCreate, ctx.format !== 'raw')
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
    printJson(result.urlRedirectUpdate, ctx.format !== 'raw')
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
    printJson(result.urlRedirectDelete, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for url-redirects: ${verb}`, 2)
}
