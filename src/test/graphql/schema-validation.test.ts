import { describe, expect, it } from 'vitest'

import { readCommandManifest } from './manifest'
import { runCommandDryRun } from './runDryRun'
import { validateGraphQLOperation } from './validateGraphQL'
import { getCompleteVersions } from './versions'

const manifest = readCommandManifest()
const versions = getCompleteVersions()

// Group entries by resource
const byResource = new Map<string, typeof manifest.entries>()
for (const entry of manifest.entries) {
  if (!byResource.has(entry.resource)) byResource.set(entry.resource, [])
  byResource.get(entry.resource)!.push(entry)
}

// Cache dry-run results so we don't re-run for each version
const dryRunCache = new Map<string, Awaited<ReturnType<typeof runCommandDryRun>>>()

const getDryRunResult = async (entry: typeof manifest.entries[number]) => {
  const key = `${entry.resource}:${entry.verb}:${JSON.stringify(entry.argv)}`
  if (!dryRunCache.has(key)) {
    const result = await runCommandDryRun({
      resource: entry.resource,
      verb: entry.verb,
      argv: entry.argv,
    })
    dryRunCache.set(key, result)
  }
  return dryRunCache.get(key)!
}

describe('GraphQL schema validation (dry-run)', () => {
  for (const version of versions) {
    describe(`API version ${version}`, () => {
      for (const [resource, entries] of byResource.entries()) {
        describe(resource, () => {
          for (const entry of entries) {
            const label = entry.skipReason ? `${entry.verb} (skipped)` : entry.verb
            it(label, async () => {
              if (entry.skipReason) return

              const printed = await getDryRunResult(entry)

              expect(
                printed.length,
                `Expected at least one dry-run GraphQL payload, got none.\nargv: ${JSON.stringify(entry.argv)}`,
              ).toBeGreaterThan(0)

              for (const op of printed) {
                const validation = validateGraphQLOperation(op.query, op.variables, op.operationName, version)
                expect(
                  validation.valid,
                  `GraphQL validation failed for API version ${version}:\n${validation.errors.join('\n')}\n\nquery:\n${op.query}\n\nvariables:\n${JSON.stringify(op.variables ?? {}, null, 2)}`,
                ).toBe(true)
              }
            })
          }
        })
      }
    })
  }
})

