import { CliError } from '../../errors'
import { coerceGid, isGid } from '../../gid'
import { runMutation, type CommandContext } from '../../router'
import { maybeFailOnUserErrors } from '../../userErrors'
import { listPublications, resolvePublicationIdFromList } from '../publications/resolvePublicationId'

const requireProductId = (id: string | undefined) => {
  if (!id) throw new CliError('Missing --id', 2)
  return coerceGid(id, 'Product')
}

export const parsePublishDate = ({
  at,
  now,
}: {
  at: string | undefined
  now: boolean | undefined
}): string | undefined => {
  if (at && now) throw new CliError('Pass either --at <iso> or --now, not both', 2)
  if (now) return new Date().toISOString()
  return at
}

const normalizePublicationId = (value: string) => {
  const raw = value.trim()
  if (!raw) throw new CliError('publication ID cannot be empty', 2)
  if (isGid(raw)) {
    if (!raw.startsWith('gid://shopify/Publication/')) {
      throw new CliError(`Expected a Publication GID (gid://shopify/Publication/...). Got: ${value}`, 2)
    }
    return raw
  }
  if (/^\d+$/.test(raw)) return coerceGid(raw, 'Publication')
  throw new CliError(`Expected a numeric ID or full GID for Publication. Got: ${value}`, 2)
}

export const resolvePublicationIds = async ({
  ctx,
  publicationIds,
  publicationNames,
}: {
  ctx: CommandContext
  publicationIds: string[]
  publicationNames: string[]
}): Promise<string[]> => {
  if (ctx.dryRun && publicationNames.length > 0) {
    throw new CliError(
      'In --dry-run mode, --publication cannot be resolved without executing a query. Use --publication-id <gid|num> instead.',
      2,
    )
  }

  const ids = publicationIds.map(normalizePublicationId)

  if (publicationNames.length > 0) {
    const publications = await listPublications(ctx)
    for (const name of publicationNames) {
      ids.push(resolvePublicationIdFromList({ publications, identifier: name }))
    }
  }

  const unique = Array.from(new Set(ids))
  if (unique.length === 0) throw new CliError('Missing --publication-id or --publication', 2)
  return unique
}

export const publishProduct = async ({
  ctx,
  id,
  publicationIds,
  publishDate,
}: {
  ctx: CommandContext
  id: string | undefined
  publicationIds: string[]
  publishDate?: string
}) => {
  const productId = requireProductId(id)

  const input = publicationIds.map((publicationId) => ({
    publicationId,
    ...(publishDate ? { publishDate } : {}),
  }))

  const result = await runMutation(ctx, {
    publishablePublish: {
      __args: { id: productId, input },
      publishable: { id: true },
      userErrors: { field: true, message: true },
    },
  })
  if (result === undefined) return undefined

  maybeFailOnUserErrors({
    payload: result.publishablePublish,
    failOnUserErrors: ctx.failOnUserErrors,
  })

  return result.publishablePublish
}

export const unpublishProduct = async ({
  ctx,
  id,
  publicationIds,
}: {
  ctx: CommandContext
  id: string | undefined
  publicationIds: string[]
}) => {
  const productId = requireProductId(id)

  const input = publicationIds.map((publicationId) => ({ publicationId }))

  const result = await runMutation(ctx, {
    publishableUnpublish: {
      __args: { id: productId, input },
      publishable: { id: true },
      userErrors: { field: true, message: true },
    },
  })
  if (result === undefined) return undefined

  maybeFailOnUserErrors({
    payload: result.publishableUnpublish,
    failOnUserErrors: ctx.failOnUserErrors,
  })

  return result.publishableUnpublish
}
