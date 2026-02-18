import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { Kind, parse, type TypeNode } from 'graphql'

type InputFieldHelp = {
  name: string
  type: string
  description?: string
  required: boolean
  typeName: string
  isList: boolean
}

type EnumValueHelp = {
  name: string
  description?: string
  deprecated: boolean
  deprecationReason?: string
}

type OperationArgHelp = {
  name: string
  type: string
  description?: string
  required: boolean
  typeName: string
  isList: boolean
}

type OperationHelp = {
  description?: string
  args: OperationArgHelp[]
}

const repoRoot = path.resolve(__dirname, '..')
const schemaPath = path.join(repoRoot, 'schema', '2026-04.graphql')
const outputPath = path.join(repoRoot, 'src', 'generated', 'help', 'schema-help.ts')

const typeToString = (type: TypeNode): string => {
  if (type.kind === Kind.NON_NULL_TYPE) return `${typeToString(type.type)}!`
  if (type.kind === Kind.LIST_TYPE) return `[${typeToString(type.type)}]`
  return type.name.value
}

const unwrapType = (type: TypeNode) => {
  let isList = false
  let current = type
  if (current.kind === Kind.NON_NULL_TYPE) current = current.type
  if (current.kind === Kind.LIST_TYPE) {
    isList = true
    current = current.type
    if (current.kind === Kind.NON_NULL_TYPE) current = current.type
  }
  const typeName = current.kind === Kind.NAMED_TYPE ? current.name.value : 'Unknown'
  return { typeName, isList }
}

const normalizeDescription = (value?: string | null) => {
  if (!value) return undefined
  const trimmed = value.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

const escapeUnicode = (value: string) =>
  value.replace(/[^\x00-\x7F]/g, (char) => {
    const code = char.codePointAt(0)
    if (code === undefined) return char
    if (code <= 0xffff) return `\\u${code.toString(16).padStart(4, '0')}`
    const adjusted = code - 0x10000
    const high = 0xd800 + (adjusted >> 10)
    const low = 0xdc00 + (adjusted & 0x3ff)
    return `\\u${high.toString(16).padStart(4, '0')}\\u${low.toString(16).padStart(4, '0')}`
  })

const stableRecord = <T,>(input: Record<string, T>) => {
  const entries = Object.entries(input).sort(([a], [b]) => a.localeCompare(b))
  return Object.fromEntries(entries)
}

const schema = readFileSync(schemaPath, 'utf8')
const ast = parse(schema, { noLocation: true })

const inputTypeHelp: Record<string, InputFieldHelp[]> = {}
const enumTypeHelp: Record<string, EnumValueHelp[]> = {}
const mutationHelp: Record<string, OperationHelp> = {}
const queryHelp: Record<string, OperationHelp> = {}

for (const definition of ast.definitions) {
  if (definition.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION) {
    const fields = definition.fields ?? []
    inputTypeHelp[definition.name.value] = fields.map((field) => {
      const { typeName, isList } = unwrapType(field.type)
      return {
        name: field.name.value,
        type: typeToString(field.type),
        description: normalizeDescription(field.description?.value),
        required: field.type.kind === Kind.NON_NULL_TYPE,
        typeName,
        isList,
      }
    })
    continue
  }

  if (definition.kind === Kind.ENUM_TYPE_DEFINITION) {
    const values = definition.values ?? []
    enumTypeHelp[definition.name.value] = values.map((value) => ({
      name: value.name.value,
      description: normalizeDescription(value.description?.value),
      deprecated: Boolean(value.directives?.some((dir) => dir.name.value === 'deprecated')),
      deprecationReason: normalizeDescription(
        value.directives
          ?.find((dir) => dir.name.value === 'deprecated')
          ?.arguments?.find((arg) => arg.name.value === 'reason')
          ?.value?.kind === Kind.STRING
          ? (value.directives
              ?.find((dir) => dir.name.value === 'deprecated')
              ?.arguments?.find((arg) => arg.name.value === 'reason')?.value.value ?? undefined)
          : undefined,
      ),
    }))
    continue
  }

  if (
    definition.kind === Kind.OBJECT_TYPE_DEFINITION ||
    definition.kind === Kind.OBJECT_TYPE_EXTENSION
  ) {
    const name = definition.name.value
    const isMutation = name === 'Mutation' || name === 'MutationRoot'
    const isQuery = name === 'Query' || name === 'QueryRoot'
    if (!isMutation && !isQuery) continue
    const target = isMutation ? mutationHelp : queryHelp
    for (const field of definition.fields ?? []) {
      const args = field.arguments ?? []
      target[field.name.value] = {
        description: normalizeDescription(field.description?.value),
        args: args.map((arg) => {
          const { typeName, isList } = unwrapType(arg.type)
          return {
            name: arg.name.value,
            type: typeToString(arg.type),
            description: normalizeDescription(arg.description?.value),
            required: arg.type.kind === Kind.NON_NULL_TYPE,
            typeName,
            isList,
          }
        }),
      }
    }
  }
}

const output = [
  '// This file is generated by scripts/extract-schema-help.ts.',
  '// Do not edit by hand.',
  '',
  'export type InputFieldHelp = {',
  '  name: string',
  '  type: string',
  '  description?: string',
  '  required: boolean',
  '  typeName: string',
  '  isList: boolean',
  '}',
  '',
  'export type EnumValueHelp = {',
  '  name: string',
  '  description?: string',
  '  deprecated: boolean',
  '  deprecationReason?: string',
  '}',
  '',
  'export type OperationArgHelp = {',
  '  name: string',
  '  type: string',
  '  description?: string',
  '  required: boolean',
  '  typeName: string',
  '  isList: boolean',
  '}',
  '',
  'export type OperationHelp = {',
  '  description?: string',
  '  args: OperationArgHelp[]',
  '}',
  '',
  `export const inputTypeHelp = ${escapeUnicode(JSON.stringify(stableRecord(inputTypeHelp), null, 2))} as Record<string, InputFieldHelp[]>`,
  '',
  `export const enumTypeHelp = ${escapeUnicode(JSON.stringify(stableRecord(enumTypeHelp), null, 2))} as Record<string, EnumValueHelp[]>`,
  '',
  `export const mutationHelp = ${escapeUnicode(JSON.stringify(stableRecord(mutationHelp), null, 2))} as Record<string, OperationHelp>`,
  '',
  `export const queryHelp = ${escapeUnicode(JSON.stringify(stableRecord(queryHelp), null, 2))} as Record<string, OperationHelp>`,
  '',
].join('\n')

mkdirSync(path.dirname(outputPath), { recursive: true })
writeFileSync(outputPath, output, 'utf8')
