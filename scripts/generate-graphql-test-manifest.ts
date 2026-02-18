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
  if (flag === '--all') return undefined
  if (flag === '--enabled') return undefined
  if (flag === '--wait') return undefined
  if (flag === '--quiet') return undefined
  if (flag === '--cycle-index') return '1'
  if (flag === '--cycle-indexes') return '1,2'
  if (flag === '--credit-amount') return '1.00,USD'
  if (flag === '--debit-amount') return '1.00,USD'
  if (flag === '--country-code') return 'US'
  if (flag === '--country-codes') return 'US'
  if (flag === '--resource-type') return 'METAOBJECT'
  if (flag === '--line-item') return '1:1'
  if (flag === '--disposition') return '1:1:NOT_RESTOCKED'
  if (flag === '--facts') return '[{"sentiment":"NEUTRAL","description":"test"}]'
  if (flag === '--items') return '[]'
  if (flag === '--line-items') return '[]'
  if (flag === '--set-quantities') return '[{"inventoryItemId":"1","locationId":"1","quantity":1}]'
  if (flag === '--updates') return '[{"locationId":"1","activate":true}]'
  if (flag === '--activate') return 'true'
  if (flag.endsWith('-ids') || flag === '--ids' || flag === '--variant-ids') return '1,2'
  if (flag.endsWith('-id') || flag === '--id') return '1'
  if (flag.includes('url')) return 'https://example.com'
  if (flag.includes('file')) return 'src/test/fixtures/sample.txt'
  if (flag.includes('quantity') || flag.includes('amount') || flag.includes('days')) return '1'
  if (flag.includes('available') || flag.includes('delta') || flag.includes('limit')) return '1'
  if (flag.includes('active')) return 'true'
  if (flag.includes('final-capture')) return 'true'
  if (flag.includes('risk-level')) return 'NONE'
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
  // Add verb-specific args so --dry-run covers more root fields without changing CLI behavior.
  // Keep these narrowly scoped to commands that otherwise need non-standard flags / JSON inputs.
  if (resource === 'checkout-branding' && verb === 'get') return ['--profile-id', '1']
  if (resource === 'checkout-branding' && verb === 'upsert') return ['--profile-id', '1', '--input', '{}']

  if (resource === 'products') {
    if (verb === 'create-media' || verb === 'update-media') {
      return ['--product-id', '1', '--media', '[]']
    }
    if (verb === 'delete-media') {
      return ['--product-id', '1', '--media-ids', 'gid://shopify/MediaImage/1,gid://shopify/MediaImage/2']
    }
    if (verb === 'join-selling-plan-groups' || verb === 'leave-selling-plan-groups') {
      return ['--id', '1', '--group-ids', '1,2']
    }
    if (verb === 'option-update') {
      return ['--product-id', '1', '--option', '{}']
    }
    if (verb === 'options-create') {
      return ['--product-id', '1', '--options', '[]']
    }
    if (verb === 'options-delete') {
      return ['--product-id', '1', '--option-ids', '1,2']
    }
    if (verb === 'options-reorder') {
      return ['--product-id', '1', '--options', '[]']
    }
    if (verb === 'combined-listing-update') {
      return ['--parent-product-id', '1']
    }
    if (verb === 'reorder-media') {
      return ['--id', '1', '--moves', '[{\"id\":\"gid://shopify/MediaImage/1\",\"newPosition\":0}]']
    }
  }

  if (resource === 'catalogs' && verb === 'context-update') {
    return ['--catalog-id', '1', '--contexts-to-add', '[]']
  }

  if (resource === 'collections' && verb === 'reorder-products') {
    return ['--id', '1', '--moves', '[{\"id\":\"1\",\"newPosition\":0}]']
  }

  if (resource === 'product-variants') {
    if (verb === 'get-by-identifier' || verb === 'by-identifier') {
      return ['--product-id', '1', '--sku', 'test']
    }
    if (verb === 'bulk-create' || verb === 'bulk-update') {
      return ['--product-id', '1', '--input', '[]']
    }
    if (verb === 'bulk-delete') {
      return ['--product-id', '1', '--variant-ids', '1,2']
    }
    if (verb === 'bulk-reorder') {
      return ['--product-id', '1', '--positions', '[{\"id\":\"gid://shopify/ProductVariant/1\",\"newPosition\":0}]']
    }
    if (verb === 'append-media' || verb === 'detach-media') {
      return ['--id', '1', '--product-id', '1', '--media-ids', 'gid://shopify/MediaImage/1']
    }
    if (verb === 'join-selling-plans' || verb === 'leave-selling-plans') {
      return ['--id', '1', '--group-ids', '1,2']
    }
  }

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

  if (/Refusing to .* without --yes/i.test(msg)) {
    addBoolFlag(argv, '--yes')
    return { updated: true }
  }

  if (
    msg.includes('Missing --ids') &&
    ((entry.resource === 'price-lists' && (entry.verb === 'delete-prices' || entry.verb === 'delete-quantity-rules')) ||
      (entry.resource === 'selling-plan-groups' && (entry.verb === 'add-variants' || entry.verb === 'remove-variants')))
  ) {
    addValueFlag(argv, '--variant-ids', '1,2')
    return { updated: true }
  }

  if (entry.resource === 'checkout-branding' && msg.startsWith('Missing --id')) {
    addValueFlag(argv, '--profile-id', '1')
    return { updated: true }
  }

  if (msg.includes('Missing tracking info (use --tracking-company/--tracking-number/--tracking-url)')) {
    setFlagValue(argv, '--tracking-number', '1')
    return { updated: true }
  }

  if (msg.includes('Missing --input or --set/--set-json')) {
    setFlagValue(argv, '--input', '{}')
    return { updated: true }
  }

  if (msg.includes('--ready must be true|false')) {
    setFlagValue(argv, '--ready', 'true')
    return { updated: true }
  }

  if (msg.includes('Missing paymentTermsTemplateId') && msg.includes('--template-id')) {
    addValueFlag(argv, '--template-id', '1')
    return { updated: true }
  }

  if (msg.includes('Nothing to update (expected paymentTermsTemplateId and/or paymentSchedules)')) {
    addValueFlag(argv, '--template-id', '1')
    return { updated: true }
  }

  if (msg.includes('Expected prices array via --input or --set prices[0].*')) {
    setFlagValue(
      argv,
      '--input',
      '{"prices":[{"variantId":"gid://shopify/ProductVariant/1","price":{"amount":"1.00","currencyCode":"USD"}}]}',
    )
    return { updated: true }
  }

  if (msg.includes('Expected pricesToAdd and/or variantIdsToDelete')) {
    setFlagValue(
      argv,
      '--input',
      '{"pricesToAdd":[{"variantId":"gid://shopify/ProductVariant/1","price":{"amount":"1.00","currencyCode":"USD"}}]}',
    )
    return { updated: true }
  }

  if (msg.includes('Expected pricesToAdd and/or pricesToDeleteByProductIds')) {
    setFlagValue(
      argv,
      '--input',
      '{"pricesToAdd":[{"productId":"gid://shopify/Product/1","price":{"amount":"1.00","currencyCode":"USD"}}]}',
    )
    return { updated: true }
  }

  if (msg.includes('Expected quantityRules array via --input or --set quantityRules[0].*')) {
    setFlagValue(
      argv,
      '--input',
      '{"quantityRules":[{"variantId":"gid://shopify/ProductVariant/1","minimum":1,"maximum":10,"increment":1}]}',
    )
    return { updated: true }
  }

  if (msg.includes('Missing concatenatedBillingCycleContracts array')) {
    setFlagValue(
      argv,
      '--input',
      '{"concatenatedBillingCycleContracts":[{"contractId":"gid://shopify/SubscriptionContract/1","selector":{"index":1}}]}',
    )
    return { updated: true }
  }

  if (msg.includes('Missing marketLocalizations array')) {
    setFlagValue(
      argv,
      '--input',
      '[{"key":"title","value":"test","marketId":"gid://shopify/Market/1","marketLocalizableContentDigest":"digest"}]',
    )
    return { updated: true }
  }

  if (msg.includes('Missing defaultLocale (use --set defaultLocale=en)')) {
    setFlagValue(argv, '--input', '{"defaultLocale":"en"}')
    return { updated: true }
  }

  if (msg.includes('Missing pickupTime in --input/--set')) {
    argv.push('--set', 'pickupTime=test')
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
    else setFlagValue(argv, flag, value)
    return { updated: true }
  }

  const singleMatch = msg.match(missingSingleRegex) ?? msg.match(missingLabelRegex)
  if (singleMatch) {
    const flag = singleMatch[1]!
    const value = defaultValueForFlag(flag)
    if (value === undefined) addBoolFlag(argv, flag)
    else setFlagValue(argv, flag, value)
    return { updated: true }
  }

  const jsonFlagMatch = msg.match(/(--[a-z0-9-]+)\s+must be valid JSON/i)
  if (jsonFlagMatch) {
    const flag = jsonFlagMatch[1]!
    setFlagValue(argv, flag, '{}')
    return { updated: true }
  }

  const jsonArrayMatch = msg.match(/(--[a-z0-9-]+)\s+must be a JSON array/i)
  if (jsonArrayMatch) {
    const flag = jsonArrayMatch[1]!
    setFlagValue(argv, flag, '[]')
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
