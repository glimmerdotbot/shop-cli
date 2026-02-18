import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { buildListNextPageArgs, parseFirst, requireId } from './_shared'

const segmentFilterSelection = {
  __typename: true,
  queryName: true,
  localizedName: true,
  multiValue: true,
} as const

const segmentValueSelection = {
  __typename: true,
  queryName: true,
  localizedValue: true,
} as const

const segmentMigrationSelection = {
  id: true,
  savedSearchId: true,
  segmentId: true,
} as const

const segmentSummarySelection = {
  id: true,
  name: true,
  creationDate: true,
  lastEditDate: true,
} as const

const segmentFullSelection = {
  ...segmentSummarySelection,
  query: true,
} as const

const getSegmentSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return segmentFullSelection
  if (view === 'raw') return {} as const
  return segmentSummarySelection
}

const pickSegmentArgs = (value: any) => {
  if (value === null || typeof value !== 'object') throw new CliError('Segment input must be an object', 2)
  const out: any = {}
  if (value.name !== undefined) out.name = value.name
  if (value.query !== undefined) out.query = value.query
  return out
}

export const runSegments = async ({
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
        '  shop segments <verb> [flags]',
        '',
        'Verbs:',
        '  create|get|list|count|update|delete',
        '  filters|filter-suggestions|value-suggestions|migrations',
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
    const args = parseStandardArgs({ argv, extraOptions: { limit: { type: 'string' } } })
    const limitRaw = (args as any).limit as any
    const limit =
      limitRaw === undefined || limitRaw === null || limitRaw === ''
        ? undefined
        : Number(limitRaw)

    if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0)) {
      throw new CliError('--limit must be a positive number', 2)
    }

    const result = await runQuery(ctx, {
      segmentsCount: {
        __args: { ...(limit !== undefined ? { limit: Math.floor(limit) } : {}) },
        count: true,
        precision: true,
      },
    })
    if (result === undefined) return
    if (ctx.quiet) return console.log(result.segmentsCount?.count ?? '')
    printJson(result.segmentsCount, ctx.format !== 'raw')
    return
  }

  if (verb === 'filters') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any

    const result = await runQuery(ctx, {
      segmentFilters: {
        __args: { first, after },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: segmentFilterSelection,
      },
    })
    if (result === undefined) return
    printConnection({
      connection: result.segmentFilters,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: { base: 'shop segments filters', first },
    })
    return
  }

  if (verb === 'filter-suggestions') {
    const args = parseStandardArgs({ argv, extraOptions: { search: { type: 'string' } } })
    const first = parseFirst(args.first)
    const after = args.after as any
    const search = args.search as any
    if (!search) throw new CliError('Missing --search', 2)

    const result = await runQuery(ctx, {
      segmentFilterSuggestions: {
        __args: { first, after, search },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: segmentFilterSelection,
      },
    })
    if (result === undefined) return
    printConnection({
      connection: result.segmentFilterSuggestions,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: {
        base: 'shop segments filter-suggestions',
        first,
        extraFlags: [{ flag: '--search', value: search }],
      },
    })
    return
  }

  if (verb === 'value-suggestions') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        search: { type: 'string' },
        'filter-query-name': { type: 'string' },
        'function-parameter-query-name': { type: 'string' },
      },
    })
    const first = parseFirst(args.first)
    const after = args.after as any
    const search = args.search as any
    if (!search) throw new CliError('Missing --search', 2)

    const filterQueryName = (args as any)['filter-query-name'] as any
    const functionParameterQueryName = (args as any)['function-parameter-query-name'] as any

    const result = await runQuery(ctx, {
      segmentValueSuggestions: {
        __args: {
          first,
          after,
          search,
          ...(filterQueryName ? { filterQueryName } : {}),
          ...(functionParameterQueryName ? { functionParameterQueryName } : {}),
        },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: segmentValueSelection,
      },
    })
    if (result === undefined) return

    const extraFlags: Array<{ flag: string; value?: string | number | boolean }> = [{ flag: '--search', value: search }]
    if (filterQueryName) extraFlags.push({ flag: '--filter-query-name', value: filterQueryName })
    if (functionParameterQueryName) extraFlags.push({ flag: '--function-parameter-query-name', value: functionParameterQueryName })

    printConnection({
      connection: result.segmentValueSuggestions,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: { base: 'shop segments value-suggestions', first, extraFlags },
    })
    return
  }

  if (verb === 'migrations') {
    const args = parseStandardArgs({ argv, extraOptions: { 'saved-search-id': { type: 'string' } } })
    const first = parseFirst(args.first)
    const after = args.after as any
    const savedSearchId = (args as any)['saved-search-id'] as any

    const result = await runQuery(ctx, {
      segmentMigrations: {
        __args: { first, after, ...(savedSearchId ? { savedSearchId } : {}) },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: segmentMigrationSelection,
      },
    })
    if (result === undefined) return

    const extraFlags: Array<{ flag: string; value?: string | number | boolean }> = []
    if (savedSearchId) extraFlags.push({ flag: '--saved-search-id', value: savedSearchId })

    printConnection({
      connection: result.segmentMigrations,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: { base: 'shop segments migrations', first, extraFlags },
    })
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Segment')
    const selection = resolveSelection({
      resource: 'segments',
      view: ctx.view,
      baseSelection: getSegmentSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { segment: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.segment, format: ctx.format, quiet: ctx.quiet })
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
      resource: 'segments',
      view: ctx.view,
      baseSelection: getSegmentSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })
    const result = await runQuery(ctx, {
      segments: {
        __args: { first, after, query, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({
      connection: result.segments,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: buildListNextPageArgs('segments', { first, query, sort: sortKey, reverse }),
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
    const input = pickSegmentArgs(built.input)
    if (!input.name) throw new CliError('Missing name in --input/--set', 2)
    if (!input.query) throw new CliError('Missing query in --input/--set', 2)

    const result = await runMutation(ctx, {
      segmentCreate: {
        __args: { name: input.name, query: input.query },
        segment: segmentSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.segmentCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.segmentCreate?.segment?.id ?? '')
    printJson(result.segmentCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Segment')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)
    const input = pickSegmentArgs(built.input)
    if (input.name === undefined && input.query === undefined) {
      throw new CliError('Nothing to update (expected name and/or query)', 2)
    }

    const result = await runMutation(ctx, {
      segmentUpdate: {
        __args: { id, ...input },
        segment: segmentSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.segmentUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.segmentUpdate?.segment?.id ?? '')
    printJson(result.segmentUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Segment')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      segmentDelete: {
        __args: { id },
        deletedSegmentId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.segmentDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.segmentDelete?.deletedSegmentId ?? '')
    printJson(result.segmentDelete, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for segments: ${verb}`, 2)
}
