import { CliError } from '../errors'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'

import { buildListNextPageArgs, parseCsv, parseFirst, requireId } from './_shared'

const eventSummarySelection = {
  id: true,
  action: true,
  message: true,
  createdAt: true,
} as const

const eventFullSelection = {
  ...eventSummarySelection,
  appTitle: true,
  attributeToApp: true,
  attributeToUser: true,
  criticalAlert: true,
  __typename: true,
} as const

const getEventSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return eventFullSelection
  if (view === 'raw') return {} as const
  return eventSummarySelection
}

const deletionEventSelection = {
  subjectId: true,
  subjectType: true,
  occurredAt: true,
} as const

export const runEvents = async ({
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
        '  shop events <verb> [flags]',
        '',
        'Verbs:',
        '  get|list|count|deletion-events',
        '',
        'Common output flags:',
        '  --view summary|ids|full|raw',
        '  --select <path>        (repeatable; dot paths; adds to base view selection)',
        '  --selection <graphql>  (selection override; can be @file.gql)',
      ].join('\n'),
    )
    return
  }

  if (verb === 'deletion-events') {
    const args = parseStandardArgs({
      argv,
      extraOptions: { 'subject-types': { type: 'string' } },
    })
    const first = parseFirst(args.first)
    const after = args.after as any
    const reverse = args.reverse as any
    const sortKey = args.sort as any
    const query = args.query as any

    const subjectTypesRaw = (args as any)['subject-types'] as string | undefined
    const subjectTypes = subjectTypesRaw ? parseCsv(subjectTypesRaw, '--subject-types') : undefined

    const result = await runQuery(ctx, {
      deletionEvents: {
        __args: {
          first,
          after,
          reverse,
          ...(sortKey ? { sortKey } : {}),
          ...(query ? { query } : {}),
          ...(subjectTypes ? { subjectTypes } : {}),
        },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: deletionEventSelection,
      },
    })
    if (result === undefined) return

    printConnection({
      connection: result.deletionEvents,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: {
        base: 'shop events deletion-events',
        first,
        query: typeof query === 'string' ? query : undefined,
        sort: typeof sortKey === 'string' ? sortKey : undefined,
        reverse: reverse === true,
        extraFlags: [...(subjectTypesRaw ? [{ flag: '--subject-types', value: subjectTypesRaw }] : [])],
      },
    })
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Event')
    const selection = resolveSelection({
      resource: 'events',
      view: ctx.view,
      baseSelection: getEventSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { event: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.event, format: ctx.format, quiet: ctx.quiet })
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
      resource: 'events',
      view: ctx.view,
      baseSelection: getEventSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      events: {
        __args: { first, after, query, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({
      connection: result.events,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: buildListNextPageArgs('events', { first, query, sort: sortKey, reverse }),
    })
    return
  }

  if (verb === 'count') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const query = args.query as any

    const result = await runQuery(ctx, { eventsCount: { __args: { query }, count: true, precision: true } })
    if (result === undefined) return
    if (ctx.quiet) return console.log(result.eventsCount?.count ?? '')
    printJson(result.eventsCount, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for events: ${verb}`, 2)
}
