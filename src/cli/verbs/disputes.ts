import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { parseFirst, requireId } from './_shared'

const disputeSummarySelection = {
  id: true,
  status: true,
  type: true,
  initiatedAt: true,
  evidenceDueBy: true,
  amount: { amount: true, currencyCode: true },
  order: { id: true, name: true },
} as const

const disputeEvidenceSummarySelection = {
  id: true,
  customerEmailAddress: true,
  dispute: { id: true, status: true, initiatedAt: true },
} as const

const getDisputeSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'raw') return {} as const
  return disputeSummarySelection
}

const getEvidenceSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'raw') return {} as const
  return disputeEvidenceSummarySelection
}

export const runDisputes = async ({
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
        '  shop disputes <verb> [flags]',
        '',
        'Verbs:',
        '  get|list',
        '  evidence get|evidence update',
      ].join('\n'),
    )
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'ShopifyPaymentsDispute')

    const selection = resolveSelection({
      view: ctx.view,
      baseSelection: getDisputeSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { dispute: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.dispute, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const reverse = args.reverse as any

    const nodeSelection = resolveSelection({
      view: ctx.view,
      baseSelection: getDisputeSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      disputes: {
        __args: { first, after, reverse },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({ connection: result.disputes, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'evidence get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'ShopifyPaymentsDisputeEvidence')

    const selection = resolveSelection({
      view: ctx.view,
      baseSelection: getEvidenceSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { disputeEvidence: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.disputeEvidence, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'evidence update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'ShopifyPaymentsDisputeEvidence')

    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      disputeEvidenceUpdate: {
        __args: { id, input: built.input },
        disputeEvidence: { id: true },
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.disputeEvidenceUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.disputeEvidenceUpdate?.disputeEvidence?.id ?? '')
    printJson(result.disputeEvidenceUpdate, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for disputes: ${verb}`, 2)
}

