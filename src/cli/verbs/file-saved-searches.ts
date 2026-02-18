import { CliError } from '../errors'
import { printConnection } from '../output'
import { parseStandardArgs, runQuery, type CommandContext } from '../router'

import { buildListNextPageArgs, parseFirst } from './_shared'

const savedSearchSelection = {
  id: true,
  name: true,
  query: true,
  resourceType: true,
  searchTerms: true,
} as const

export const runFileSavedSearches = async ({
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
        '  shop file-saved-searches <verb> [flags]',
        '',
        'Verbs:',
        '  list',
        '',
        'Common output flags:',
        '  --format json|jsonl|table|markdown|raw',
        '  --quiet               (IDs only when possible)',
      ].join('\n'),
    )
    return
  }

  if (verb === 'list') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const reverse = args.reverse as any

    const result = await runQuery(ctx, {
      fileSavedSearches: {
        __args: { first, after, reverse },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: savedSearchSelection,
      },
    })
    if (result === undefined) return

    printConnection({
      connection: result.fileSavedSearches,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: buildListNextPageArgs('file-saved-searches', { first, reverse }),
    })
    return
  }

  throw new CliError(`Unknown verb for file-saved-searches: ${verb}`, 2)
}

