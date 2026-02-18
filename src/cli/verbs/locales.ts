import { CliError } from '../errors'
import { printJson } from '../output'
import { runQuery, type CommandContext } from '../router'

const localeSelection = {
  isoCode: true,
  name: true,
} as const

export const runLocales = async ({
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
        '  shop locales <verb> [flags]',
        '',
        'Verbs:',
        '  available',
      ].join('\n'),
    )
    return
  }

  if (verb === 'available') {
    const result = await runQuery(ctx, { availableLocales: localeSelection as any })
    if (result === undefined) return
    if (ctx.quiet) return
    printJson(result.availableLocales, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for locales: ${verb}`, 2)
}

