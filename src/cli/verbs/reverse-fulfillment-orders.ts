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

const parseDisposition = (
  value: string,
): { reverseFulfillmentOrderLineItemId: string; quantity: number; dispositionType: string; locationId?: string } => {
  // <reverseFulfillmentOrderLineItemId>:<quantity>:<dispositionType>[:<locationId>]
  const raw = value.trim()
  const usage = () =>
    new CliError('--disposition must be <reverseFulfillmentOrderLineItemId>:<quantity>:<dispositionType>[:<locationId>]', 2)

  const splitOnLastColonOrThrow = (s: string): [string, string] => {
    const idx = s.lastIndexOf(':')
    if (idx <= 0 || idx === s.length - 1) throw usage()
    return [s.slice(0, idx), s.slice(idx + 1)]
  }

  const parseCore = (core: string) => {
    // <id>:<qty>:<type>
    const [rest, dispositionTypeRaw] = splitOnLastColonOrThrow(core)
    const [idRaw, quantityRaw] = splitOnLastColonOrThrow(rest)

    const reverseFulfillmentOrderLineItemId = idRaw.trim()
    const dispositionType = dispositionTypeRaw.trim()
    const quantity = Number(quantityRaw.trim())

    if (!reverseFulfillmentOrderLineItemId || !dispositionType) throw usage()
    if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
      throw new CliError('--disposition quantity must be a positive integer', 2)
    }

    return { reverseFulfillmentOrderLineItemId, quantity, dispositionType }
  }

  // Try without locationId first.
  let firstErr: unknown
  try {
    return parseCore(raw)
  } catch (err) {
    firstErr = err
  }

  // If there's a trailing locationId, it may itself be a GID (contains ':'), so detect `:<spaces>gid://` safely.
  const gidIdx = raw.lastIndexOf('gid://')
  if (gidIdx > 0) {
    const before = raw.slice(0, gidIdx)
    const colonIdx = before.lastIndexOf(':')
    if (colonIdx >= 0 && before.slice(colonIdx + 1).trim() === '') {
      const core = raw.slice(0, colonIdx).trim()
      const locationId = raw.slice(gidIdx).trim()
      if (locationId) return { ...parseCore(core), locationId }
    }
  }

  // Non-GID locationId (no ':') - simple suffix split.
  try {
    const [core, locationIdRaw] = splitOnLastColonOrThrow(raw)
    const locationId = locationIdRaw.trim()
    if (!locationId) throw usage()
    return { ...parseCore(core.trim()), locationId }
  } catch {
    throw firstErr
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
