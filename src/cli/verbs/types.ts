import { parseArgs } from 'node:util'

import { CliError } from '../errors'
import {
  enumTypeHelp,
  inputTypeHelp,
  type InputFieldHelp,
  type EnumValueHelp,
} from '../../generated/help/schema-help'
import { resolveCliCommand } from '../command'

const PRIMITIVES = new Set(['String', 'Int', 'Float', 'Boolean', 'ID', 'DateTime', 'Date', 'JSON', 'Decimal', 'HTML', 'URL', 'Money', 'UnsignedInt64', 'FormattedString', 'Color', 'UtcOffset', 'ARN'])

const printHelp = () => {
  const command = resolveCliCommand()
  console.log(
    [
      'Explore input types and enums from the Shopify Admin API schema.',
      '',
      'Usage:',
      `  ${command} types <TypeName>`,
      '',
      'Arguments:',
      '  TypeName    The name of an input type or enum to explore.',
      '',
      'Flags:',
      '  --all       Show all enum values (for large enums).',
      '',
      'Examples:',
      `  ${command} types ProductBundleComponentInput`,
      `  ${command} types ProductStatus`,
      `  ${command} types CountryCode --all`,
    ].join('\n'),
  )
}

/** Simple fuzzy matching: check if all chars of needle appear in haystack in order */
const fuzzyMatch = (needle: string, haystack: string): boolean => {
  const lowerNeedle = needle.toLowerCase()
  const lowerHaystack = haystack.toLowerCase()
  let ni = 0
  for (let hi = 0; hi < lowerHaystack.length && ni < lowerNeedle.length; hi++) {
    if (lowerHaystack[hi] === lowerNeedle[ni]) ni++
  }
  return ni === lowerNeedle.length
}

/** Score a match - lower is better. Prefers exact prefix matches, then substring, then fuzzy */
const scoreMatch = (query: string, typeName: string): number => {
  const lowerQuery = query.toLowerCase()
  const lowerType = typeName.toLowerCase()

  if (lowerType === lowerQuery) return 0 // Exact match
  if (lowerType.startsWith(lowerQuery)) return 1 // Prefix match
  if (lowerType.includes(lowerQuery)) return 2 // Substring match
  if (fuzzyMatch(query, typeName)) return 3 // Fuzzy match
  return Infinity
}

const findSuggestions = (query: string, limit = 5): string[] => {
  const allTypes = [
    ...Object.keys(inputTypeHelp),
    ...Object.keys(enumTypeHelp),
  ]

  const scored = allTypes
    .map((name) => ({ name, score: scoreMatch(query, name) }))
    .filter(({ score }) => score < Infinity)
    .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name))
    .slice(0, limit)

  return scored.map(({ name }) => name)
}

const formatFieldType = (field: InputFieldHelp): string => {
  let label = field.typeName
  if (field.isList) label = `${label}[]`
  if (field.required) label = `${label}!`
  return label
}

const collectNestedTypes = (
  fields: InputFieldHelp[],
  depth: number,
  visited: Set<string>,
): Map<string, InputFieldHelp[]> => {
  const result = new Map<string, InputFieldHelp[]>()
  if (depth <= 0) return result

  for (const field of fields) {
    const typeName = field.typeName
    if (PRIMITIVES.has(typeName)) continue
    if (visited.has(typeName)) continue

    const nestedFields = inputTypeHelp[typeName]
    if (!nestedFields) continue

    visited.add(typeName)
    result.set(typeName, nestedFields)

    // Recurse
    const deeper = collectNestedTypes(nestedFields, depth - 1, visited)
    for (const [k, v] of deeper) {
      result.set(k, v)
    }
  }

  return result
}

/** Word-wrap text to a given width */
const wrapText = (text: string, width: number): string[] => {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']
  const lines: string[] = []
  let line = words[0]!
  for (let i = 1; i < words.length; i++) {
    const word = words[i]!
    if (line.length + 1 + word.length > width) {
      lines.push(line)
      line = word
    } else {
      line += ` ${word}`
    }
  }
  lines.push(line)
  return lines
}

/** Format a field line with proper indentation and word wrapping */
const formatFieldLine = (
  field: InputFieldHelp,
  nameWidth: number,
  typeWidth: number,
  lineIndent: string,
  totalWidth = 108,
): string => {
  const name = field.name.padEnd(nameWidth)
  const type = formatFieldType(field).padEnd(typeWidth)
  const required = field.required ? 'Required. ' : ''
  const desc = field.description ?? ''

  // Calculate prefix and indent for continuation lines
  const prefix = `${lineIndent}${name}  ${type}  `
  const indent = ' '.repeat(prefix.length)
  const descWidth = Math.max(20, totalWidth - prefix.length)

  // Normalize: remove blank lines, join into single string, then wrap
  const normalizedDesc = `${required}${desc}`
    .split('\n')
    .filter((line) => line.trim() !== '')
    .join(' ')
  const wrappedLines = wrapText(normalizedDesc, descWidth)

  const lines = [`${prefix}${wrappedLines[0]}`]
  for (let i = 1; i < wrappedLines.length; i++) {
    lines.push(`${indent}${wrappedLines[i]}`)
  }
  return lines.join('\n')
}

const renderInputType = (
  typeName: string,
  fields: InputFieldHelp[],
  showAll: boolean,
): string => {
  const lines: string[] = [typeName, '', 'Fields:']

  // Calculate column widths
  const nameWidth = Math.max(...fields.map((f) => f.name.length), 4)
  const typeWidth = Math.max(...fields.map((f) => formatFieldType(f).length), 4)

  for (const field of fields) {
    lines.push(formatFieldLine(field, nameWidth, typeWidth, '  '))
  }

  // Collect nested types (2 levels)
  const visited = new Set<string>([typeName])
  const nested = collectNestedTypes(fields, 2, visited)

  for (const [nestedName, nestedFields] of nested) {
    lines.push('')
    lines.push(`Type: ${nestedName}`)

    const nestedNameWidth = Math.max(...nestedFields.map((f) => f.name.length), 4)
    const nestedTypeWidth = Math.max(...nestedFields.map((f) => formatFieldType(f).length), 4)

    for (const field of nestedFields) {
      lines.push(formatFieldLine(field, nestedNameWidth, nestedTypeWidth, '  '))
    }
  }

  return lines.join('\n')
}

const renderEnumType = (
  typeName: string,
  values: EnumValueHelp[],
  showAll: boolean,
): string => {
  const lines: string[] = [typeName, '']

  const MAX_INLINE = 10
  const MAX_EXPANDED = 20

  if (!showAll && values.length > MAX_EXPANDED) {
    // Large enum - show inline format
    const shown = values.slice(0, MAX_INLINE).map((v) => v.name)
    const remaining = values.length - MAX_INLINE
    lines.push(`Values: ${shown.join(' | ')} | ... and ${remaining} more`)
    lines.push('')
    lines.push('Use --all to see all values.')
  } else {
    // Show all values with descriptions
    lines.push('Values:')
    const nameWidth = Math.max(...values.map((v) => v.name.length), 4)

    for (const value of values) {
      const name = value.name.padEnd(nameWidth)
      const desc = value.description ?? ''
      const deprecated = value.deprecated
        ? value.deprecationReason
          ? `[Deprecated: ${value.deprecationReason}] `
          : '[Deprecated] '
        : ''
      lines.push(`  ${name}  ${deprecated}${desc}`)
    }
  }

  return lines.join('\n')
}

export const runTypes = async ({
  verb,
  argv,
}: {
  verb: string
  argv: string[]
}) => {
  if (verb === 'help') {
    printHelp()
    return
  }

  // Check for help first
  if (argv.includes('--help') || argv.includes('-h') || !verb) {
    printHelp()
    return
  }

  const parsed = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      all: { type: 'boolean' },
      help: { type: 'boolean' },
      h: { type: 'boolean' },
    },
  })

  const showAll = parsed.values.all ?? false

  // The type name comes from verb (how CLI parses it)
  const typeName = verb

  // Check input types first
  const inputFields = inputTypeHelp[typeName]
  if (inputFields) {
    console.log(renderInputType(typeName, inputFields, showAll))
    return
  }

  // Check enum types
  const enumValues = enumTypeHelp[typeName]
  if (enumValues) {
    console.log(renderEnumType(typeName, enumValues, showAll))
    return
  }

  // Type not found - suggest alternatives
  const suggestions = findSuggestions(typeName)

  const lines = [`Type "${typeName}" not found.`]
  if (suggestions.length > 0) {
    lines.push('')
    lines.push('Did you mean?')
    for (const suggestion of suggestions) {
      lines.push(`  ${suggestion}`)
    }
  }

  throw new CliError(lines.join('\n'), 2)
}
