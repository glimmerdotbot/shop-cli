import { parseArgs } from 'node:util'

import type { Client } from '../generated/admin-2026-04'
import { generateMutationOp, generateQueryOp } from '../generated/admin-2026-04'
import { GenqlError } from '../generated/admin-2026-04'

import { CliError } from './errors'
import { printJsonError } from './output'
import { runCollections } from './verbs/collections'
import { runCustomers } from './verbs/customers'
import { runOrders } from './verbs/orders'
import { runProducts } from './verbs/products'

export type CliView = 'summary' | 'ids' | 'full' | 'raw'

export type CommandContext = {
  client: Client
  format: 'json' | 'table' | 'raw'
  quiet: boolean
  view: CliView
  dryRun: boolean
  failOnUserErrors: boolean
}

export type RunCommandArgs = CommandContext & {
  resource: string
  verb: string
  argv: string[]
}

export const runCommand = async ({
  client,
  resource,
  verb,
  argv,
  format,
  quiet,
  view,
  dryRun,
  failOnUserErrors,
}: RunCommandArgs) => {
  const ctx: CommandContext = { client, format, quiet, view, dryRun, failOnUserErrors }

  if (resource === 'products') return runProducts({ ctx, verb, argv })
  if (resource === 'collections') return runCollections({ ctx, verb, argv })
  if (resource === 'customers') return runCustomers({ ctx, verb, argv })
  if (resource === 'orders') return runOrders({ ctx, verb, argv })

  throw new CliError(`Unknown resource: ${resource}`, 2)
}

export const parseStandardArgs = ({
  argv,
  extraOptions,
}: {
  argv: string[]
  extraOptions: Record<string, any>
}): any => {
  const parsed = parseArgs({
    args: argv,
    allowPositionals: false,
    options: {
      ...extraOptions,
      input: { type: 'string' },
      set: { type: 'string', multiple: true },
      'set-json': { type: 'string', multiple: true },
      select: { type: 'string', multiple: true },
      selection: { type: 'string' },
      id: { type: 'string' },
      yes: { type: 'boolean' },
      help: { type: 'boolean' },
      h: { type: 'boolean' },
      query: { type: 'string' },
      first: { type: 'string' },
      after: { type: 'string' },
      sort: { type: 'string' },
      reverse: { type: 'boolean' },
      tags: { type: 'string' },
      status: { type: 'string' },
      'new-title': { type: 'string' },
    },
  })
  return parsed.values
}

export const runQuery = async (ctx: CommandContext, request: any): Promise<any> => {
  if (ctx.dryRun) {
    // dry-run output is always a stable JSON payload
    // (format/quiet are handled by the command wrapper, not by the request generator)
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(generateQueryOp(request), null, 2))
    return undefined
  }
  try {
    return await ctx.client.query(request)
  } catch (err) {
    if (err instanceof GenqlError) {
      printJsonError({ errors: err.errors, data: err.data })
      throw new CliError('GraphQL query failed', 1)
    }
    throw err
  }
}

export const runMutation = async (ctx: CommandContext, request: any): Promise<any> => {
  if (ctx.dryRun) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(generateMutationOp(request), null, 2))
    return undefined
  }
  try {
    return await ctx.client.mutation(request)
  } catch (err) {
    if (err instanceof GenqlError) {
      printJsonError({ errors: err.errors, data: err.data })
      throw new CliError('GraphQL mutation failed', 1)
    }
    throw err
  }
}
