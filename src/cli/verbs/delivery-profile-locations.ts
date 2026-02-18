import { CliError } from '../errors'
import { printConnection } from '../output'
import { parseStandardArgs, runQuery, type CommandContext } from '../router'

import { buildListNextPageArgs, parseFirst } from './_shared'

const locationSelection = {
  id: true,
  name: true,
  isActive: true,
} as const

export const runDeliveryProfileLocations = async ({
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
        '  shop delivery-profile-locations <verb> [flags]',
        '',
        'Verbs:',
        '  available|available-connection',
        '',
        'Notes:',
        "  - 'available' uses the deprecated list field",
        "  - 'available-connection' is paginated (recommended)",
      ].join('\n'),
    )
    return
  }

  if (verb === 'available') {
    const result = await runQuery(ctx, {
      locationsAvailableForDeliveryProfiles: locationSelection,
    })
    if (result === undefined) return

    const nodes = result.locationsAvailableForDeliveryProfiles ?? []
    printConnection({ connection: { nodes }, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'available-connection') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const reverse = args.reverse as any

    const result = await runQuery(ctx, {
      locationsAvailableForDeliveryProfilesConnection: {
        __args: { first, after, reverse },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: locationSelection,
      },
    })
    if (result === undefined) return

    printConnection({
      connection: result.locationsAvailableForDeliveryProfilesConnection,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: buildListNextPageArgs('delivery-profile-locations', { first, reverse }),
    })
    return
  }

  throw new CliError(`Unknown verb for delivery-profile-locations: ${verb}`, 2)
}

