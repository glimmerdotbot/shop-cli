import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'
import { listPublications, resolvePublicationIdFromList } from '../workflows/publications/resolvePublicationId'

import { parseFirst, requireId } from './_shared'

const publicationSummarySelection = {
  id: true,
  name: true,
  autoPublish: true,
  catalog: { title: true },
} as const

const publicationFullSelection = {
  ...publicationSummarySelection,
} as const

const getPublicationSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return publicationFullSelection
  if (view === 'raw') return {} as const
  return publicationSummarySelection
}

export const runPublications = async ({
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
        '  shop publications <verb> [flags]',
        '',
        'Verbs:',
        '  resolve|create|get|list|update|delete',
        '',
        'Common output flags:',
        '  --view summary|ids|full|raw',
        '  --select <path>        (repeatable; dot paths; adds to base view selection)',
        '  --selection <graphql>  (selection override; can be @file.gql)',
      ].join('\n'),
    )
    return
  }

  if (verb === 'resolve') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        publication: { type: 'string' },
      },
    })

    if (ctx.dryRun) {
      await listPublications(ctx)
      return
    }

    const identifier = args.publication as string | undefined
    if (!identifier) throw new CliError('Missing --publication <name|gid|num>', 2)

    const publications = await listPublications(ctx)
    const id = resolvePublicationIdFromList({ publications, identifier })

    if (ctx.quiet) return console.log(id)

    const match =
      publications.find((p) => p.id === id) ??
      ({
        id,
        name: null,
        catalogTitle: null,
        autoPublish: null,
      } as const)

    printJson(match)
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Publication')
    const selection = resolveSelection({
      resource: 'publications',
      view: ctx.view,
      baseSelection: getPublicationSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { publication: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.publication, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const reverse = args.reverse as any

    const nodeSelection = resolveSelection({
      resource: 'publications',
      view: ctx.view,
      baseSelection: getPublicationSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      publications: {
        __args: { first, after, reverse },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({ connection: result.publications, format: ctx.format, quiet: ctx.quiet })
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
      publicationCreate: {
        __args: { input: built.input },
        publication: publicationSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.publicationCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.publicationCreate?.publication?.id ?? '')
    printJson(result.publicationCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Publication')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      publicationUpdate: {
        __args: { id, input: built.input },
        publication: publicationSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.publicationUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.publicationUpdate?.publication?.id ?? '')
    printJson(result.publicationUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Publication')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      publicationDelete: {
        __args: { id },
        deletedId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.publicationDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.publicationDelete?.deletedId ?? '')
    printJson(result.publicationDelete, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for publications: ${verb}`, 2)
}
