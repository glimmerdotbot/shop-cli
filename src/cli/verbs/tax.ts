import { CliError } from '../errors'
import { coerceGid } from '../gid'
import { printJson } from '../output'
import { parseStandardArgs, runMutation, type CommandContext } from '../router'
import { maybeFailOnUserErrors } from '../userErrors'

import { parseDateTime } from './_shared'

const parseBool = (value: unknown, flag: string) => {
  if (value === undefined || value === null || value === '') throw new CliError(`Missing ${flag}`, 2)
  if (typeof value !== 'string') throw new CliError(`${flag} must be a string`, 2)
  const raw = value.trim().toLowerCase()
  if (raw === 'true' || raw === '1' || raw === 'yes') return true
  if (raw === 'false' || raw === '0' || raw === 'no') return false
  throw new CliError(`${flag} must be true|false`, 2)
}

export const runTax = async ({
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
        '  shop tax <verb> [flags]',
        '',
        'Verbs:',
        '  configure-app|create-summary',
      ].join('\n'),
    )
    return
  }

  if (verb === 'configure-app') {
    const args = parseStandardArgs({ argv, extraOptions: { ready: { type: 'string' } } })
    const ready = parseBool((args as any).ready, '--ready')

    const result = await runMutation(ctx, {
      taxAppConfigure: {
        __args: { ready },
        taxAppConfiguration: { state: true },
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.taxAppConfigure, failOnUserErrors: ctx.failOnUserErrors })
    printJson(result.taxAppConfigure, ctx.format !== 'raw')
    return
  }

  if (verb === 'create-summary') {
    const args = parseStandardArgs({
      argv,
      extraOptions: { 'start-time': { type: 'string' }, 'end-time': { type: 'string' } },
    })

    const orderIdRaw = (args as any)['order-id'] as string | undefined
    const idFallback = args.id as string | undefined
    const orderId = orderIdRaw ?? idFallback

    const startTimeRaw = (args as any)['start-time'] as string | undefined
    const endTimeRaw = (args as any)['end-time'] as string | undefined

    if (!orderId && !(startTimeRaw && endTimeRaw)) {
      throw new CliError('Missing --order-id (or --id) or --start-time/--end-time', 2)
    }

    const startTime = startTimeRaw ? parseDateTime(startTimeRaw, '--start-time') : undefined
    const endTime = endTimeRaw ? parseDateTime(endTimeRaw, '--end-time') : undefined

    const result = await runMutation(ctx, {
      taxSummaryCreate: {
        __args: {
          ...(orderId ? { orderId: coerceGid(orderId, 'Order') } : {}),
          ...(startTime ? { startTime } : {}),
          ...(endTime ? { endTime } : {}),
        },
        enqueuedOrders: { id: true, name: true },
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return
    maybeFailOnUserErrors({ payload: result.taxSummaryCreate, failOnUserErrors: ctx.failOnUserErrors })
    if (ctx.quiet) {
      for (const order of result.taxSummaryCreate?.enqueuedOrders ?? []) {
        if (order?.id) process.stdout.write(`${order.id}\n`)
      }
      return
    }
    printJson(result.taxSummaryCreate, ctx.format !== 'raw')
    return
  }

  throw new CliError(`Unknown verb for tax: ${verb}`, 2)
}
