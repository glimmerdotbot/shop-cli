import { CliError } from '../../errors'
import { coerceGid, isGid } from '../../gid'
import { runQuery, type CommandContext } from '../../router'

export type PublicationSummary = {
  id: string
  name?: string | null
  catalogTitle?: string | null
  autoPublish?: boolean | null
}

export const listPublications = async (ctx: CommandContext): Promise<PublicationSummary[]> => {
  const result = await runQuery(ctx, {
    publications: {
      __args: { first: 250 },
      nodes: {
        id: true,
        name: true,
        autoPublish: true,
        catalog: { title: true },
      },
    },
  })
  if (result === undefined) return []

  const nodes = result.publications?.nodes ?? []
  return nodes.map((p: any) => ({
    id: p?.id,
    name: p?.name,
    catalogTitle: p?.catalog?.title,
    autoPublish: p?.autoPublish,
  }))
}

const normalize = (value: string) => value.trim().toLowerCase()

export const resolvePublicationIdFromList = ({
  publications,
  identifier,
}: {
  publications: PublicationSummary[]
  identifier: string
}): string => {
  const raw = identifier.trim()
  if (!raw) throw new CliError('Missing publication identifier', 2)

  if (isGid(raw)) {
    if (!raw.startsWith('gid://shopify/Publication/')) {
      throw new CliError(`Expected a Publication GID (gid://shopify/Publication/...). Got: ${raw}`, 2)
    }
    return raw
  }
  if (/^\d+$/.test(raw)) return coerceGid(raw, 'Publication')

  const target = normalize(raw)

  const matches = publications.filter((p) => {
    const names = [p.name, p.catalogTitle].filter((v): v is string => Boolean(v))
    return names.some((n) => normalize(n) === target)
  })

  if (matches.length === 1) return matches[0]!.id

  if (matches.length > 1) {
    throw new CliError(
      `Publication name is ambiguous (${raw}): ${matches
        .map((m) => `${m.name ?? m.catalogTitle ?? '(unknown)'} (${m.id})`)
        .join(', ')}`,
      2,
    )
  }

  const hint =
    publications.length === 0
      ? ''
      : ` Known publications: ${publications
          .map((p) => p.name ?? p.catalogTitle ?? '(unknown)')
          .filter((v, i, arr) => v && arr.indexOf(v) === i)
          .slice(0, 12)
          .join(', ')}`

  throw new CliError(`No publication found matching: ${raw}.${hint}`, 2)
}

export const resolvePublicationId = async ({
  ctx,
  publications,
  identifier,
}: {
  ctx: CommandContext
  publications?: PublicationSummary[]
  identifier: string
}): Promise<string> => {
  const list = publications ?? (await listPublications(ctx))
  return resolvePublicationIdFromList({ publications: list, identifier })
}
