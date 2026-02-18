import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { parseFirst, requireId } from './_shared'

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
        '  create|get|list|update|delete',
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
    const id = requireId(args.id, 'WebhookSubscription')
    const selection = resolveSelection({
      view: ctx.view,
      baseSelection: getWebhookSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
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
      view: ctx.view,
      baseSelection: getWebhookSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
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
