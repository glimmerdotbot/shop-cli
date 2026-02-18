import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { buildListNextPageArgs, parseDateTime, parseFirst, requireId } from './_shared'

const productFeedSummarySelection = {
  id: true,
  country: true,
  language: true,
  status: true,
} as const

const productFeedFullSelection = {
  ...productFeedSummarySelection,
} as const

const getProductFeedSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return productFeedFullSelection
  if (view === 'raw') return {} as const
  return productFeedSummarySelection
}

export const runProductFeeds = async ({
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
        '  shop product-feeds <verb> [flags]',
        '',
        'Verbs:',
        '  get|list|create|delete|full-sync',
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
    const id = requireId(args.id, 'ProductFeed')

    const selection = resolveSelection({
      resource: 'product-feeds',
      view: ctx.view,
      baseSelection: getProductFeedSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { productFeed: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.productFeed, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const reverse = args.reverse as any

    const nodeSelection = resolveSelection({
      resource: 'product-feeds',
      view: ctx.view,
      baseSelection: getProductFeedSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      productFeeds: {
        __args: { first, after, reverse },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return

    printConnection({
      connection: result.productFeeds,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: buildListNextPageArgs('product-feeds', { first, reverse }),
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

    const result = await runMutation(ctx, {
      productFeedCreate: {
        __args: { input: built.input },
        productFeed: productFeedSummarySelection,
        userErrors: { code: true, field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.productFeedCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.productFeedCreate?.productFeed?.id ?? '')
    printJson(result.productFeedCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'ProductFeed')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      productFeedDelete: {
        __args: { id },
        deletedId: true,
        userErrors: { code: true, field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.productFeedDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.productFeedDelete?.deletedId ?? '')
    printJson(result.productFeedDelete, ctx.format !== 'raw')
    return
  }

  if (verb === 'full-sync') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'updated-at-since': { type: 'string' },
        'before-updated-at': { type: 'string' },
      },
    })

    const id = requireId(args.id, 'ProductFeed')
    const updatedAtSince = (args as any)['updated-at-since']
      ? parseDateTime((args as any)['updated-at-since'], '--updated-at-since')
      : undefined
    const beforeUpdatedAt = (args as any)['before-updated-at']
      ? parseDateTime((args as any)['before-updated-at'], '--before-updated-at')
      : undefined

    const result = await runMutation(ctx, {
      productFullSync: {
        __args: {
          id,
          ...(updatedAtSince ? { updatedAtSince } : {}),
          ...(beforeUpdatedAt ? { beforeUpdatedAt } : {}),
        },
        id: true,
        userErrors: { code: true, field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.productFullSync, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.productFullSync?.id ?? '')
    printJson(result.productFullSync, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for product-feeds: ${verb}`, 2)
}

