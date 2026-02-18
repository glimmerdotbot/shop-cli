import { CliError } from '../errors'
import { printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

const requireString = (value: unknown, flag: string) => {
  if (typeof value !== 'string' || !value) throw new CliError(`Missing ${flag}`, 2)
  return value
}

const reverseFulfillmentOrderSummarySelection = {
  id: true,
  status: true,
  order: { id: true, name: true },
} as const

const reverseFulfillmentOrderFullSelection = {
  ...reverseFulfillmentOrderSummarySelection,
  lineItems: {
    __args: { first: 50 },
    nodes: {
      id: true,
      totalQuantity: true,
      fulfillmentLineItem: { id: true, lineItem: { id: true, title: true } },
      dispositions: { id: true, quantity: true, type: true, location: { id: true, name: true } },
    },
  },
  reverseDeliveries: {
    __args: { first: 10 },
    nodes: {
      id: true,
      deliverable: { __typename: true },
    },
  },
} as const

const getReverseFulfillmentOrderSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return reverseFulfillmentOrderFullSelection
  if (view === 'raw') return {} as const
  return reverseFulfillmentOrderSummarySelection
}

const parseDisposition = (value: string) => {
  // <reverseFulfillmentOrderLineItemId>:<quantity>:<dispositionType>[:<locationId>]
  const parts = value.split(':')
  if (parts.length < 3) {
    throw new CliError('--disposition must be <reverseFulfillmentOrderLineItemId>:<quantity>:<dispositionType>[:<locationId>]', 2)
  }
  const reverseFulfillmentOrderLineItemId = parts[0]!
  const quantityRaw = parts[1]!
  const dispositionType = parts[2]!
  const locationId = parts[3]

  const quantity = Number(quantityRaw)
  if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
    throw new CliError('--disposition quantity must be a positive integer', 2)
  }

  return {
    reverseFulfillmentOrderLineItemId,
    quantity,
    dispositionType,
    ...(locationId ? { locationId } : {}),
  }
}

export const runReverseFulfillmentOrders = async ({
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
        '  shop reverse-fulfillment-orders <verb> [flags]',
        '',
        'Verbs:',
        '  get|dispose',
        '',
        'Common output flags:',
        '  --view summary|ids|full|raw',
        '  --select <path>        (repeatable; dot paths; adds to base view selection)',
        '  --selection <graphql>  (selection override; can be @file.gql)',
        '',
        'Special flags:',
        '  --disposition <id>:<qty>:<type>[:<locationId>]  (repeatable; dispose)',
      ].join('\n'),
    )
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireString(args.id, '--id')
    const selection = resolveSelection({
      typeName: 'ReverseFulfillmentOrder',
      view: ctx.view,
      baseSelection: getReverseFulfillmentOrderSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { reverseFulfillmentOrder: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.reverseFulfillmentOrder, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'dispose') {
    const args = parseStandardArgs({ argv, extraOptions: { disposition: { type: 'string', multiple: true } } })
    const dispositionsRaw = (args as any).disposition as string[] | undefined

    const dispositionInputs =
      dispositionsRaw && dispositionsRaw.length > 0
        ? dispositionsRaw.map(parseDisposition)
        : (() => {
            throw new CliError('Missing --disposition', 2)
          })()

    for (const d of dispositionInputs) {
      if (d.dispositionType === 'RESTOCKED' && !d.locationId) {
        throw new CliError('RESTOCKED dispositions require a locationId (use :<locationId> suffix)', 2)
      }
    }

    const result = await runMutation(ctx, {
      reverseFulfillmentOrderDispose: {
        __args: { dispositionInputs },
        reverseFulfillmentOrderLineItems: { id: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.reverseFulfillmentOrderDispose,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    printJson(result.reverseFulfillmentOrderDispose, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for reverse-fulfillment-orders: ${verb}`, 2)
}
