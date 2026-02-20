import { CliError } from '../errors'
import { coerceGid } from '../gid'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { applyComputedFieldsToNode, computedPublicationsSelection } from '../output/computedFields'
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

const productSummarySelection = {
  id: true,
  title: true,
  handle: true,
  status: true,
  updatedAt: true,
} as const

const productFullSelection = {
  ...productSummarySelection,
  createdAt: true,
  tags: true,
} as const

const collectionFullSelection = {
  ...collectionSummarySelection,
  description: true,
  sortOrder: true,
  templateSuffix: true,
} as const

const collectionSummarySelectionForGet = {
  ...collectionSummarySelection,
  ...computedPublicationsSelection,
} as const

const collectionFullSelectionForGet = {
  ...collectionFullSelection,
  ...computedPublicationsSelection,
} as const

const getCollectionSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return collectionFullSelection
  if (view === 'raw') return {} as const
  return collectionSummarySelection
}

const getCollectionSelectionForGet = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return collectionFullSelectionForGet
  if (view === 'raw') return {} as const
  return collectionSummarySelectionForGet
}

const getProductSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return productFullSelection
  if (view === 'raw') return {} as const
  return productSummarySelection
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
        '  create|get|by-handle|by-identifier|list|count|update|delete|duplicate',
        '  rules-conditions',
        '  add-products|remove-products|reorder-products|list-products',
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

  if (verb === 'by-handle') {
    const args = parseStandardArgs({ argv, extraOptions: { handle: { type: 'string' } } })
    const handle = args.handle as string | undefined
    if (!handle) throw new CliError('Missing --handle', 2)

    const selectValues = Array.isArray(args.select)
      ? args.select
      : args.select
        ? [args.select]
        : []
    const selectionOverride =
      typeof (args as any).selection === 'string' && (args as any).selection.length > 0
    const select =
      !selectionOverride && ctx.view !== 'raw' && ctx.view !== 'ids'
        ? Array.from(new Set([...selectValues, 'resourcePublicationsV2.nodes.publication.name']))
        : args.select

    const includeValues = Array.isArray(args.include)
      ? args.include
      : args.include
        ? [args.include]
        : []
    const include =
      ctx.view === 'all'
        ? Array.from(new Set([...includeValues, 'resourcePublicationsV2']))
        : args.include

    const selection = resolveSelection({
      resource: 'collections',
      view: ctx.view,
      baseSelection: getCollectionSelectionForGet(ctx.view) as any,
      select,
      selection: (args as any).selection,
      include,
      ensureId: ctx.quiet,
      defaultConnectionFirst: ctx.view === 'all' ? 50 : 10,
    })

    const result = await runQuery(ctx, {
      collectionByHandle: { __args: { handle }, ...selection },
    })
    if (result === undefined) return

    const wantsResourcePublicationsV2 =
      Array.isArray(args.select) &&
      args.select.some((p: unknown) => typeof p === 'string' && p.startsWith('resourcePublicationsV2'))
    const wantsResourcePublicationsV2ViaSelection =
      typeof (args as any).selection === 'string' && (args as any).selection.includes('resourcePublicationsV2')
    const stripResourcePublicationsV2 = !(wantsResourcePublicationsV2 || wantsResourcePublicationsV2ViaSelection)

    const withComputed = applyComputedFieldsToNode(result.collectionByHandle, {
      view: ctx.view,
      stripResourcePublicationsV2,
    })
    printNode({ node: withComputed, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'by-identifier') {
    const args = parseStandardArgs({ argv, extraOptions: { identifier: { type: 'string' } } })
    const identifier = parseJsonArg((args as any).identifier, '--identifier')

    const selectValues = Array.isArray(args.select)
      ? args.select
      : args.select
        ? [args.select]
        : []
    const selectionOverride =
      typeof (args as any).selection === 'string' && (args as any).selection.length > 0
    const select =
      !selectionOverride && ctx.view !== 'raw' && ctx.view !== 'ids'
        ? Array.from(new Set([...selectValues, 'resourcePublicationsV2.nodes.publication.name']))
        : args.select

    const includeValues = Array.isArray(args.include)
      ? args.include
      : args.include
        ? [args.include]
        : []
    const include =
      ctx.view === 'all'
        ? Array.from(new Set([...includeValues, 'resourcePublicationsV2']))
        : args.include

    const selection = resolveSelection({
      resource: 'collections',
      view: ctx.view,
      baseSelection: getCollectionSelectionForGet(ctx.view) as any,
      select,
      selection: (args as any).selection,
      include,
      ensureId: ctx.quiet,
      defaultConnectionFirst: ctx.view === 'all' ? 50 : 10,
    })

    const result = await runQuery(ctx, {
      collectionByIdentifier: { __args: { identifier }, ...selection },
    })
    if (result === undefined) return

    const wantsResourcePublicationsV2 =
      Array.isArray(args.select) &&
      args.select.some((p: unknown) => typeof p === 'string' && p.startsWith('resourcePublicationsV2'))
    const wantsResourcePublicationsV2ViaSelection =
      typeof (args as any).selection === 'string' && (args as any).selection.includes('resourcePublicationsV2')
    const stripResourcePublicationsV2 = !(wantsResourcePublicationsV2 || wantsResourcePublicationsV2ViaSelection)

    const withComputed = applyComputedFieldsToNode(result.collectionByIdentifier, {
      view: ctx.view,
      stripResourcePublicationsV2,
    })
    printNode({ node: withComputed, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'rules-conditions') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const selection = resolveSelection({
      typeName: 'CollectionRuleConditions',
      view: ctx.view,
      baseSelection: {
        ruleType: true,
        defaultRelation: true,
        allowedRelations: true,
        ruleObject: {
          __typename: true,
          on_CollectionRuleMetafieldCondition: {
            metafieldDefinition: { id: true, name: true, namespace: true, key: true },
          },
        },
        __typename: true,
      } as const,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: false,
    })

    const result = await runQuery(ctx, { collectionRulesConditions: selection })
    if (result === undefined) return
    printJson(result.collectionRulesConditions, ctx.format !== 'raw')
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Collection')

    const selectValues = Array.isArray(args.select)
      ? args.select
      : args.select
        ? [args.select]
        : []
    const selectionOverride =
      typeof (args as any).selection === 'string' && (args as any).selection.length > 0
    const select =
      !selectionOverride && ctx.view !== 'raw' && ctx.view !== 'ids'
        ? Array.from(new Set([...selectValues, 'resourcePublicationsV2.nodes.publication.name']))
        : args.select

    const includeValues = Array.isArray(args.include)
      ? args.include
      : args.include
        ? [args.include]
        : []
    const include =
      ctx.view === 'all'
        ? Array.from(new Set([...includeValues, 'resourcePublicationsV2']))
        : args.include

    const selection = resolveSelection({
      resource: 'collections',
      view: ctx.view,
      baseSelection: getCollectionSelectionForGet(ctx.view) as any,
      select,
      selection: (args as any).selection,
      include,
      ensureId: ctx.quiet,
      defaultConnectionFirst: ctx.view === 'all' ? 50 : 10,
    })

    const result = await runQuery(ctx, {
      collection: { __args: { id }, ...selection },
    })
    if (result === undefined) return
    const wantsResourcePublicationsV2 =
      Array.isArray(args.select) &&
      args.select.some((p: unknown) => typeof p === 'string' && p.startsWith('resourcePublicationsV2'))
    const wantsResourcePublicationsV2ViaSelection =
      typeof (args as any).selection === 'string' && (args as any).selection.includes('resourcePublicationsV2')
    const stripResourcePublicationsV2 = !(wantsResourcePublicationsV2 || wantsResourcePublicationsV2ViaSelection)

    const withComputed = applyComputedFieldsToNode(result.collection, {
      view: ctx.view,
      stripResourcePublicationsV2,
    })
    printNode({ node: withComputed, format: ctx.format, quiet: ctx.quiet })
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

  if (verb === 'list-products') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        handle: { type: 'string' },
        published: { type: 'boolean' },
      },
    })

    const rawId = args.id as unknown
    const rawHandle = (args as any).handle as unknown
    const handle = typeof rawHandle === 'string' && rawHandle.trim() ? rawHandle.trim() : undefined

    if (typeof rawId === 'string' && rawId && handle) {
      throw new CliError('Pass exactly one of --id or --handle', 2)
    }

    if (!(typeof rawId === 'string' && rawId) && !handle) {
      throw new CliError('Missing --id or --handle', 2)
    }

    const id = typeof rawId === 'string' && rawId ? requireId(rawId, 'Collection') : undefined

    const toNumericId = (gid: string, typeLabel: string) => {
      const match = /\/(\d+)$/.exec(gid)
      if (!match) throw new CliError(`Invalid ${typeLabel} ID`, 2)
      return match[1]!
    }

    const first = parseFirst(args.first)
    const after = args.after as any
    const userQuery =
      typeof args.query === 'string' && args.query.trim() ? (args.query.trim() as any) : undefined
    const published = (args as any).published === true
    const publishedFilter = 'published_status:published'
    const reverse = args.reverse as any
    const sortKey = args.sort as any

    const nodeSelection = resolveSelection({
      resource: 'products',
      view: ctx.view,
      baseSelection: getProductSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    let numericId = typeof id === 'string' && id ? toNumericId(id, 'Collection') : undefined
    if (!numericId && handle) {
      const resolveResult = await runQuery(ctx, {
        collectionByHandle: { __args: { handle }, id: true },
      })
      if (resolveResult === undefined) return
      const resolvedId = (resolveResult as any)?.collectionByHandle?.id
      if (typeof resolvedId !== 'string' || !resolvedId) throw new CliError('Collection not found', 2)
      numericId = toNumericId(resolvedId, 'Collection')
    }

    if (!numericId) throw new CliError('Collection not found', 2)

    const collectionFilter = `collection_id:${numericId}`
    const parts: string[] = []
    if (typeof userQuery === 'string' && userQuery) parts.push(userQuery)
    if (published && !(typeof userQuery === 'string' && userQuery.includes(publishedFilter))) {
      parts.push(publishedFilter)
    }
    if (!(typeof userQuery === 'string' && userQuery.includes(collectionFilter))) {
      parts.push(collectionFilter)
    }
    const query = parts.length > 0 ? (parts.join(' ') as any) : undefined

    const base = id
      ? `shop collections list-products --id ${id}`
      : `shop collections list-products --handle ${handle}`

    const result = await runQuery(ctx, {
      products: {
        __args: { first, after, query, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return

    printConnection({
      connection: result.products,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: {
        base,
        first,
        query: typeof userQuery === 'string' ? userQuery : undefined,
        sort: typeof sortKey === 'string' ? sortKey : undefined,
        reverse: reverse === true,
        extraFlags: published ? [{ flag: '--published', value: true }] : undefined,
      },
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
    if (ctx.quiet) {
      process.stdout.write(`${payload?.job?.id ?? ''}\n`)
      return
    }
    printNode({
      node: { job: payload?.job, collectionId: id, productIds, userErrors: payload?.userErrors },
      format: ctx.format,
      quiet: false,
    })
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

    let moves: Array<{ id: string; newPosition: string }> = []
    if ((args as any).moves) {
      moves = parseJsonArg((args as any).moves, '--moves')
      if (!Array.isArray(moves)) throw new CliError('--moves must be a JSON array', 2)
    } else if ((args as any).move) {
      const raw = (args as any).move as string[]
      const parsedMoves: Array<{ id: string; newPosition: string }> = []
      for (const item of raw) {
        const idx = item.lastIndexOf(':')
        if (idx <= 0 || idx === item.length - 1) throw new CliError('--move must be <productId>:<newPosition>', 2)
        const productId = item.slice(0, idx).trim()
        const pos = Number(item.slice(idx + 1).trim())
        if (!productId) throw new CliError('--move productId cannot be empty', 2)
        if (!Number.isFinite(pos) || pos < 0) throw new CliError('--move newPosition must be a non-negative number', 2)
        parsedMoves.push({ id: coerceGid(productId, 'Product'), newPosition: String(Math.floor(pos)) })
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
      return { id: mid.startsWith('gid://') ? mid : coerceGid(mid, 'Product'), newPosition: String(Math.floor(pos)) }
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
    if (ctx.quiet) {
      process.stdout.write(`${result.collectionReorderProducts?.job?.id ?? ''}\n`)
      return
    }
    printNode({
      node: {
        job: result.collectionReorderProducts?.job,
        collectionId: id,
        moves: normalizedMoves,
        userErrors: result.collectionReorderProducts?.userErrors,
      },
      format: ctx.format,
      quiet: false,
    })
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
        collection: { id: true },
        job: { id: true, done: true },
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.collectionDuplicate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) {
      process.stdout.write(`${result.collectionDuplicate?.job?.id ?? result.collectionDuplicate?.collection?.id ?? ''}\n`)
      return
    }
    printNode({
      node: {
        job: result.collectionDuplicate?.job,
        collectionId: result.collectionDuplicate?.collection?.id,
        userErrors: result.collectionDuplicate?.userErrors,
      },
      format: ctx.format,
      quiet: false,
    })
    return
  }

  throw new CliError(`Unknown verb for collections: ${verb}`, 2)
}
