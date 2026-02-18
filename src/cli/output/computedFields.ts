import type { CliView } from '../router'

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export type ComputedPublication = {
  isPublished: boolean
  title: string
  publishDate: string | null
}

const getPublicationTitle = (publication: any): string | undefined => {
  if (!publication || typeof publication !== 'object') return undefined

  const catalog = (publication as any).catalog
  if (catalog && typeof catalog === 'object') {
    const appNodes = (catalog as any).on_AppCatalog?.apps?.nodes
    if (Array.isArray(appNodes)) {
      const titles = appNodes
        .map((a) => (a && typeof a === 'object' ? (a as any).title : undefined))
        .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
      if (titles.length === 1) return titles[0]
      if (titles.length > 1) return titles.join(', ')
    }

    const catalogTitle = (catalog as any).title
    if (typeof catalogTitle === 'string' && catalogTitle.trim().length > 0) return catalogTitle
  }

  const id = (publication as any).id
  if (typeof id === 'string' && id.trim().length > 0) return id
  return undefined
}

export const computePublications = (node: unknown): ComputedPublication[] | undefined => {
  if (!isPlainObject(node)) return undefined

  const pubs = (node as any).resourcePublicationsV2?.nodes
  if (!Array.isArray(pubs)) return undefined

  const out: ComputedPublication[] = []
  for (const p of pubs) {
    if (!p || typeof p !== 'object') continue
    const title = getPublicationTitle((p as any).publication) ?? 'Unknown publication'
    const publishDateRaw = (p as any).publishDate
    const publishDate = typeof publishDateRaw === 'string' ? publishDateRaw : null
    out.push({
      isPublished: (p as any).isPublished === true,
      title,
      publishDate,
    })
  }
  return out
}

export const applyComputedFieldsToNode = (
  node: unknown,
  {
    view,
    stripResourcePublicationsV2 = view === 'summary' || view === 'full',
  }: { view: CliView; stripResourcePublicationsV2?: boolean },
): unknown => {
  if (view === 'raw' || view === 'ids') return node
  if (!isPlainObject(node)) return node

  const publications = computePublications(node)
  if (!publications) return node

  const out: Record<string, unknown> = { ...node, ['[publications]']: publications }
  if (stripResourcePublicationsV2) {
    delete out.resourcePublicationsV2
  }

  return out
}
