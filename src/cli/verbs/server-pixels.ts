import { CliError } from '../errors'
import { printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

const serverPixelSelection = {
  id: true,
  status: true,
  webhookEndpointAddress: true,
} as const

const getServerPixelSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'raw') return {} as const
  return serverPixelSelection
}

export const runServerPixels = async ({
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
        '  shop server-pixels <verb> [flags]',
        '',
        'Verbs:',
        '  get|create|delete|update-pubsub|update-eventbridge',
        '',
        'Common output flags:',
        '  --view summary|ids|raw',
        '  --select <path>        (repeatable; dot paths; adds to base view selection)',
        '  --selection <graphql>  (selection override; can be @file.gql)',
      ].join('\n'),
    )
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const selection = resolveSelection({
      resource: 'server-pixels',
      view: ctx.view,
      baseSelection: getServerPixelSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { serverPixel: selection })
    if (result === undefined) return
    printNode({ node: result.serverPixel, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'create') {
    const result = await runMutation(ctx, {
      serverPixelCreate: {
        serverPixel: serverPixelSelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.serverPixelCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.serverPixelCreate?.serverPixel?.id ?? '')
    printJson(result.serverPixelCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    if (!argv.includes('--yes')) {
      throw new CliError('Refusing to delete without --yes', 2)
    }

    const result = await runMutation(ctx, {
      serverPixelDelete: {
        deletedServerPixelId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.serverPixelDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.serverPixelDelete?.deletedServerPixelId ?? '')
    printJson(result.serverPixelDelete, ctx.format !== 'raw')
    return
  }

  if (verb === 'update-pubsub') {
    const args = parseStandardArgs({
      argv,
      extraOptions: { 'pubsub-project': { type: 'string' }, 'pubsub-topic': { type: 'string' } },
    })
    const pubSubProject = args['pubsub-project'] as string | undefined
    const pubSubTopic = args['pubsub-topic'] as string | undefined
    if (!pubSubProject || !pubSubTopic) throw new CliError('Missing --pubsub-project or --pubsub-topic', 2)

    const result = await runMutation(ctx, {
      pubSubServerPixelUpdate: {
        __args: { pubSubProject, pubSubTopic },
        serverPixel: serverPixelSelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.pubSubServerPixelUpdate, failOnUserErrors: ctx.failOnUserErrors })
    printJson(result.pubSubServerPixelUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update-eventbridge') {
    const args = parseStandardArgs({ argv, extraOptions: { arn: { type: 'string' } } })
    const arn = args.arn as string | undefined
    if (!arn) throw new CliError('Missing --arn', 2)

    const result = await runMutation(ctx, {
      eventBridgeServerPixelUpdate: {
        __args: { arn },
        serverPixel: serverPixelSelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.eventBridgeServerPixelUpdate,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    printJson(result.eventBridgeServerPixelUpdate, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for server-pixels: ${verb}`, 2)
}
