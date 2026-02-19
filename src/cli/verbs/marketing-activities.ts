import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import {
  buildListNextPageArgs,
  parseFirst,
  parseIds,
  parseJsonArg,
  parseStringList,
  requireId,
} from './_shared'

const marketingActivitySummarySelection = {
  id: true,
  title: true,
  activityListUrl: true,
  sourceAndMedium: true,
  status: true,
  statusBadgeType: true,
  budget: { budgetType: true, total: { amount: true, currencyCode: true } },
  adSpend: { amount: true, currencyCode: true },
  createdAt: true,
} as const

const marketingActivityFullSelection = {
  ...marketingActivitySummarySelection,
  utmParameters: { campaign: true, medium: true, source: true },
  urlParameterValue: true,
  marketingChannelType: true,
  marketingEvent: { id: true, type: true, remoteId: true },
} as const

const getMarketingActivitySelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return marketingActivityFullSelection
  if (view === 'raw') return {} as const
  return marketingActivitySummarySelection
}

export const runMarketingActivities = async ({
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
        '  shop marketing-activities <verb> [flags]',
        '',
        'Verbs:',
        '  create|create-external|get|list|update|update-external|upsert-external',
        '  delete-external|delete-all-external',
        '  create-engagement|delete-engagements',
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
    const id = requireId(args.id, 'MarketingActivity')
    const selection = resolveSelection({
      resource: 'marketing-activities',
      view: ctx.view,
      baseSelection: getMarketingActivitySelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { marketingActivity: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.marketingActivity, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'remote-ids': { type: 'string', multiple: true },
        utm: { type: 'string' },
      },
    })
    const first = parseFirst(args.first)
    const after = args.after as any
    const query = args.query as any
    const reverse = args.reverse as any
    const sortKey = args.sort as any
    const marketingActivityIds = args.ids ? parseIds(args.ids, 'MarketingActivity') : []
    const remoteIds = args['remote-ids'] ? parseStringList(args['remote-ids'], '--remote-ids') : []
    const utm = args.utm ? parseJsonArg(args.utm, '--utm', { allowEmpty: true }) : undefined

    const nodeSelection = resolveSelection({
      resource: 'marketing-activities',
      view: ctx.view,
      baseSelection: getMarketingActivitySelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })
    const result = await runQuery(ctx, {
      marketingActivities: {
        __args: {
          first,
          after,
          query,
          reverse,
          sortKey,
          ...(marketingActivityIds.length > 0 ? { marketingActivityIds } : {}),
          ...(remoteIds.length > 0 ? { remoteIds } : {}),
          ...(utm ? { utm } : {}),
        },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({
      connection: result.marketingActivities,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: buildListNextPageArgs('marketing-activities', { first, query, sort: sortKey, reverse }),
    })
    return
  }

  if (verb === 'create' || verb === 'create-external') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const mutation = verb === 'create' ? 'marketingActivityCreate' : 'marketingActivityCreateExternal'
    const result = await runMutation(ctx, {
      [mutation]: {
        __args: { input: built.input },
        marketingActivity: marketingActivitySummarySelection,
        userErrors: { field: true, message: true },
      },
    })

    if (result === undefined) return
    const payload = (result as any)[mutation]
    maybeFailOnUserErrors({ payload, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(payload?.marketingActivity?.id ?? '')
    printJson(payload, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    if (args.id && built.input && !built.input.id) {
      built.input.id = requireId(args.id, 'MarketingActivity')
    }

    const result = await runMutation(ctx, {
      marketingActivityUpdate: {
        __args: { input: built.input },
        marketingActivity: marketingActivitySummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.marketingActivityUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.marketingActivityUpdate?.marketingActivity?.id ?? '')
    printJson(result.marketingActivityUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update-external') {
    const args = parseStandardArgs({
      argv,
      extraOptions: { 'remote-id': { type: 'string' }, utm: { type: 'string' } },
    })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const marketingActivityId = args.id ? requireId(args.id, 'MarketingActivity') : undefined
    const remoteId = args['remote-id'] as string | undefined
    const utm = args.utm ? parseJsonArg(args.utm, '--utm', { allowEmpty: true }) : undefined

    const result = await runMutation(ctx, {
      marketingActivityUpdateExternal: {
        __args: {
          input: built.input,
          ...(marketingActivityId ? { marketingActivityId } : {}),
          ...(remoteId ? { remoteId } : {}),
          ...(utm ? { utm } : {}),
        },
        marketingActivity: marketingActivitySummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.marketingActivityUpdateExternal,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.marketingActivityUpdateExternal?.marketingActivity?.id ?? '')
    printJson(result.marketingActivityUpdateExternal, ctx.format !== 'raw')
    return
  }

  if (verb === 'upsert-external') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      marketingActivityUpsertExternal: {
        __args: { input: built.input },
        marketingActivity: marketingActivitySummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.marketingActivityUpsertExternal,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.marketingActivityUpsertExternal?.marketingActivity?.id ?? '')
    printJson(result.marketingActivityUpsertExternal, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete-external') {
    const args = parseStandardArgs({ argv, extraOptions: { 'remote-id': { type: 'string' } } })
    const marketingActivityId = args.id ? requireId(args.id, 'MarketingActivity') : undefined
    const remoteId = args['remote-id'] as string | undefined
    if (!marketingActivityId && !remoteId) throw new CliError('Missing --id or --remote-id', 2)

    const result = await runMutation(ctx, {
      marketingActivityDeleteExternal: {
        __args: { ...(marketingActivityId ? { marketingActivityId } : {}), ...(remoteId ? { remoteId } : {}) },
        deletedMarketingActivityId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.marketingActivityDeleteExternal,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.marketingActivityDeleteExternal?.deletedMarketingActivityId ?? '')
    printJson(result.marketingActivityDeleteExternal, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete-all-external') {
    if (!argv.includes('--yes')) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      marketingActivitiesDeleteAllExternal: {
        job: { id: true, done: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.marketingActivitiesDeleteAllExternal,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    printJson(result.marketingActivitiesDeleteAllExternal, ctx.format !== 'raw')
    return
  }

  if (verb === 'create-engagement') {
    const args = parseStandardArgs({
      argv,
      extraOptions: { 'activity-id': { type: 'string' }, 'channel-handle': { type: 'string' }, 'remote-id': { type: 'string' } },
    })
    const marketingActivityId = args['activity-id']
      ? requireId(args['activity-id'], 'MarketingActivity', '--activity-id')
      : undefined
    const channelHandle = args['channel-handle'] as string | undefined
    const remoteId = args['remote-id'] as string | undefined

    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      marketingEngagementCreate: {
        __args: {
          marketingEngagement: built.input,
          ...(marketingActivityId ? { marketingActivityId } : {}),
          ...(channelHandle ? { channelHandle } : {}),
          ...(remoteId ? { remoteId } : {}),
        },
        marketingEngagement: { occurredOn: true, marketingActivity: { id: true } },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.marketingEngagementCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) {
      return console.log(result.marketingEngagementCreate?.marketingEngagement?.marketingActivity?.id ?? '')
    }
    printJson(result.marketingEngagementCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete-engagements') {
    const args = parseStandardArgs({
      argv,
      extraOptions: { 'channel-handle': { type: 'string' }, all: { type: 'boolean' } },
    })
    const channelHandle = args['channel-handle'] as string | undefined
    const deleteEngagementsForAllChannels = Boolean(args.all)

    if (!channelHandle && !deleteEngagementsForAllChannels) {
      throw new CliError('Missing --channel-handle or --all', 2)
    }

    const result = await runMutation(ctx, {
      marketingEngagementsDelete: {
        __args: {
          ...(channelHandle ? { channelHandle } : {}),
          ...(deleteEngagementsForAllChannels ? { deleteEngagementsForAllChannels: true } : {}),
        },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.marketingEngagementsDelete, failOnUserErrors: ctx.failOnUserErrors })
    printJson(result.marketingEngagementsDelete, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for marketing-activities: ${verb}`, 2)
}
