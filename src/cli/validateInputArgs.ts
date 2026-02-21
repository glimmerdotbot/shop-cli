import { CliError } from './errors'
import { resolveCliCommand } from './command'
import { inputTypeHelp } from '../generated/help/schema-help'
import { getType } from './introspection'
import { findSuggestions } from './suggest'

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const formatCliPlaceholder = (field: { typeName: string; isList: boolean }) => {
  const base = `${field.typeName}${field.isList ? '[]' : ''}`
  return `<${base}>`
}

const validateInputObject = ({
  inputTypeName,
  value,
  at,
  setPath,
}: {
  inputTypeName: string
  value: unknown
  at: string
  setPath: string
}) => {
  if (value === null || value === undefined) return

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const nextSetPath = setPath ? `${setPath}.${i}` : String(i)
      validateInputObject({ inputTypeName, value: value[i], at: `${at}[${i}]`, setPath: nextSetPath })
    }
    return
  }

  if (!isPlainObject(value)) return

  const fields = inputTypeHelp[inputTypeName]
  if (!fields) return

  const allowed = new Map(fields.map((f) => [f.name, f]))

  for (const [key, child] of Object.entries(value)) {
    const field = allowed.get(key)
    if (!field) {
      const fullSetPath = setPath ? `${setPath}.${key}` : key
      const suggestions = findSuggestions({
        query: key,
        candidates: Array.from(allowed.keys()),
        limit: 5,
        mode: 'field',
      })

      const lines = [
        `Unknown input field "${key}" on ${inputTypeName}${setPath ? ` (in --set ${fullSetPath})` : ''}`,
      ]

      if (suggestions.length > 0) {
        lines.push('')
        lines.push('Did you mean:')
        for (const s of suggestions) {
          const suggestionField = allowed.get(s)
          if (!suggestionField) continue
          const suggestionPath = setPath ? `${setPath}.${s}` : s
          lines.push(`  --set ${suggestionPath}=${formatCliPlaceholder(suggestionField)}`)
        }
      }

      lines.push('')
      lines.push('For valid fields see:')
      lines.push(`  ${resolveCliCommand()} types ${inputTypeName}`)
      throw new CliError(lines.join('\n'), 2)
    }

    const nestedTypeName = field.typeName
    if (nestedTypeName && inputTypeHelp[nestedTypeName]) {
      const nextSetPath = setPath ? `${setPath}.${key}` : key
      validateInputObject({ inputTypeName: nestedTypeName, value: child, at: `${at}.${key}`, setPath: nextSetPath })
    }
  }
}

export const validateRequestInputArgs = (rootTypeName: 'Query' | 'Mutation', request: any) => {
  if (!isPlainObject(request)) return

  const root = getType(rootTypeName)
  if (!root?.fields) return

  for (const [opName, selection] of Object.entries(request)) {
    if (!isPlainObject(selection)) continue
    const field: any = root.fields[opName]
    if (!field) continue

    const args = (selection as any).__args
    if (!isPlainObject(args)) continue

    const argDefs: any = field.args ?? {}
    for (const [argName, argValue] of Object.entries(args)) {
      if (argValue === undefined) continue

      const argDef: any = argDefs[argName]
      if (!argDef) {
        const candidates = Object.keys(argDefs)
        const suggestions = findSuggestions({
          query: argName,
          candidates,
          limit: 5,
          mode: 'field',
        })
        const lines = [`Unknown argument "${argName}" for ${rootTypeName}.${opName}.`]
        if (suggestions.length > 0) {
          lines.push('')
          lines.push('Did you mean?')
          for (const s of suggestions) lines.push(`  ${s}`)
        }
        throw new CliError(lines.join('\n'), 2)
      }

      const typeName = argDef[0]?.name
      if (!typeName) continue
      if (!inputTypeHelp[typeName]) continue

      validateInputObject({ inputTypeName: typeName, value: argValue, at: `${opName}.__args.${argName}`, setPath: '' })
    }
  }
}
