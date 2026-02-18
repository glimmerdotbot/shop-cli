import { CliError } from '../errors'
import { printConnection, printJson, printNode } from '../output'
import { parseStandardArgs, runQuery, type CommandContext } from '../router'

import { parseFirst, requireId } from './_shared'

const shopBillingPreferencesSelection = {
  currency: true,
} as const

const domainSelection = {
  id: true,
  host: true,
  url: true,
  sslEnabled: true,
} as const

const onlineStoreSelection = {
  passwordProtection: { enabled: true },
} as const

const apiVersionSelection = {
  displayName: true,
  handle: true,
  supported: true,
} as const

const shopPayReceiptSelection = {
  token: true,
  createdAt: true,
  processingStatus: { state: true, message: true, errorCode: true },
  sourceIdentifier: true,
  order: { id: true },
} as const

export const runShop = async ({
  ctx,
  verb,
  argv,
}: {
  ctx: CommandContext
  verb: string
  argv: string[]
}) => {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(
      [
        'Usage:',
        '  shop shop <verb> [flags]',
        '',
        'Verbs:',
        '  billing-preferences|domain|online-store|public-api-versions',
        '  shop-pay-receipt|shop-pay-receipts',
      ].join('\n'),
    )
    return
  }

  if (verb === 'billing-preferences') {
    const result = await runQuery(ctx, { shopBillingPreferences: shopBillingPreferencesSelection as any })
    if (result === undefined) return
    if (ctx.quiet) return
    printJson(result.shopBillingPreferences, ctx.format !== 'raw')
    return
  }

  if (verb === 'domain') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const id = requireId(args.id, 'Domain')
    const result = await runQuery(ctx, { domain: { __args: { id }, ...domainSelection } })
    if (result === undefined) return
    printNode({ node: result.domain, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'online-store') {
    const result = await runQuery(ctx, { onlineStore: onlineStoreSelection as any })
    if (result === undefined) return
    printNode({ node: result.onlineStore, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'public-api-versions') {
    const result = await runQuery(ctx, { publicApiVersions: apiVersionSelection as any })
    if (result === undefined) return
    if (ctx.quiet) return
    printJson(result.publicApiVersions, ctx.format !== 'raw')
    return
  }

  if (verb === 'shop-pay-receipt') {
    const args = parseStandardArgs({ argv, extraOptions: { token: { type: 'string' } } })
    const token = (args as any).token as string | undefined
    if (!token) throw new CliError('Missing --token', 2)

    const result = await runQuery(ctx, {
      shopPayPaymentRequestReceipt: {
        __args: { token },
        ...shopPayReceiptSelection,
      },
    })
    if (result === undefined) return
    printNode({ node: result.shopPayPaymentRequestReceipt, format: ctx.format, quiet: ctx.quiet })
    return
  }

  if (verb === 'shop-pay-receipts') {
    const args = parseStandardArgs({ argv, extraOptions: {} })
    const first = parseFirst(args.first)
    const after = args.after as any
    const reverse = args.reverse as any
    const sortKey = args.sort as any
    const query = args.query as any

    const result = await runQuery(ctx, {
      shopPayPaymentRequestReceipts: {
        __args: { first, after, reverse, ...(sortKey ? { sortKey } : {}), ...(query ? { query } : {}) },
        pageInfo: { hasNextPage: true, endCursor: true },
        nodes: shopPayReceiptSelection,
      },
    })
    if (result === undefined) return
    printConnection({
      connection: result.shopPayPaymentRequestReceipts,
      format: ctx.format,
      quiet: ctx.quiet,
      nextPageArgs: {
        base: 'shop shop shop-pay-receipts',
        first,
        query,
        sort: sortKey,
        reverse: reverse === true,
      },
    })
    return
  }

  throw new CliError(`Unknown verb for shop: ${verb}`, 2)
}
