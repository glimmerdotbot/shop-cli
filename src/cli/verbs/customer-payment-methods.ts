import { CliError } from '../errors'
import { printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { resolveSelection } from '../selection/select'
import { maybeFailOnUserErrors } from '../userErrors'

import { parseJsonArg, requireGidFlag, requireId, requireStringFlag } from './_shared'

const parseBool = (value: unknown, flag: string, { allowEmpty = false }: { allowEmpty?: boolean } = {}): boolean | undefined => {
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

const customerPaymentMethodSummarySelection = {
  id: true,
  revokedAt: true,
  revokedReason: true,
  customer: { id: true },
  instrument: { __typename: true },
} as const

const customerPaymentMethodFullSelection = {
  ...customerPaymentMethodSummarySelection,
  instrument: {
    __typename: true,
    on_CustomerCreditCard: {
      brand: true,
      lastDigits: true,
      expiryMonth: true,
      expiryYear: true,
      name: true,
      expiresSoon: true,
      isRevocable: true,
      maskedNumber: true,
    },
    on_CustomerPaypalBillingAgreement: {
      inactive: true,
      paypalAccountEmail: true,
      isRevocable: true,
      billingAddress: { address1: true, city: true, countryCode: true, provinceCode: true, zip: true },
    },
    on_CustomerShopPayAgreement: {
      inactive: true,
      lastDigits: true,
      expiryMonth: true,
      expiryYear: true,
      name: true,
      expiresSoon: true,
      isRevocable: true,
      maskedNumber: true,
    },
  },
} as const

const getCustomerPaymentMethodSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return customerPaymentMethodFullSelection
  if (view === 'raw') return {} as const
  return customerPaymentMethodSummarySelection
}

export const runCustomerPaymentMethods = async ({
  ctx,
  verb,
  argv,
}: {
  ctx: CommandContext
  verb: string
  argv: string[]
}) => {
  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: { 'show-revoked': { type: 'boolean' } } })
    const id = requireId(args.id, 'CustomerPaymentMethod')
    const showRevoked = (args as any)['show-revoked'] === true ? true : undefined

    const selection = resolveSelection({
      resource: 'customer-payment-methods',
      view: ctx.view,
      baseSelection: getCustomerPaymentMethodSelection(ctx.view) as any,
      select: args.select,
      selection: (args as any).selection,
      include: args.include,
      ensureId: ctx.quiet,
    })

    const result = await runQuery(ctx, {
      customerPaymentMethod: {
        __args: { id, ...(showRevoked ? { showRevoked } : {}) },
        ...selection,
      },
    })
    if (result === undefined) return
    printNode({ node: result.customerPaymentMethod, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'credit-card-create') {
    const args = parseStandardArgs({
      argv,
      extraOptions: { 'customer-id': { type: 'string' }, 'billing-address': { type: 'string' }, 'session-id': { type: 'string' } },
    })
    const customerId = requireGidFlag((args as any)['customer-id'], '--customer-id', 'Customer')
    const billingAddress = parseJsonArg((args as any)['billing-address'], '--billing-address')
    const sessionId = requireStringFlag((args as any)['session-id'], '--session-id')

    const result = await runMutation(ctx, {
      customerPaymentMethodCreditCardCreate: {
        __args: { customerId, billingAddress, sessionId },
        customerPaymentMethod: customerPaymentMethodSummarySelection,
        processing: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.customerPaymentMethodCreditCardCreate,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.customerPaymentMethodCreditCardCreate?.customerPaymentMethod?.id ?? '')
    printJson(result.customerPaymentMethodCreditCardCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'credit-card-update') {
    const args = parseStandardArgs({
      argv,
      extraOptions: { 'billing-address': { type: 'string' }, 'session-id': { type: 'string' } },
    })
    const id = requireId(args.id, 'CustomerPaymentMethod')
    const billingAddress = parseJsonArg((args as any)['billing-address'], '--billing-address')
    const sessionId = requireStringFlag((args as any)['session-id'], '--session-id')

    const result = await runMutation(ctx, {
      customerPaymentMethodCreditCardUpdate: {
        __args: { id, billingAddress, sessionId },
        customerPaymentMethod: customerPaymentMethodSummarySelection,
        processing: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.customerPaymentMethodCreditCardUpdate,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.customerPaymentMethodCreditCardUpdate?.customerPaymentMethod?.id ?? '')
    printJson(result.customerPaymentMethodCreditCardUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'paypal-billing-agreement-create') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'customer-id': { type: 'string' },
        'billing-agreement-id': { type: 'string' },
        'billing-address': { type: 'string' },
        inactive: { type: 'string' },
      },
    })
    const customerId = requireGidFlag((args as any)['customer-id'], '--customer-id', 'Customer')
    const billingAgreementId = requireStringFlag((args as any)['billing-agreement-id'], '--billing-agreement-id')
    const billingAddressRaw = (args as any)['billing-address']
    const billingAddress = billingAddressRaw ? parseJsonArg(billingAddressRaw, '--billing-address') : undefined
    const inactive = parseBool((args as any).inactive, '--inactive', { allowEmpty: true })

    const result = await runMutation(ctx, {
      customerPaymentMethodPaypalBillingAgreementCreate: {
        __args: { customerId, billingAgreementId, ...(billingAddress ? { billingAddress } : {}), ...(inactive !== undefined ? { inactive } : {}) },
        customerPaymentMethod: customerPaymentMethodSummarySelection,
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.customerPaymentMethodPaypalBillingAgreementCreate,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.customerPaymentMethodPaypalBillingAgreementCreate?.customerPaymentMethod?.id ?? '')
    printJson(result.customerPaymentMethodPaypalBillingAgreementCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'paypal-billing-agreement-update') {
    const args = parseStandardArgs({ argv, extraOptions: { 'billing-address': { type: 'string' } } })
    const id = requireId(args.id, 'CustomerPaymentMethod')
    const billingAddress = parseJsonArg((args as any)['billing-address'], '--billing-address')

    const result = await runMutation(ctx, {
      customerPaymentMethodPaypalBillingAgreementUpdate: {
        __args: { id, billingAddress },
        customerPaymentMethod: customerPaymentMethodSummarySelection,
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.customerPaymentMethodPaypalBillingAgreementUpdate,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.customerPaymentMethodPaypalBillingAgreementUpdate?.customerPaymentMethod?.id ?? '')
    printJson(result.customerPaymentMethodPaypalBillingAgreementUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'remote-create') {
    const args = parseStandardArgs({
      argv,
      extraOptions: { 'customer-id': { type: 'string' }, 'remote-reference': { type: 'string' } },
    })
    const customerId = requireGidFlag((args as any)['customer-id'], '--customer-id', 'Customer')
    const remoteReference = parseJsonArg((args as any)['remote-reference'], '--remote-reference')

    const result = await runMutation(ctx, {
      customerPaymentMethodRemoteCreate: {
        __args: { customerId, remoteReference },
        customerPaymentMethod: customerPaymentMethodSummarySelection,
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.customerPaymentMethodRemoteCreate,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.customerPaymentMethodRemoteCreate?.customerPaymentMethod?.id ?? '')
    printJson(result.customerPaymentMethodRemoteCreate, ctx.format !== 'raw')
    return
  }

  if (verb === 'revoke') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const customerPaymentMethodId = requireId(args.id, 'CustomerPaymentMethod')

    const result = await runMutation(ctx, {
      customerPaymentMethodRevoke: {
        __args: { customerPaymentMethodId },
        revokedCustomerPaymentMethodId: true,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.customerPaymentMethodRevoke,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.customerPaymentMethodRevoke?.revokedCustomerPaymentMethodId ?? '')
    printJson(result.customerPaymentMethodRevoke, ctx.format !== 'raw')
    return
  }

  if (verb === 'send-update-email') {
    const args = parseStandardArgs({ argv, extraOptions: { email: { type: 'string' } } })
    const customerPaymentMethodId = requireId(args.id, 'CustomerPaymentMethod')
    const email = (args as any).email ? parseJsonArg((args as any).email, '--email', { allowEmpty: true }) : undefined

    const result = await runMutation(ctx, {
      customerPaymentMethodSendUpdateEmail: {
        __args: { customerPaymentMethodId, ...(email ? { email } : {}) },
        customer: { id: true },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.customerPaymentMethodSendUpdateEmail,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.customerPaymentMethodSendUpdateEmail?.customer?.id ?? '')
    printJson(result.customerPaymentMethodSendUpdateEmail, ctx.format !== 'raw')
    return
  }

  if (verb === 'duplication-data-get') {
    const args = parseStandardArgs({
      argv,
      extraOptions: { 'target-customer-id': { type: 'string' }, 'target-shop-id': { type: 'string' } },
    })
    const customerPaymentMethodId = requireId(args.id, 'CustomerPaymentMethod')
    const targetCustomerId = requireGidFlag((args as any)['target-customer-id'], '--target-customer-id', 'Customer')
    const targetShopId = requireGidFlag((args as any)['target-shop-id'], '--target-shop-id', 'Shop')

    const result = await runMutation(ctx, {
      customerPaymentMethodGetDuplicationData: {
        __args: { customerPaymentMethodId, targetCustomerId, targetShopId },
        encryptedDuplicationData: true,
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.customerPaymentMethodGetDuplicationData,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.customerPaymentMethodGetDuplicationData?.encryptedDuplicationData ?? '')
    printJson(result.customerPaymentMethodGetDuplicationData, ctx.format !== 'raw')
    return
  }

  if (verb === 'duplication-create') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'customer-id': { type: 'string' },
        'billing-address': { type: 'string' },
        'encrypted-duplication-data': { type: 'string' },
      },
    })
    const customerId = requireGidFlag((args as any)['customer-id'], '--customer-id', 'Customer')
    const billingAddress = parseJsonArg((args as any)['billing-address'], '--billing-address')
    const encryptedDuplicationData = requireStringFlag((args as any)['encrypted-duplication-data'], '--encrypted-duplication-data')

    const result = await runMutation(ctx, {
      customerPaymentMethodCreateFromDuplicationData: {
        __args: { customerId, billingAddress, encryptedDuplicationData },
        customerPaymentMethod: customerPaymentMethodSummarySelection,
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.customerPaymentMethodCreateFromDuplicationData,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.customerPaymentMethodCreateFromDuplicationData?.customerPaymentMethod?.id ?? '')
    printJson(result.customerPaymentMethodCreateFromDuplicationData, ctx.format !== 'raw')
    return
  }

  if (verb === 'update-url-get') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const customerPaymentMethodId = requireId(args.id, 'CustomerPaymentMethod')

    const result = await runMutation(ctx, {
      customerPaymentMethodGetUpdateUrl: {
        __args: { customerPaymentMethodId },
        updatePaymentMethodUrl: true,
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.customerPaymentMethodGetUpdateUrl,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    if (ctx.quiet) return console.log(result.customerPaymentMethodGetUpdateUrl?.updatePaymentMethodUrl ?? '')
    printJson(result.customerPaymentMethodGetUpdateUrl, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for customer-payment-methods: ${verb}`, 2)
}
