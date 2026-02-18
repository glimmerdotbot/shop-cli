import { CliError } from '../errors'
import { coerceGid } from '../gid'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { runMutation, runQuery, parseStandardArgs, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'
import { resolvePublicationIds } from '../workflows/products/publishablePublish'

import { buildListNextPageArgs, parseFirst, parseJsonArg, parseStringList, requireId } from './_shared'

const collectionSummarySelection = {
  id: true,
  title: true,
  handle: true,
  updatedAt: true,
} as const

const collectionFullSelection = {
  ...collectionSummarySelection,
  description: true,
  sortOrder: true,
  templateSuffix: true,
} as const

const getCollectionSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return collectionFullSelection
  if (view === 'raw') return {} as const
  return collectionSummarySelection
}

const getListNodeSelection = (view: CommandContext['view']) => getCollectionSelection(view)

export const runCollections = async ({
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
        '  shop collections <verb> [flags]',
        '',
        'Verbs:',
        '  create|get|list|count|update|delete|duplicate',
        '  add-products|remove-products|reorder-products',
        '  publish|unpublish',
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
    const id = requireId(args.id, 'Collection')
    const selection = resolveSelection({
      resource: 'collections',
      view: ctx.view,
      baseSelection: getCollectionSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      collection: { __args: { id }, ...selection },
    })
    if (result === undefined) return
    printNode({ node: result.collection, format: ctx.format, quiet: ctx.quiet })
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
      resource: 'collections',
      view: ctx.view,
      baseSelection: getListNodeSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })
    const result = await runQuery(ctx, {
      collections: {
        __args: { first, after, query, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return

    printConnection({
      connection: result.collections,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: buildListNextPageArgs('collections', { first, query, sort: sortKey, reverse }),
    })
    return
  }

  if (verb === 'count') {
    const args = parseStandardArgs({ argv, extraOptions: { limit: { type: 'string' } } })
    const query = args.query as any
    const limitRaw = args.limit as any
    const limit =
      limitRaw === undefined || limitRaw === null || limitRaw === ''
        ? undefined
        : Number(limitRaw)

    if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0)) {
      throw new CliError('--limit must be a positive number', 2)
    }

    const result = await runQuery(ctx, {
      collectionsCount: {
        __args: {
          ...(query ? { query } : {}),
          ...(limit !== undefined ? { limit: Math.floor(limit) } : {}),
        },
        count: true,
        precision: true,
      },
    })
    if (result === undefined) return
    if (ctx.quiet) return console.log(result.collectionsCount?.count ?? '')
    printJson(result.collectionsCount, ctx.format !== 'raw')
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
      collectionCreate: {
        __args: { input: built.input },
        collection: collectionSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.collectionCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.collectionCreate?.collection?.id ?? '')
    printJson(result.collectionCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'add-products' || verb === 'remove-products') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'product-id': { type: 'string', multiple: true },
      },
    })

    const id = requireId(args.id as any, 'Collection')
    const rawProducts = parseStringList((args as any)['product-id'], '--product-id')
    const productIds = rawProducts.map((pid) => coerceGid(pid, 'Product'))

    const mutation = verb === 'add-products' ? 'collectionAddProductsV2' : 'collectionRemoveProducts'
    const result = await runMutation(ctx, {
      [mutation]: {
        __args: { id, productIds },
        job: { id: true, done: true },
        userErrors: { field: true, message: true },
      },
    } as any)
    if (result === undefined) return

    const payload = (result as any)[mutation]
    maybeFailOnUserErrors({ payload, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(payload?.job?.id ?? '')
    printJson(payload, ctx.format !== 'raw')
    return
  }

  if (verb === 'reorder-products') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        moves: { type: 'string' },
        move: { type: 'string', multiple: true },
      },
    })
    const id = requireId(args.id as any, 'Collection')

    let moves: Array<{ id: string; newPosition: number }> = []
    if ((args as any).moves) {
      moves = parseJsonArg((args as any).moves, '--moves')
      if (!Array.isArray(moves)) throw new CliError('--moves must be a JSON array', 2)
    } else if ((args as any).move) {
      const raw = (args as any).move as string[]
      const parsedMoves: Array<{ id: string; newPosition: number }> = []
      for (const item of raw) {
        const parts = item.split(':')
        if (parts.length !== 2) throw new CliError('--move must be <productId>:<newPosition>', 2)
        const productId = parts[0]!.trim()
        const pos = Number(parts[1]!.trim())
        if (!productId) throw new CliError('--move productId cannot be empty', 2)
        if (!Number.isFinite(pos) || pos < 0) throw new CliError('--move newPosition must be a non-negative number', 2)
        parsedMoves.push({ id: coerceGid(productId, 'Product'), newPosition: Math.floor(pos) })
      }
      moves = parsedMoves
    }

    if (moves.length === 0) {
      throw new CliError('Missing moves: pass either --moves <json|@file> or --move <productId>:<newPosition> (repeatable)', 2)
    }

    const normalizedMoves = moves.map((move, i) => {
      const mid = (move as any)?.id
      const newPosition = (move as any)?.newPosition
      if (typeof mid !== 'string' || !mid.trim()) throw new CliError(`moves[${i}].id is required`, 2)
      const pos = Number(newPosition)
      if (!Number.isFinite(pos) || pos < 0) throw new CliError(`moves[${i}].newPosition must be a non-negative number`, 2)
      return { id: mid.startsWith('gid://') ? mid : coerceGid(mid, 'Product'), newPosition: Math.floor(pos) }
    })

    const result = await runMutation(ctx, {
      collectionReorderProducts: {
        __args: { id, moves: normalizedMoves },
        job: { id: true, done: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.collectionReorderProducts, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.collectionReorderProducts?.job?.id ?? '')
    printJson(result.collectionReorderProducts, ctx.format !== 'raw')
    return
  }

  if (verb === 'publish' || verb === 'unpublish') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'publication-id': { type: 'string', multiple: true },
        publication: { type: 'string', multiple: true },
      },
    })

    const id = requireId(args.id as any, 'Collection')
    const publicationIds = ((args as any)['publication-id'] as any) ?? []
    const publicationNames = ((args as any).publication as any) ?? []

    const resolvedPublicationIds = await resolvePublicationIds({
      ctx,
      publicationIds,
      publicationNames,
    })

    const collectionPublications = resolvedPublicationIds.map((publicationId) => ({ publicationId }))
    const mutation = verb === 'publish' ? 'collectionPublish' : 'collectionUnpublish'

    const result = await runMutation(ctx, {
      [mutation]: {
        __args: { input: { id, collectionPublications } },
        collection: { id: true, title: true },
        userErrors: { field: true, message: true },
      },
    } as any)
    if (result === undefined) return
    const payload = (result as any)[mutation]
    maybeFailOnUserErrors({ payload, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(payload?.collection?.id ?? '')
    printJson(payload, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Collection')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const input = { ...built.input, id }

    const result = await runMutation(ctx, {
      collectionUpdate: {
        __args: { input },
        collection: collectionSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.collectionUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.collectionUpdate?.collection?.id ?? '')
    printJson(result.collectionUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Collection')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      collectionDelete: {
        __args: { input: { id } },
        deletedCollectionId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.collectionDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.collectionDelete?.deletedCollectionId ?? '')
    printJson(result.collectionDelete, ctx.format !== 'raw')
    return
  }

  if (verb === 'duplicate') {
    const args = parseStandardArgs({ argv, extraOptions: { 'copy-publications': { type: 'boolean' } } })
    const id = requireId(args.id, 'Collection')

    const built = buildInput({
      inputArg: undefined,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })

    let newTitle =
      (args['new-title'] as string | undefined) ??
      (built.used ? built.input?.newTitle : undefined)

    if (!newTitle) {
      const original = await runQuery(ctx, {
        collection: { __args: { id }, title: true },
      })
      if (original === undefined) return
      const title = original.collection?.title
      if (!title) throw new CliError('Could not resolve original collection title to auto-generate newTitle', 2)
      newTitle = `${title} (Copy)`
    }

    const copyPublications = (args as any)['copy-publications']
    const input = {
      collectionId: id,
      newTitle,
      ...(copyPublications === undefined ? {} : { copyPublications }),
      ...(built.used ? built.input : {}),
    }

    const result = await runMutation(ctx, {
      collectionDuplicate: {
        __args: { input },
        collection: collectionSummarySelection,
        job: { id: true, done: true },
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.collectionDuplicate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.collectionDuplicate?.collection?.id ?? '')
    printJson(result.collectionDuplicate, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for collections: ${verb}`, 2)
}
