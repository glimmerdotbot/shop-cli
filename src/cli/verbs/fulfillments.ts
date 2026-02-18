import { CliError } from '../errors'
import { buildInput } from '../input'
import { printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { requireId } from './_shared'

const fulfillmentSummarySelection = {
  id: true,
  status: true,
  name: true,
  createdAt: true,
  totalQuantity: true,
  trackingInfo: {
    company: true,
    number: true,
    url: true,
  },
  fulfillmentLineItems: {
    __args: { first: 20 },
    nodes: {
      id: true,
      quantity: true,
      lineItem: { id: true, title: true },
    },
  },
} as const

const getFulfillmentSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return fulfillmentSummarySelection
  if (view === 'raw') return {} as const
  return fulfillmentSummarySelection
}

const parseTrackingInfo = ({
  company,
  number,
  url,
}: {
  company?: unknown
  number?: unknown
  url?: unknown
}) => {
  const trackingInfoInput: Record<string, any> = {}
  if (typeof company === 'string' && company) trackingInfoInput.company = company
  if (typeof number === 'string' && number) trackingInfoInput.number = number
  if (typeof url === 'string' && url) trackingInfoInput.url = url
  if (Object.keys(trackingInfoInput).length === 0) return undefined
  return trackingInfoInput
}

export const runFulfillments = async ({
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
        '  shop fulfillments <verb> [flags]',
        '',
        'Verbs:',
        '  create|get|cancel|update-tracking|create-event',
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
    const id = requireId(args.id, 'Fulfillment')
    const selection = resolveSelection({
      resource: 'fulfillments',
      view: ctx.view,
      baseSelection: getFulfillmentSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { fulfillment: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.fulfillment, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'create') {
    const args = parseStandardArgs({ argv, extraOptions: { message: { type: 'string' } } })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      fulfillmentCreateV2: {
        __args: { fulfillment: built.input, message: args.message as any },
        fulfillment: fulfillmentSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.fulfillmentCreateV2, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.fulfillmentCreateV2?.fulfillment?.id ?? '')
    printJson(result.fulfillmentCreateV2, ctx.format !== 'raw')
    return
  }

  if (verb === 'cancel') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Fulfillment')

    const result = await runMutation(ctx, {
      fulfillmentCancel: {
        __args: { id },
        fulfillment: fulfillmentSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.fulfillmentCancel, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.fulfillmentCancel?.fulfillment?.id ?? '')
    printJson(result.fulfillmentCancel, ctx.format !== 'raw')
    return
  }

  if (verb === 'update-tracking') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'tracking-company': { type: 'string' },
        'tracking-number': { type: 'string' },
        'tracking-url': { type: 'string' },
        'notify-customer': { type: 'boolean' },
      },
    })
    const id = requireId(args.id, 'Fulfillment')
    const trackingInfoInput = parseTrackingInfo({
      company: args['tracking-company'],
      number: args['tracking-number'],
      url: args['tracking-url'],
    })
    if (!trackingInfoInput) throw new CliError('Missing tracking info (use --tracking-company/--tracking-number/--tracking-url)', 2)

    const result = await runMutation(ctx, {
      fulfillmentTrackingInfoUpdateV2: {
        __args: {
          fulfillmentId: id,
          trackingInfoInput,
          notifyCustomer: args['notify-customer'] ? true : undefined,
        },
        fulfillment: fulfillmentSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.fulfillmentTrackingInfoUpdateV2,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.fulfillmentTrackingInfoUpdateV2?.fulfillment?.id ?? '')
    printJson(result.fulfillmentTrackingInfoUpdateV2, ctx.format !== 'raw')
    return
  }

  if (verb === 'create-event') {
    const args = parseStandardArgs({
      argv,
      extraOptions: { status: { type: 'string' }, message: { type: 'string' }, 'happened-at': { type: 'string' } },
    })
    const id = requireId(args.id, 'Fulfillment')
    const status = args.status as string | undefined
    if (!status) throw new CliError('Missing --status', 2)

    const fulfillmentEvent: any = {
      fulfillmentId: id,
      status,
    }
    if (args.message) fulfillmentEvent.message = args.message
    if (args['happened-at']) fulfillmentEvent.happenedAt = args['happened-at']

    const result = await runMutation(ctx, {
      fulfillmentEventCreate: {
        __args: { fulfillmentEvent },
        fulfillmentEvent: { id: true, status: true, message: true, happenedAt: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.fulfillmentEventCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.fulfillmentEventCreate?.fulfillmentEvent?.id ?? '')
    printJson(result.fulfillmentEventCreate, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for fulfillments: ${verb}`, 2)
}
