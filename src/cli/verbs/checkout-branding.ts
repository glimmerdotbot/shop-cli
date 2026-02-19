import { CliError } from '../errors'
import { buildInput } from '../input'
import { printJson } from '../output'
import { parseStandardArgs, runMutation, runQuery, type CommandContext } from '../router'
import { maybeFailOnUserErrors } from '../userErrors'

import { requireId } from './_shared'

const checkoutBrandingSelection = {
  customizations: {
    checkbox: { cornerRadius: true },
    control: { border: true, color: true, cornerRadius: true, labelPosition: true },
    favicon: { image: { id: true, url: true } },
    global: { cornerRadius: true, typography: { letterCase: true, kerning: true } },
    header: {
      alignment: true,
      position: true,
      logo: { image: { id: true, url: true }, maxWidth: true, visibility: true },
      banner: { image: { id: true, url: true } },
    },
    main: { backgroundImage: { image: { id: true, url: true } } },
    orderSummary: { backgroundImage: { image: { id: true, url: true } } },
    primaryButton: {
      background: true,
      blockPadding: true,
      border: true,
      cornerRadius: true,
      typography: { font: true, size: true, weight: true, letterCase: true, kerning: true },
    },
    secondaryButton: {
      background: true,
      border: true,
      cornerRadius: true,
      typography: { font: true, size: true, weight: true, letterCase: true, kerning: true },
    },
    textField: {
      border: true,
      typography: { font: true, size: true, weight: true, letterCase: true, kerning: true },
    },
  },
  designSystem: {
    colors: {
      global: {
        accent: true,
        brand: true,
        critical: true,
        decorative: true,
        info: true,
        success: true,
        warning: true,
      },
      schemes: {
        scheme1: {
          base: { accent: true, background: true, border: true, decorative: true, icon: true, text: true },
          control: { accent: true, background: true, border: true, decorative: true, icon: true, text: true },
          primaryButton: { accent: true, background: true, border: true, decorative: true, icon: true, text: true },
          secondaryButton: { accent: true, background: true, border: true, decorative: true, icon: true, text: true },
        },
      },
    },
    cornerRadius: { base: true, small: true, large: true },
    typography: {
      primary: { name: true, loadingStrategy: true, base: { sources: true, weight: true }, bold: { sources: true, weight: true } },
      secondary: { name: true, loadingStrategy: true, base: { sources: true, weight: true }, bold: { sources: true, weight: true } },
      size: { base: true, ratio: true },
    },
  },
} as const

export const runCheckoutBranding = async ({
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
        '  shop checkout-branding <verb> [flags]',
        '',
        'Verbs:',
        '  get|upsert',
      ].join('\n'),
    )
    return
  }

  if (verb === 'get') {
    const args = parseStandardArgs({ argv, extraOptions: { 'profile-id': { type: 'string' } } })
    const profileId = requireId(args['profile-id'], 'CheckoutProfile', '--profile-id')

    const result = await runQuery(ctx, {
      checkoutBranding: { __args: { checkoutProfileId: profileId }, ...checkoutBrandingSelection },
    })
    if (result === undefined) return
    printJson(result.checkoutBranding, ctx.format !== 'raw')
    return
  }

  if (verb === 'upsert') {
    const args = parseStandardArgs({ argv, extraOptions: { 'profile-id': { type: 'string' } } })
    const profileId = requireId(args['profile-id'], 'CheckoutProfile', '--profile-id')

    const built = buildInput({
      inputArg: args.input as any,
      setArgs: args.set as any,
      setJsonArgs: args['set-json'] as any,
    })
    if (!built.used) throw new CliError('Missing --input or --set/--set-json', 2)

    const result = await runMutation(ctx, {
      checkoutBrandingUpsert: {
        __args: { checkoutProfileId: profileId, checkoutBrandingInput: built.input },
        checkoutBranding: checkoutBrandingSelection,
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.checkoutBrandingUpsert, failOnUserErrors: ctx.failOnUserErrors })
    printJson(result.checkoutBrandingUpsert, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for checkout-branding: ${verb}`, 2)
}
