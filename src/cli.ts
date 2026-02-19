import dotenv from 'dotenv'
import { resolve } from 'path'

// Load .env from the current working directory (where the CLI is invoked),
// not from where the package is installed
dotenv.config({ path: resolve(process.cwd(), '.env'), quiet: true })

import { createCliClientFromEnv } from './cli/client'
import { CliError } from './cli/errors'
import { parseGlobalFlags } from './cli/globalFlags'
import { parseHeadersFromEnv, parseHeaderValues } from './cli/headers'
import { renderResourceHelp, renderTopLevelHelp, renderVerbHelp } from './cli/help/render'
import { runCommand } from './cli/router'
import { createShopifyAdminClient } from './adminClient'
import { resolveAdminApiVersion } from './defaults'
import { resolveCliCommand } from './cli/command'
import { buildUnexpectedPositionalHint, parseVerbAndRest, rewritePositionalIdAsFlag } from './cli/parse-command'
import { setGlobalCommand } from './cli/output'

const helpFlags = new Set(['--help', '-h', '--help-full', '--help-all'])
const versionFlags = new Set(['--version', '-v'])

const hasHelpFlag = (args: string[]) => args.some((arg) => helpFlags.has(arg))
const hasVersionFlag = (args: string[]) => args.some((arg) => versionFlags.has(arg))

const wantsFullHelp = (args: string[]) => args.some((arg) => arg === '--help-full' || arg === '--help-all')

const printVersion = async () => {
  const fs = await import('fs')
  const path = await import('path')
  // Walk up from dist/cli.js to find package.json
  let dir = __dirname
  for (let i = 0; i < 5; i++) {
    const pkgPath = path.join(dir, 'package.json')
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      console.log(pkg.version)
      return
    }
    dir = path.dirname(dir)
  }
  console.log('unknown')
}

const main = async () => {
  const command = resolveCliCommand()
  setGlobalCommand(command)
  const argv = process.argv.slice(2)

  if (hasVersionFlag(argv)) {
    await printVersion()
    return
  }

  if (argv.length === 0 || argv[0] === 'help' || hasHelpFlag([argv[0]])) {
    console.log(renderTopLevelHelp(command))
    return
  }

  const resource = argv[0]
  if (!resource) {
    console.log(renderTopLevelHelp(command))
    throw new CliError('Missing <resource>', 2)
  }

  const afterResource = argv.slice(1)
  const { verb, rest } = parseVerbAndRest({ resource, afterResource })
  const rewrittenRest = rewritePositionalIdAsFlag({ resource, verb, rest })

  // Special handling for `types` command (no verb required for --help)
  const isTypesCommand = resource === 'types'

  if (!verb) {
    // For `types`, empty verb with --help shows types help
    if (isTypesCommand && hasHelpFlag(afterResource)) {
      // Let runCommand handle it - it will show the types help
      // Fall through to runCommand below
    } else {
      const resourceHelp = renderResourceHelp(resource, command)
      if (resourceHelp) {
        console.log(resourceHelp)
        if (hasHelpFlag(afterResource)) return
        throw new CliError(`\nMissing <verb> for "${resource}"`, 2)
      } else if (!isTypesCommand) {
        console.log(renderTopLevelHelp(command))
        throw new CliError(`\nUnknown resource: ${resource}`, 2)
      }
      // For `types` with no verb and no --help, fall through and let runTypes show help
    }
  }

  if (hasHelpFlag(rewrittenRest)) {
    // Special case: `shop types --help` should show types help
    if (isTypesCommand) {
      // Fall through to runCommand which will show the types help
    } else {
      const verbHelp = renderVerbHelp(resource, verb, { showAllFields: wantsFullHelp(rewrittenRest) }, command)
      if (verbHelp) {
        console.log(verbHelp)
        return
      }
      const resourceHelp = renderResourceHelp(resource, command)
      if (resourceHelp) {
        console.log(resourceHelp)
        return
      }
      console.log(renderTopLevelHelp(command))
      return
    }
  }

  const unexpectedPositionalHint = buildUnexpectedPositionalHint({ command, resource, verb, rest: rewrittenRest })
  if (unexpectedPositionalHint) {
    throw new CliError(unexpectedPositionalHint, 2)
  }

  const parsed = parseGlobalFlags(rewrittenRest)

  const dryRun = parsed.dryRun ?? false
  const isOfflineCommand = verb === 'fields' || isTypesCommand
  const shopDomain = parsed.shopDomain
  const graphqlEndpoint = parsed.graphqlEndpoint
  const accessToken = parsed.accessToken
  const envHeaders = parseHeadersFromEnv(process.env.SHOPIFY_HEADERS)
  const cliHeaders = parseHeaderValues(parsed.headers, '--header')
  const headers = { ...envHeaders, ...cliHeaders }
  const resolvedAccessToken = accessToken ?? process.env.SHOPIFY_ACCESS_TOKEN
  const hasAuthHeader = Object.keys(headers).some((name) => {
    const normalized = name.toLowerCase()
    return normalized === 'authorization' || normalized === 'x-shopify-access-token'
  })
  const apiVersion = parsed.apiVersion as any

  const warnMissingAccessToken = !resolvedAccessToken && !hasAuthHeader

  const verbose = parsed.verbose ?? false

  const resolvedApiVersion = resolveAdminApiVersion(apiVersion ?? process.env.SHOPIFY_API_VERSION)

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
