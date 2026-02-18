import 'dotenv/config'

import { createCliClientFromEnv } from './cli/client'
import { CliError } from './cli/errors'
import { renderResourceHelp, renderTopLevelHelp, renderVerbHelp } from './cli/help/render'
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

const main = async () => {
  const argv = process.argv.slice(2)

  if (argv.length === 0 || argv[0] === 'help' || argv[0] === '--help' || argv[0] === '-h') {
    console.log(renderTopLevelHelp())
    return
  }

  const resource = argv[0]
  if (!resource) {
    console.log(renderTopLevelHelp())
    throw new CliError('Missing <resource>', 2)
  }

  const afterResource = argv.slice(1)
  const firstFlagIndex = afterResource.findIndex((t) => t.startsWith('-'))
  const verbParts =
    firstFlagIndex === -1 ? afterResource : afterResource.slice(0, firstFlagIndex)
  const rest =
    firstFlagIndex === -1 ? [] : afterResource.slice(firstFlagIndex)

  const verb = verbParts.join(' ')

  const parsed = parseGlobalFlags(rest)
  const wantsHelp =
    parsed.passthrough.includes('--help') ||
    parsed.passthrough.includes('-h') ||
    parsed.passthrough.includes('--help-full') ||
    parsed.passthrough.includes('--help-all')
  const helpFull =
    parsed.passthrough.includes('--help-full') || parsed.passthrough.includes('--help-all')

  if (!verb) {
    const resourceHelp = renderResourceHelp(resource)
    if (resourceHelp) {
      console.log(resourceHelp)
      return
    }
    console.log(renderTopLevelHelp())
    throw new CliError(`Unknown resource: ${resource}`, 2)
  }

  if (wantsHelp) {
    const verbHelp = renderVerbHelp(resource, verb, { showAllFields: helpFull })
    if (verbHelp) {
      console.log(verbHelp)
      return
    }
    const resourceHelp = renderResourceHelp(resource)
    if (resourceHelp) {
      console.log(resourceHelp)
      return
    }
    console.log(renderTopLevelHelp())
    throw new CliError(`Unknown resource: ${resource}`, 2)
  }

  const dryRun = parsed.dryRun ?? false
  const shopDomain = parsed.shopDomain
  const accessToken = parsed.accessToken
  const apiVersion = parsed.apiVersion as any

  const client = dryRun
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
