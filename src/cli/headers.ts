import { CliError } from './errors'
import { parseJson5 } from './json'

const parseHeaderPair = (value: string, label: string) => {
  const colonIndex = value.indexOf(':')
  const equalsIndex = value.indexOf('=')

  const separatorIndex =
    colonIndex === -1
      ? equalsIndex
      : equalsIndex === -1
        ? colonIndex
        : Math.min(colonIndex, equalsIndex)

  if (separatorIndex === -1) {
    throw new CliError(`Invalid ${label} value: expected "Name: value" or "Name=value"`, 2)
  }

  const name = value.slice(0, separatorIndex).trim()
  if (!name) {
    throw new CliError(`Invalid ${label} value: header name is required`, 2)
  }

  const headerValue = value.slice(separatorIndex + 1).trim()
  return { name, value: headerValue }
}

export const parseHeaderValues = (values: string[], label = '--header') => {
  const headers: Record<string, string> = {}
  for (const rawValue of values) {
    const { name, value } = parseHeaderPair(rawValue, label)
    headers[name] = value
  }
  return headers
}

export const parseHeadersFromEnv = (
  raw: string | undefined,
  label = 'SHOPIFY_HEADERS',
): Record<string, string> => {
  if (!raw) return {}

  let parsed: unknown
  try {
    parsed = parseJson5(raw)
  } catch {
    throw new CliError(
      `Invalid ${label}: expected a JSON object like {"X-Foo":"bar"}`,
      2,
    )
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new CliError(
      `Invalid ${label}: expected a JSON object like {"X-Foo":"bar"}`,
      2,
    )
  }

  const headers: Record<string, string> = {}
  for (const [name, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value !== 'string') {
      throw new CliError(`Invalid ${label}: header "${name}" must be a string`, 2)
    }
    headers[name] = value
  }
  return headers
}
