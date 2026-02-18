import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildSchema, type GraphQLSchema } from 'graphql'

const here = dirname(fileURLToPath(import.meta.url))
const schemaDir = join(here, '../../../schema')

const schemaCache = new Map<string, GraphQLSchema>()

/**
 * Get the Admin GraphQL schema for a specific API version.
 * Schemas are cached for performance.
 */
export const getAdminSchema = (version?: string): GraphQLSchema => {
  const targetVersion = version ?? '2026-04'

  const cached = schemaCache.get(targetVersion)
  if (cached) return cached

  const schemaPath = join(schemaDir, `${targetVersion}.graphql`)
  const schemaSource = readFileSync(schemaPath, 'utf8')
  const schema = buildSchema(schemaSource)
  schemaCache.set(targetVersion, schema)
  return schema
}

