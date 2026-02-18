import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { CliError } from '../src/cli/errors'
import { extractAllResourceVerbs } from '../src/test/graphql/extractVerbs'
import { tryRunCommandDryRun } from '../src/test/graphql/runDryRun'

type ManifestEntry = {
  resource: string
  verb: string
  argv: string[]
  skipReason?: string
}

type CommandManifest = {
  generatedAt: string
  schemaVersion: string
  entries: ManifestEntry[]
}

const here = dirname(fileURLToPath(import.meta.url))
const manifestPath = join(here, '../src/test/graphql/command-manifest.json')

const hasFlag = (argv: string[], flag: string) => argv.includes(flag)

const setFlagValue = (argv: string[], flag: string, value: string) => {
  const idx = argv.indexOf(flag)
  if (idx === -1) {
    argv.push(flag, value)
    return
  }
  const next = argv[idx + 1]
  if (!next || next.startsWith('-')) {
    argv.splice(idx + 1, 0, value)
    return
  }
  argv[idx + 1] = value
}

const addBoolFlag = (argv: string[], flag: string) => {
  if (!hasFlag(argv, flag)) argv.push(flag)
}

const addValueFlag = (argv: string[], flag: string, value: string) => {
  if (hasFlag(argv, flag)) return
  argv.push(flag, value)
}

const defaultValueForFlag = (flag: string) => {
  if (flag === '--yes') return undefined
  if (flag === '--reverse') return undefined
  if (flag === '--now') return undefined
  if (flag === '--notify-customer') return undefined
  if (flag.endsWith('-ids') || flag === '--ids' || flag === '--variant-ids') return '1,2'
  if (flag.endsWith('-id') || flag === '--id') return '1'
  if (flag.includes('url')) return 'https://example.com'
  if (flag.includes('file')) return 'src/test/fixtures/sample.txt'
  if (flag.includes('quantity') || flag.includes('amount') || flag.includes('days')) return '1'
  if (flag.includes('available') || flag.includes('delta') || flag.includes('limit')) return '1'
  if (flag.includes('status')) return 'ACTIVE'
  if (flag.includes('tags')) return 'tag1,tag2'
  if (flag.includes('media-type')) return 'IMAGE'
  if (flag.includes('content-type')) return 'image/jpeg'
  if (flag.includes('topic')) return 'APP_UNINSTALLED'
  if (flag.includes('reason')) return 'correction'
  if (flag.includes('operation')) return 'Op'
  if (flag.includes('currency')) return 'USD'
  return 'test'
}

const guessBaseArgs = ({ resource, verb }: { resource: string; verb: string }): string[] => {
  if (resource === 'graphql' && (verb === 'query' || verb === 'mutation')) {
    if (verb === 'query') return ['{ shop { name } }']
    return ['mutation { metafieldsSet(metafields: []) { userErrors { message } } }']
  }

  if (resource === 'segments' && verb === 'create') {
    return ['--input', JSON.stringify({ name: 'Test segment', query: "email_subscription_status = 'SUBSCRIBED'" })]
  }
  if (resource === 'segments' && verb === 'update') {
    return ['--id', '1', '--input', JSON.stringify({ name: 'Updated segment' })]
  }

  if (resource === 'companies' && verb === 'bulk-delete') {
    return ['--ids', '1,2', '--yes']
  }
  if (resource === 'companies' && verb === 'assign-main-contact') {
    return ['--id', '1', '--contact-id', '1']
  }
  if (resource === 'companies' && verb === 'assign-customer') {
    return ['--id', '1', '--customer-id', '1']
  }

  if (resource === 'company-contacts' && verb === 'create') {
    return ['--company-id', '1', '--input', '{}']
  }
  if (resource === 'company-contacts' && verb === 'assign-role') {
    return ['--id', '1', '--role-id', '1', '--location-id', '1']
  }
  if (resource === 'company-contacts' && verb === 'revoke-role') {
    return ['--id', '1', '--role-assignment-id', '1']
  }
  if (resource === 'company-contacts' && verb === 'bulk-delete') {
    return ['--ids', '1,2', '--yes']
  }

  if (resource === 'company-locations' && verb === 'create') {
    return ['--company-id', '1', '--input', '{}']
  }
  if (resource === 'company-locations' && verb === 'bulk-delete') {
    return ['--ids', '1,2', '--yes']
  }

  if (resource === 'files' && verb === 'upload') {
    return ['--file', 'src/test/fixtures/sample.txt']
  }

  if (resource === 'inventory' && verb === 'set') {
    return ['--location-id', '1', '--inventory-item-id', '1', '--available', '1']
  }
  if (resource === 'inventory' && verb === 'adjust') {
    return ['--location-id', '1', '--inventory-item-id', '1', '--delta', '1']
  }

  if (verb === 'list' || verb.startsWith('list-')) return []
  if (verb === 'count' || verb.endsWith('-count')) return []

  if (verb === 'get' || verb.startsWith('get-')) return ['--id', '1']

  if (verb === 'create') return ['--input', '{}']
  if (verb === 'update') return ['--id', '1', '--input', '{}']
  if (verb === 'delete') return ['--id', '1', '--yes']

  if (verb === 'duplicate') return ['--id', '1', '--new-title', 'Copy']

  return ['--id', '1']
}

const applyErrorFixes = ({
  entry,
  argv,
  err,
}: {
  entry: { resource: string; verb: string }
  argv: string[]
  err: CliError
}): { updated: boolean; skipReason?: string } => {
  const msg = err.message

  if (msg.includes('Refusing to delete without --yes')) {
    addBoolFlag(argv, '--yes')
    return { updated: true }
  }

  if (msg.includes('Refusing to bulk-delete without --yes')) {
    addBoolFlag(argv, '--yes')
    return { updated: true }
  }

  if (msg.includes('Missing --input or --set/--set-json')) {
    setFlagValue(argv, '--input', '{}')
    return { updated: true }
  }

  const missingOrRegex = /^Missing\s+(--[a-z0-9-]+)\s+or\s+(--[a-z0-9-]+)\b/i
  const missingSingleRegex = /^Missing\s+(--[a-z0-9-]+)\b/i
  const missingLabelRegex = /^Missing\s+(\-\-[^\s]+)\b/i

  const orMatch = msg.match(missingOrRegex)
  if (orMatch) {
    const flag = orMatch[1]!
    const value = defaultValueForFlag(flag)
    if (value === undefined) addBoolFlag(argv, flag)
    else addValueFlag(argv, flag, value)
    return { updated: true }
  }

  const singleMatch = msg.match(missingSingleRegex) ?? msg.match(missingLabelRegex)
  if (singleMatch) {
    const flag = singleMatch[1]!
    const value = defaultValueForFlag(flag)
    if (value === undefined) addBoolFlag(argv, flag)
    else addValueFlag(argv, flag, value)
    return { updated: true }
  }

  const jsonFlagMatch = msg.match(/(--[a-z0-9-]+)\s+must be valid JSON/i)
  if (jsonFlagMatch) {
    const flag = jsonFlagMatch[1]!
    setFlagValue(argv, flag, '{}')
    return { updated: true }
  }

  if (msg.includes('--variables must be a JSON object')) {
    setFlagValue(argv, '--variables', '{}')
    return { updated: true }
  }

  if (msg.includes('--input must be a JSON array')) {
    setFlagValue(argv, '--input', '[]')
    return { updated: true }
  }

  if (msg.includes('--tags must include at least one tag') || msg.includes('Missing --tags')) {
    setFlagValue(argv, '--tags', 'tag1')
    return { updated: true }
  }

  if (msg.includes('Missing --url')) {
    addValueFlag(argv, '--url', 'https://example.com/image.jpg')
    return { updated: true }
  }

  if (msg.includes('--media-type must be')) {
    setFlagValue(argv, '--media-type', 'IMAGE')
    return { updated: true }
  }

  if (msg.includes('In --dry-run mode') && msg.includes('pass --')) {
    const suggestion = msg.match(/pass\s+(--[a-z0-9-]+)/i)?.[1]
    if (suggestion) {
      const value = defaultValueForFlag(suggestion)
      if (value === undefined) addBoolFlag(argv, suggestion)
      else addValueFlag(argv, suggestion, value)
      return { updated: true }
    }
  }

  if (msg.includes('In --dry-run mode')) {
    return { updated: false, skipReason: `dry-run unsupported: ${msg}` }
  }

  if (msg.includes('Unknown resource:')) {
    return { updated: false, skipReason: msg }
  }

  if (msg.includes('Unknown verb')) {
    return { updated: false, skipReason: msg }
  }

  if (entry.resource === 'graphql' && msg.includes('Missing GraphQL query/mutation')) {
    // The base args should already cover this, but keep a safe fallback here.
    if (entry.verb === 'query') argv.unshift('{ shop { name } }')
    if (entry.verb === 'mutation') argv.unshift('mutation { metafieldsSet(metafields: []) { userErrors { message } } }')
    return { updated: true }
  }

  return { updated: false, skipReason: msg }
}

const resolveArgs = async ({ resource, verb }: { resource: string; verb: string }) => {
  const argv = guessBaseArgs({ resource, verb })

  for (let attempt = 0; attempt < 10; attempt++) {
    const { printed, error } = await tryRunCommandDryRun({ resource, verb, argv })
    if (!error) {
      if (printed.length === 0) {
        return { argv, skipReason: 'no dry-run GraphQL output' }
      }
      return { argv, skipReason: undefined }
    }

    const errorMessage =
      error && typeof error === 'object' && 'message' in error ? String((error as any).message) : String(error)

    const isSchemaMismatch =
      errorMessage.includes('does not have a field') ||
      errorMessage.includes('no typing defined for argument') ||
      errorMessage.includes('Expected type') ||
      errorMessage.includes('Cannot query field')

    // If code generation fails because the selections/args don't match the schema,
    // do not skip: emit a manifest entry so `test:graphql` surfaces the failure.
    if (isSchemaMismatch) {
      return { argv, skipReason: undefined }
    }

    if (!(error instanceof CliError)) {
      return { argv, skipReason: `unhandled error: ${(error as Error).message}` }
    }

    const fix = applyErrorFixes({ entry: { resource, verb }, argv, err: error })
    if (fix.skipReason) return { argv, skipReason: fix.skipReason }
    if (!fix.updated) return { argv, skipReason: `could not auto-fix: ${error.message}` }
  }

  return { argv, skipReason: 'exceeded retry budget while auto-generating args' }
}

const main = async () => {
  const extracted = extractAllResourceVerbs()
  const entries: ManifestEntry[] = []

  for (const { resource, verb } of extracted) {
    const { argv, skipReason } = await resolveArgs({ resource, verb })
    entries.push({ resource, verb, argv, ...(skipReason ? { skipReason } : {}) })
  }

  const manifest: CommandManifest = {
    generatedAt: new Date().toISOString(),
    schemaVersion: '2026-04',
    entries,
  }

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
  // eslint-disable-next-line no-console
  console.log(`Wrote ${entries.length} entries to ${manifestPath}`)
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})
