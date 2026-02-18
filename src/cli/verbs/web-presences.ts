import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { buildListNextPageArgs, parseFirst, requireId } from './_shared'

const webPresenceSummarySelection = {
  id: true,
  defaultLocale: { locale: true, name: true, primary: true, published: true },
  alternateLocales: { locale: true, name: true, primary: true, published: true },
  subfolderSuffix: true,
  domain: { id: true, host: true, url: true },
} as const

const webPresenceFullSelection = {
  ...webPresenceSummarySelection,
  rootUrls: { locale: true, url: true },
  market: { id: true, name: true },
} as const

const getWebPresenceSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return webPresenceFullSelection
  if (view === 'raw') return {} as const
  return webPresenceSummarySelection
}

export const runWebPresences = async ({
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
        '  shop web-presences <verb> [flags]',
        '',
        'Verbs:',
        '  list|create|update|delete',
        '',
        'Common output flags:',
        '  --view summary|ids|full|raw',
        '  --select <path>        (repeatable; dot paths; adds to base view selection)',
        '  --selection <graphql>  (selection override; can be @file.gql)',
      ].join('\n'),
    )
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const reverse = args.reverse as any

    const nodeSelection = resolveSelection({
      resource: 'web-presences',
      typeName: 'MarketWebPresence',
      view: ctx.view,
      baseSelection: getWebPresenceSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      webPresences: {
        __args: { first, after, reverse },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({
      connection: result.webPresences,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: buildListNextPageArgs('web-presences', { first, reverse }),
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

    const selection = resolveSelection({
      resource: 'web-presences',
      typeName: 'MarketWebPresence',
      view: ctx.view,
      baseSelection: getWebPresenceSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      ensureId: ctx.quiet,
    })

    const result = await runMutation(ctx, {
      webPresenceCreate: {
        __args: { input: built.input },
        webPresence: selection as any,
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.webPresenceCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.webPresenceCreate?.webPresence?.id ?? '')
    printJson(result.webPresenceCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'MarketWebPresence')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const selection = resolveSelection({
      resource: 'web-presences',
      typeName: 'MarketWebPresence',
      view: ctx.view,
      baseSelection: getWebPresenceSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      ensureId: ctx.quiet,
    })

    const result = await runMutation(ctx, {
      webPresenceUpdate: {
        __args: { id, input: built.input },
        webPresence: selection as any,
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.webPresenceUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.webPresenceUpdate?.webPresence?.id ?? '')
    printJson(result.webPresenceUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'MarketWebPresence')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      webPresenceDelete: {
        __args: { id },
        deletedId: true,
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.webPresenceDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.webPresenceDelete?.deletedId ?? '')
    printJson(result.webPresenceDelete, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for web-presences: ${verb}`, 2)
}
