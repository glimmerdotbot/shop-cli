import { readFileSync } from 'node:fs'

import { CliError } from '../errors'

export type GenqlSelection = {
  __args?: Record<string, unknown>
  [field: string]: true | GenqlSelection | Record<string, unknown> | undefined
}

type Token =
  | { type: 'name'; value: string }
  | { type: 'string'; value: string }
  | { type: 'number'; value: number }
  | { type: 'punct'; value: '{' | '}' | '(' | ')' | ':' | '[' | ']' | ',' }
  | { type: 'spread' }

const isNameStart = (ch: string) => /[A-Za-z_]/.test(ch)
const isNameContinue = (ch: string) => /[0-9A-Za-z_]/.test(ch)

const readSelectionSource = (arg: string) => {
  if (arg.startsWith('@file:')) return readFileSync(arg.slice('@file:'.length), 'utf8')
  if (arg.startsWith('@')) return readFileSync(arg.slice(1), 'utf8')
  return arg
}

const tokenize = (src: string): Token[] => {
  const tokens: Token[] = []
  let i = 0

  const peek = () => src[i]
  const next = () => src[i++]

  const skipWhitespaceAndComments = () => {
    while (i < src.length) {
      const ch = peek()
      if (!ch) return
      if (/\s/.test(ch)) {
        i++
        continue
      }
      if (ch === ',') {
        tokens.push({ type: 'punct', value: ',' })
        i++
        continue
      }
      if (ch === '#') {
        while (i < src.length && src[i] !== '\n') i++
        continue
      }
      return
    }
  }

  const readName = () => {
    const start = i
    i++
    while (i < src.length && isNameContinue(src[i]!)) i++
    return src.slice(start, i)
  }

  const readString = () => {
    // GraphQL "StringValue" (no block strings).
    const quote = next()
    if (quote !== '"') throw new CliError('Internal error: expected quote', 2)
    let out = ''
    while (i < src.length) {
      const ch = next()
      if (!ch) break
      if (ch === '"') return out
      if (ch === '\\') {
        const esc = next()
        if (!esc) throw new CliError('Unterminated string literal', 2)
        if (esc === '"' || esc === '\\' || esc === '/') out += esc
        else if (esc === 'b') out += '\b'
        else if (esc === 'f') out += '\f'
        else if (esc === 'n') out += '\n'
        else if (esc === 'r') out += '\r'
        else if (esc === 't') out += '\t'
        else if (esc === 'u') {
          const hex = src.slice(i, i + 4)
          if (!/^[0-9A-Fa-f]{4}$/.test(hex)) throw new CliError('Invalid unicode escape', 2)
          out += String.fromCharCode(parseInt(hex, 16))
          i += 4
        } else {
          throw new CliError(`Invalid escape sequence: \\${esc}`, 2)
        }
        continue
      }
      out += ch
    }
    throw new CliError('Unterminated string literal', 2)
  }

  const readNumber = () => {
    const start = i
    if (src[i] === '-') i++
    while (i < src.length && /[0-9]/.test(src[i]!)) i++
    if (src[i] === '.') {
      i++
      while (i < src.length && /[0-9]/.test(src[i]!)) i++
    }
    const raw = src.slice(start, i)
    const n = Number(raw)
    if (!Number.isFinite(n)) throw new CliError(`Invalid number literal: ${raw}`, 2)
    return n
  }

  while (i < src.length) {
    skipWhitespaceAndComments()
    if (i >= src.length) break

    const ch = peek()!

    if (ch === '.' && src.slice(i, i + 3) === '...') {
      i += 3
      tokens.push({ type: 'spread' })
      continue
    }

    if (ch === '"' /* string */) {
      tokens.push({ type: 'string', value: readString() })
      continue
    }

    if (ch === '-' || /[0-9]/.test(ch)) {
      tokens.push({ type: 'number', value: readNumber() })
      continue
    }

    if (isNameStart(ch)) {
      tokens.push({ type: 'name', value: readName() })
      continue
    }

    if (ch === '{' || ch === '}' || ch === '(' || ch === ')' || ch === ':' || ch === '[' || ch === ']') {
      i++
      tokens.push({ type: 'punct', value: ch })
      continue
    }

    throw new CliError(`Unexpected character in --selection: ${ch}`, 2)
  }

  return tokens.filter((t) => !(t.type === 'punct' && t.value === ','))
}

type Parser = {
  tokens: Token[]
  i: number
}

const parserPeek = (p: Parser) => p.tokens[p.i]
const parserNext = (p: Parser) => p.tokens[p.i++]

type PunctValue = Extract<Token, { type: 'punct' }>['value']

const expectName = (p: Parser) => {
  const tok = parserNext(p)
  if (!tok || tok.type !== 'name') throw new CliError('Invalid --selection: expected name', 2)
  return tok.value
}

const expectPunct = (p: Parser, value?: PunctValue) => {
  const tok = parserNext(p)
  if (!tok || tok.type !== 'punct') throw new CliError('Invalid --selection: expected punctuation', 2)
  if (value && tok.value !== value) throw new CliError(`Invalid --selection: expected '${value}'`, 2)
  return tok.value
}

const expectSpread = (p: Parser) => {
  const tok = parserNext(p)
  if (!tok || tok.type !== 'spread') throw new CliError('Invalid --selection: expected ...', 2)
}

const tryConsumePunct = (p: Parser, value: PunctValue) => {
  const tok = parserPeek(p)
  if (tok?.type === 'punct' && tok.value === value) {
    p.i++
    return true
  }
  return false
}

const parseValue = (p: Parser): unknown => {
  const tok = parserPeek(p)
  if (!tok) throw new CliError('Invalid --selection: expected value', 2)

  if (tok.type === 'string') {
    p.i++
    return tok.value
  }
  if (tok.type === 'number') {
    p.i++
    return tok.value
  }
  if (tok.type === 'name') {
    p.i++
    if (tok.value === 'true') return true
    if (tok.value === 'false') return false
    if (tok.value === 'null') return null
    return tok.value // enum
  }
  if (tok.type === 'punct' && tok.value === '[') {
    p.i++
    const items: unknown[] = []
    while (!tryConsumePunct(p, ']')) {
      items.push(parseValue(p))
      tryConsumePunct(p, ',')
    }
    return items
  }
  if (tok.type === 'punct' && tok.value === '{') {
    p.i++
    const obj: Record<string, unknown> = {}
    while (!tryConsumePunct(p, '}')) {
      const key = expectName(p)
      expectPunct(p, ':')
      obj[key] = parseValue(p)
      tryConsumePunct(p, ',')
    }
    return obj
  }

  throw new CliError('Invalid --selection: unsupported value', 2)
}

const mergeSelectionValue = (
  current: true | GenqlSelection | undefined,
  next: true | GenqlSelection,
): true | GenqlSelection => {
  if (current === undefined) return next
  if (current === true) return next
  if (next === true) return current

  const merged: GenqlSelection = { ...current }
  if (current.__args || next.__args) {
    merged.__args = { ...(current.__args ?? {}), ...(next.__args ?? {}) }
  }
  for (const [k, v] of Object.entries(next)) {
    if (k === '__args') continue
    merged[k] = mergeSelectionValue(merged[k] as any, v as any) as any
  }
  return merged
}

const parseArguments = (p: Parser): Record<string, unknown> => {
  const args: Record<string, unknown> = {}
  expectPunct(p, '(')
  while (!tryConsumePunct(p, ')')) {
    const name = expectName(p)
    expectPunct(p, ':')
    args[name] = parseValue(p)
    tryConsumePunct(p, ',')
  }
  return args
}

const parseSelectionSet = (p: Parser): GenqlSelection => {
  const out: GenqlSelection = {}

  if (tryConsumePunct(p, '{')) {
    while (!tryConsumePunct(p, '}')) {
      const selection = parseSelection(p)
      for (const [k, v] of Object.entries(selection)) {
        out[k] = mergeSelectionValue(out[k] as any, v as any) as any
      }
    }
    return out
  }

  while (p.i < p.tokens.length) {
    const selection = parseSelection(p)
    for (const [k, v] of Object.entries(selection)) {
      out[k] = mergeSelectionValue(out[k] as any, v as any) as any
    }
  }
  return out
}

const parseField = (p: Parser): Record<string, true | GenqlSelection> => {
  const firstName = expectName(p)

  // alias: field
  let fieldName = firstName
  if (tryConsumePunct(p, ':')) {
    fieldName = expectName(p)
  }

  const tok = parserPeek(p)
  const hasArgs = tok?.type === 'punct' && tok.value === '('
  const args = hasArgs ? parseArguments(p) : undefined

  const nextTok = parserPeek(p)
  const hasSelectionSet = nextTok?.type === 'punct' && nextTok.value === '{'

  if (args && !hasSelectionSet) {
    throw new CliError(
      `Invalid --selection: field '${fieldName}' has arguments but no sub-selection`,
      2,
    )
  }

  const selection = hasSelectionSet ? parseSelectionSet(p) : true
  const value: true | GenqlSelection = args ? { __args: args, ...(selection === true ? {} : selection) } : selection
  return { [fieldName]: value }
}

const parseInlineFragment = (p: Parser): Record<string, GenqlSelection> => {
  expectSpread(p)
  const on = expectName(p)
  if (on !== 'on') throw new CliError('Invalid --selection: expected "on" after ...', 2)
  const typeName = expectName(p)
  const selection = parseSelectionSet(p)
  return { [`on_${typeName}`]: selection }
}

const parseSelection = (p: Parser): Record<string, true | GenqlSelection> => {
  const tok = parserPeek(p)
  if (!tok) throw new CliError('Invalid --selection: unexpected end', 2)
  if (tok.type === 'spread') return parseInlineFragment(p)
  if (tok.type === 'name') return parseField(p)
  throw new CliError('Invalid --selection: expected field selection', 2)
}

export const parseGraphqlSelectionArg = (arg: string): GenqlSelection => {
  const src = readSelectionSource(arg).trim()
  if (!src) throw new CliError('Invalid --selection: empty', 2)

  const tokens = tokenize(src)
  const p: Parser = { tokens, i: 0 }
  const selection = parseSelectionSet(p)

  if (p.i !== p.tokens.length) {
    throw new CliError('Invalid --selection: trailing tokens', 2)
  }

  if (Object.keys(selection).length === 0) {
    throw new CliError('Invalid --selection: selection set is empty', 2)
  }

  return selection
}
