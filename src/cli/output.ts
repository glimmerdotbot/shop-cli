import { CliError } from './errors'

export type OutputFormat = 'json' | 'jsonl' | 'table' | 'raw' | 'markdown'

let globalOutputFormat: OutputFormat | undefined

export const setGlobalOutputFormat = (format: OutputFormat) => {
  globalOutputFormat = format
}

type NextPageExtraFlag = { flag: string; value?: string | number | boolean }
type NextPageArgs = {
  base: string
  first?: number
  query?: string
  sort?: string
  reverse?: boolean
  extraFlags?: NextPageExtraFlag[]
}

export const writeJson = (
  data: unknown,
  {
    pretty = true,
    stream = process.stdout,
  }: { pretty?: boolean; stream?: NodeJS.WritableStream } = {},
) => {
  const effectivePretty = globalOutputFormat === 'jsonl' ? false : pretty
  stream.write(JSON.stringify(data, null, effectivePretty ? 2 : 0))
  stream.write('\n')
}

export const printJson = (data: unknown, pretty = true) => writeJson(data, { pretty })
export const printJsonError = (data: unknown, pretty = true) =>
  writeJson(data, { pretty, stream: process.stderr })

export const printIds = (ids: Array<string | undefined | null>) => {
  for (const id of ids) {
    if (id) process.stdout.write(`${id}\n`)
  }
}

const doubleQuote = (value: string): string =>
  `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`

const buildNextPageCommand = ({
  base,
  endCursor,
  first,
  query,
  sort,
  reverse,
  extraFlags,
}: NextPageArgs & { endCursor: string }): string => {
  const parts: string[] = [base]

  for (const extra of extraFlags ?? []) {
    if (!extra?.flag) continue
    const value = extra.value
    if (typeof value === 'boolean') {
      if (value) parts.push(extra.flag)
      continue
    }
    if (typeof value === 'number') {
      if (Number.isFinite(value)) parts.push(extra.flag, String(value))
      continue
    }
    if (typeof value === 'string' && value) {
      parts.push(extra.flag, doubleQuote(value))
    }
  }

  if (typeof first === 'number' && Number.isFinite(first) && first > 0 && first !== 50) {
    parts.push(`--first ${Math.floor(first)}`)
  }
  parts.push(`--after ${doubleQuote(endCursor)}`)
  if (query) parts.push(`--query ${doubleQuote(query)}`)
  if (sort) parts.push(`--sort ${sort}`)
  if (reverse) parts.push('--reverse')

  return parts.join(' ')
}

const toTableCell = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  const t = typeof value
  if (t === 'string') return String(value)
  if (t === 'number' || t === 'boolean') return String(value)
  return JSON.stringify(value)
}

const formatPublicationsForTable = (value: unknown): string | undefined => {
  if (!Array.isArray(value)) return undefined
  const parts: string[] = []
  for (const p of value) {
    if (!p || typeof p !== 'object') continue
    const title = typeof (p as any).title === 'string' ? (p as any).title : undefined
    if (!title) continue
    const isPublished = (p as any).isPublished === true
    const publishDate = typeof (p as any).publishDate === 'string' ? (p as any).publishDate : undefined
    const suffix = publishDate ? ` ${isPublished ? 'published' : 'staged'} ${publishDate}` : ` ${isPublished ? 'published' : 'staged'}`
    parts.push(`${title}${suffix}`)
  }
  return parts.join('; ')
}

const coerceComputedFieldsForTable = (node: Record<string, unknown>): Record<string, unknown> => {
  const computed = node['[publications]']
  if (computed !== undefined) {
    const formatted = formatPublicationsForTable(computed)
    if (formatted !== undefined) return { ...node, ['[publications]']: formatted }
  }
  return node
}

const escapeMarkdownTableCell = (value: string): string => {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isPrimitive = (value: unknown): boolean =>
  value === null || value === undefined || typeof value !== 'object'

/**
 * Flattens nested single-key objects into dot-path keys with primitive leaf values.
 * e.g. { seo: { title: "Orchids" } } -> { "seo.title": "Orchids" }
 * Only flattens when there's a single key leading to a primitive value.
 * Arrays and multi-key objects are kept as-is.
 */
const flattenSingleKeyPaths = (obj: Record<string, unknown>): Record<string, unknown> => {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    if (isPlainObject(value)) {
      const keys = Object.keys(value)
      if (keys.length === 1) {
        // Recursively flatten and check if we get a single primitive entry
        const flattened = flattenSingleKeyPaths(value)
        const flattenedKeys = Object.keys(flattened)
        if (flattenedKeys.length === 1) {
          const childKey = flattenedKeys[0]!
          const childValue = flattened[childKey]
          // Only flatten if the leaf is a primitive
          if (isPrimitive(childValue)) {
            result[`${key}.${childKey}`] = childValue
            continue
          }
        }
      }
      // Multi-key object, couldn't flatten, or non-primitive leaf - keep as-is
      result[key] = value
    } else {
      result[key] = value
    }
  }

  return result
}

const printMarkdownTable = (rows: Array<Record<string, unknown>>) => {
  if (rows.length === 0) return

  // Collect all unique keys across all rows
  const keys = new Set<string>()
  for (const row of rows) {
    for (const key of Object.keys(row)) keys.add(key)
  }
  const headers = Array.from(keys)

  if (headers.length === 0) return

  // Build header row
  const headerRow = '| ' + headers.join(' | ') + ' |'

  // Build separator row
  const separatorRow = '| ' + headers.map(() => '---').join(' | ') + ' |'

  // Build data rows
  const dataRows = rows.map((row) => {
    const cells = headers.map((h) => escapeMarkdownTableCell(toTableCell(row[h])))
    return '| ' + cells.join(' | ') + ' |'
  })

  process.stdout.write(headerRow + '\n')
  process.stdout.write(separatorRow + '\n')
  for (const row of dataRows) {
    process.stdout.write(row + '\n')
  }
}

const printMarkdownNode = (node: Record<string, unknown>, headingLevel = 2) => {
  const prefix = '#'.repeat(headingLevel)
  for (const [key, value] of Object.entries(node)) {
    process.stdout.write(`${prefix} ${key}\n\n`)
    if (value === null || value === undefined) {
      process.stdout.write('\n')
    } else if (isPlainObject(value)) {
      // Recurse into nested objects with deeper heading level
      printMarkdownNode(value, headingLevel + 1)
    } else if (Array.isArray(value)) {
      if (key === '[publications]') {
        for (const p of value) {
          if (!p || typeof p !== 'object') continue
          const title = typeof (p as any).title === 'string' ? (p as any).title : undefined
          if (!title) continue
          process.stdout.write(`${'#'.repeat(headingLevel + 1)} ${title}\n`)
          process.stdout.write(`- isPublished: ${(p as any).isPublished === true}\n`)
          const publishDate = typeof (p as any).publishDate === 'string' ? (p as any).publishDate : ''
          process.stdout.write(`- publishDate: ${publishDate}\n\n`)
        }
      } else {
        process.stdout.write(JSON.stringify(value, null, 2) + '\n\n')
      }
    } else {
      process.stdout.write(String(value) + '\n\n')
    }
  }
}

export const printNode = ({
  node,
  format,
  quiet,
}: {
  node: any
  format: OutputFormat
  quiet: boolean
}) => {
  if (quiet) {
    const id = typeof node === 'object' && node !== null ? (node.id as unknown) : undefined
    if (typeof id === 'string') printIds([id])
    return
  }

  if (format === 'table') {
    if (typeof node !== 'object' || node === null) {
      printMarkdownTable([{ value: node }])
      return
    }
    const coerced = coerceComputedFieldsForTable(node as Record<string, unknown>)
    const flattened = flattenSingleKeyPaths(coerced)
    printMarkdownTable([flattened])
    return
  }

  if (format === 'markdown') {
    if (typeof node !== 'object' || node === null) {
      process.stdout.write(`${node}\n`)
      return
    }
    printMarkdownNode(node as Record<string, unknown>)
    return
  }

  if (format === 'jsonl') {
    writeJson(node, { pretty: false })
    return
  }

  if (format === 'raw') {
    printJson(node, false)
    return
  }

  if (format === 'json') {
    printJson(node, true)
    return
  }

  throw new CliError(`Unknown format: ${format}`, 2)
}

export const printConnection = ({
  connection,
  format,
  quiet,
  nextPageArgs,
}: {
  connection: { nodes?: any[]; pageInfo?: any }
  format: OutputFormat
  quiet: boolean
  nextPageArgs?: NextPageArgs
}) => {
  const nodes = connection.nodes ?? []
  const pageInfo = connection.pageInfo
  const hasNextPage = pageInfo?.hasNextPage === true
  const endCursor = typeof pageInfo?.endCursor === 'string' ? (pageInfo.endCursor as string) : undefined

  if (quiet) {
    printIds(nodes.map((n) => n?.id))
    return
  }

  const nextPageCommand =
    hasNextPage && endCursor && nextPageArgs
      ? buildNextPageCommand({ ...nextPageArgs, endCursor })
      : undefined

  if (format === 'table') {
    const rows = nodes.map((n) => {
      if (typeof n !== 'object' || n === null) return { value: n }
      const coerced = coerceComputedFieldsForTable(n as Record<string, unknown>)
      return flattenSingleKeyPaths(coerced)
    })
    printMarkdownTable(rows)
    if (nextPageCommand) process.stderr.write(`\nNext page: ${nextPageCommand}\n`)
    return
  }

  if (format === 'markdown') {
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]
      if (typeof n !== 'object' || n === null) {
        process.stdout.write(`${n}\n`)
      } else {
        const title = (n as any).title ?? (n as any).name ?? (n as any).id ?? `Item ${i + 1}`
        process.stdout.write(`# ${title}\n\n`)
        printMarkdownNode(n as Record<string, unknown>, 2)
      }
    }
    if (nextPageCommand) process.stderr.write(`\nNext page: ${nextPageCommand}\n`)
    return
  }

  if (format === 'jsonl') {
    for (const n of nodes) writeJson(n, { pretty: false })
    if (nextPageCommand) process.stderr.write(`Next page: ${nextPageCommand}\n`)
    return
  }

  if (format === 'raw') {
    printJson(nodes, false)
    if (nextPageCommand) process.stderr.write(`Next page: ${nextPageCommand}\n`)
    return
  }

  if (format === 'json') {
    const output: any = { nodes }
    if (hasNextPage) {
      output.pageInfo = {
        hasNextPage: true,
        ...(endCursor ? { endCursor } : {}),
        ...(nextPageCommand ? { nextPageCommand } : {}),
      }
    }
    printJson(output, true)
    return
  }

  throw new CliError(`Unknown format: ${format}`, 2)
}
