import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { maybeFailOnUserErrors } from '../userErrors'

import { applySelect, parseFirst, requireId } from './_shared'

const segmentSummarySelection = {
  id: true,
  name: true,
  creationDate: true,
  lastEditDate: true,
} as const

const segmentFullSelection = {
  ...segmentSummarySelection,
  query: true,
} as const

const getSegmentSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return segmentFullSelection
  return segmentSummarySelection
}

const pickSegmentArgs = (value: any) => {
  if (value === null || typeof value !== 'object') throw new CliError('Segment input must be an object', 2)
  const out: any = {}
  if (value.name !== undefined) out.name = value.name
  if (value.query !== undefined) out.query = value.query
  return out
}

export const runSegments = async ({
  ctx,
  verb,
  argv,
}: {
  ctx: CommandContext
  verb: string
  argv: string[]
}) => {
  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Segment')
    const selection = applySelect(getSegmentSelection(ctx.view), args.select)

    const result = await runQuery(ctx, { segment: { __args: { id }, ...selection } })
    if (result === undefined) return
    if (ctx.quiet) return console.log(result.segment?.id ?? '')
    printJson(result.segment)
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const query = args.query as any
    const reverse = args.reverse as any
    const sortKey = args.sort as any

    const nodeSelection = applySelect(getSegmentSelection(ctx.view), args.select)
    const result = await runQuery(ctx, {
      segments: {
        __args: { first, after, query, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({ connection: result.segments, format: ctx.format, quiet: ctx.quiet })
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
    const input = pickSegmentArgs(built.input)
    if (!input.name) throw new CliError('Missing name in --input/--set', 2)
    if (!input.query) throw new CliError('Missing query in --input/--set', 2)

    const result = await runMutation(ctx, {
      segmentCreate: {
        __args: { name: input.name, query: input.query },
        segment: segmentSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.segmentCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.segmentCreate?.segment?.id ?? '')
    printJson(result.segmentCreate)
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Segment')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)
    const input = pickSegmentArgs(built.input)
    if (input.name === undefined && input.query === undefined) {
      throw new CliError('Nothing to update (expected name and/or query)', 2)
    }

    const result = await runMutation(ctx, {
      segmentUpdate: {
        __args: { id, ...input },
        segment: segmentSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.segmentUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.segmentUpdate?.segment?.id ?? '')
    printJson(result.segmentUpdate)
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Segment')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      segmentDelete: {
        __args: { id },
        deletedSegmentId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.segmentDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.segmentDelete?.deletedSegmentId ?? '')
    printJson(result.segmentDelete)
    return
  }

  throw new CliError(`Unknown verb for segments: ${verb}`, 2)
}

