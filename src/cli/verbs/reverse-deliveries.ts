import { CliError } from '../errors'
import { printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

const requireString = (value: unknown, flag: string) => {
  if (typeof value !== 'string' || !value) throw new CliError(`Missing ${flag}`, 2)
  return value
}

const reverseDeliverySummarySelection = {
  id: true,
  reverseFulfillmentOrder: { id: true, status: true },
  deliverable: { __typename: true },
} as const

const reverseDeliveryFullSelection = {
  ...reverseDeliverySummarySelection,
  deliverable: {
    __typename: true,
    on_ReverseDeliveryShippingDeliverable: {
      label: { id: true, publicFileUrl: true },
      tracking: { number: true, url: true },
    },
  },
  reverseDeliveryLineItems: {
    __args: { first: 25 },
    nodes: {
      id: true,
      quantity: true,
      reverseFulfillmentOrderLineItem: { id: true },
    },
  },
} as const

const getReverseDeliverySelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return reverseDeliveryFullSelection
  if (view === 'raw') return {} as const
  return reverseDeliverySummarySelection
}

const parseLineItem = (value: string): { reverseFulfillmentOrderLineItemId: string; quantity: number } => {
  const [id, qtyRaw] = value.split(':')
  if (!id || !qtyRaw) throw new CliError('--line-item must be <reverseFulfillmentOrderLineItemId>:<quantity>', 2)
  const quantity = Number(qtyRaw)
  if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
    throw new CliError('--line-item quantity must be a positive integer', 2)
  }
  return { reverseFulfillmentOrderLineItemId: id, quantity }
}

export const runReverseDeliveries = async ({
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
        '  shop reverse-deliveries <verb> [flags]',
        '',
        'Verbs:',
        '  get|create-with-shipping|shipping-update',
        '',
        'Common output flags:',
        '  --view summary|ids|full|raw',
        '  --select <path>        (repeatable; dot paths; adds to base view selection)',
        '  --selection <graphql>  (selection override; can be @file.gql)',
        '',
        'Special flags:',
        '  --reverse-fulfillment-order-id <id>   (create-with-shipping)',
        '  --line-item <id>:<qty>                (repeatable; create-with-shipping)',
        '  --tracking-number <string>            (create-with-shipping, shipping-update)',
        '  --tracking-url <url>                  (create-with-shipping, shipping-update)',
        '  --label-url <url>                     (create-with-shipping, shipping-update)',
        '  --notify-customer                     (create-with-shipping, shipping-update)',
      ].join('\n'),
    )
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireString(args.id, '--id')
    const selection = resolveSelection({
      typeName: 'ReverseDelivery',
      view: ctx.view,
      baseSelection: getReverseDeliverySelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { reverseDelivery: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.reverseDelivery, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'create-with-shipping') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'reverse-fulfillment-order-id': { type: 'string' },
        'line-item': { type: 'string', multiple: true },
        'tracking-number': { type: 'string' },
        'tracking-url': { type: 'string' },
        'label-url': { type: 'string' },
        'notify-customer': { type: 'boolean' },
      },
    })

    const reverseFulfillmentOrderId = requireString((args as any)['reverse-fulfillment-order-id'], '--reverse-fulfillment-order-id')
    const lineItemsRaw = (args as any)['line-item'] as string[] | undefined
    const reverseDeliveryLineItems = (lineItemsRaw ?? []).map(parseLineItem)

    const trackingNumber = (args as any)['tracking-number'] as string | undefined
    const trackingUrl = (args as any)['tracking-url'] as string | undefined
    const labelUrl = (args as any)['label-url'] as string | undefined

    const trackingInput =
      trackingNumber || trackingUrl ? { ...(trackingNumber ? { number: trackingNumber } : {}), ...(trackingUrl ? { url: trackingUrl } : {}) } : null

    const labelInput = labelUrl ? { fileUrl: labelUrl } : null

    const result = await runMutation(ctx, {
      reverseDeliveryCreateWithShipping: {
        __args: {
          reverseFulfillmentOrderId,
          reverseDeliveryLineItems,
          trackingInput,
          labelInput,
          notifyCustomer: (args as any)['notify-customer'] ? true : undefined,
        },
        reverseDelivery: reverseDeliverySummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.reverseDeliveryCreateWithShipping,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.reverseDeliveryCreateWithShipping?.reverseDelivery?.id ?? '')
    printJson(result.reverseDeliveryCreateWithShipping, ctx.format !== 'raw')
    return
  }

  if (verb === 'shipping-update') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'tracking-number': { type: 'string' },
        'tracking-url': { type: 'string' },
        'label-url': { type: 'string' },
        'notify-customer': { type: 'boolean' },
      },
    })
    const reverseDeliveryId = requireString(args.id, '--id')

    const trackingNumber = (args as any)['tracking-number'] as string | undefined
    const trackingUrl = (args as any)['tracking-url'] as string | undefined
    const labelUrl = (args as any)['label-url'] as string | undefined

    const trackingInput =
      trackingNumber || trackingUrl ? { ...(trackingNumber ? { number: trackingNumber } : {}), ...(trackingUrl ? { url: trackingUrl } : {}) } : null

    const labelInput = labelUrl ? { fileUrl: labelUrl } : null

    const result = await runMutation(ctx, {
      reverseDeliveryShippingUpdate: {
        __args: {
          reverseDeliveryId,
          trackingInput,
          labelInput,
          notifyCustomer: (args as any)['notify-customer'] ? true : undefined,
        },
        reverseDelivery: reverseDeliverySummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.reverseDeliveryShippingUpdate,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.reverseDeliveryShippingUpdate?.reverseDelivery?.id ?? '')
    printJson(result.reverseDeliveryShippingUpdate, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for reverse-deliveries: ${verb}`, 2)
}

