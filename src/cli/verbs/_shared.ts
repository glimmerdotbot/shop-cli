import { readFileSync } from 'node:fs'

import { CliError } from '../errors'
import { coerceGid, type ShopifyGidType } from '../gid'

export const parseFirst = (value: unknown) => {
  if (value === undefined) return 50
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) throw new CliError('--first must be a positive integer', 2)
  return Math.floor(n)
}

export const parseIntFlag = (flag: string, value: unknown) => {
  if (value === undefined || value === null || value === '') {
    throw new CliError(`Missing ${flag}`, 2)
  }
  const n = Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new CliError(`${flag} must be an integer`, 2)
  }
  return n
}

export const requireId = (id: unknown, type: ShopifyGidType, flag = '--id') => {
  const normalized =
    typeof id === 'string'
      ? id
      : typeof id === 'number' && Number.isFinite(id)
        ? String(id)
        : undefined
  if (!normalized) throw new CliError(`Missing ${flag}`, 2)
  return coerceGid(normalized, type)
}

export const requireGidFlag = (value: unknown, flag: string, type: ShopifyGidType) => {
  if (typeof value !== 'string' || !value) throw new CliError(`Missing ${flag}`, 2)
  return coerceGid(value, type)
}

export const requireStringFlag = (value: unknown, flag: string) => {
  if (typeof value !== 'string' || !value) throw new CliError(`Missing ${flag}`, 2)
  return value
}

export const requireLocationId = (value: unknown, flag = '--location-id') => {
  if (typeof value !== 'string' || !value) throw new CliError(`Missing ${flag}`, 2)
  return coerceGid(value, 'Location')
}

export const parseDateTime = (value: unknown, flag: string) => {
  if (typeof value !== 'string' || !value) throw new CliError(`Missing ${flag}`, 2)
  return value
}

export const parseCsv = (value: unknown, label: string) => {
  if (typeof value !== 'string' || !value.trim()) throw new CliError(`Missing ${label}`, 2)
  const parts = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length === 0) throw new CliError(`${label} must include at least one item`, 2)
  return parts
}

export const parseIds = (value: unknown, type: ShopifyGidType) => {
  const raw = Array.isArray(value) ? value : value === undefined ? [] : [value]
  const parts: string[] = []
  for (const v of raw) {
    if (typeof v !== 'string') throw new CliError('--ids must be a string', 2)
    parts.push(...v.split(',').map((s) => s.trim()).filter(Boolean))
  }
  if (parts.length === 0) throw new CliError('Missing --ids', 2)
  return parts.map((id) => coerceGid(id, type))
}

const readUtf8 = (path: string) => readFileSync(path, 'utf8')

const parseJson = (value: string, label: string) => {
  try {
    return JSON.parse(value)
  } catch (err) {
    throw new CliError(`${label} must be valid JSON: ${(err as Error).message}`, 2)
  }
}

export const parseJsonArg = (
  value: unknown,
  label: string,
  { allowEmpty = false }: { allowEmpty?: boolean } = {},
) => {
  if (value === undefined || value === null || value === '') {
    if (allowEmpty) return undefined
    throw new CliError(`Missing ${label}`, 2)
  }
  if (typeof value !== 'string') throw new CliError(`${label} must be a string`, 2)
  const raw = value.trim()
  if (!raw) {
    if (allowEmpty) return undefined
    throw new CliError(`Missing ${label}`, 2)
  }
  if (raw.startsWith('@file:')) return parseJson(readUtf8(raw.slice('@file:'.length)), label)
  if (raw.startsWith('@')) return parseJson(readUtf8(raw.slice(1)), label)
  return parseJson(raw, label)
}

export const parseTextArg = (
  value: unknown,
  label: string,
  { allowEmpty = false }: { allowEmpty?: boolean } = {},
) => {
  if (value === undefined || value === null || value === '') {
    if (allowEmpty) return undefined
    throw new CliError(`Missing ${label}`, 2)
  }
  if (typeof value !== 'string') throw new CliError(`${label} must be a string`, 2)
  const raw = value.trim()
  if (!raw) {
    if (allowEmpty) return undefined
    throw new CliError(`Missing ${label}`, 2)
  }
  if (raw.startsWith('@file:')) return readUtf8(raw.slice('@file:'.length))
  if (raw.startsWith('@')) return readUtf8(raw.slice(1))
  return raw
}

export const parseStringList = (
  value: unknown,
  label: string,
  { allowEmpty = false }: { allowEmpty?: boolean } = {},
) => {
  if (value === undefined || value === null) {
    if (allowEmpty) return [] as string[]
    throw new CliError(`Missing ${label}`, 2)
  }

  const raw = Array.isArray(value) ? value : [value]
  const parts: string[] = []

  for (const v of raw) {
    if (typeof v !== 'string') throw new CliError(`${label} must be a string`, 2)
    parts.push(...v.split(',').map((s) => s.trim()).filter(Boolean))
  }

  if (parts.length === 0) {
    if (allowEmpty) return []
    throw new CliError(`Missing ${label}`, 2)
  }

  return parts
}

export const buildListNextPageArgs = (
  resource: string,
  args: { first?: unknown; query?: unknown; sort?: unknown; reverse?: unknown },
  extraFlags?: Array<{ flag: string; value?: unknown }>,
) => {
  const normalizedExtraFlags: Array<{ flag: string; value?: string | number | boolean }> = []

  for (const f of extraFlags ?? []) {
    if (!f?.flag) continue
    const value = f.value
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      normalizedExtraFlags.push({ flag: f.flag, value })
    }
  }

  return {
    base: `shop ${resource} list`,
    first: typeof args.first === 'number' ? args.first : undefined,
    query: typeof args.query === 'string' ? args.query : undefined,
    sort: typeof args.sort === 'string' ? args.sort : undefined,
    reverse: args.reverse === true,
    extraFlags: normalizedExtraFlags,
  }
}
