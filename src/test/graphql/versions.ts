import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const schemaDir = join(here, '../../../schema')

/**
 * Pattern for valid Shopify API version format: YYYY-MM
 */
const VERSION_PATTERN = /^(\d{4}-\d{2})\.graphql$/

/**
 * Get all available API versions from the schema directory.
 * Returns versions sorted in descending order (newest first).
 */
export const getAvailableVersions = (): string[] => {
  const files = readdirSync(schemaDir)
  const versions: string[] = []

  for (const file of files) {
    const match = file.match(VERSION_PATTERN)
    if (match) {
      versions.push(match[1])
    }
  }

  // Sort descending (newest first)
  return versions.sort((a, b) => b.localeCompare(a))
}

/**
 * Check if a version has both .graphql and .introspection.json files.
 */
export const isVersionComplete = (version: string): boolean => {
  const files = readdirSync(schemaDir)
  const hasGraphql = files.includes(`${version}.graphql`)
  const hasIntrospection = files.includes(`${version}.introspection.json`)
  return hasGraphql && hasIntrospection
}

/**
 * Get all complete versions (having both schema files).
 */
export const getCompleteVersions = (): string[] => {
  return getAvailableVersions().filter(isVersionComplete)
}
