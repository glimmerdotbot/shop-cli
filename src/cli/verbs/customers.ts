import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printIds, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import {
  buildListNextPageArgs,
  parseCsv,
  parseFirst,
  parseJsonArg,
  requireGidFlag,
  requireId,
  requireStringFlag,
} from './_shared'

const parseBool = (
  value: unknown,
  flag: string,
  { allowEmpty = false }: { allowEmpty?: boolean } = {},
): boolean | undefined => {
  if (value === undefined || value === null || value === '') {
    if (allowEmpty) return undefined
    throw new CliError(`Missing ${flag}`, 2)
  }
  if (typeof value !== 'string') throw new CliError(`${flag} must be a string`, 2)
  const raw = value.trim().toLowerCase()
  if (!raw) {
    if (allowEmpty) return undefined
    throw new CliError(`Missing ${flag}`, 2)
  }
  if (raw === 'true' || raw === '1' || raw === 'yes') return true
  if (raw === 'false' || raw === '0' || raw === 'no') return false
  throw new CliError(`${flag} must be a boolean (true/false)`, 2)
}

const customerSummarySelection = {
  id: true,
  displayName: true,
  email: true,
  state: true,
  updatedAt: true,
} as const

const customerFullSelection = {
  ...customerSummarySelection,
  createdAt: true,
  phone: true,
  tags: true,
} as const

const getCustomerSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return customerFullSelection
  if (view === 'raw') return {} as const
  return customerSummarySelection
}

const mailingAddressSummarySelection = {
  id: true,
  address1: true,
  address2: true,
  city: true,
  provinceCode: true,
  countryCode: true,
  zip: true,
} as const

const mailingAddressFullSelection = {
  ...mailingAddressSummarySelection,
  company: true,
  firstName: true,
  lastName: true,
  name: true,
  phone: true,
  province: true,
  country: true,
} as const

const getMailingAddressSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return mailingAddressFullSelection
  if (view === 'raw') return {} as const
  return mailingAddressSummarySelection
}

const customerTaxExemptionsSummarySelection = {
  id: true,
  taxExempt: true,
  taxExemptions: true,
} as const

const getCustomerSelectionForTaxExemptions = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return { ...customerFullSelection, taxExempt: true, taxExemptions: true } as const
  if (view === 'raw') return {} as const
  return customerTaxExemptionsSummarySelection
}

export const runCustomers = async ({
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
        '  shop customers <verb> [flags]',
        '',
        'Verbs:',
        '  create|get|list|count|update|delete',
        '  add-tags|remove-tags|merge|merge-preview|merge-job-status',
        '  by-identifier|set',
        '  address-create|address-update|address-delete|update-default-address',
        '  email-marketing-consent-update|sms-marketing-consent-update',
        '  add-tax-exemptions|remove-tax-exemptions|replace-tax-exemptions',
        '  generate-account-activation-url',
        '  request-data-erasure|cancel-data-erasure',
        '  send-invite',
        '  metafields upsert',
        '',
        'Common output flags:',
        '  --view summary|ids|full|raw',
        '  --select <path>        (repeatable; dot paths; adds to base view selection)',
        '  --selection <graphql>  (selection override; can be @file.gql)',
      ].join('\n'),
    )
    return
  }

  if (verb === 'by-identifier') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'email-address': { type: 'string' },
        'phone-number': { type: 'string' },
        'identifier-id': { type: 'string' },
        'custom-id': { type: 'string' },
      },
    })

    const emailAddress = (args as any)['email-address'] as any
    const phoneNumber = (args as any)['phone-number'] as any
    const identifierId = (args as any)['identifier-id'] as any
    const customIdRaw = (args as any)['custom-id'] as any

    const present = [
      emailAddress ? 'emailAddress' : undefined,
      phoneNumber ? 'phoneNumber' : undefined,
      identifierId ? 'id' : undefined,
      customIdRaw ? 'customId' : undefined,
    ].filter(Boolean) as string[]

    if (present.length === 0) throw new CliError('Missing --email-address', 2)
    if (present.length > 1) {
      throw new CliError(`Pass exactly one identifier (--email-address, --phone-number, --identifier-id, --custom-id). Got: ${present.join(', ')}`, 2)
    }

    const identifier: any = {}
    if (emailAddress) identifier.emailAddress = String(emailAddress)
    if (phoneNumber) identifier.phoneNumber = String(phoneNumber)
    if (identifierId) identifier.id = requireGidFlag(identifierId, '--identifier-id', 'Customer')
    if (customIdRaw) identifier.customId = parseJsonArg(customIdRaw, '--custom-id')

    const selection = resolveSelection({
      resource: 'customers',
      view: ctx.view,
      baseSelection: getCustomerSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { customerByIdentifier: { __args: { identifier }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.customerByIdentifier, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'merge-preview') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'other-id': { type: 'string' },
        'override-fields': { type: 'string' },
      },
    })
    const customerOneId = requireId(args.id as any, 'Customer')
    const other = (args as any)['other-id'] as string | undefined
    if (!other) throw new CliError('Missing --other-id', 2)
    const customerTwoId = requireId(other, 'Customer')
    const overrideFieldsRaw = (args as any)['override-fields'] as any
    const overrideFields =
      overrideFieldsRaw !== undefined ? parseJsonArg(overrideFieldsRaw, '--override-fields', { allowEmpty: true }) : undefined

    const result = await runQuery(ctx, {
      customerMergePreview: {
        __args: {
          customerOneId,
          customerTwoId,
          ...(overrideFields ? { overrideFields } : {}),
        },
        resultingCustomerId: true,
        customerMergeErrors: { message: true, errorFields: true },
        blockingFields: { __typename: true },
        defaultFields: { __typename: true },
        alternateFields: { __typename: true },
      },
    })
    if (result === undefined) return
    if (ctx.quiet) return console.log(result.customerMergePreview?.resultingCustomerId ?? '')
    printJson(result.customerMergePreview, ctx.format !== 'raw')
    return
  }

  if (verb === 'merge-job-status') {
    const args = parseStandardArgs({ argv, extraOptions: { 'job-id': { type: 'string' } } })
    const jobId = requireStringFlag((args as any)['job-id'], '--job-id')

    const result = await runQuery(ctx, {
      customerMergeJobStatus: {
        __args: { jobId },
        jobId: true,
        status: true,
        resultingCustomerId: true,
        customerMergeErrors: { message: true, errorFields: true },
      },
    })
    if (result === undefined) return
    if (ctx.quiet) return console.log(result.customerMergeJobStatus?.jobId ?? '')
    printJson(result.customerMergeJobStatus, ctx.format !== 'raw')
    return
  }

  if (verb === 'set') {
    const args = parseStandardArgs({ argv, extraOptions: { identifier: { type: 'string' } } })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const identifierRaw = (args as any).identifier as any
    const identifier = identifierRaw ? parseJsonArg(identifierRaw, '--identifier', { allowEmpty: true }) : undefined

    const result = await runMutation(ctx, {
      customerSet: {
        __args: { input: built.input, ...(identifier ? { identifier } : {}) },
        customer: customerSummarySelection,
        userErrors: { code: true, field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.customerSet, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.customerSet?.customer?.id ?? '')
    printJson(result.customerSet, ctx.format !== 'raw')
    return
  }

  if (verb === 'address-create') {
    const args = parseStandardArgs({ argv, extraOptions: { address: { type: 'string' }, 'set-as-default': { type: 'string' } } })
    const customerId = requireId(args.id as any, 'Customer')
    const address = parseJsonArg((args as any).address, '--address')
    const setAsDefault = parseBool((args as any)['set-as-default'], '--set-as-default', { allowEmpty: true })

    const result = await runMutation(ctx, {
      customerAddressCreate: {
        __args: { customerId, address, ...(setAsDefault !== undefined ? { setAsDefault } : {}) },
        address: { id: true, address1: true, city: true, provinceCode: true, countryCode: true, zip: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.customerAddressCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.customerAddressCreate?.address?.id ?? '')
    printJson(result.customerAddressCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'address-update') {
    const args = parseStandardArgs({
      argv,
      extraOptions: { 'address-id': { type: 'string' }, address: { type: 'string' }, 'set-as-default': { type: 'string' } },
    })
    const customerId = requireId(args.id as any, 'Customer')
    const addressId = requireGidFlag((args as any)['address-id'], '--address-id', 'MailingAddress')
    const address = parseJsonArg((args as any).address, '--address')
    const setAsDefault = parseBool((args as any)['set-as-default'], '--set-as-default', { allowEmpty: true })

    const result = await runMutation(ctx, {
      customerAddressUpdate: {
        __args: { customerId, addressId, address, ...(setAsDefault !== undefined ? { setAsDefault } : {}) },
        address: { id: true, address1: true, city: true, provinceCode: true, countryCode: true, zip: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.customerAddressUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.customerAddressUpdate?.address?.id ?? '')
    printJson(result.customerAddressUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'address-delete') {
    const args = parseStandardArgs({ argv, extraOptions: { 'address-id': { type: 'string' } } })
    const customerId = requireId(args.id as any, 'Customer')
    const addressId = requireGidFlag((args as any)['address-id'], '--address-id', 'MailingAddress')

    const result = await runMutation(ctx, {
      customerAddressDelete: {
        __args: { customerId, addressId },
        deletedAddressId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.customerAddressDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.customerAddressDelete?.deletedAddressId ?? '')
    printJson(result.customerAddressDelete, ctx.format !== 'raw')
    return
  }

  if (verb === 'update-default-address') {
    const args = parseStandardArgs({ argv, extraOptions: { 'address-id': { type: 'string' } } })
    const customerId = requireId(args.id as any, 'Customer')
    const addressId = requireGidFlag((args as any)['address-id'], '--address-id', 'MailingAddress')

    const addressSelection = resolveSelection({
      typeName: 'MailingAddress',
      view: ctx.view,
      baseSelection: getMailingAddressSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runMutation(ctx, {
      customerUpdateDefaultAddress: {
        __args: { customerId, addressId },
        customer: { id: true, defaultAddress: addressSelection },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.customerUpdateDefaultAddress, failOnUserErrors: ctx.failOnUserErrors })
    const customer = result.customerUpdateDefaultAddress?.customer
    const address = customer?.defaultAddress

    if (!address) {
      if (ctx.quiet) return
      printJson({ customerId: customer?.id ?? customerId, address: null }, ctx.format !== 'raw')
      return
    }

    if (ctx.quiet) {
      printIds([address.id])
      return
    }

    if (ctx.view === 'ids') {
      printNode({ node: { id: address.id }, format: ctx.format, quiet: false })
      return
    }

    const out = { ...address, customerId: customer?.id ?? customerId, isDefault: true }
    printNode({ node: out, format: ctx.format, quiet: false })
    return
  }

  if (verb === 'email-marketing-consent-update') {
    const args = parseStandardArgs({ argv, extraOptions: { 'email-marketing-consent': { type: 'string' } } })
    const customerId = requireId(args.id as any, 'Customer')
    const emailMarketingConsent = parseJsonArg((args as any)['email-marketing-consent'], '--email-marketing-consent')

    const result = await runMutation(ctx, {
      customerEmailMarketingConsentUpdate: {
        __args: { input: { customerId, emailMarketingConsent } },
        customer: {
          id: true,
          defaultEmailAddress: {
            emailAddress: true,
            marketingState: true,
            marketingOptInLevel: true,
            marketingUpdatedAt: true,
            sourceLocation: { id: true, name: true },
          },
        },
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.customerEmailMarketingConsentUpdate, failOnUserErrors: ctx.failOnUserErrors })
    const customer = result.customerEmailMarketingConsentUpdate?.customer
    const email = customer?.defaultEmailAddress
    const out = {
      customerId: customer?.id ?? customerId,
      emailAddress: email?.emailAddress,
      marketingState: email?.marketingState,
      marketingOptInLevel: email?.marketingOptInLevel,
      marketingUpdatedAt: email?.marketingUpdatedAt,
      sourceLocationId: email?.sourceLocation?.id,
      sourceLocationName: email?.sourceLocation?.name,
    }

    if (ctx.quiet || ctx.view === 'ids') {
      printIds([out.customerId])
      return
    }

    printNode({ node: out, format: ctx.format, quiet: false })
    return
  }

  if (verb === 'sms-marketing-consent-update') {
    const args = parseStandardArgs({ argv, extraOptions: { 'sms-marketing-consent': { type: 'string' } } })
    const customerId = requireId(args.id as any, 'Customer')
    const smsMarketingConsent = parseJsonArg((args as any)['sms-marketing-consent'], '--sms-marketing-consent')

    const result = await runMutation(ctx, {
      customerSmsMarketingConsentUpdate: {
        __args: { input: { customerId, smsMarketingConsent } },
        customer: {
          id: true,
          defaultPhoneNumber: {
            phoneNumber: true,
            marketingState: true,
            marketingOptInLevel: true,
            marketingUpdatedAt: true,
            marketingCollectedFrom: true,
            sourceLocation: { id: true, name: true },
          },
        },
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.customerSmsMarketingConsentUpdate, failOnUserErrors: ctx.failOnUserErrors })
    const customer = result.customerSmsMarketingConsentUpdate?.customer
    const sms = customer?.defaultPhoneNumber
    const out = {
      customerId: customer?.id ?? customerId,
      phoneNumber: sms?.phoneNumber,
      marketingState: sms?.marketingState,
      marketingOptInLevel: sms?.marketingOptInLevel,
      marketingUpdatedAt: sms?.marketingUpdatedAt,
      marketingCollectedFrom: sms?.marketingCollectedFrom,
      sourceLocationId: sms?.sourceLocation?.id,
      sourceLocationName: sms?.sourceLocation?.name,
    }

    if (ctx.quiet || ctx.view === 'ids') {
      printIds([out.customerId])
      return
    }

    printNode({ node: out, format: ctx.format, quiet: false })
    return
  }

  if (verb === 'add-tax-exemptions' || verb === 'remove-tax-exemptions' || verb === 'replace-tax-exemptions') {
    const args = parseStandardArgs({ argv, extraOptions: { exemptions: { type: 'string' } } })
    const customerId = requireId(args.id as any, 'Customer')
    const taxExemptions = parseCsv((args as any).exemptions, '--exemptions')

    const op =
      verb === 'add-tax-exemptions'
        ? 'customerAddTaxExemptions'
        : verb === 'remove-tax-exemptions'
          ? 'customerRemoveTaxExemptions'
          : 'customerReplaceTaxExemptions'

    const customerSelection = resolveSelection({
      resource: 'customers',
      view: ctx.view,
      baseSelection: getCustomerSelectionForTaxExemptions(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
      defaultConnectionFirst: ctx.view === 'all' ? 50 : 10,
    })

    const request: any = {
      [op]: {
        __args: { customerId, taxExemptions: taxExemptions as any },
        customer: customerSelection,
        userErrors: { field: true, message: true },
      },
    }

    const result = await runMutation(ctx, request)
    if (result === undefined) return
    const payload = result[op]
    maybeFailOnUserErrors({ payload, failOnUserErrors: ctx.failOnUserErrors })
    printNode({ node: payload?.customer, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'generate-account-activation-url') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const customerId = requireId(args.id as any, 'Customer')

    const result = await runMutation(ctx, {
      customerGenerateAccountActivationUrl: {
        __args: { customerId },
        accountActivationUrl: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.customerGenerateAccountActivationUrl,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    const url = result.customerGenerateAccountActivationUrl?.accountActivationUrl ?? ''
    if (ctx.quiet) return console.log(url)
    printJson(result.customerGenerateAccountActivationUrl, ctx.format !== 'raw')
    return
  }

  if (verb === 'request-data-erasure' || verb === 'cancel-data-erasure') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const customerId = requireId(args.id as any, 'Customer')
    const op = verb === 'request-data-erasure' ? 'customerRequestDataErasure' : 'customerCancelDataErasure'

    const request: any = {
      [op]: {
        __args: { customerId },
        customerId: true,
        userErrors: { field: true, message: true, code: true },
      },
    }

    const result = await runMutation(ctx, request)
    if (result === undefined) return
    const payload = result[op]
    maybeFailOnUserErrors({ payload, failOnUserErrors: ctx.failOnUserErrors })
    const now = new Date().toISOString()
    const out =
      verb === 'request-data-erasure'
        ? { customerId: payload?.customerId ?? customerId, status: 'REQUESTED', requestedAt: now }
        : { customerId: payload?.customerId ?? customerId, status: 'CANCELLED', cancelledAt: now }

    if (ctx.quiet || ctx.view === 'ids') {
      printIds([out.customerId])
      return
    }

    printNode({ node: out, format: ctx.format, quiet: false })
    return
  }

  if (verb === 'count') {
    const args = parseStandardArgs({ argv, extraOptions: { limit: { type: 'string' } } })
    const query = args.query as any
    const limitRaw = args.limit as any
    const limit =
      limitRaw === undefined || limitRaw === null || limitRaw === ''
        ? undefined
        : Number(limitRaw)

    if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0)) {
      throw new CliError('--limit must be a positive number', 2)
    }

    const result = await runQuery(ctx, {
      customersCount: {
        __args: {
          ...(query ? { query } : {}),
          ...(limit !== undefined ? { limit: Math.floor(limit) } : {}),
        },
        count: true,
        precision: true,
      },
    })
    if (result === undefined) return
    if (ctx.quiet) return console.log(result.customersCount?.count ?? '')
    printJson(result.customersCount, ctx.format !== 'raw')
    return
  }

  if (verb === 'metafields upsert') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const ownerId = requireId(args.id as any, 'Customer')

    const asArray = (value: any): any[] => {
      if (Array.isArray(value)) return value
      if (value && Array.isArray(value.metafields)) return value.metafields
      if (value && typeof value === 'object') return [value]
      return []
    }

    const items = asArray(built.input)
    if (items.length === 0) throw new CliError('Missing metafield input: pass --input/--set/--set-json', 2)

    const normalized = items.map((m) => {
      if (!m || typeof m !== 'object') throw new CliError('Metafield inputs must be objects', 2)
      const { key, namespace, type, value, compareDigest } = m as any
      if (!key) throw new CliError('Metafield input missing key', 2)
      if (value === undefined) throw new CliError('Metafield input missing value', 2)
      return {
        ownerId,
        key,
        namespace,
        type,
        value: String(value),
        compareDigest,
      }
    })

    const chunk = <T,>(arr: T[], size: number): T[][] => {
      const out: T[][] = []
      for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
      return out
    }

    const payloads: any[] = []
    const ids: Array<string | undefined> = []

    for (const group of chunk(normalized, 25)) {
      const result = await runMutation(ctx, {
        metafieldsSet: {
          __args: { metafields: group },
          metafields: { id: true },
          userErrors: { field: true, message: true, elementIndex: true, code: true },
        },
      })
      if (result === undefined) return

      maybeFailOnUserErrors({ payload: result.metafieldsSet, failOnUserErrors: ctx.failOnUserErrors })
      payloads.push(result.metafieldsSet)
      for (const mf of result.metafieldsSet?.metafields ?? []) ids.push(mf?.id)
    }

    if (ctx.quiet) {
      printIds(ids)
      return
    }

    printJson(payloads.length === 1 ? payloads[0] : payloads, ctx.format !== 'raw')
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Customer')
    const selection = resolveSelection({
      resource: 'customers',
      view: ctx.view,
      baseSelection: getCustomerSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, { customer: { __args: { id }, ...selection } })
    if (result === undefined) return
    printNode({ node: result.customer, format: ctx.format, quiet: ctx.quiet })
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
      resource: 'customers',
      view: ctx.view,
      baseSelection: getCustomerSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      customers: {
        __args: { first, after, query, reverse, sortKey },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: nodeSelection,
      },
    })
    if (result === undefined) return

    printConnection({
      connection: result.customers,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: buildListNextPageArgs('customers', { first, query, sort: sortKey, reverse }),
    })
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

    const result = await runMutation(ctx, {
      customerCreate: {
        __args: { input: built.input },
        customer: customerSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.customerCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.customerCreate?.customer?.id ?? '')
    printJson(result.customerCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'add-tags' || verb === 'remove-tags') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id as any, 'Customer')
    const tags = parseCsv(args.tags as any, '--tags')

    const mutationField = verb === 'add-tags' ? 'tagsAdd' : 'tagsRemove'
    const request: any = {
      [mutationField]: {
        __args: { id, tags },
        node: { id: true },
        userErrors: { field: true, message: true },
      },
    }

    const result = await runMutation(ctx, request)
    if (result === undefined) return
    const payload = result[mutationField]
    maybeFailOnUserErrors({ payload, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(payload?.node?.id ?? '')
    printJson(payload, ctx.format !== 'raw')
    return
  }

  if (verb === 'merge') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'other-id': { type: 'string' },
        'override-fields': { type: 'string' },
      },
    })
    const customerOneId = requireId(args.id as any, 'Customer')
    const other = (args as any)['other-id'] as string | undefined
    if (!other) throw new CliError('Missing --other-id', 2)
    const customerTwoId = requireId(other, 'Customer')
    const overrideFieldsRaw = (args as any)['override-fields'] as any
    const overrideFields =
      overrideFieldsRaw !== undefined ? parseJsonArg(overrideFieldsRaw, '--override-fields', { allowEmpty: true }) : undefined

    const result = await runMutation(ctx, {
      customerMerge: {
        __args: {
          customerOneId,
          customerTwoId,
          ...(overrideFields ? { overrideFields } : {}),
        },
        job: { id: true, done: true },
        resultingCustomerId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.customerMerge, failOnUserErrors: ctx.failOnUserErrors })
    const job = result.customerMerge?.job
    const out = { job, resultingCustomerId: result.customerMerge?.resultingCustomerId }

    if (ctx.quiet) {
      printIds([job?.id])
      return
    }

    printNode({ node: out, format: ctx.format, quiet: false })
    return
  }

  if (verb === 'send-invite') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        email: { type: 'string' },
      },
    })
    const customerId = requireId(args.id as any, 'Customer')
    const emailRaw = (args as any).email as any
    const email =
      emailRaw !== undefined ? parseJsonArg(emailRaw, '--email', { allowEmpty: true }) : undefined

    const result = await runMutation(ctx, {
      customerSendAccountInviteEmail: {
        __args: {
          customerId,
          ...(email ? { email } : {}),
        },
        customer: { id: true, defaultEmailAddress: { emailAddress: true } },
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.customerSendAccountInviteEmail,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    const customer = result.customerSendAccountInviteEmail?.customer
    const out = {
      customerId: customer?.id ?? customerId,
      emailAddress: customer?.defaultEmailAddress?.emailAddress,
      requestedAt: new Date().toISOString(),
    }

    if (ctx.quiet || ctx.view === 'ids') {
      printIds([out.customerId])
      return
    }

    printNode({ node: out, format: ctx.format, quiet: false })
    return
  }

  if (verb === 'update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Customer')
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const input = { ...built.input, id }
    const result = await runMutation(ctx, {
      customerUpdate: {
        __args: { input },
        customer: customerSummarySelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.customerUpdate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.customerUpdate?.customer?.id ?? '')
    printJson(result.customerUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'delete') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Customer')
    if (!args.yes) throw new CliError('Refusing to delete without --yes', 2)

    const result = await runMutation(ctx, {
      customerDelete: {
        __args: { input: { id } },
        deletedCustomerId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.customerDelete, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.customerDelete?.deletedCustomerId ?? '')
    printJson(result.customerDelete, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for customers: ${verb}`, 2)
}
