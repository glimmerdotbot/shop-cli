import 'dotenv/config'

import { createCliClientFromEnv } from './cli/client'
import { CliError } from './cli/errors'
import { runCommand } from './cli/router'
import { createShopifyAdminClient } from './adminClient'

type GlobalParsed = {
  passthrough: string[]
  shopDomain?: string
  accessToken?: string
  apiVersion?: string
  format?: string
  quiet?: boolean
  dryRun?: boolean
  noFailOnUserErrors?: boolean
  view?: string
}

const parseGlobalFlags = (args: string[]): GlobalParsed => {
  const parsed: GlobalParsed = { passthrough: [] }

  const takeValue = (i: number, flag: string) => {
    const next = args[i + 1]
    if (!next) throw new CliError(`Missing value for ${flag}`, 2)
    return next
  }

  for (let i = 0; i < args.length; i++) {
    const token = args[i]!

    if (!token.startsWith('-')) {
      parsed.passthrough.push(token)
      continue
    }

    const [flag, inlineValue] = token.split('=', 2)

    if (flag === '--shop-domain') {
      parsed.shopDomain = inlineValue ?? takeValue(i, flag)
      if (!inlineValue) i++
      continue
    }
    if (flag === '--access-token') {
      parsed.accessToken = inlineValue ?? takeValue(i, flag)
      if (!inlineValue) i++
      continue
    }
    if (flag === '--api-version') {
      parsed.apiVersion = inlineValue ?? takeValue(i, flag)
      if (!inlineValue) i++
      continue
    }
    if (flag === '--format') {
      parsed.format = inlineValue ?? takeValue(i, flag)
      if (!inlineValue) i++
      continue
    }
    if (flag === '--view') {
      parsed.view = inlineValue ?? takeValue(i, flag)
      if (!inlineValue) i++
      continue
    }
    if (flag === '--quiet') {
      parsed.quiet = true
      continue
    }
    if (flag === '--dry-run') {
      parsed.dryRun = true
      continue
    }
    if (flag === '--no-fail-on-user-errors') {
      parsed.noFailOnUserErrors = true
      continue
    }

    // Unknown option: leave it for the verb parser (and don't consume a value).
    parsed.passthrough.push(token)
  }

  return parsed
}

const printHelp = () => {
  console.log(
    [
      'Usage:',
      '  shop <resource> <verb> [flags]',
      '',
      'Implemented resources (initial slice):',
      '  products: create|get|list|update|delete|duplicate|set-status|add-tags|remove-tags|media add|media upload',
      '  collections: create|get|list|update|delete|duplicate',
      '  customers: create|get|list|update|delete',
      '  orders: create|get|list|update|delete',
      '  inventory: set|adjust',
      '  files: upload',
      '',
      'Auth (flags override env):',
      '  --shop-domain <your-shop.myshopify.com> (or env SHOP_DOMAIN / SHOPIFY_SHOP)',
      '  --access-token <token>              (or env SHOPIFY_ACCESS_TOKEN)',
      '  --api-version <YYYY-MM>             (default: 2026-04)',
      '',
      'Output:',
      '  --format json|table|raw   (default: json)',
      '  --view summary|ids|full|raw (default: summary)',
      '  --select <path>           (repeatable; dot paths; adds to base view selection)',
      '  --selection <graphql>     (selection override; can be @file.gql)',
      '  --quiet                  (IDs only when possible)',
      '',
      'Debug:',
      '  --dry-run                (print GraphQL op + variables, do not execute)',
      '  --no-fail-on-user-errors (do not exit non-zero on userErrors)',
      '',
      'Examples:',
      '  shop products list --first 5 --format table',
      '  shop products create --set title=\"Hat\" --set status=\"ACTIVE\"',
      '  shop products add-tags --id 123 --tags \"summer,featured\"',
    ].join('\n'),
  )
}

const main = async () => {
  const argv = process.argv.slice(2)

  if (argv.length === 0 || argv[0] === 'help' || argv[0] === '--help' || argv[0] === '-h') {
    printHelp()
    return
  }

  const resource = argv[0]
  if (!resource) {
    printHelp()
    throw new CliError('Missing <resource>', 2)
  }

  const afterResource = argv.slice(1)
  const firstFlagIndex = afterResource.findIndex((t) => t.startsWith('-'))
  const verbParts =
    firstFlagIndex === -1 ? afterResource : afterResource.slice(0, firstFlagIndex)
  const rest =
    firstFlagIndex === -1 ? [] : afterResource.slice(firstFlagIndex)

  const verb = verbParts.join(' ')
  if (!verb) {
    printHelp()
    throw new CliError('Missing <resource> or <verb>', 2)
  }

  const parsed = parseGlobalFlags(rest)

  const dryRun = parsed.dryRun ?? false
  const wantsHelp = parsed.passthrough.includes('--help') || parsed.passthrough.includes('-h')
  const shopDomain = parsed.shopDomain
  const accessToken = parsed.accessToken
  const apiVersion = parsed.apiVersion as any

  const client = dryRun || wantsHelp
    ? createShopifyAdminClient({
        shopDomain:
          shopDomain ?? process.env.SHOP_DOMAIN ?? process.env.SHOPIFY_SHOP ?? 'example.myshopify.com',
        accessToken: accessToken ?? process.env.SHOPIFY_ACCESS_TOKEN ?? 'DUMMY',
        apiVersion: apiVersion ?? '2026-04',
      })
    : createCliClientFromEnv({ shopDomain, accessToken, apiVersion })

  await runCommand({
    client,
    resource,
    verb,
    argv: parsed.passthrough,
    format: (parsed.format as any) ?? 'json',
    quiet: parsed.quiet ?? false,
    view: (parsed.view as any) ?? 'summary',
    dryRun,
    failOnUserErrors: !(parsed.noFailOnUserErrors ?? false),
  })
}

main().catch((err) => {
  if (err instanceof CliError) {
    console.error(err.message)
    process.exit(err.exitCode)
  }
  console.error(err)
  process.exit(1)
})
