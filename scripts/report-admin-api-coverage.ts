import { readFileSync, writeFileSync } from 'node:fs'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildClientSchema, parse, type DocumentNode, type IntrospectionQuery } from 'graphql'

import { readCommandManifest } from '../src/test/graphql/manifest'
import { tryRunCommandDryRun } from '../src/test/graphql/runDryRun'

type RootOperationType = 'query' | 'mutation'

type UsedRootField = {
  operationType: RootOperationType
  field: string
  operationName?: string
  resource: string
  verb: string
}

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

const schemaVersion = '2026-04'
const schemaPath = join(root, 'schema', `${schemaVersion}.introspection.json`)

const getRootFieldNames = (schema: ReturnType<typeof buildClientSchema>) => {
  const queryFields = new Set(schema.getQueryType()?.getFields ? Object.keys(schema.getQueryType()!.getFields()) : [])
  const mutationFields = new Set(
    schema.getMutationType()?.getFields ? Object.keys(schema.getMutationType()!.getFields()) : [],
  )
  return { queryFields, mutationFields }
}

const extractRootFieldNamesFromDocument = (
  doc: DocumentNode,
): Array<{ operationType: RootOperationType; fields: string[]; operationName?: string }> => {
  const out: Array<{ operationType: RootOperationType; fields: string[]; operationName?: string }> = []

  for (const def of doc.definitions) {
    if (def.kind !== 'OperationDefinition') continue
    if (def.operation !== 'query' && def.operation !== 'mutation') continue

    const fields: string[] = []
    for (const sel of def.selectionSet.selections) {
      if (sel.kind !== 'Field') continue
      fields.push(sel.name.value)
    }
    out.push({
      operationType: def.operation,
      fields,
      operationName: def.name?.value,
    })
  }

  return out
}

const camelPrefix = (name: string): string => {
  // Take the leading "word" from a camelCase / PascalCase identifier.
  // Examples:
  // - productUpdate -> product
  // - URLRedirectCreate -> url
  // - shop -> shop
  const trimmed = name.trim()
  if (!trimmed) return 'unknown'
  const first = trimmed[0]!.toLowerCase() + trimmed.slice(1)
  const m = first.match(/^[a-z0-9]+/)
  return (m?.[0] ?? 'unknown').toLowerCase()
}

const main = async () => {
  const introspection = JSON.parse(readFileSync(schemaPath, 'utf8')) as IntrospectionQuery
  const schema = buildClientSchema(introspection)
  const { queryFields, mutationFields } = getRootFieldNames(schema)

  const manifest = readCommandManifest()
  if (manifest.schemaVersion !== schemaVersion) {
    throw new Error(`command-manifest.json schemaVersion=${manifest.schemaVersion} does not match ${schemaVersion}`)
  }

  const used: UsedRootField[] = []
  const errors: Array<{ resource: string; verb: string; argv: string[]; error: string }> = []

  for (const entry of manifest.entries) {
    if (entry.skipReason) continue

    const { printed, error } = await tryRunCommandDryRun({
      resource: entry.resource,
      verb: entry.verb,
      argv: entry.argv,
      view: 'summary',
    })

    if (error) {
      errors.push({
        resource: entry.resource,
        verb: entry.verb,
        argv: entry.argv,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    for (const op of printed) {
      const doc = parse(op.query)
      for (const extracted of extractRootFieldNamesFromDocument(doc)) {
        for (const field of extracted.fields) {
          used.push({
            operationType: extracted.operationType,
            field,
            operationName: extracted.operationName ?? op.operationName,
            resource: entry.resource,
            verb: entry.verb,
          })
        }
      }
    }
  }

  const usedQueryFields = new Set(used.filter((u) => u.operationType === 'query').map((u) => u.field))
  const usedMutationFields = new Set(used.filter((u) => u.operationType === 'mutation').map((u) => u.field))

  const missingQueries = [...queryFields].filter((f) => !usedQueryFields.has(f)).sort((a, b) => a.localeCompare(b))
  const missingMutations = [...mutationFields]
    .filter((f) => !usedMutationFields.has(f))
    .sort((a, b) => a.localeCompare(b))

  const groupByPrefix = (fields: string[]) => {
    const groups = new Map<string, string[]>()
    for (const field of fields) {
      const key = camelPrefix(field)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(field)
    }
    const sorted = [...groups.entries()]
      .map(([prefix, ops]) => ({ prefix, ops: ops.sort((a, b) => a.localeCompare(b)) }))
      .sort((a, b) => b.ops.length - a.ops.length || a.prefix.localeCompare(b.prefix))
    return sorted
  }

  const report = {
    schemaVersion,
    totals: {
      queryFields: queryFields.size,
      mutationFields: mutationFields.size,
      usedQueryFields: usedQueryFields.size,
      usedMutationFields: usedMutationFields.size,
      missingQueryFields: missingQueries.length,
      missingMutationFields: missingMutations.length,
    },
    missing: {
      queries: missingQueries,
      mutations: missingMutations,
      grouped: {
        queries: groupByPrefix(missingQueries),
        mutations: groupByPrefix(missingMutations),
      },
    },
    used: {
      grouped: {
        queries: groupByPrefix([...usedQueryFields]),
        mutations: groupByPrefix([...usedMutationFields]),
      },
    },
    errors,
  }

  const reportsDir = join(root, 'reports')
  mkdirSync(reportsDir, { recursive: true })

  const jsonPath = join(reportsDir, `admin-api-coverage-${schemaVersion}.json`)
  writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n', 'utf8')

  const mdLines: string[] = []
  mdLines.push(`# Admin API coverage report (${schemaVersion})`)
  mdLines.push(``)
  mdLines.push(`Root field coverage (Query + Mutation) based on CLI --dry-run GraphQL payloads.`)
  mdLines.push(``)
  mdLines.push(`## Totals`)
  mdLines.push(``)
  mdLines.push(`- Query fields: ${report.totals.queryFields}`)
  mdLines.push(`- Mutation fields: ${report.totals.mutationFields}`)
  mdLines.push(`- Used Query fields: ${report.totals.usedQueryFields}`)
  mdLines.push(`- Used Mutation fields: ${report.totals.usedMutationFields}`)
  mdLines.push(`- Missing Query fields: ${report.totals.missingQueryFields}`)
  mdLines.push(`- Missing Mutation fields: ${report.totals.missingMutationFields}`)
  mdLines.push(``)
  mdLines.push(`## Missing (grouped by prefix)`)
  mdLines.push(``)
  mdLines.push(`### Queries`)
  mdLines.push(``)
  for (const g of report.missing.grouped.queries.slice(0, 80)) {
    mdLines.push(`- \`${g.prefix}\` (${g.ops.length})`)
  }
  if (report.missing.grouped.queries.length > 80) {
    mdLines.push(`- … (${report.missing.grouped.queries.length - 80} more groups)`)
  }
  mdLines.push(``)
  mdLines.push(`### Mutations`)
  mdLines.push(``)
  for (const g of report.missing.grouped.mutations.slice(0, 80)) {
    mdLines.push(`- \`${g.prefix}\` (${g.ops.length})`)
  }
  if (report.missing.grouped.mutations.length > 80) {
    mdLines.push(`- … (${report.missing.grouped.mutations.length - 80} more groups)`)
  }
  mdLines.push(``)
  mdLines.push(`## Notes`)
  mdLines.push(``)
  mdLines.push(`- Full missing field lists are in the JSON report.`)
  mdLines.push(`- Grouping is heuristic: the prefix is the leading camelCase word of the root field name.`)
  mdLines.push(``)
  mdLines.push(`## Dry-run errors`)
  mdLines.push(``)
  mdLines.push(`Commands that threw during --dry-run (still captured any printed GraphQL payloads): ${errors.length}`)
  mdLines.push(``)

  const mdPath = join(reportsDir, `admin-api-coverage-${schemaVersion}.md`)
  writeFileSync(mdPath, mdLines.join('\n') + '\n', 'utf8')

  // eslint-disable-next-line no-console
  console.log(`Wrote:\n- ${jsonPath}\n- ${mdPath}`)
  // eslint-disable-next-line no-console
  console.log(
    `Totals: query ${usedQueryFields.size}/${queryFields.size}, mutation ${usedMutationFields.size}/${mutationFields.size}`,
  )
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exitCode = 1
})

