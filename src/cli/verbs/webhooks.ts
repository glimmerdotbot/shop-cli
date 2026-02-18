import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { buildListNextPageArgs, parseFirst, requireId } from './_shared'

const webhookSummarySelection = {
  id: true,
  topic: true,
  uri: true,
  format: true,
  createdAt: true,
  updatedAt: true,
} as const

const webhookFullSelection = {
  ...webhookSummarySelection,
  filter: true,
  includeFields: true,
  metafieldNamespaces: true,
} as const

const getWebhookSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return webhookFullSelection
  if (view === 'raw') return {} as const
  return webhookSummarySelection
}

export const runWebhooks = async ({
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
        '  shop webhooks <verb> [flags]',
        '',
        'Verbs:',
        '  create|get|list|update|delete|count',
        '  pubsub-create|pubsub-update',
        '  event-bridge-create|event-bridge-update',
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
      extraOptions: { limit: { type: 'string' } },
    })
    const query = args.query as any
    const limitRaw = (args as any).limit as any
    const limit =
      limitRaw === undefined || limitRaw === null || limitRaw === ''
        ? undefined
        : Number(limitRaw)

    if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0)) {
      throw new CliError('--limit must be a positive number', 2)
    }

    const result = await runQuery(ctx, {
      webhookSubscriptionsCount: {
        __args: {
          ...(query ? { query } : {}),
          ...(limit !== undefined ? { limit: Math.floor(limit) } : {}),
        },
        count: true,
        precision: true,
      },
    })
    if (result === undefined) return
    if (ctx.quiet) return console.log(result.webhookSubscriptionsCount?.count ?? '')
    printJson(result.webhookSubscriptionsCount, ctx.format !== 'raw')
    return
  }

  if (verb === 'event-bridge-create') {
    const args = parseStandardArgs({ argv, extraOptions: { topic: { type: 'string' } } })
    const topic = args.topic as string | undefined
    if (!topic) throw new CliError('Missing --topic', 2)

    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json (webhookSubscription)', 2)

    const result = await runMutation(ctx, {
      eventBridgeWebhookSubscriptionCreate: {
        __args: { topic: topic as any, webhookSubscription: built.input },
        webhookSubscription: webhookSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.eventBridgeWebhookSubscriptionCreate,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.eventBridgeWebhookSubscriptionCreate?.webhookSubscription?.id ?? '')
    printJson(result.eventBridgeWebhookSubscriptionCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'event-bridge-update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'WebhookSubscription')

    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json (webhookSubscription)', 2)

    const result = await runMutation(ctx, {
      eventBridgeWebhookSubscriptionUpdate: {
        __args: { id, webhookSubscription: built.input },
        webhookSubscription: webhookSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.eventBridgeWebhookSubscriptionUpdate,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.eventBridgeWebhookSubscriptionUpdate?.webhookSubscription?.id ?? '')
    printJson(result.eventBridgeWebhookSubscriptionUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'WebhookSubscription')
    const selection = resolveSelection({
      resource: 'webhooks',
      view: ctx.view,
      baseSelection: getWebhookSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { webhookSubscription: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.webhookSubscription, format: ctx.format, quiet: ctx.quiet })
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
      resource: 'webhooks',
      view: ctx.view,
      baseSelection: getWebhookSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })
    const result = await runQuery(ctx, {
      webhookSubscriptions: {
        __args: { first, after, query, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({
      connection: result.webhookSubscriptions,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: buildListNextPageArgs('webhooks', { first, query, sort: sortKey, reverse }),
    })
    return
  }

  if (verb === 'pubsub-create') {
    const args = parseStandardArgs({
      argv,
      extraOptions: { topic: { type: 'string' }, 'pubsub-project': { type: 'string' }, 'pubsub-topic': { type: 'string' } },
    })
    const topic = args.topic as string | undefined
    if (!topic) throw new CliError('Missing --topic', 2)

    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    const input = built.used ? (built.input as any) : {}

    const pubSubProject = (args as any)['pubsub-project'] ?? input.pubSubProject
    const pubSubTopic = (args as any)['pubsub-topic'] ?? input.pubSubTopic
    if (!pubSubProject) throw new CliError('Missing --pubsub-project', 2)
    if (!pubSubTopic) throw new CliError('Missing --pubsub-topic', 2)

    const webhookSubscription = { ...input, pubSubProject, pubSubTopic }

    const result = await runMutation(ctx, {
      pubSubWebhookSubscriptionCreate: {
        __args: { topic, webhookSubscription },
        webhookSubscription: webhookSummarySelection,
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.pubSubWebhookSubscriptionCreate,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.pubSubWebhookSubscriptionCreate?.webhookSubscription?.id ?? '')
    printJson(result.pubSubWebhookSubscriptionCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'pubsub-update') {
    const args = parseStandardArgs({
      argv,
      extraOptions: { 'pubsub-project': { type: 'string' }, 'pubsub-topic': { type: 'string' } },
    })
    const id = requireId(args.id, 'WebhookSubscription')

    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    const input = built.used ? (built.input as any) : {}

    const pubSubProject = (args as any)['pubsub-project'] ?? input.pubSubProject
    const pubSubTopic = (args as any)['pubsub-topic'] ?? input.pubSubTopic
    if (!pubSubProject) throw new CliError('Missing --pubsub-project', 2)
    if (!pubSubTopic) throw new CliError('Missing --pubsub-topic', 2)

    const webhookSubscription = { ...input, pubSubProject, pubSubTopic }

    const result = await runMutation(ctx, {
      pubSubWebhookSubscriptionUpdate: {
        __args: { id, webhookSubscription },
        webhookSubscription: webhookSummarySelection,
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.pubSubWebhookSubscriptionUpdate,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.pubSubWebhookSubscriptionUpdate?.webhookSubscription?.id ?? '')
    printJson(result.pubSubWebhookSubscriptionUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'create') {
    const args = parseStandardArgs({ argv, extraOptions: { topic: { type: 'string' } } })
    const topic = args.topic as string | undefined
    if (!topic) throw new CliError('Missing --topic', 2)

    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json (webhookSubscription)', 2)

    const result = await runMutation(ctx, {
      webhookSubscriptionCreate: {
        __args: { topic, webhookSubscription: built.input },
        webhookSubscription: webhookSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.webhookSubscriptionCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.webhookSubscriptionCreate?.webhookSubscription?.id ?? '')
    printJson(result.webhookSubscriptionCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'WebhookSubscription')

    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json (webhookSubscription)', 2)

    const result = await runMutation(ctx, {
      webhookSubscriptionUpdate: {
        __args: { id, webhookSubscription: built.input },
        webhookSubscription: webhookSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.webhookSubscriptionUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.webhookSubscriptionUpdate?.webhookSubscription?.id ?? '')
    printJson(result.webhookSubscriptionUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'WebhookSubscription')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      webhookSubscriptionDelete: {
        __args: { id },
        deletedWebhookSubscriptionId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.webhookSubscriptionDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.webhookSubscriptionDelete?.deletedWebhookSubscriptionId ?? '')
    printJson(result.webhookSubscriptionDelete, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for webhooks: ${verb}`, 2)
}
