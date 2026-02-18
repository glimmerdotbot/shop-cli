import { parse, validate, type DocumentNode } from 'graphql'

import { getAdminSchema } from './schema'

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export interface ValidationOptions {
  variables?: Record<string, unknown>
  operationName?: string
  apiVersion?: string
}

const getOperationDefinition = (doc: DocumentNode, operationName?: string) => {
  const ops = doc.definitions.filter((d) => d.kind === 'OperationDefinition')
  if (ops.length === 0) return undefined
  if (!operationName) return ops[0]

  for (const d of ops) {
    const name = (d as any).name?.value
    if (name === operationName) return d
  }
  return undefined
}

export function validateGraphQLOperation(
  query: string,
  variables?: Record<string, unknown>,
  operationName?: string,
  apiVersion?: string,
): ValidationResult {
  const errors: string[] = []
  const schema = getAdminSchema(apiVersion)

  let document: DocumentNode
  try {
    document = parse(query)
  } catch (e) {
    return { valid: false, errors: [`Parse error: ${(e as Error).message}`] }
  }

  const validationErrors = validate(schema, document)
  if (validationErrors.length > 0) {
    errors.push(...validationErrors.map((e) => e.message))
  }

  if (variables && Object.keys(variables).length > 0) {
    const op = getOperationDefinition(document, operationName)
    const varDefs = (op as any)?.variableDefinitions ?? []

    for (const varDef of varDefs) {
      const varName = varDef.variable.name.value as string
      const isNonNull = varDef.type.kind === 'NonNullType'
      const varValue = variables[varName]

      if (isNonNull && (varValue === undefined || varValue === null)) {
        errors.push(`Missing required variable: $${varName}`)
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

