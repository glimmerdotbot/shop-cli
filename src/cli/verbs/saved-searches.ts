import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { maybeFailOnUserErrors } from '../userErrors'

import { parseFirst, requireId } from './_shared'

const savedSearchSelection = {
  id: true,
  name: true,
  query: true,
  resourceType: true,
  searchTerms: true,
  filters: { key: true, value: true },
} as const

export const runSavedSearches = async ({
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
        '  shop saved-searches <verb> [flags]',
        '',
        'Verbs:',
        '  create|update|delete',
        '  list-products|list-orders|list-customers|list-draft-orders|list-collections',
      ].join('\n'),
    )
    return
  }

  if (verb === 'create') {
    const args = parseStandardArgs({ argv, extraOptions: { 'resource-type': { type: 'string' } } })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    if (args['resource-type'] && built.input && !built.input.resourceType) {
      built.input.resourceType = args['resource-type']
    }

    const result = await runMutation(ctx, {
      savedSearchCreate: {
        __args: { input: built.input },
        savedSearch: savedSearchSelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.savedSearchCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.savedSearchCreate?.savedSearch?.id ?? '')
    printJson(result.savedSearchCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    if (args.id && built.input && !built.input.id) {
      built.input.id = requireId(args.id, 'SavedSearch')
    }

    const result = await runMutation(ctx, {
      savedSearchUpdate: {
        __args: { input: built.input },
        savedSearch: savedSearchSelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.savedSearchUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.savedSearchUpdate?.savedSearch?.id ?? '')
    printJson(result.savedSearchUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'SavedSearch')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      savedSearchDelete: {
        __args: { input: { id } },
        deletedSavedSearchId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.savedSearchDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.savedSearchDelete?.deletedSavedSearchId ?? '')
    printJson(result.savedSearchDelete, ctx.format !== 'raw')
    return
  }

  if (verb === 'list-products' || verb === 'list-orders' || verb === 'list-customers' || verb === 'list-draft-orders' || verb === 'list-collections') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const reverse = args.reverse as any

    const field =
      verb === 'list-products'
        ? 'productSavedSearches'
        : verb === 'list-orders'
          ? 'orderSavedSearches'
          : verb === 'list-customers'
            ? 'customerSavedSearches'
            : verb === 'list-draft-orders'
              ? 'draftOrderSavedSearches'
              : 'collectionSavedSearches'

    const result = await runQuery(ctx, {
      [field]: {
        __args: { first, after, reverse },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: savedSearchSelection,
      },
    })
    if (result === undefined) return
    const connection = (result as any)[field]
    printConnection({ connection, format: ctx.format, quiet: ctx.quiet })
    return
  }

  throw new CliError(`Unknown verb for saved-searches: ${verb}`, 2)
}
