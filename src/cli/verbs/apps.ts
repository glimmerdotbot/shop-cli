import { CliError } from '../errors'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'

import { parseFirst, requireId } from './_shared'

const appSummarySelection = {
  id: true,
  handle: true,
  apiKey: true,
  developerName: true,
  embedded: true,
  published: true,
  installUrl: true,
  launchUrl: true,
} as const

const appFullSelection = {
  ...appSummarySelection,
  description: true,
  developerType: true,
  developerUrl: true,
  appStoreAppUrl: true,
  appStoreDeveloperUrl: true,
  pricingDetailsSummary: true,
  privacyPolicyUrl: true,
} as const

const getAppSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return appFullSelection
  if (view === 'raw') return {} as const
  return appSummarySelection
}

const appInstallationSummarySelection = {
  id: true,
  app: { id: true, handle: true, apiKey: true },
  activeSubscriptions: { id: true, name: true, status: true },
} as const

const getAppInstallationSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'raw') return {} as const
  return appInstallationSummarySelection
}

const appDiscountTypeSummarySelection = {
  functionId: true,
  title: true,
  description: true,
  discountClass: true,
  targetType: true,
  appKey: true,
} as const

const getAppDiscountTypeSelection = (view: CommandContext['view']) => {
  if (view === 'raw') return {} as const
  return appDiscountTypeSummarySelection
}

export const runApps = async ({
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
        '  shop apps <verb> [flags]',
        '',
        'Verbs:',
        '  get|by-handle|by-key',
        '  installations|current-installation',
        '  discount-type|discount-types|discount-types-nodes',
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
    const id = requireId(args.id, 'App')

    const selection = resolveSelection({
      resource: 'apps',
      view: ctx.view,
      baseSelection: getAppSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { app: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.app, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'by-handle') {
    const args = parseStandardArgs({ argv, extraOptions: { handle: { type: 'string' } } })
    const handle = args.handle as string | undefined
    if (!handle) throw new CliError('Missing --handle', 2)

    const selection = resolveSelection({
      resource: 'apps',
      view: ctx.view,
      baseSelection: getAppSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { appByHandle: { __args: { handle }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.appByHandle, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'by-key') {
    const args = parseStandardArgs({ argv, extraOptions: { 'api-key': { type: 'string' } } })
    const apiKey = (args as any)['api-key'] as string | undefined
    if (!apiKey) throw new CliError('Missing --api-key', 2)

    const selection = resolveSelection({
      resource: 'apps',
      view: ctx.view,
      baseSelection: getAppSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { appByKey: { __args: { apiKey }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.appByKey, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'installations') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        category: { type: 'string' },
        privacy: { type: 'string' },
      },
    })
    const first = parseFirst(args.first)
    const after = args.after as any
    const reverse = args.reverse as any
    const sortKey = args.sort as any
    const category = (args as any).category as any
    const privacy = (args as any).privacy as any

    const nodeSelection = resolveSelection({
      resource: 'apps',
      typeName: 'AppInstallation',
      view: ctx.view,
      baseSelection: getAppInstallationSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      appInstallations: {
        __args: {
          first,
          after,
          reverse,
          ...(sortKey ? { sortKey } : {}),
          ...(category ? { category } : {}),
          ...(privacy ? { privacy } : {}),
        },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return

    printConnection({
      connection: result.appInstallations,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: {
        base: 'shop apps installations',
        first,
        reverse: reverse === true,
        extraFlags: [
          ...(sortKey ? [{ flag: '--sort', value: sortKey }] : []),
          ...(category ? [{ flag: '--category', value: category }] : []),
          ...(privacy ? [{ flag: '--privacy', value: privacy }] : []),
        ],
      },
    })
    return
  }

  if (verb === 'current-installation') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const selection = resolveSelection({
      resource: 'apps',
      typeName: 'AppInstallation',
      view: ctx.view,
      baseSelection: getAppInstallationSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { currentAppInstallation: selection })
    if (result === undefined) return
    printNode({ node: result.currentAppInstallation, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'discount-type') {
    const args = parseStandardArgs({ argv, extraOptions: { 'function-id': { type: 'string' } } })
    const functionId = (args as any)['function-id'] as string | undefined
    if (!functionId) throw new CliError('Missing --function-id', 2)

    const selection = resolveSelection({
      typeName: 'AppDiscountType',
      view: ctx.view,
      baseSelection: getAppDiscountTypeSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      ensureId: false,
    })

    const result = await runQuery(ctx, { appDiscountType: { __args: { functionId }, ...selection } })
    if (result === undefined) return
    if (ctx.quiet) return
    printJson(result.appDiscountType, ctx.format !== 'raw')
    return
  }

  if (verb === 'discount-types') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const selection = resolveSelection({
      typeName: 'AppDiscountType',
      view: ctx.view,
      baseSelection: getAppDiscountTypeSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      ensureId: false,
    })

    const result = await runQuery(ctx, { appDiscountTypes: selection as any })
    if (result === undefined) return
    if (ctx.quiet) return
    printJson(result.appDiscountTypes, ctx.format !== 'raw')
    return
  }

  if (verb === 'discount-types-nodes') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const reverse = args.reverse as any

    const nodeSelection = resolveSelection({
      typeName: 'AppDiscountType',
      view: ctx.view,
      baseSelection: getAppDiscountTypeSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      ensureId: false,
    })

    const result = await runQuery(ctx, {
      appDiscountTypesNodes: {
        __args: { first, after, reverse },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({
      connection: result.appDiscountTypesNodes,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: { base: 'shop apps discount-types-nodes', first, reverse: reverse === true },
    })
    return
  }

  throw new CliError(`Unknown verb for apps: ${verb}`, 2)
}
