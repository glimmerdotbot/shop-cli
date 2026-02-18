import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  parse,
  validate,
  buildClientSchema,
  type GraphQLSchema,
  type GraphQLError,
  type IntrospectionQuery,
} from 'graphql'

// Lazy-loaded schema cache
let cachedSchema: GraphQLSchema | null = null

/**
 * Get the path to the introspection JSON file for a given API version.
 */
const getIntrospectionPath = (apiVersion: string): string => {
  // __dirname equivalent for ESM
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)
  // From src/ go up to root, then into schema/
  return join(__dirname, '..', 'schema', `${apiVersion}.introspection.json`)
}

/**
 * Load and cache the GraphQL schema from the introspection JSON file.
 * Returns null if the schema file doesn't exist (validation will be skipped).
 */
const loadSchema = (apiVersion: string): GraphQLSchema | null => {
  if (cachedSchema) return cachedSchema

  const introspectionPath = getIntrospectionPath(apiVersion)

  try {
    const introspectionJson = readFileSync(introspectionPath, 'utf8')
    const introspection = JSON.parse(introspectionJson) as IntrospectionQuery
    cachedSchema = buildClientSchema(introspection)
    return cachedSchema
  } catch (err) {
    // Schema file doesn't exist - validation will be skipped
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw err
  }
}

export interface ValidationResult {
  valid: boolean
  errors: readonly GraphQLError[]
}

/**
 * Validate a GraphQL query/mutation against the Shopify Admin schema.
 *
 * @param query - The GraphQL query or mutation string
 * @param apiVersion - The API version (e.g., "2026-04")
 * @returns Validation result with any errors found
 */
export const validateGraphQL = (
  query: string,
  apiVersion: string,
): ValidationResult => {
  const schema = loadSchema(apiVersion)

  // If schema isn't available, skip validation
  if (!schema) {
    return { valid: true, errors: [] }
  }

  // Parse the query
  let documentAST
  try {
    documentAST = parse(query)
  } catch (err) {
    // Parse errors are GraphQL errors
    return {
      valid: false,
      errors: [err as GraphQLError],
    }
  }

  // Validate against the schema
  const errors = validate(schema, documentAST)

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Format validation errors for CLI output.
 */
export const formatValidationErrors = (errors: readonly GraphQLError[]): string => {
  return errors
    .map((error, index) => {
      const location = error.locations?.[0]
      const locationStr = location ? ` (line ${location.line}, col ${location.column})` : ''
      const prefix = errors.length > 1 ? `${index + 1}. ` : ''
      return `${prefix}${error.message}${locationStr}`
    })
    .join('\n')
}
