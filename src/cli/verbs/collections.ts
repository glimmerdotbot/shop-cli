import { CliError } from '../errors'
import { coerceGid } from '../gid'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { runMutation, runQuery, parseStandardArgs, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

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

const requireId = (id: string | undefined) => {
  if (!id) throw new CliError('Missing --id', 2)
  return coerceGid(id, 'Collection')
}

const parseFirst = (value: unknown) => {
  if (value === undefined) return 50
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) throw new CliError('--first must be a positive integer', 2)
  return Math.floor(n)
}

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
        '  create|get|list|update|delete|duplicate',
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
      baseSelection: getCollectionSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
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
      view: ctx.view,
      baseSelection: getListNodeSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
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
      collectionCreate: {
        __args: { input: built.input },
        collection: collectionSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.collectionCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.collectionCreate?.collection?.id ?? '')
    if (ctx.format === 'raw') printJson(result.collectionCreate, false)
    else printJson(result.collectionCreate)
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
      collectionUpdate: {
        __args: { input },
        collection: collectionSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.collectionUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.collectionUpdate?.collection?.id ?? '')
    if (ctx.format === 'raw') printJson(result.collectionUpdate, false)
    else printJson(result.collectionUpdate)
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id as any)
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
    if (ctx.format === 'raw') printJson(result.collectionDelete, false)
    else printJson(result.collectionDelete)
    return
  }

  if (verb === 'duplicate') {
    const args = parseStandardArgs({ argv, extraOptions: { 'copy-publications': { type: 'boolean' } } })
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
    if (ctx.format === 'raw') printJson(result.collectionDuplicate, false)
    else printJson(result.collectionDuplicate)
    return
  }

  throw new CliError(`Unknown verb for collections: ${verb}`, 2)
}
