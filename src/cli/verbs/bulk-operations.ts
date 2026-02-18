import { CliError } from '../errors'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { buildListNextPageArgs, parseFirst, parseTextArg, requireId } from './_shared'

const bulkOperationSelection = {
  id: true,
  type: true,
  status: true,
  errorCode: true,
  createdAt: true,
  completedAt: true,
  objectCount: true,
  fileSize: true,
  url: true,
  partialDataUrl: true,
  rootObjectCount: true,
  query: true,
} as const

const getBulkOperationSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'raw') return {} as const
  return bulkOperationSelection
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const waitForBulkOperation = async ({
  ctx,
  id,
  intervalMs,
}: {
  ctx: CommandContext
  id: string
  intervalMs: number
}) => {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = await runQuery(ctx, { bulkOperation: { __args: { id }, ...bulkOperationSelection } })
    if (result === undefined) return undefined
    const op = result.bulkOperation
    const status = op?.status as string | undefined
    if (status && ['COMPLETED', 'FAILED', 'CANCELED', 'EXPIRED'].includes(status)) {
      return op
    }
    await sleep(intervalMs)
  }
}

export const runBulkOperations = async ({
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
        '  shop bulk-operations <verb> [flags]',
        '',
        'Verbs:',
        '  run-query|run-mutation|get|list|current|cancel',
        '',
        'Common output flags:',
        '  --view summary|ids|raw',
        '  --select <path>        (repeatable; dot paths; adds to base view selection)',
        '  --selection <graphql>  (selection override; can be @file.gql)',
      ].join('\n'),
    )
    return
  }

  if (verb === 'run-query') {
    const args = parseStandardArgs({ argv, extraOptions: { wait: { type: 'boolean' }, 'wait-interval': { type: 'string' } } })
    const query = parseTextArg(args.query, '--query')
    const wait = Boolean(args.wait)
    const intervalMs = args['wait-interval'] ? Number(args['wait-interval']) * 1000 : 2000
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
      throw new CliError('--wait-interval must be a positive number (seconds)', 2)
    }

    const result = await runMutation(ctx, {
      bulkOperationRunQuery: {
        __args: { query },
        bulkOperation: bulkOperationSelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.bulkOperationRunQuery, failOnUserErrors: ctx.failOnUserErrors })

    const op = result.bulkOperationRunQuery?.bulkOperation
    if (!wait) {
      if (ctx.quiet) return console.log(op?.id ?? '')
      printJson(result.bulkOperationRunQuery, ctx.format !== 'raw')
      return
    }

    if (!op?.id) throw new CliError('Bulk operation did not return an ID', 2)
    const finalOp = await waitForBulkOperation({ ctx, id: op.id, intervalMs })
    if (!finalOp) return
    if (ctx.quiet) return console.log(finalOp.id ?? '')
    printJson(finalOp, ctx.format !== 'raw')
    return
  }

  if (verb === 'run-mutation') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        mutation: { type: 'string' },
        'staged-upload-path': { type: 'string' },
        'client-id': { type: 'string' },
        wait: { type: 'boolean' },
        'wait-interval': { type: 'string' },
      },
    })
    const mutation = parseTextArg(args.mutation, '--mutation')
    const stagedUploadPath = args['staged-upload-path'] as string | undefined
    if (!stagedUploadPath) throw new CliError('Missing --staged-upload-path', 2)

    const clientIdentifier = args['client-id'] as string | undefined
    const wait = Boolean(args.wait)
    const intervalMs = args['wait-interval'] ? Number(args['wait-interval']) * 1000 : 2000
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
      throw new CliError('--wait-interval must be a positive number (seconds)', 2)
    }

    const result = await runMutation(ctx, {
      bulkOperationRunMutation: {
        __args: {
          mutation,
          stagedUploadPath,
          ...(clientIdentifier ? { clientIdentifier } : {}),
        },
        bulkOperation: bulkOperationSelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.bulkOperationRunMutation, failOnUserErrors: ctx.failOnUserErrors })

    const op = result.bulkOperationRunMutation?.bulkOperation
    if (!wait) {
      if (ctx.quiet) return console.log(op?.id ?? '')
      printJson(result.bulkOperationRunMutation, ctx.format !== 'raw')
      return
    }

    if (!op?.id) throw new CliError('Bulk operation did not return an ID', 2)
    const finalOp = await waitForBulkOperation({ ctx, id: op.id, intervalMs })
    if (!finalOp) return
    if (ctx.quiet) return console.log(finalOp.id ?? '')
    printJson(finalOp, ctx.format !== 'raw')
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'BulkOperation')
    const selection = resolveSelection({
      resource: 'bulk-operations',
      view: ctx.view,
      baseSelection: getBulkOperationSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { bulkOperation: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.bulkOperation, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({ argv, extraOptions: { status: { type: 'string' } } })
    const first = parseFirst(args.first)
    const after = args.after as any
    const reverse = args.reverse as any
    const sortKey = args.sort as any
    const status = args.status as string | undefined
    const type = args.type as string | undefined

    const queryParts: string[] = []
    if (args.query) queryParts.push(args.query as string)
    if (status) queryParts.push(`status:${status.toLowerCase()}`)
    if (type) queryParts.push(`operation_type:${type.toLowerCase()}`)
    const query = queryParts.length > 0 ? queryParts.join(' ') : undefined

    const nodeSelection = resolveSelection({
      resource: 'bulk-operations',
      view: ctx.view,
      baseSelection: getBulkOperationSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })
    const result = await runQuery(ctx, {
      bulkOperations: {
        __args: { first, after, reverse, sortKey, ...(query ? { query } : {}) },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({
      connection: result.bulkOperations,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: buildListNextPageArgs('bulk-operations', { first, query, sort: sortKey, reverse }),
    })
    return
  }

  if (verb === 'current') {
    const args = parseStandardArgs({ argv, extraOptions: { type: { type: 'string' } } })
    const type = args.type as string | undefined

    const selection = resolveSelection({
      resource: 'bulk-operations',
      view: ctx.view,
      baseSelection: getBulkOperationSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      currentBulkOperation: { __args: { ...(type ? { type } : {}) }, ...selection },
    })
    if (result === undefined) return
    printNode({ node: result.currentBulkOperation, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'cancel') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'BulkOperation')
    if (!args.yes) throw new CliError('Refusing to cancel without --yes', 2)

    const result = await runMutation(ctx, {
      bulkOperationCancel: {
        __args: { id },
        bulkOperation: bulkOperationSelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.bulkOperationCancel, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.bulkOperationCancel?.bulkOperation?.id ?? '')
    printJson(result.bulkOperationCancel, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for bulk-operations: ${verb}`, 2)
}
