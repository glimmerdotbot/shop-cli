import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { maybeFailOnUserErrors } from '../userErrors'

import { applySelect, parseFirst, requireId } from './_shared'

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
  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'WebhookSubscription')
    const selection = applySelect(getWebhookSelection(ctx.view), args.select)

    const result = await runQuery(ctx, { webhookSubscription: { __args: { id }, ...selection } })
    if (result === undefined) return
    if (ctx.quiet) return console.log(result.webhookSubscription?.id ?? '')
    printJson(result.webhookSubscription)
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const query = args.query as any
    const reverse = args.reverse as any
    const sortKey = args.sort as any

    const nodeSelection = applySelect(getWebhookSelection(ctx.view), args.select)
    const result = await runQuery(ctx, {
      webhookSubscriptions: {
        __args: { first, after, query, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({ connection: result.webhookSubscriptions, format: ctx.format, quiet: ctx.quiet })
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
    printJson(result.webhookSubscriptionCreate)
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
    printJson(result.webhookSubscriptionUpdate)
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
    printJson(result.webhookSubscriptionDelete)
    return
  }

  throw new CliError(`Unknown verb for webhooks: ${verb}`, 2)
}

