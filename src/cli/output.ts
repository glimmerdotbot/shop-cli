import { CliError } from './errors'

export type OutputFormat = 'json' | 'table' | 'raw'

export const printJson = (data: unknown, pretty = true) => {
  process.stdout.write(JSON.stringify(data, null, pretty ? 2 : 0))
  process.stdout.write('\n')
}

export const printIds = (ids: Array<string | undefined | null>) => {
  for (const id of ids) {
    if (id) process.stdout.write(`${id}\n`)
  }
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
    // eslint-disable-next-line no-console
    console.table(nodes)
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

