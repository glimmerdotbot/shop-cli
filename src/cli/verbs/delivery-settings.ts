import { CliError } from '../errors'
import { printJson } from '../output'
import { parseStandardArgs, runMutation, type CommandContext } from '../router'
import { maybeFailOnUserErrors } from '../userErrors'

import { requireLocationId } from './_shared'

export const runDeliverySettings = async ({
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
        '  shop delivery-settings <verb> [flags]',
        '',
        'Verbs:',
        '  setting-update|shipping-origin-assign',
      ].join('\n'),
    )
    return
  }

  if (verb === 'setting-update') {
    const result = await runMutation(ctx, {
      deliverySettingUpdate: {
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.deliverySettingUpdate, failOnUserErrors: ctx.failOnUserErrors })
    printJson(result.deliverySettingUpdate, ctx.format !== 'raw')
    return
  }

  if (verb === 'shipping-origin-assign') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        'location-id': { type: 'string' },
      },
    })
    const locationId = requireLocationId((args as any)['location-id'], '--location-id')

    const result = await runMutation(ctx, {
      deliveryShippingOriginAssign: {
        __args: { locationId },
        userErrors: { field: true, message: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({
      payload: result.deliveryShippingOriginAssign,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    printJson(result.deliveryShippingOriginAssign, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for delivery-settings: ${verb}`, 2)
}

