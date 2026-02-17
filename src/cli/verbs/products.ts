import { CliError } from '../errors'
import { coerceGid } from '../gid'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

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

const requireId = (id: string | undefined) => {
  if (!id) throw new CliError('Missing --id', 2)
  return coerceGid(id, 'Product')
}

const parseFirst = (value: unknown) => {
  if (value === undefined) return 50
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) throw new CliError('--first must be a positive integer', 2)
  return Math.floor(n)
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
        '  create|get|list|update|delete|duplicate|set-status|add-tags|remove-tags',
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
    const id = requireId(args.id as any)
    const selection = resolveSelection({
      view: ctx.view,
      baseSelection: getProductSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
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
      view: ctx.view,
      baseSelection: getProductSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
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

    printConnection({ connection: result.products, format: ctx.format, quiet: ctx.quiet })
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
    if (ctx.format === 'raw') printJson(result.productCreate, false)
    else printJson(result.productCreate)
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id as any)
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
    if (ctx.format === 'raw') printJson(result.productUpdate, false)
    else printJson(result.productUpdate)
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id as any)
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
    if (ctx.format === 'raw') printJson(result.productDelete, false)
    else printJson(result.productDelete)
    return
  }

  if (verb === 'duplicate') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id as any)

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
    if (ctx.format === 'raw') printJson(result.productDuplicate, false)
    else printJson(result.productDuplicate)
    return
  }

  if (verb === 'set-status') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id as any)
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
    if (ctx.format === 'raw') printJson(result.productUpdate, false)
    else printJson(result.productUpdate)
    return
  }

  if (verb === 'add-tags' || verb === 'remove-tags') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id as any)
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
    if (ctx.format === 'raw') printJson(payload, false)
    else printJson(payload)
    return
  }

  throw new CliError(`Unknown verb for products: ${verb}`, 2)
}
