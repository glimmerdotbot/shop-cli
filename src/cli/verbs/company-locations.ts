import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { parseFirst, parseIds, parseJsonArg, parseStringList, requireId } from './_shared'

const companyLocationSummarySelection = {
  id: true,
  name: true,
  company: { id: true, name: true },
  billingAddress: { address1: true, city: true, countryCode: true },
  shippingAddress: { address1: true, city: true, countryCode: true },
} as const

const companyLocationFullSelection = {
  ...companyLocationSummarySelection,
  locale: true,
  note: true,
  taxSettings: { taxExempt: true, taxRegistrationId: true },
} as const

const getCompanyLocationSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return companyLocationFullSelection
  if (view === 'raw') return {} as const
  return companyLocationSummarySelection
}

const resolveStaffAssignmentIds = async ({
  ctx,
  locationId,
  staffMemberIds,
}: {
  ctx: CommandContext
  locationId: string
  staffMemberIds: string[]
}): Promise<string[]> => {
  if (staffMemberIds.length === 0) return []
  if (ctx.dryRun) {
    throw new CliError('--dry-run cannot resolve --staff-member-ids; pass --assignment-ids instead', 2)
  }

  const result = await runQuery(ctx, {
    companyLocation: {
      __args: { id: locationId },
      staffMemberAssignments: {
        __args: { first: 100 },
        nodes: { id: true, staffMember: { id: true } },
      },
    },
  })

  const nodes = result?.companyLocation?.staffMemberAssignments?.nodes ?? []
  const byStaffId = new Map<string, string>()
  for (const node of nodes) {
    if (node?.staffMember?.id && node?.id) {
      byStaffId.set(node.staffMember.id, node.id)
    }
  }

  const assignmentIds: string[] = []
  const missing: string[] = []
  for (const staffId of staffMemberIds) {
    const assignmentId = byStaffId.get(staffId)
    if (!assignmentId) missing.push(staffId)
    else assignmentIds.push(assignmentId)
  }

  if (missing.length > 0) {
    throw new CliError(
      `Could not resolve staff member assignments for: ${missing.join(', ')}`,
      2,
    )
  }

  return assignmentIds
}

export const runCompanyLocations = async ({
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
        '  shop company-locations <verb> [flags]',
        '',
        'Verbs:',
        '  create|get|list|update|delete|bulk-delete',
        '  assign-address|assign-roles|revoke-roles',
        '  assign-staff|remove-staff',
        '  assign-tax-exemptions|revoke-tax-exemptions',
        '  create-tax-registration|revoke-tax-registration|update-tax-settings',
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
    const id = requireId(args.id, 'CompanyLocation')
    const selection = resolveSelection({
      resource: 'company-locations',
      view: ctx.view,
      baseSelection: getCompanyLocationSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { companyLocation: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.companyLocation, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const query = args.query as any
    const reverse = args.reverse as any
    const sortKey = args.sort as any

    const nodeSelection = resolveSelection({
      resource: 'company-locations',
      view: ctx.view,
      baseSelection: getCompanyLocationSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })
    const result = await runQuery(ctx, {
      companyLocations: {
        __args: { first, after, query, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return
    printConnection({ connection: result.companyLocations, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'create') {
    const args = parseStandardArgs({ argv, extraOptions: { 'company-id': { type: 'string' } } })
    const companyId = requireId(args['company-id'], 'Company')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      companyLocationCreate: {
        __args: { companyId, input: built.input },
        companyLocation: companyLocationSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.companyLocationCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.companyLocationCreate?.companyLocation?.id ?? '')
    printJson(result.companyLocationCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'CompanyLocation')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      companyLocationUpdate: {
        __args: { companyLocationId: id, input: built.input },
        companyLocation: companyLocationSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.companyLocationUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.companyLocationUpdate?.companyLocation?.id ?? '')
    printJson(result.companyLocationUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'CompanyLocation')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      companyLocationDelete: {
        __args: { companyLocationId: id },
        deletedCompanyLocationId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.companyLocationDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.companyLocationDelete?.deletedCompanyLocationId ?? '')
    printJson(result.companyLocationDelete, ctx.format !== 'raw')
    return
  }

  if (verb === 'bulk-delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    if (!args.yes) throw new CliError('Refusing to bulk-delete without --yes', 2)
    const companyLocationIds = parseIds(args.ids, 'CompanyLocation')

    const result = await runMutation(ctx, {
      companyLocationsDelete: {
        __args: { companyLocationIds },
        deletedCompanyLocationIds: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.companyLocationsDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log((result.companyLocationsDelete?.deletedCompanyLocationIds ?? []).join('\n'))
    printJson(result.companyLocationsDelete, ctx.format !== 'raw')
    return
  }

  if (verb === 'assign-address') {
    const args = parseStandardArgs({ argv, extraOptions: { 'address-type': { type: 'string', multiple: true }, address: { type: 'string' } } })
    const id = requireId(args.id, 'CompanyLocation')
    const addressTypes = parseStringList(args['address-type'], '--address-type')
    const address = parseJsonArg(args.address, '--address')

    const result = await runMutation(ctx, {
      companyLocationAssignAddress: {
        __args: { locationId: id, addressTypes, address },
        addresses: { id: true, address1: true, city: true, countryCode: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.companyLocationAssignAddress, failOnUserErrors: ctx.failOnUserErrors })
    printJson(result.companyLocationAssignAddress, ctx.format !== 'raw')
    return
  }

  if (verb === 'assign-roles') {
    const args = parseStandardArgs({ argv, extraOptions: { 'role-assignments': { type: 'string' } } })
    const id = requireId(args.id, 'CompanyLocation')
    const rolesToAssign = parseJsonArg(args['role-assignments'], '--role-assignments')

    const result = await runMutation(ctx, {
      companyLocationAssignRoles: {
        __args: { companyLocationId: id, rolesToAssign },
        roleAssignments: { id: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.companyLocationAssignRoles, failOnUserErrors: ctx.failOnUserErrors })
    printJson(result.companyLocationAssignRoles, ctx.format !== 'raw')
    return
  }

  if (verb === 'revoke-roles') {
    const args = parseStandardArgs({ argv, extraOptions: { 'role-assignment-ids': { type: 'string', multiple: true } } })
    const id = requireId(args.id, 'CompanyLocation')
    const rolesToRevoke = parseStringList(args['role-assignment-ids'], '--role-assignment-ids')

    const result = await runMutation(ctx, {
      companyLocationRevokeRoles: {
        __args: { companyLocationId: id, rolesToRevoke },
        revokedRoleAssignmentIds: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.companyLocationRevokeRoles, failOnUserErrors: ctx.failOnUserErrors })
    printJson(result.companyLocationRevokeRoles, ctx.format !== 'raw')
    return
  }

  if (verb === 'assign-staff') {
    const args = parseStandardArgs({ argv, extraOptions: { 'staff-member-ids': { type: 'string', multiple: true } } })
    const id = requireId(args.id, 'CompanyLocation')
    const staffMemberIds = parseStringList(args['staff-member-ids'], '--staff-member-ids')

    const result = await runMutation(ctx, {
      companyLocationAssignStaffMembers: {
        __args: { companyLocationId: id, staffMemberIds },
        companyLocationStaffMemberAssignments: { id: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.companyLocationAssignStaffMembers,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    printJson(result.companyLocationAssignStaffMembers, ctx.format !== 'raw')
    return
  }

  if (verb === 'remove-staff') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'assignment-ids': { type: 'string', multiple: true },
        'staff-member-ids': { type: 'string', multiple: true },
      },
    })
    const id = requireId(args.id, 'CompanyLocation')
    const assignmentIdsRaw = args['assignment-ids'] as any
    const staffMemberIdsRaw = args['staff-member-ids'] as any

    let assignmentIds = assignmentIdsRaw ? parseStringList(assignmentIdsRaw, '--assignment-ids') : []
    if (assignmentIds.length === 0) {
      const staffMemberIds = staffMemberIdsRaw
        ? parseStringList(staffMemberIdsRaw, '--staff-member-ids')
        : []
      if (staffMemberIds.length === 0) throw new CliError('Missing --assignment-ids or --staff-member-ids', 2)
      assignmentIds = await resolveStaffAssignmentIds({ ctx, locationId: id, staffMemberIds })
    }

    const result = await runMutation(ctx, {
      companyLocationRemoveStaffMembers: {
        __args: { companyLocationStaffMemberAssignmentIds: assignmentIds },
        deletedCompanyLocationStaffMemberAssignmentIds: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.companyLocationRemoveStaffMembers,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    printJson(result.companyLocationRemoveStaffMembers, ctx.format !== 'raw')
    return
  }

  if (verb === 'assign-tax-exemptions') {
    const args = parseStandardArgs({ argv, extraOptions: { exemptions: { type: 'string', multiple: true } } })
    const id = requireId(args.id, 'CompanyLocation')
    const taxExemptions = parseStringList(args.exemptions, '--exemptions')

    const result = await runMutation(ctx, {
      companyLocationAssignTaxExemptions: {
        __args: { companyLocationId: id, taxExemptions },
        companyLocation: companyLocationSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.companyLocationAssignTaxExemptions,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    printJson(result.companyLocationAssignTaxExemptions, ctx.format !== 'raw')
    return
  }

  if (verb === 'revoke-tax-exemptions') {
    const args = parseStandardArgs({ argv, extraOptions: { exemptions: { type: 'string', multiple: true } } })
    const id = requireId(args.id, 'CompanyLocation')
    const taxExemptions = parseStringList(args.exemptions, '--exemptions')

    const result = await runMutation(ctx, {
      companyLocationRevokeTaxExemptions: {
        __args: { companyLocationId: id, taxExemptions },
        companyLocation: companyLocationSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.companyLocationRevokeTaxExemptions,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    printJson(result.companyLocationRevokeTaxExemptions, ctx.format !== 'raw')
    return
  }

  if (verb === 'create-tax-registration') {
    const args = parseStandardArgs({ argv, extraOptions: { 'tax-id': { type: 'string' } } })
    const id = requireId(args.id, 'CompanyLocation')
    const taxId = args['tax-id'] as string | undefined
    if (!taxId) throw new CliError('Missing --tax-id', 2)

    const result = await runMutation(ctx, {
      companyLocationCreateTaxRegistration: {
        __args: { locationId: id, taxId },
        companyLocation: companyLocationSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.companyLocationCreateTaxRegistration,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    printJson(result.companyLocationCreateTaxRegistration, ctx.format !== 'raw')
    return
  }

  if (verb === 'revoke-tax-registration') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'CompanyLocation')

    const result = await runMutation(ctx, {
      companyLocationRevokeTaxRegistration: {
        __args: { companyLocationId: id },
        companyLocation: companyLocationSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.companyLocationRevokeTaxRegistration,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    printJson(result.companyLocationRevokeTaxRegistration, ctx.format !== 'raw')
    return
  }

  if (verb === 'update-tax-settings') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        exemptions: { type: 'string', multiple: true },
        'remove-exemptions': { type: 'string', multiple: true },
        'tax-exempt': { type: 'boolean' },
        'tax-id': { type: 'string' },
      },
    })
    const id = requireId(args.id, 'CompanyLocation')
    const exemptionsToAssign = args.exemptions
      ? parseStringList(args.exemptions, '--exemptions')
      : undefined
    const exemptionsToRemove = args['remove-exemptions']
      ? parseStringList(args['remove-exemptions'], '--remove-exemptions')
      : undefined
    const taxExempt = args['tax-exempt'] as boolean | undefined
    const taxRegistrationId = args['tax-id'] as string | undefined

    if (!exemptionsToAssign && !exemptionsToRemove && taxExempt === undefined && !taxRegistrationId) {
      throw new CliError(
        'Missing --exemptions, --remove-exemptions, --tax-exempt, or --tax-id',
        2,
      )
    }

    const result = await runMutation(ctx, {
      companyLocationTaxSettingsUpdate: {
        __args: {
          companyLocationId: id,
          ...(exemptionsToAssign ? { exemptionsToAssign } : {}),
          ...(exemptionsToRemove ? { exemptionsToRemove } : {}),
          ...(taxExempt === undefined ? {} : { taxExempt }),
          ...(taxRegistrationId ? { taxRegistrationId } : {}),
        },
        companyLocation: companyLocationSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.companyLocationTaxSettingsUpdate,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    printJson(result.companyLocationTaxSettingsUpdate, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for company-locations: ${verb}`, 2)
}
