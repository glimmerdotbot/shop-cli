import { CliError } from './errors'

export type OutputFormat = 'json' | 'table' | 'raw' | 'markdown'

export const writeJson = (
  data: unknown,
  {
    pretty = true,
    stream = process.stdout,
  }: { pretty?: boolean; stream?: NodeJS.WritableStream } = {},
) => {
  stream.write(JSON.stringify(data, null, pretty ? 2 : 0))
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

const toTableCell = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  const t = typeof value
  if (t === 'string') return String(value)
  if (t === 'number' || t === 'boolean') return String(value)
  return JSON.stringify(value)
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
    const formatted = value === null || value === undefined ? '' :
      typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
    process.stdout.write(`${prefix} ${key}\n\n${formatted}\n\n`)
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
    const flattened = flattenSingleKeyPaths(node as Record<string, unknown>)
    printMarkdownTable([flattened])
    return
  }

  if (format === 'markdown') {
    if (typeof node !== 'object' || node === null) {
      process.stdout.write(`${node}\n`)
      return
    }
    const flattened = flattenSingleKeyPaths(node as Record<string, unknown>)
    printMarkdownNode(flattened)
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
}: {
  connection: { nodes?: any[]; pageInfo?: any }
  format: OutputFormat
  quiet: boolean
}) => {
  const nodes = connection.nodes ?? []

  if (quiet) {
    printIds(nodes.map((n) => n?.id))
    return
  }

  if (format === 'table') {
    const rows = nodes.map((n) => {
      if (typeof n !== 'object' || n === null) return { value: n }
      return flattenSingleKeyPaths(n as Record<string, unknown>)
    })
    printMarkdownTable(rows)
    if (connection.pageInfo) printJson({ pageInfo: connection.pageInfo })
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
        const flattened = flattenSingleKeyPaths(n as Record<string, unknown>)
        printMarkdownNode(flattened, 2)
      }
    }
    if (connection.pageInfo) {
      process.stdout.write('---\n\n')
      printJson({ pageInfo: connection.pageInfo })
    }
    return
  }

  if (format === 'raw') {
    printJson(connection, false)
    return
  }

  if (format === 'json') {
    printJson(connection, true)
    return
  }

  throw new CliError(`Unknown format: ${format}`, 2)
}
