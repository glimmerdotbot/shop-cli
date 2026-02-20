import { CliError } from '../errors'
import { coerceGid } from '../gid'
import { buildInput } from '../input'
import { printConnection, printIds, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { parseFirst } from './_shared'

const mobilePlatformApplicationSummarySelection = {
  __typename: true,
  on_AndroidApplication: {
    id: true,
    applicationId: true,
    appLinksEnabled: true,
  },
  on_AppleApplication: {
    id: true,
    appId: true,
    appClipApplicationId: true,
    appClipsEnabled: true,
    sharedWebCredentialsEnabled: true,
    universalLinksEnabled: true,
  },
} as const

const mobilePlatformApplicationFullSelection = {
  ...mobilePlatformApplicationSummarySelection,
  on_AndroidApplication: {
    ...mobilePlatformApplicationSummarySelection.on_AndroidApplication,
    sha256CertFingerprints: true,
  },
} as const

const getMobilePlatformApplicationSelection = (view: CommandContext['view']) => {
  if (view === 'ids') {
    return {
      __typename: true,
      on_AndroidApplication: { id: true },
      on_AppleApplication: { id: true },
    } as const
  }
  if (view === 'full') return mobilePlatformApplicationFullSelection
  if (view === 'raw') return {} as const
  return mobilePlatformApplicationSummarySelection
}

const extractUnionId = (node: any) =>
  (node?.on_AndroidApplication?.id as string | undefined) ??
  (node?.on_AppleApplication?.id as string | undefined)

const normalizeMobileAppId = (raw: unknown, platform?: string) => {
  if (typeof raw !== 'string' || !raw) throw new CliError('Missing --id', 2)

  const p = platform?.trim().toLowerCase()
  const type = p === 'apple' || p === 'ios' ? 'AppleApplication' : 'AndroidApplication'
  if (raw.startsWith('gid://')) {
    // If --platform is provided, validate the GID type early; otherwise the ID could be either Apple or Android.
    return p ? coerceGid(raw, type, '--id') : raw
  }
  // This is primarily for convenience in tests/dry-run; real IDs are typically full GIDs.
  return coerceGid(raw, type)
}

export const runMobilePlatformApplications = async ({
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
        '  shop mobile-platform-applications <verb> [flags]',
        '',
        'Verbs:',
        '  create|get|list|update|delete',
        '',
        'Notes:',
        '  --platform apple|android is used only when coercing numeric IDs to GIDs.',
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
      view: ctx.view,
      baseSelection: getMobilePlatformApplicationSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      ensureId: false,
    })

    const result = await runQuery(ctx, {
      mobilePlatformApplications: {
        __args: { first, after, reverse },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return

    const rawConnection = result.mobilePlatformApplications
    const nodes = (rawConnection?.nodes ?? []).map((n: any) => ({ id: extractUnionId(n), ...n }))
    const connection = { ...rawConnection, nodes }

    if (ctx.quiet) {
      printIds(nodes.map((n: any) => n.id))
      return
    }

    printConnection({ connection, format: ctx.format, quiet: false })
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: { platform: { type: 'string' } } })
    const id = normalizeMobileAppId(args.id, (args as any).platform)

    const selection = resolveSelection({
      view: ctx.view,
      baseSelection: getMobilePlatformApplicationSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      ensureId: false,
    })

    const result = await runQuery(ctx, {
      mobilePlatformApplication: {
        __args: { id },
        ...selection,
      },
    })
    if (result === undefined) return

    const node = result.mobilePlatformApplication
    if (ctx.quiet) {
      printIds([extractUnionId(node)])
      return
    }
    printNode({ node, format: ctx.format, quiet: false })
    return
  }

  if (verb === 'create') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const selection = resolveSelection({
      view: ctx.view,
      baseSelection: getMobilePlatformApplicationSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      ensureId: false,
    })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      mobilePlatformApplicationCreate: {
        __args: { input: built.input },
        mobilePlatformApplication: selection as any,
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.mobilePlatformApplicationCreate,
      failOnUserErrors: ctx.failOnUserErrors,
    })

    const created = result.mobilePlatformApplicationCreate?.mobilePlatformApplication
    if (ctx.quiet) {
      printIds([extractUnionId(created)])
      return
    }
    printJson(result.mobilePlatformApplicationCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: { platform: { type: 'string' } } })
    const id = normalizeMobileAppId(args.id, (args as any).platform)
    const selection = resolveSelection({
      view: ctx.view,
      baseSelection: getMobilePlatformApplicationSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      ensureId: false,
    })

    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      mobilePlatformApplicationUpdate: {
        __args: { id, input: built.input },
        mobilePlatformApplication: selection as any,
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.mobilePlatformApplicationUpdate,
      failOnUserErrors: ctx.failOnUserErrors,
    })

    const updated = result.mobilePlatformApplicationUpdate?.mobilePlatformApplication
    if (ctx.quiet) {
      printIds([extractUnionId(updated)])
      return
    }
    printJson(result.mobilePlatformApplicationUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: { platform: { type: 'string' } } })
    const id = normalizeMobileAppId(args.id, (args as any).platform)
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      mobilePlatformApplicationDelete: {
        __args: { id },
        deletedMobilePlatformApplicationId: true,
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.mobilePlatformApplicationDelete,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.mobilePlatformApplicationDelete?.deletedMobilePlatformApplicationId ?? '')
    printJson(result.mobilePlatformApplicationDelete, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for mobile-platform-applications: ${verb}`, 2)
}
