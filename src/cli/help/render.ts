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
    '  --api-version <YYYY-MM>             (default: 2026-04)',
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

  return lines.join('\n').trimEnd()
}
