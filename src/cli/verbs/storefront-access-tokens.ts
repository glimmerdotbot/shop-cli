import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { parseFirst, requireId } from './_shared'

const storefrontAccessTokenSummarySelection = {
  id: true,
  title: true,
  accessToken: true,
  createdAt: true,
  updatedAt: true,
} as const

const storefrontAccessTokenFullSelection = {
  ...storefrontAccessTokenSummarySelection,
  accessScopes: { handle: true },
} as const

const getTokenSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return storefrontAccessTokenFullSelection
  if (view === 'raw') return {} as const
  return storefrontAccessTokenSummarySelection
}

export const runStorefrontAccessTokens = async ({
  ctx,
  verb,
  argv,
}: {
  ctx: CommandContext
  verb: string
  argv: string[]
}) => {
  if (verb === 'list') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const reverse = args.reverse as any

    const nodeSelection = resolveSelection({
      view: ctx.view,
      baseSelection: getTokenSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      shop: {
        storefrontAccessTokens: {
          __args: { first, after, reverse },
          pageInfo: { hasNextPage: true, endCursor: true },
          nodes: nodeSelection,
        },
      },
    })
    if (result === undefined) return
    const connection = result.shop?.storefrontAccessTokens ?? { nodes: [], pageInfo: undefined }
    printConnection({ connection, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'create') {
    const args = parseStandardArgs({ argv, extraOptions: { title: { type: 'string' } } })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })

    const titleFromFlag = (args as any).title as string | undefined
    const input = built.used ? built.input : titleFromFlag ? { title: titleFromFlag } : undefined
    if (!input) throw new CliError('Missing --input/--set or --title', 2)
    if (typeof input !== 'object' || input === null) throw new CliError('Token input must be an object', 2)
    if (!('title' in input) || !(input as any).title) throw new CliError('Missing title', 2)

    const result = await runMutation(ctx, {
      storefrontAccessTokenCreate: {
        __args: { input },
        storefrontAccessToken: storefrontAccessTokenSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.storefrontAccessTokenCreate,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.storefrontAccessTokenCreate?.storefrontAccessToken?.id ?? '')
    printJson(result.storefrontAccessTokenCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'StorefrontAccessToken')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      storefrontAccessTokenDelete: {
        __args: { input: { id } },
        deletedStorefrontAccessTokenId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.storefrontAccessTokenDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.storefrontAccessTokenDelete?.deletedStorefrontAccessTokenId ?? '')
    printJson(result.storefrontAccessTokenDelete, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for storefront-access-tokens: ${verb}`, 2)
}

