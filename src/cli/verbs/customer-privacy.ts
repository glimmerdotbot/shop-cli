import { CliError } from '../errors'
import { buildInput } from '../input'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { maybeFailOnUserErrors } from '../userErrors'

import { parseCsv, requireStringFlag } from './_shared'

const parseBool = (value: unknown, flag: string): boolean => {
  if (typeof value !== 'string' || !value.trim()) throw new CliError(`Missing ${flag}`, 2)
  const raw = value.trim().toLowerCase()
  if (raw === 'true' || raw === '1' || raw === 'yes') return true
  if (raw === 'false' || raw === '0' || raw === 'no') return false
  throw new CliError(`${flag} must be a boolean (true/false)`, 2)
}

const privacySettingsSelection = {
  banner: { enabled: true, autoManaged: true },
  dataSaleOptOutPage: { autoManaged: true },
  privacyPolicy: { autoManaged: true, supportedLocales: true },
} as const

const consentPolicySelection = {
  id: true,
  countryCode: true,
  regionCode: true,
  consentRequired: true,
  dataSaleOptOutRequired: true,
  shopId: true,
} as const

const consentPolicyRegionSelection = {
  countryCode: true,
  regionCode: true,
} as const

export const runCustomerPrivacy = async ({
  ctx,
  verb,
  argv,
}: {
  ctx: CommandContext
  verb: string
  argv: string[]
}) => {
  if (verb === 'privacy-settings') {
    const result = await runQuery(ctx, { privacySettings: privacySettingsSelection })
    if (result === undefined) return
    printNode({ node: result.privacySettings, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'privacy-features-disable') {
    const args = parseStandardArgs({ argv, extraOptions: { features: { type: 'string' } } })
    const features = parseCsv(args.features, '--features')

    const result = await runMutation(ctx, {
      privacyFeaturesDisable: {
        __args: { featuresToDisable: features as any },
        featuresDisabled: true,
        userErrors: { code: true, field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.privacyFeaturesDisable, failOnUserErrors: ctx.failOnUserErrors })
    printJson(result.privacyFeaturesDisable, ctx.format !== 'raw')
    return
  }

  if (verb === 'consent-policy') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'country-code': { type: 'string' },
        'region-code': { type: 'string' },
        'consent-required': { type: 'string' },
        'data-sale-opt-out-required': { type: 'string' },
      },
    })

    const id = args.id as any
    const countryCode = (args as any)['country-code'] as any
    const regionCode = (args as any)['region-code'] as any
    const consentRequiredRaw = (args as any)['consent-required'] as any
    const dataSaleOptOutRequiredRaw = (args as any)['data-sale-opt-out-required'] as any

    const consentRequired =
      consentRequiredRaw === undefined ? undefined : parseBool(consentRequiredRaw, '--consent-required')
    const dataSaleOptOutRequired =
      dataSaleOptOutRequiredRaw === undefined
        ? undefined
        : parseBool(dataSaleOptOutRequiredRaw, '--data-sale-opt-out-required')

    const result = await runQuery(ctx, {
      consentPolicy: {
        __args: {
          ...(id ? { id } : {}),
          ...(countryCode ? { countryCode } : {}),
          ...(regionCode ? { regionCode } : {}),
          ...(consentRequired !== undefined ? { consentRequired } : {}),
          ...(dataSaleOptOutRequired !== undefined ? { dataSaleOptOutRequired } : {}),
        },
        ...consentPolicySelection,
      },
    })
    if (result === undefined) return
    printNode({ node: result.consentPolicy, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'consent-policy-regions') {
    const result = await runQuery(ctx, { consentPolicyRegions: consentPolicyRegionSelection })
    if (result === undefined) return
    const nodes = (result.consentPolicyRegions ?? []) as any[]
    printConnection({ connection: { nodes }, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'consent-policy-update') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const raw = built.input
    const consentPolicies = Array.isArray(raw)
      ? raw
      : raw && typeof raw === 'object' && Array.isArray((raw as any).consentPolicies)
        ? (raw as any).consentPolicies
        : raw && typeof raw === 'object'
          ? [raw]
          : []

    if (consentPolicies.length === 0) {
      throw new CliError('Consent policy input must be an object or array (or { consentPolicies: [...] })', 2)
    }

    const result = await runMutation(ctx, {
      consentPolicyUpdate: {
        __args: { consentPolicies },
        updatedPolicies: consentPolicySelection,
        userErrors: { code: true, field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.consentPolicyUpdate, failOnUserErrors: ctx.failOnUserErrors })
    printJson(result.consentPolicyUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'data-sale-opt-out') {
    const args = parseStandardArgs({ argv, extraOptions: { 'email-address': { type: 'string' } } })
    const email = requireStringFlag((args as any)['email-address'], '--email-address')

    const result = await runMutation(ctx, {
      dataSaleOptOut: {
        __args: { email },
        customerId: true,
        userErrors: { code: true, field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.dataSaleOptOut, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) return console.log(result.dataSaleOptOut?.customerId ?? '')
    printJson(result.dataSaleOptOut, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for customer-privacy: ${verb}`, 2)
}
