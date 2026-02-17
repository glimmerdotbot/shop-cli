import { readFileSync } from 'node:fs'
import { CliError } from './errors'

const readUtf8 = (path: string) => readFileSync(path, 'utf8')

const parseJson = (value: string, label: string) => {
  try {
    return JSON.parse(value)
  } catch (err) {
    throw new CliError(`${label} must be valid JSON: ${(err as Error).message}`, 2)
  }
}

const parseJsonOrFile = (arg: string, label: string) => {
  if (arg.startsWith('@file:')) return parseJson(readUtf8(arg.slice('@file:'.length)), label)
  if (arg.startsWith('@')) return parseJson(readUtf8(arg.slice(1)), label)
  return parseJson(arg, label)
}

const parseSetValue = (raw: string) => {
  if (raw.startsWith('@file:')) return readUtf8(raw.slice('@file:'.length))
  if (raw.startsWith('@json:')) return parseJson(readUtf8(raw.slice('@json:'.length)), '--set-json')

  const looksJson =
    raw.startsWith('{') ||
    raw.startsWith('[') ||
    raw.startsWith('"') ||
    raw === 'true' ||
    raw === 'false' ||
    raw === 'null' ||
    /^-?\d+(\.\d+)?$/.test(raw)

  if (looksJson) return parseJson(raw, '--set')
  return raw
}

const splitSetArg = (arg: string) => {
  const eq = arg.indexOf('=')
  if (eq === -1) throw new CliError(`Expected --set path=value, got: ${arg}`, 2)
  const path = arg.slice(0, eq).trim()
  const value = arg.slice(eq + 1)
  if (!path) throw new CliError(`Expected --set path=value, got: ${arg}`, 2)
  return { path, value }
}

const setDeep = (target: any, path: string, value: any) => {
  const parts = path.split('.').filter(Boolean)
  if (parts.length === 0) throw new CliError(`Invalid --set path: ${path}`, 2)

  let cursor: any = target
  for (let i = 0; i < parts.length; i++) {
    const key = parts[i]!
    const isLast = i === parts.length - 1
    const nextKey = parts[i + 1]
    const nextIsIndex = nextKey !== undefined && /^\d+$/.test(nextKey)

    if (isLast) {
      if (Array.isArray(cursor) && /^\d+$/.test(key)) {
        cursor[Number(key)] = value
      } else {
        cursor[key] = value
      }
      return
    }

    if (Array.isArray(cursor) && /^\d+$/.test(key)) {
      const idx = Number(key)
      cursor[idx] ??= nextIsIndex ? [] : {}
      cursor = cursor[idx]
    } else {
      cursor[key] ??= nextIsIndex ? [] : {}
      cursor = cursor[key]
    }
  }
}

export type BuiltInput = {
  input: any
  used: boolean
}

export const buildInput = ({
  inputArg,
  setArgs,
  setJsonArgs,
}: {
  inputArg?: string
  setArgs?: string[]
  setJsonArgs?: string[]
}): BuiltInput => {
  const hasAny = Boolean(inputArg) || (setArgs?.length ?? 0) > 0 || (setJsonArgs?.length ?? 0) > 0
  if (!hasAny) return { input: undefined, used: false }

  let result: any = inputArg ? parseJsonOrFile(inputArg, '--input') : {}

  for (const arg of setArgs ?? []) {
    const { path, value } = splitSetArg(arg)
    setDeep(result, path, parseSetValue(value))
  }

  for (const arg of setJsonArgs ?? []) {
    const { path, value } = splitSetArg(arg)
    const parsed = parseJsonOrFile(value, '--set-json')
    setDeep(result, path, parsed)
  }

  return { input: result, used: true }
}

