import { parseArgs } from 'node:util'

import type { Client } from '../generated/admin-2026-04'
import { generateMutationOp, generateQueryOp } from '../generated/admin-2026-04'

import { CliError } from './errors'
import { printJson } from './output'
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
      id: { type: 'string' },
      yes: { type: 'boolean' },
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
    printJson(generateQueryOp(request))
    return undefined
  }
  return await ctx.client.query(request)
}

export const runMutation = async (ctx: CommandContext, request: any): Promise<any> => {
  if (ctx.dryRun) {
    printJson(generateMutationOp(request))
    return undefined
  }
  return await ctx.client.mutation(request)
}
