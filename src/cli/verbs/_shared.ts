import { CliError } from '../errors'
import { coerceGid, type ShopifyGidType } from '../gid'

export const parseFirst = (value: unknown) => {
  if (value === undefined) return 50
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) throw new CliError('--first must be a positive integer', 2)
  return Math.floor(n)
}

export const requireId = (id: unknown, type: ShopifyGidType) => {
  if (typeof id !== 'string' || !id) throw new CliError('Missing --id', 2)
  return coerceGid(id, type)
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
