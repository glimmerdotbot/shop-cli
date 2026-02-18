import { CliError } from '../errors'
import { coerceGid } from '../gid'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'
import {
  buildLocalFilesForStagedUpload,
  stagedUploadLocalFiles,
  type StagedUploadResource,
} from '../workflows/files/stagedUploads'
import { metafieldsUpsert } from '../workflows/products/metafieldsUpsert'
import {
  parsePublishDate,
  publishProduct,
  resolvePublicationIds,
  unpublishProduct,
} from '../workflows/products/publishablePublish'
import { listPublications } from '../workflows/publications/resolvePublicationId'

import { buildListNextPageArgs, parseFirst, requireId } from './_shared'

type MediaContentType = 'IMAGE' | 'VIDEO' | 'MODEL_3D' | 'EXTERNAL_VIDEO'

const productMediaSelection = {
  id: true,
  mediaContentType: true,
  status: true,
  alt: true,
  preview: { status: true, image: { url: true } },
  mediaErrors: { code: true, message: true },
  mediaWarnings: { code: true, message: true },
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

const getProductSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return productFullSelection
  if (view === 'raw') return {} as const
  return productSummarySelection
}

const parseTags = (tags: string | undefined) => {
  if (!tags) throw new CliError('Missing --tags', 2)
  const parts = tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
  if (parts.length === 0) throw new CliError('--tags must include at least one tag', 2)
  return parts
}

const normalizeMediaContentType = (value: string | undefined): MediaContentType => {
  if (!value) return 'IMAGE'
  const v = value.toUpperCase()
  if (v === 'IMAGE' || v === 'VIDEO' || v === 'MODEL_3D' || v === 'EXTERNAL_VIDEO') return v
  throw new CliError('--media-type must be IMAGE|VIDEO|MODEL_3D|EXTERNAL_VIDEO', 2)
}

const normalizeMediaId = (value: string) => {
  const raw = value.trim()
  if (!raw) throw new CliError('Media ID cannot be empty', 2)
  if (raw.startsWith('gid://')) return raw
  // Media IDs map to file resources in most workflows; allow numeric IDs by coercing to File.
  return coerceGid(raw, 'File')
}

const mediaTypeToStagedResource = (mediaType: MediaContentType): StagedUploadResource => {
  if (mediaType === 'IMAGE') return 'IMAGE'
  if (mediaType === 'VIDEO') return 'VIDEO'
  if (mediaType === 'MODEL_3D') return 'MODEL_3D'
  throw new CliError('--media-type EXTERNAL_VIDEO cannot be used with --file uploads', 2)
}

const stagedResourceToMediaType = (resource: StagedUploadResource): MediaContentType => {
  if (resource === 'IMAGE') return 'IMAGE'
  if (resource === 'VIDEO') return 'VIDEO'
  if (resource === 'MODEL_3D') return 'MODEL_3D'
  throw new CliError('Only IMAGE|VIDEO|MODEL_3D can be uploaded as product media', 2)
}

export const runProducts = async ({
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
        '  shop products <verb> [flags]',
        '',
        'Verbs:',
        '  create|get|list|count|update|delete|duplicate|set-status|archive|unarchive',
        '  add-tags|remove-tags|set-price',
        '  publish|unpublish|publish-all',
        '  bundle-create|bundle-update',
        '  metafields upsert',
        '  media add|media upload|media list|media remove|media reorder|media update',
        '',
        'Common output flags:',
        '  --view summary|ids|full|raw',
        '  --select <path>        (repeatable; dot paths; adds to base view selection)',
        '  --selection <graphql>  (selection override; can be @file.gql)',
      ].join('\n'),
    )
    return
  }

  if (verb === 'bundle-create' || verb === 'bundle-update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const mutation = verb === 'bundle-create' ? 'productBundleCreate' : 'productBundleUpdate'
    const result = await runMutation(ctx, {
      [mutation]: {
        __args: { input: built.input },
        productBundleOperation: {
          id: true,
          status: true,
          product: { id: true, title: true },
          userErrors: { field: true, message: true },
        },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    const payload = (result as any)[mutation]
    maybeFailOnUserErrors({ payload, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(payload?.productBundleOperation?.id ?? '')
    printJson(payload, ctx.format !== 'raw')
    return
  }

  if (verb === 'count') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        limit: { type: 'string' },
        'saved-search-id': { type: 'string' },
      },
    })
    const query = args.query as any
    const limitRaw = args.limit as any
    const savedSearchIdRaw = (args as any)['saved-search-id'] as any

    const limit =
      limitRaw === undefined || limitRaw === null || limitRaw === ''
        ? undefined
        : Number(limitRaw)

    if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0)) {
      throw new CliError('--limit must be a positive number', 2)
    }

    const savedSearchId = savedSearchIdRaw
      ? coerceGid(String(savedSearchIdRaw), 'SavedSearch')
      : undefined

    const result = await runQuery(ctx, {
      productsCount: {
        __args: {
          ...(query ? { query } : {}),
          ...(savedSearchId ? { savedSearchId } : {}),
          ...(limit !== undefined ? { limit: Math.floor(limit) } : {}),
        },
        count: true,
        precision: true,
      },
    })
    if (result === undefined) return
    if (ctx.quiet) return console.log(result.productsCount?.count ?? '')
    printJson(result.productsCount, ctx.format !== 'raw')
    return
  }

  if (verb === 'publish' || verb === 'unpublish') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'publication-id': { type: 'string', multiple: true },
        publication: { type: 'string', multiple: true },
        at: { type: 'string' },
        now: { type: 'boolean' },
      },
    })

    const publicationIds = ((args['publication-id'] as any) ?? []) as string[]
    const publicationNames = ((args.publication as any) ?? []) as string[]

    const resolvedPublicationIds = await resolvePublicationIds({
      ctx,
      publicationIds,
      publicationNames,
    })

    if (verb === 'publish') {
      const publishDate = parsePublishDate({ at: args.at as any, now: args.now as any })
      const payload = await publishProduct({
        ctx,
        id: args.id,
        publicationIds: resolvedPublicationIds,
        publishDate,
      })
      if (payload === undefined) return
      if (ctx.quiet) return console.log(payload?.publishable?.id ?? '')
      printJson(payload)
      return
    }

    const payload = await unpublishProduct({
      ctx,
      id: args.id,
      publicationIds: resolvedPublicationIds,
    })
    if (payload === undefined) return
    if (ctx.quiet) return console.log(payload?.publishable?.id ?? '')
    printJson(payload)
    return
  }

  if (verb === 'publish-all') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        at: { type: 'string' },
        now: { type: 'boolean' },
      },
    })

    if (ctx.dryRun) {
      await listPublications(ctx)
      return
    }

    const publishDate = parsePublishDate({ at: args.at as any, now: args.now as any })
    const publications = await listPublications(ctx)
    const publicationIds = publications.map((p) => p.id).filter(Boolean)
    if (publicationIds.length === 0) throw new CliError('No publications found to publish to', 2)

    const payload = await publishProduct({
      ctx,
      id: args.id,
      publicationIds,
      publishDate,
    })
    if (payload === undefined) return
    if (ctx.quiet) return console.log(payload?.publishable?.id ?? '')
    printJson(payload)
    return
  }

  if (verb === 'metafields upsert') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await metafieldsUpsert({ ctx, id: args.id, input: built.input })
    if (result === undefined) return

    printJson(result)
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Product')
    const selection = resolveSelection({
      resource: 'products',
      view: ctx.view,
      baseSelection: getProductSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { product: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.product, format: ctx.format, quiet: ctx.quiet })
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
      resource: 'products',
      view: ctx.view,
      baseSelection: getProductSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

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
      nextPageArgs: buildListNextPageArgs('products', { first, query, sort: sortKey, reverse }),
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
      productCreate: {
        __args: { input: built.input },
        product: productSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.productCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.productCreate?.product?.id ?? '')
    printJson(result.productCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'archive' || verb === 'unarchive') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id as any, 'Product')
    const status =
      verb === 'archive' ? 'ARCHIVED' : ((args.status as string | undefined) ?? 'DRAFT')

    const result = await runMutation(ctx, {
      productUpdate: {
        __args: { input: { id, status } },
        product: productSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.productUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.productUpdate?.product?.id ?? '')
    printJson(result.productUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Product')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const input = { ...built.input, id }

    const result = await runMutation(ctx, {
      productUpdate: {
        __args: { input },
        product: productSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.productUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.productUpdate?.product?.id ?? '')
    printJson(result.productUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Product')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      productDelete: {
        __args: { input: { id } },
        deletedProductId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.productDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.productDelete?.deletedProductId ?? '')
    printJson(result.productDelete, ctx.format !== 'raw')
    return
  }

  if (verb === 'duplicate') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Product')

    const built = buildInput({
      inputArg: undefined,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })

    let newTitle =
      (args['new-title'] as string | undefined) ??
      (built.used ? built.input?.newTitle : undefined)

    if (!newTitle) {
      const original = await runQuery(ctx, { product: { __args: { id }, title: true } })
      if (original === undefined) return
      const title = original.product?.title
      if (!title) throw new CliError('Could not resolve original product title to auto-generate newTitle', 2)
      newTitle = `${title} (Copy)`
    }

    const mutationArgs = {
      productId: id,
      newTitle,
      ...(built.used ? built.input : {}),
    }

    const result = await runMutation(ctx, {
      productDuplicate: {
        __args: mutationArgs,
        newProduct: productSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.productDuplicate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.productDuplicate?.newProduct?.id ?? '')
    printJson(result.productDuplicate, ctx.format !== 'raw')
    return
  }

  if (verb === 'set-status') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Product')
    const status = args.status as string | undefined
    if (!status) throw new CliError('Missing --status (ACTIVE|DRAFT|ARCHIVED)', 2)

    const result = await runMutation(ctx, {
      productUpdate: {
        __args: { input: { id, status } },
        product: productSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.productUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.productUpdate?.product?.id ?? '')
    printJson(result.productUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'set-price') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'variant-id': { type: 'string' },
        price: { type: 'string' },
        'compare-at-price': { type: 'string' },
        'product-id': { type: 'string' },
      },
    })

    const variantId = requireId((args as any)['variant-id'], 'ProductVariant')
    const price = args.price as string | undefined
    if (!price) throw new CliError('Missing --price', 2)

    const compareAtPrice = (args as any)['compare-at-price'] as string | undefined
    const explicitProductId = (args as any)['product-id'] as string | undefined

    let productId: string
    if (explicitProductId) {
      productId = coerceGid(explicitProductId, 'Product')
    } else {
      if (ctx.dryRun) {
        throw new CliError(
          'In --dry-run mode, --product-id is required because resolving a productId from a variantId requires executing a query.',
          2,
        )
      }
      const resolved = await runQuery(ctx, {
        productVariant: { __args: { id: variantId }, product: { id: true } },
      })
      if (resolved === undefined) return
      const pid = resolved.productVariant?.product?.id
      if (!pid) throw new CliError('Could not resolve productId from --variant-id', 2)
      productId = pid
    }

    const result = await runMutation(ctx, {
      productVariantsBulkUpdate: {
        __args: {
          productId,
          variants: [
            {
              id: variantId,
              price,
              ...(compareAtPrice ? { compareAtPrice } : {}),
            },
          ],
        },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.productVariantsBulkUpdate,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(variantId)
    printJson(result.productVariantsBulkUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'add-tags' || verb === 'remove-tags') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Product')
    const tags = parseTags(args.tags as any)

    const mutationField = verb === 'add-tags' ? 'tagsAdd' : 'tagsRemove'
    const request: any = {
      [mutationField]: {
        __args: { id, tags },
        node: { id: true },
        userErrors: { field: true, message: true },
      },
    }

    const result = await runMutation(ctx, request)
    if (result === undefined) return
    const payload = result[mutationField]
    maybeFailOnUserErrors({ payload, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(payload?.node?.id ?? '')
    printJson(payload, ctx.format !== 'raw')
    return
  }

  if (verb === 'media add') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        url: { type: 'string', multiple: true },
        alt: { type: 'string' },
        'media-type': { type: 'string' },
      },
    })
    const id = requireId(args.id, 'Product')

    const urls = (args.url as string[] | undefined) ?? []
    if (urls.length === 0) throw new CliError('Missing --url (repeatable)', 2)

    const mediaContentType = normalizeMediaContentType(args['media-type'] as any)
    const alt = args.alt as string | undefined

    const media = urls.map((url) => ({
      originalSource: url,
      mediaContentType,
      ...(alt ? { alt } : {}),
    }))

    const result = await runMutation(ctx, {
      productUpdate: {
        __args: { product: { id }, media },
        product: productSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.productUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.productUpdate?.product?.id ?? '')
    printJson(result.productUpdate)
    return
  }

  if (verb === 'media upload') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        file: { type: 'string', multiple: true },
        alt: { type: 'string' },
        'content-type': { type: 'string' },
        'media-type': { type: 'string' },
      },
    })
    const id = requireId(args.id, 'Product')

    const filePaths = (args.file as string[] | undefined) ?? []
    if (filePaths.length === 0) throw new CliError('Missing --file (repeatable)', 2)

    const forcedMediaType = args['media-type'] as string | undefined
    const forced = forcedMediaType ? normalizeMediaContentType(forcedMediaType) : undefined
    const resourceOverride = forced ? mediaTypeToStagedResource(forced) : undefined

    const localFiles = buildLocalFilesForStagedUpload({
      filePaths,
      contentType: args['content-type'] as any,
      resource: resourceOverride,
    })

    const targets = await stagedUploadLocalFiles(ctx, localFiles)
    if (targets === undefined) return

    const alt = args.alt as string | undefined
    const media = targets.map((t, i) => {
      const local = localFiles[i]!
      if (!t.resourceUrl) throw new CliError(`Missing staged target resourceUrl for ${local.filename}`, 2)
      return {
        originalSource: t.resourceUrl,
        mediaContentType: forced ?? stagedResourceToMediaType(local.resource),
        ...(alt ? { alt } : {}),
      }
    })

    const result = await runMutation(ctx, {
      productUpdate: {
        __args: { product: { id }, media },
        product: productSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.productUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.productUpdate?.product?.id ?? '')
    printJson(result.productUpdate)
    return
  }

  if (verb === 'media list') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id as any, 'Product')
    const first = parseFirst(args.first)
    const after = args.after as any

    const result = await runQuery(ctx, {
      product: {
        __args: { id },
        media: {
          __args: { first, after },
          pageInfo: { hasNextPage: true, endCursor: true },
          nodes: productMediaSelection,
        },
      },
    })
    if (result === undefined) return
    const connection = result.product?.media ?? { nodes: [], pageInfo: undefined }
    printConnection({
      connection,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: {
        base: 'shop products media list',
        first,
        extraFlags: [{ flag: '--id', value: id }],
      },
    })
    return
  }

  if (verb === 'media remove') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'media-id': { type: 'string', multiple: true },
      },
    })
    const productId = requireId(args.id as any, 'Product')
    const mediaIds = ((args as any)['media-id'] as string[] | undefined) ?? []
    if (mediaIds.length === 0) throw new CliError('Missing --media-id (repeatable)', 2)

    const files = mediaIds.map((id) => ({
      id: normalizeMediaId(id),
      referencesToRemove: [productId],
    }))

    const result = await runMutation(ctx, {
      fileUpdate: {
        __args: { files },
        files: { id: true, alt: true, fileStatus: true, updatedAt: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.fileUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(productId)
    printJson(result.fileUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'media update') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'media-id': { type: 'string' },
        alt: { type: 'string' },
      },
    })
    const mediaIdRaw = (args as any)['media-id'] as string | undefined
    if (!mediaIdRaw) throw new CliError('Missing --media-id', 2)
    const alt = args.alt as string | undefined
    if (alt === undefined) throw new CliError('Missing --alt', 2)

    const files = [{ id: normalizeMediaId(mediaIdRaw), alt }]

    const result = await runMutation(ctx, {
      fileUpdate: {
        __args: { files },
        files: { id: true, alt: true, fileStatus: true, updatedAt: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.fileUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(files[0]!.id)
    printJson(result.fileUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'media reorder') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        moves: { type: 'string' },
        move: { type: 'string', multiple: true },
      },
    })
    const id = requireId(args.id as any, 'Product')

    let moves: Array<{ id: string; newPosition: number }> = []
    if ((args as any).moves) {
      try {
        const parsed = JSON.parse((args as any).moves as string)
        if (!Array.isArray(parsed)) throw new CliError('--moves must be a JSON array', 2)
        moves = parsed as any
      } catch (err) {
        throw new CliError(`--moves must be valid JSON: ${(err as Error).message}`, 2)
      }
    } else if ((args as any).move) {
      const raw = (args as any).move as string[]
      const parsedMoves: Array<{ id: string; newPosition: number }> = []
      for (const item of raw) {
        const parts = item.split(':')
        if (parts.length !== 2) throw new CliError('--move must be <mediaId>:<newPosition>', 2)
        const mediaId = parts[0]!.trim()
        const pos = Number(parts[1]!.trim())
        if (!mediaId) throw new CliError('--move mediaId cannot be empty', 2)
        if (!Number.isFinite(pos) || pos < 0) throw new CliError('--move newPosition must be a non-negative number', 2)
        parsedMoves.push({ id: normalizeMediaId(mediaId), newPosition: Math.floor(pos) } as any)
      }
      moves = parsedMoves as any
    }

    if (moves.length === 0) {
      throw new CliError('Missing moves: pass either --moves <json> or --move <mediaId>:<newPosition> (repeatable)', 2)
    }

    const normalizedMoves = moves.map((move, i) => {
      const id = (move as any)?.id
      const newPosition = (move as any)?.newPosition
      if (typeof id !== 'string' || !id.trim()) {
        throw new CliError(`moves[${i}].id is required`, 2)
      }
      const pos = Number(newPosition)
      if (!Number.isFinite(pos) || pos < 0) {
        throw new CliError(`moves[${i}].newPosition must be a non-negative number`, 2)
      }
      return { id: normalizeMediaId(id), newPosition: Math.floor(pos) }
    })

    const result = await runMutation(ctx, {
      productReorderMedia: {
        __args: { id, moves: normalizedMoves },
        job: { id: true, done: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.productReorderMedia, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.productReorderMedia?.job?.id ?? '')
    printJson(result.productReorderMedia, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for products: ${verb}`, 2)
}
