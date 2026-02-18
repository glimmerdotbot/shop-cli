import { CliError } from '../errors'
import { printJson } from '../output'
import { parseStandardArgs, type CommandContext } from '../router'
import { listPublications, resolvePublicationIdFromList } from '../workflows/publications/resolvePublicationId'

export const runPublications = async ({
  ctx,
  verb,
  argv,
}: {
  ctx: CommandContext
  verb: string
  argv: string[]
}) => {
  if (verb === 'resolve') {
    const args = parseStandardArgs({
      argv,
      extraOptions: {
        publication: { type: 'string' },
      },
    })

    if (ctx.dryRun) {
      await listPublications(ctx)
      return
    }

    const identifier = args.publication as string | undefined
    if (!identifier) throw new CliError('Missing --publication <name|gid|num>', 2)

    const publications = await listPublications(ctx)
    const id = resolvePublicationIdFromList({ publications, identifier })

    if (ctx.quiet) return console.log(id)

    const match =
      publications.find((p) => p.id === id) ??
      ({
        id,
        name: null,
        catalogTitle: null,
        autoPublish: null,
      } as const)

    printJson(match)
    return
  }

  throw new CliError(`Unknown verb for publications: ${verb}`, 2)
}
