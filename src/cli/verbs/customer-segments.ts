import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printIds, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { coerceGid } from '../gid'
import { parseFirst, parseStringList, requireGidFlag, requireId } from './_shared'

const customerSegmentMemberSummarySelection = {
  id: true,
  displayName: true,
  numberOfOrders: true,
  amountSpent: { amount: true, currencyCode: true },
} as const

const customerSegmentMemberFullSelection = {
  ...customerSegmentMemberSummarySelection,
  firstName: true,
  lastName: true,
  note: true,
  lastOrderId: true,
  defaultAddress: { address1: true, city: true, provinceCode: true, countryCode: true, zip: true },
  defaultEmailAddress: { emailAddress: true, marketingState: true },
  defaultPhoneNumber: { phoneNumber: true, marketingState: true },
} as const

const getCustomerSegmentMemberSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return customerSegmentMemberFullSelection
  if (view === 'raw') return {} as const
  return customerSegmentMemberSummarySelection
}

const membersQuerySelection = {
  id: true,
  done: true,
  currentCount: true,
} as const

export const runCustomerSegments = async ({
  ctx,
  verb,
  argv,
}: {
  ctx: CommandContext
  verb: string
  argv: string[]
}) => {
  if (verb === 'members') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'segment-id': { type: 'string' },
        'query-id': { type: 'string' },
        timezone: { type: 'string' },
      },
    })

    const first = parseFirst(args.first)
    const after = args.after as any
    const query = args.query as any
    const reverse = args.reverse as any
    const sortKey = args.sort as any
    const timezone = (args as any).timezone as any

    const segmentIdRaw = (args as any)['segment-id']
    const queryIdRaw = (args as any)['query-id']

    const segmentId = segmentIdRaw ? coerceGid(String(segmentIdRaw), 'Segment') : undefined
    const queryId = queryIdRaw ? coerceGid(String(queryIdRaw), 'CustomerSegmentMembersQuery') : undefined

    const nodeSelection = resolveSelection({
      resource: 'customer-segments',
      view: ctx.view,
      baseSelection: getCustomerSegmentMemberSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      customerSegmentMembers: {
        __args: {
          first,
          after,
          ...(query ? { query } : {}),
          ...(queryId ? { queryId } : {}),
          ...(segmentId ? { segmentId } : {}),
          ...(reverse ? { reverse } : {}),
          ...(sortKey ? { sortKey } : {}),
          ...(timezone ? { timezone } : {}),
        },
        pageInfo: { hasNextPage: true, endCursor: true },
        edges: { cursor: true, node: nodeSelection },
      },
    })
    if (result === undefined) return

    const edges = (result.customerSegmentMembers?.edges ?? []) as any[]
    const nodes = edges.map((e) => e?.node).filter(Boolean)
    const pageInfo = result.customerSegmentMembers?.pageInfo

    const extraFlags: Array<{ flag: string; value?: string | number | boolean }> = []
    if (segmentId) extraFlags.push({ flag: '--segment-id', value: segmentId })
    if (queryId) extraFlags.push({ flag: '--query-id', value: queryId })
    if (timezone) extraFlags.push({ flag: '--timezone', value: timezone })

    printConnection({
      connection: { nodes, pageInfo },
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: {
        base: 'shop customer-segments members',
        first,
        query,
        sort: sortKey,
        reverse: reverse === true,
        extraFlags,
      },
    })
    return
  }

  if (verb === 'members-query') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'CustomerSegmentMembersQuery')

    const result = await runQuery(ctx, { customerSegmentMembersQuery: { __args: { id }, ...membersQuerySelection } })
    if (result === undefined) return
    printNode({ node: result.customerSegmentMembersQuery, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'membership') {
    const args = parseStandardArgs({
      argv,
      extraOptions: { 'customer-id': { type: 'string' }, 'segment-ids': { type: 'string', multiple: true } },
    })

    const customerId = requireGidFlag((args as any)['customer-id'], '--customer-id', 'Customer')
    const segmentIdsRaw = parseStringList((args as any)['segment-ids'], '--segment-ids')
    const segmentIds = segmentIdsRaw.map((id) => coerceGid(id, 'Segment'))

    const result = await runQuery(ctx, {
      customerSegmentMembership: {
        __args: { customerId, segmentIds },
        memberships: { segmentId: true, isMember: true },
      },
    })
    if (result === undefined) return

    const memberships = result.customerSegmentMembership?.memberships ?? []
    if (ctx.quiet) {
      const memberSegmentIds = memberships.filter((m: any) => m?.isMember === true).map((m: any) => m?.segmentId)
      printIds(memberSegmentIds)
      return
    }

    printConnection({ connection: { nodes: memberships as any[] }, format: ctx.format, quiet: false })
    return
  }

  if (verb === 'members-query-create') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      customerSegmentMembersQueryCreate: {
        __args: { input: built.input },
        customerSegmentMembersQuery: membersQuerySelection,
        userErrors: { code: true, field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.customerSegmentMembersQueryCreate,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.customerSegmentMembersQueryCreate?.customerSegmentMembersQuery?.id ?? '')
    printJson(result.customerSegmentMembersQueryCreate, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for customer-segments: ${verb}`, 2)
}

