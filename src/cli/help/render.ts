import type { FlagSpec, ResourceSpec, VerbSpec } from './spec'
import { formatFlags, formatSection } from './format'
import {
  commandRegistry,
  commonOutputFlags,
  paginationFlags,
  standardInputFlags,
} from './registry'
import {
  enumTypeHelp,
  inputTypeHelp,
  mutationHelp,
  queryHelp,
  type InputFieldHelp,
} from '../../generated/help/schema-help'
import { DEFAULT_ADMIN_API_VERSION } from '../../defaults'

const PRIMITIVES = new Set([
  'String', 'Int', 'Float', 'Boolean', 'ID', 'DateTime', 'Date', 'JSON',
  'Decimal', 'HTML', 'URL', 'Money', 'UnsignedInt64', 'FormattedString',
  'Color', 'UtcOffset', 'ARN',
])

type VerbHelpOptions = {
  showAllFields?: boolean
}

const findResource = (resource: string): ResourceSpec | undefined =>
  commandRegistry.find((entry) => entry.resource === resource)

const findVerb = (resource: ResourceSpec, verb: string): VerbSpec | undefined =>
  resource.verbs.find((entry) => entry.verb === verb)

const formatEnumValues = (enumName: string) => {
  const values = enumTypeHelp[enumName]
  if (!values) return undefined
  const names = values.map((value) => value.name)
  if (names.length <= 6) return names.join('|')
  return `${names.slice(0, 6).join('|')}|...`
}

const formatType = (field: InputFieldHelp) => {
  const enumValues = formatEnumValues(field.typeName)
  let label = enumValues ?? field.typeName
  if (field.isList) label = `${label}[]`
  return label
}

const operationHelpFor = (spec: VerbSpec) => {
  if (!spec.operation) return undefined
  if (spec.operation.type === 'mutation') return mutationHelp[spec.operation.name]
  return queryHelp[spec.operation.name]
}

const inputFieldsFor = (spec: VerbSpec): InputFieldHelp[] | undefined => {
  if (!spec.input || spec.input.mode !== 'set') return undefined
  const opHelp = operationHelpFor(spec)
  const inputArg = spec.input.arg ?? spec.operation?.inputArg ?? 'input'
  const arg = opHelp?.args.find((item) => item.name === inputArg)
  if (!arg) return undefined
  return inputTypeHelp[arg.typeName]
}

const formatFieldFlags = (fields: InputFieldHelp[]) => {
  return fields.map((field) => {
    const type = formatType(field)
    const required = field.required ? 'Required. ' : ''
    const description = field.description ? `${required}${field.description}` : required.trim() || undefined
    return {
      label: `--set ${field.name}=<${type}>`,
      description,
    } satisfies FlagSpec
  })
}

const formatOutputFlags = (spec: VerbSpec) => {
  const flags: FlagSpec[] = []
  if (spec.output?.view) flags.push(...commonOutputFlags)
  if (spec.output?.pagination) flags.push(...paginationFlags)
  return flags
}

/** Get type names from fields that reference other input types (not primitives/enums) */
const getReferencedInputTypes = (fields: InputFieldHelp[]): string[] => {
  const types: string[] = []
  const seen = new Set<string>()

  for (const field of fields) {
    const typeName = field.typeName
    if (PRIMITIVES.has(typeName)) continue
    if (enumTypeHelp[typeName]) continue // It's an enum, not an input type
    if (!inputTypeHelp[typeName]) continue // Not a known input type
    if (seen.has(typeName)) continue

    seen.add(typeName)
    types.push(typeName)
  }

  return types
}

/** Collect all nested input types up to a given depth, preserving first-reference order */
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
    if (enumTypeHelp[typeName]) continue // Skip enums
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

/** Format a field's type with list and required markers */
const formatFieldTypeWithMarkers = (field: InputFieldHelp): string => {
  let label = field.typeName
  if (field.isList) label = `${label}[]`
  if (field.required) label = `${label}!`
  return label
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

/** Render the collected type shapes section for --help-full */
const renderTypeShapesSection = (
  types: Map<string, InputFieldHelp[]>,
  totalWidth = 108,
): string[] => {
  if (types.size === 0) return []

  const lines: string[] = ['Referenced types:']

  for (const [typeName, fields] of types) {
    lines.push('')
    lines.push(`  ${typeName}:`)

    const nameWidth = Math.max(...fields.map((f) => f.name.length), 4)
    const typeWidth = Math.max(...fields.map((f) => formatFieldTypeWithMarkers(f).length), 4)

    for (const field of fields) {
      const name = field.name.padEnd(nameWidth)
      const type = formatFieldTypeWithMarkers(field).padEnd(typeWidth)
      const required = field.required ? 'Required. ' : ''
      const desc = field.description ?? ''

      // Calculate prefix and indent for continuation lines
      const prefix = `    ${name}  ${type}  `
      const indent = ' '.repeat(prefix.length)
      const descWidth = Math.max(20, totalWidth - prefix.length)

      // Normalize: remove blank lines, join into single string, then wrap
      const normalizedDesc = `${required}${desc}`
        .split('\n')
        .filter((line) => line.trim() !== '')
        .join(' ')
      const wrappedLines = wrapText(normalizedDesc, descWidth)

      lines.push(`${prefix}${wrappedLines[0]}`)
      for (let i = 1; i < wrappedLines.length; i++) {
        lines.push(`${indent}${wrappedLines[i]}`)
      }
    }
  }

  return lines
}

/** Format the "Type details" footer for regular --help */
const formatTypeDetailsFooter = (typeNames: string[]): string[] => {
  if (typeNames.length === 0) return []

  const lines = ['Type details:']
  for (const typeName of typeNames) {
    lines.push(`  shop types ${typeName}`)
  }
  return lines
}

export const renderTopLevelHelp = () => {
  const resources = [...commandRegistry]
    .filter((r) => r.resource !== 'graphql')
    .sort((a, b) => a.resource.localeCompare(b.resource))
  const resourceLines = resources.map((resource) => {
    const verbs = resource.verbs.map((verb) => verb.verb).join('|')
    return `  ${resource.resource}: ${verbs}`
  })

  return [
    'Usage:',
    '  shop <resource> <verb> [flags]',
    '',
    'Resources:',
    ...resourceLines,
    '',
    'Auth (flags override env):',
    '  --shop <your-shop.myshopify.com>      (or env SHOPIFY_SHOP)',
    '  --graphql-endpoint <url>          (or env GRAPHQL_ENDPOINT; overrides shop domain)',
    '  --access-token <token>              (or env SHOPIFY_ACCESS_TOKEN)',
    '  --header "Name: value"              (repeatable; adds request headers)',
    `  --api-version <YYYY-MM>             (default: ${DEFAULT_ADMIN_API_VERSION})`,
    '',
    'Output:',
    '  --format json|jsonl|table|raw|markdown   (default: json)',
    '  --view summary|ids|full|raw|all (default: summary)',
    '  --select <path>           (repeatable; dot paths; adds to base view selection)',
    '  --include <connection>    (repeatable; only used with --view all)',
    '  --selection <graphql>     (selection override; can be @file.gql)',
    '  --quiet                  (IDs only when possible)',
    '',
    'Debug:',
    '  --dry-run                (print GraphQL op + variables, do not execute)',
    '  --no-fail-on-user-errors (do not exit non-zero on userErrors)',
    '',
    'Raw GraphQL:',
    '  shop graphql <query>              Execute raw GraphQL query or mutation',
    '  shop graphql @file.graphql        Execute query from file',
    '  --var <name>=<value>              Set a variable (repeatable)',
    '  --variables <json>                Variables as JSON (or @file.json)',
    '  --no-validate                     Skip local schema validation',
    '',
    'Schema introspection:',
    '  shop types <TypeName>             Explore input types and enums',
    '',
    'Examples:',
    '  shop products list --first 5 --format table',
    '  shop products create --set title="Hat" --set status="ACTIVE"',
    '  shop products add-tags --id 123 --tags "summer,featured"',
    '  shop publications resolve --publication "Online Store"',
    '  shop products publish --id 123 --publication "Online Store" --now',
    '  shop products metafields upsert --id 123 --set namespace=custom --set key=foo --set type=single_line_text_field --set value=bar',
  ].join('\n')
}

export const renderResourceHelp = (resource: string) => {
  const spec = findResource(resource)
  if (!spec) return undefined

  const verbs = spec.verbs.map((verb) => verb.verb).join('|')

  const lines: string[] = ['Usage:', `  shop ${spec.resource} <verb> [flags]`, '']
  if (spec.description) lines.push(spec.description, '')
  lines.push('Verbs:', `  ${verbs}`, '')

  if (spec.flags && spec.flags.length > 0) {
    lines.push(...formatSection('Flags:', formatFlags({ flags: spec.flags })))
    lines.push('')
  }

  if (spec.notes && spec.notes.length > 0) {
    lines.push('Notes:')
    for (const note of spec.notes) lines.push(`  ${note}`)
    lines.push('')
  }

  if (spec.examples && spec.examples.length > 0) {
    lines.push('Examples:')
    for (const example of spec.examples) lines.push(`  ${example}`)
    lines.push('')
  }

  // Don't show common output flags for resources that don't use them (e.g., graphql)
  if (spec.resource !== 'graphql') {
    const outputFlags = formatFlags({ flags: commonOutputFlags })
    lines.push(...formatSection('Common output flags:', outputFlags))
  }
  return lines.join('\n')
}

export const renderVerbHelp = (
  resourceName: string,
  verbName: string,
  options: VerbHelpOptions = {},
) => {
  const resource = findResource(resourceName)
  if (!resource) return undefined
  const spec = findVerb(resource, verbName)
  if (!spec) return undefined

  const lines: string[] = []
  if (spec.description) lines.push(spec.description, '')
  lines.push('Usage:')
  lines.push(`  shop ${resource.resource} ${spec.verb} [flags]`)
  lines.push('')

  const requiredFlags = spec.requiredFlags ?? []
  if (requiredFlags.length > 0) {
    lines.push(...formatSection('Required flags:', formatFlags({ flags: requiredFlags })))
    lines.push('')
  }

  if (spec.input && spec.input.mode === 'set') {
    const title = spec.input.required ? 'Input options (required):' : 'Input options:'
    lines.push(...formatSection(title, formatFlags({ flags: standardInputFlags })))
    lines.push('')
  }

  const inputFields = inputFieldsFor(spec)
  let referencedTypeNames: string[] = []

  if (inputFields && inputFields.length > 0) {
    const requiredFields = inputFields.filter((field) => field.required)
    const optionalFields = inputFields.filter((field) => !field.required)
    const ordered = [...requiredFields, ...optionalFields]
    const maxFields = options.showAllFields ? ordered.length : 15
    const shown = ordered.slice(0, maxFields)
    const fieldFlags = formatFieldFlags(shown)
    lines.push(...formatSection('Input fields (via --set):', formatFlags({ flags: fieldFlags })))
    const remaining = ordered.length - shown.length
    if (!options.showAllFields && remaining > 0) {
      lines.push(
        '',
        `Additional fields (${remaining} more):`,
        '  Run with --help-full or --help-all to see all fields.',
        '',
      )
    } else {
      lines.push('')
    }

    // Collect all referenced types (including nested, 2 levels deep)
    const visited = new Set<string>()
    const nestedTypes = collectNestedTypes(ordered, 2, visited)

    if (options.showAllFields) {
      // For --help-full: expand all referenced types at the end
      if (nestedTypes.size > 0) {
        lines.push(...renderTypeShapesSection(nestedTypes))
        lines.push('')
      }
    } else {
      // For regular --help: collect type names for footer (all nested types)
      referencedTypeNames = Array.from(nestedTypes.keys())
    }
  }

  const optionalFlags = spec.flags ?? []
  if (optionalFlags.length > 0) {
    lines.push(...formatSection('Flags:', formatFlags({ flags: optionalFlags })))
    lines.push('')
  }

  const outputFlags = formatOutputFlags(spec)
  if (outputFlags.length > 0) {
    lines.push(...formatSection('Output flags:', formatFlags({ flags: outputFlags })))
    lines.push('')
  }

  if (spec.notes && spec.notes.length > 0) {
    lines.push('Notes:')
    for (const note of spec.notes) lines.push(`  ${note}`)
    lines.push('')
  }

  if (spec.examples && spec.examples.length > 0) {
    lines.push('Examples:')
    for (const example of spec.examples) lines.push(`  ${example}`)
    lines.push('')
  }

  // For regular --help: add "Type details" footer if there are referenced types
  if (!options.showAllFields && referencedTypeNames.length > 0) {
    const footerLines = formatTypeDetailsFooter(referencedTypeNames)
    if (footerLines.length > 0) {
      lines.push(...footerLines)
      lines.push('')
    }
  }

  return lines.join('\n').trimEnd()
}
