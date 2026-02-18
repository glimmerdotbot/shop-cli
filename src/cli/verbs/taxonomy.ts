import { CliError } from '../errors'
import { printConnection } from '../output'
import { parseStandardArgs, runQuery, type CommandContext } from '../router'

import { parseFirst } from './_shared'

const taxonomyCategorySummarySelection = {
  id: true,
  name: true,
  fullName: true,
  level: true,
  isRoot: true,
  isLeaf: true,
  isArchived: true,
  parentId: true,
} as const

export const runTaxonomy = async ({
  ctx,
  verb,
  argv,
}: {
  ctx: CommandContext
  verb: string
  argv: string[]
}) => {
  if (verb !== 'categories' && verb !== 'list') {
    throw new CliError(`Unknown verb for taxonomy: ${verb}`, 2)
  }

  const args = parseStandardArgs({
    argv,
    extraOptions: {
      search: { type: 'string' },
      'children-of': { type: 'string' },
      'descendants-of': { type: 'string' },
      'siblings-of': { type: 'string' },
    },
  })

  const first = parseFirst(args.first)
  const after = args.after as any

  const search = (args as any).search as string | undefined
  const childrenOf = (args as any)['children-of'] as string | undefined
  const descendantsOf = (args as any)['descendants-of'] as string | undefined
  const siblingsOf = (args as any)['siblings-of'] as string | undefined

  const result = await runQuery(ctx, {
    taxonomy: {
      categories: {
        __args: {
          first,
          after,
          ...(search ? { search } : {}),
          ...(childrenOf ? { childrenOf } : {}),
          ...(descendantsOf ? { descendantsOf } : {}),
          ...(siblingsOf ? { siblingsOf } : {}),
        },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: taxonomyCategorySummarySelection,
      },
    },
  })
  if (result === undefined) return
  const connection = result.taxonomy?.categories ?? { nodes: [], pageInfo: undefined }
  printConnection({ connection, format: ctx.format, quiet: ctx.quiet })
}
