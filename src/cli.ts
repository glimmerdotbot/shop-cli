import dotenv from 'dotenv'
import { resolve } from 'path'

// Load .env from the current working directory (where the CLI is invoked),
// not from where the package is installed
dotenv.config({ path: resolve(process.cwd(), '.env'), quiet: true })

import { createCliClientFromEnv } from './cli/client'
import { CliError } from './cli/errors'
import { renderResourceHelp, renderTopLevelHelp, renderVerbHelp } from './cli/help/render'
import { runCommand } from './cli/router'
import { createShopifyAdminClient } from './adminClient'

type GlobalParsed = {
  passthrough: string[]
  shopDomain?: string
  graphqlEndpoint?: string
  accessToken?: string
  apiVersion?: string
  format?: string
  quiet?: boolean
  dryRun?: boolean
  noFailOnUserErrors?: boolean
  view?: string
  headers: string[]
  verbose?: boolean
}

const parseGlobalFlags = (args: string[]): GlobalParsed => {
  const parsed: GlobalParsed = { passthrough: [], headers: [] }

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

    if (flag === '--shop') {
      parsed.shopDomain = inlineValue ?? takeValue(i, flag)
      if (!inlineValue) i++
      continue
    }
    if (flag === '--graphql-endpoint') {
      parsed.graphqlEndpoint = inlineValue ?? takeValue(i, flag)
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
    if (flag === '--header') {
      parsed.headers.push(inlineValue ?? takeValue(i, flag))
      if (!inlineValue) i++
      continue
    }
    if (flag === '--verbose') {
      parsed.verbose = true
      continue
    }

    // Unknown option: leave it for the verb parser (and don't consume a value).
    parsed.passthrough.push(token)
  }

  return parsed
}

const parseHeaderValues = (values: string[]) => {
  const headers: Record<string, string> = {}
  for (const value of values) {
    const separatorIndex = value.indexOf(':')
    if (separatorIndex === -1) {
      throw new CliError('Invalid --header value: expected "Name: value"', 2)
    }
    const name = value.slice(0, separatorIndex).trim()
    if (!name) {
      throw new CliError('Invalid --header value: header name is required', 2)
    }
    const headerValue = value.slice(separatorIndex + 1).trim()
    headers[name] = headerValue
  }
  return headers
}

const helpFlags = new Set(['--help', '-h', '--help-full', '--help-all'])

const hasHelpFlag = (args: string[]) => args.some((arg) => helpFlags.has(arg))

const wantsFullHelp = (args: string[]) => args.some((arg) => arg === '--help-full' || arg === '--help-all')

const main = async () => {
  const argv = process.argv.slice(2)

  if (argv.length === 0 || argv[0] === 'help' || hasHelpFlag([argv[0]])) {
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
  if (!verb) {
    const resourceHelp = renderResourceHelp(resource)
    if (resourceHelp) {
      console.log(resourceHelp)
      if (hasHelpFlag(afterResource)) return
      throw new CliError(`\nMissing <verb> for "${resource}"`, 2)
    } else {
      console.log(renderTopLevelHelp())
      throw new CliError(`\nUnknown resource: ${resource}`, 2)
    }
  }

  if (hasHelpFlag(rest)) {
    const verbHelp = renderVerbHelp(resource, verb, { showAllFields: wantsFullHelp(rest) })
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
    return
  }

  const parsed = parseGlobalFlags(rest)

  const dryRun = parsed.dryRun ?? false
  const isOfflineCommand = verb === 'fields'
  const shopDomain = parsed.shopDomain
  const graphqlEndpoint = parsed.graphqlEndpoint
  const accessToken = parsed.accessToken
  const headers = parseHeaderValues(parsed.headers)
  const resolvedAccessToken = accessToken ?? process.env.SHOPIFY_ACCESS_TOKEN
  const hasAuthHeader = Object.keys(headers).some((name) => {
    const normalized = name.toLowerCase()
    return normalized === 'authorization' || normalized === 'x-shopify-access-token'
  })
  const apiVersion = parsed.apiVersion as any

  const warnMissingAccessToken = !resolvedAccessToken && !hasAuthHeader

  const verbose = parsed.verbose ?? false

  const resolvedApiVersion = apiVersion ?? process.env.SHOPIFY_API_VERSION ?? '2026-04'

  const client = dryRun || isOfflineCommand
    ? createShopifyAdminClient({
        shopDomain:
          shopDomain ?? process.env.SHOPIFY_SHOP ?? 'example.myshopify.com',
        graphqlEndpoint: graphqlEndpoint ?? process.env.GRAPHQL_ENDPOINT,
        accessToken: resolvedAccessToken ?? 'DUMMY',
        apiVersion: resolvedApiVersion,
        headers,
        verbose,
      })
    : createCliClientFromEnv({
        shopDomain,
        graphqlEndpoint,
        accessToken,
        apiVersion,
        headers,
        verbose,
      })

  await runCommand({
    client,
    resource,
    verb,
    argv: parsed.passthrough,
    format: (parsed.format as any) ?? (isOfflineCommand ? 'table' : 'json'),
    quiet: parsed.quiet ?? false,
    view: (parsed.view as any) ?? 'summary',
    dryRun,
    failOnUserErrors: !(parsed.noFailOnUserErrors ?? false),
    warnMissingAccessToken,
    // Raw GraphQL client options (for graphql command)
    shopDomain: shopDomain ?? process.env.SHOPIFY_SHOP,
    graphqlEndpoint: graphqlEndpoint ?? process.env.GRAPHQL_ENDPOINT,
    accessToken: resolvedAccessToken,
    apiVersion: resolvedApiVersion,
    headers,
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
