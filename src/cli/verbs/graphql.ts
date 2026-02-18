import { parseArgs } from 'node:util'
import { readFileSync } from 'node:fs'

import { CliError } from '../errors'
import { printJson, printJsonError } from '../output'
import type { CommandContext } from '../router'
import {
  createRawGraphQLClient,
  type RawGraphQLRequest,
  type RawGraphQLResponse,
} from '../../adminClient'
import { validateGraphQL, formatValidationErrors } from '../../graphqlValidator'

type GraphQLCommandContext = CommandContext & {
  shopDomain?: string
  graphqlEndpoint?: string
  accessToken?: string
  apiVersion?: string
  headers?: Record<string, string>
}

const printHelp = () => {
  console.log(
    [
      'Usage:',
      '  shop graphql query <graphql> [flags]',
      '  shop graphql mutation <graphql> [flags]',
      '  shop graphql <graphql> [flags]',
      '',
      'Execute raw GraphQL queries and mutations against the Shopify Admin API.',
      '',
      'Arguments:',
      '  <graphql>              GraphQL query/mutation (inline or @file.graphql)',
      '',
      'Variables:',
      '  --var <name>=<value>      Set a string variable (repeatable)',
      '  --var-json <name>=<json>  Set a variable with JSON value (repeatable)',
      '  --variables <json>        Variables as JSON object (or @file.json)',
      '  --operation <name>        Operation name (for multi-operation documents)',
      '',
      'Validation:',
      '  Queries are validated against the bundled Shopify Admin schema before',
      '  execution. This catches errors locally with helpful messages, without',
      '  making an API request.',
      '',
      '  --no-validate             Skip local schema validation',
      '',
      'Output:',
      '  --format json|jsonl|raw   Output format (default: json)',
      '  --include-extensions      Include extensions in output',
      '',
      'Examples:',
      '  # Simple query',
      '  shop graphql query \'{ shop { name } }\'',
      '',
      '  # Query from file',
      '  shop graphql query @get-products.graphql',
      '',
      '  # Query with variables',
      '  shop graphql query \'query GetProduct($id: ID!) { product(id: $id) { title } }\' \\',
      '    --var id=gid://shopify/Product/123',
      '',
      '  # Mutation',
      '  shop graphql mutation \'mutation { productCreate(input: { title: "Test" }) { product { id } } }\'',
      '',
      '  # Auto-detect query vs mutation',
      '  shop graphql \'{ shop { name } }\'',
      '',
      '  # With JSON variables from file',
      '  shop graphql @query.graphql --variables @vars.json',
      '',
      '  # Skip validation for edge cases',
      '  shop graphql \'{ shop { name } }\' --no-validate',
    ].join('\n'),
  )
}

const readTextArg = (value: string): string => {
  const trimmed = value.trim()
  if (trimmed.startsWith('@file:')) return readFileSync(trimmed.slice('@file:'.length), 'utf8')
  if (trimmed.startsWith('@')) return readFileSync(trimmed.slice(1), 'utf8')
  return trimmed
}

const parseVariables = ({
  varArgs,
  varJsonArgs,
  variablesArg,
}: {
  varArgs?: string[]
  varJsonArgs?: string[]
  variablesArg?: string
}): Record<string, unknown> | undefined => {
  const vars: Record<string, unknown> = {}
  let hasVars = false

  // Parse --variables (base object)
  if (variablesArg) {
    const raw = readTextArg(variablesArg)
    try {
      const parsed = JSON.parse(raw)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new CliError('--variables must be a JSON object', 2)
      }
      Object.assign(vars, parsed)
      hasVars = true
    } catch (err) {
      if (err instanceof CliError) throw err
      throw new CliError(`--variables must be valid JSON: ${(err as Error).message}`, 2)
    }
  }

  // Parse --var name=value (string values)
  if (varArgs) {
    for (const arg of varArgs) {
      const eqIdx = arg.indexOf('=')
      if (eqIdx === -1) throw new CliError(`Invalid --var: expected name=value, got "${arg}"`, 2)
      const name = arg.slice(0, eqIdx)
      const value = arg.slice(eqIdx + 1)
      if (!name) throw new CliError(`Invalid --var: missing variable name in "${arg}"`, 2)
      vars[name] = value
      hasVars = true
    }
  }

  // Parse --var-json name=json (JSON values)
  if (varJsonArgs) {
    for (const arg of varJsonArgs) {
      const eqIdx = arg.indexOf('=')
      if (eqIdx === -1) throw new CliError(`Invalid --var-json: expected name=json, got "${arg}"`, 2)
      const name = arg.slice(0, eqIdx)
      const jsonStr = arg.slice(eqIdx + 1)
      if (!name) throw new CliError(`Invalid --var-json: missing variable name in "${arg}"`, 2)
      try {
        vars[name] = JSON.parse(jsonStr)
        hasVars = true
      } catch (err) {
        throw new CliError(`Invalid --var-json "${name}": ${(err as Error).message}`, 2)
      }
    }
  }

  return hasVars ? vars : undefined
}

export const runGraphQL = async ({
  ctx,
  verb,
  argv,
}: {
  ctx: GraphQLCommandContext
  verb: string
  argv: string[]
}) => {
  // Check for help first
  if (argv.includes('--help') || argv.includes('-h') || verb === 'help') {
    printHelp()
    return
  }

  // The main CLI parser joins all non-flag args as `verb`, so:
  // - `shop graphql query '{ ... }'` becomes verb = "query { ... }"
  // - `shop graphql '{ ... }'` becomes verb = "{ ... }"
  let actualVerb = verb
  let verbGraphQL: string | undefined

  if (verb === 'query' || verb.startsWith('query')) {
    const parts = verb.split(' ')
    actualVerb = 'query'
    verbGraphQL = parts.slice(1).join(' ').trim() || undefined
  } else if (verb === 'mutation' || verb.startsWith('mutation')) {
    const parts = verb.split(' ')
    actualVerb = 'mutation'
    verbGraphQL = parts.slice(1).join(' ').trim() || undefined
  }

  const parsed = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      var: { type: 'string', multiple: true },
      'var-json': { type: 'string', multiple: true },
      variables: { type: 'string' },
      operation: { type: 'string' },
      'include-extensions': { type: 'boolean' },
      'no-validate': { type: 'boolean' },
      help: { type: 'boolean' },
      h: { type: 'boolean' },
    },
  })

  // Determine the query source
  let querySource: string | undefined

  // If verb is 'query' or 'mutation', check for GraphQL from verb parsing or positional
  if (actualVerb === 'query' || actualVerb === 'mutation') {
    querySource = verbGraphQL ?? parsed.positionals[0]
  } else if (verb) {
    // verb itself might be the query (e.g., `shop graphql '{ shop { name } }'`)
    querySource = verb
  }

  if (!querySource) {
    throw new CliError('Missing GraphQL query/mutation. Use: shop graphql <query> or shop graphql query <query>', 2)
  }

  // Read the query (supports @file syntax)
  const query = readTextArg(querySource)

  // Parse variables
  const variables = parseVariables({
    varArgs: parsed.values.var,
    varJsonArgs: parsed.values['var-json'],
    variablesArg: parsed.values.variables,
  })

  const request: RawGraphQLRequest = {
    query,
    ...(variables ? { variables } : {}),
    ...(parsed.values.operation ? { operationName: parsed.values.operation } : {}),
  }

  // Dry run: print the request
  if (ctx.dryRun) {
    printJson(request, ctx.format !== 'raw')
    return
  }

  // Validate the query against the local schema (unless --no-validate)
  if (!parsed.values['no-validate'] && ctx.apiVersion) {
    const validation = validateGraphQL(query, ctx.apiVersion)
    if (!validation.valid) {
      const errorMessage = formatValidationErrors(validation.errors)
      console.error('GraphQL validation failed:\n')
      console.error(errorMessage)
      console.error('\nUse --no-validate to skip validation and send the request anyway.')
      throw new CliError('GraphQL validation failed', 1)
    }
  }

  // Create the raw client
  const rawClient = createRawGraphQLClient({
    shopDomain: ctx.shopDomain,
    graphqlEndpoint: ctx.graphqlEndpoint,
    accessToken: ctx.accessToken,
    apiVersion: ctx.apiVersion,
    headers: ctx.headers,
  })

  // Execute the request
  let response: RawGraphQLResponse
  try {
    response = await rawClient.request(request)
  } catch (err) {
    throw new CliError(`GraphQL request failed: ${(err as Error).message}`, 1)
  }

  // Handle errors
  if (response.errors && response.errors.length > 0) {
    printJsonError({ errors: response.errors, data: response.data }, ctx.format !== 'raw')
    throw new CliError('GraphQL request returned errors', 1)
  }

  // Output the result
  const output = parsed.values['include-extensions']
    ? response
    : response.data

  printJson(output, ctx.format !== 'raw')
}
