import { CliError } from './errors'

export type OutputFormat = 'json' | 'table' | 'raw'

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

const toTableCell = (value: unknown) => {
  if (value === null || value === undefined) return value
  const t = typeof value
  if (t === 'string' || t === 'number' || t === 'boolean') return value
  return JSON.stringify(value)
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
      // eslint-disable-next-line no-console
      console.table([{ value: toTableCell(node) }])
      return
    }
    const row: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(node)) row[k] = toTableCell(v)
    // eslint-disable-next-line no-console
    console.table([row])
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
      if (typeof n !== 'object' || n === null) return { value: toTableCell(n) }
      const row: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(n)) row[k] = toTableCell(v)
      return row
    })
    // eslint-disable-next-line no-console
    console.table(rows)
    if (connection.pageInfo) printJson({ pageInfo: connection.pageInfo })
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
