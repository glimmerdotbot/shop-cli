import { CliError } from '../../errors'
import { coerceGid } from '../../gid'
import { printIds } from '../../output'
import { runMutation, type CommandContext } from '../../router'
import { maybeFailOnUserErrors } from '../../userErrors'

const requireProductId = (id: string | undefined) => {
  if (!id) throw new CliError('Missing --id', 2)
  return coerceGid(id, 'Product')
}

const asArray = (value: any): any[] => {
  if (Array.isArray(value)) return value
  if (value && Array.isArray(value.metafields)) return value.metafields
  if (value && typeof value === 'object') return [value]
  return []
}

const chunk = <T,>(items: T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export const metafieldsUpsert = async ({
  ctx,
  id,
  input,
}: {
  ctx: CommandContext
  id: string | undefined
  input: any
}) => {
  const ownerId = requireProductId(id)
  const items = asArray(input)
  if (items.length === 0) throw new CliError('Missing metafield input: pass --input/--set/--set-json', 2)

  const normalized = items.map((m) => {
    if (!m || typeof m !== 'object') throw new CliError('Metafield inputs must be objects', 2)
    const { key, namespace, type, value, compareDigest } = m as any
    if (!key) throw new CliError('Metafield input missing key', 2)
    if (value === undefined) throw new CliError('Metafield input missing value', 2)
    return {
      ownerId,
      key,
      namespace,
      type,
      value: String(value),
      compareDigest,
    }
  })

  const payloads: any[] = []
  const ids: Array<string | undefined> = []

  for (const group of chunk(normalized, 25)) {
    const result = await runMutation(ctx, {
      metafieldsSet: {
        __args: { metafields: group },
        metafields: { id: true },
        userErrors: { field: true, message: true, elementIndex: true, code: true },
      },
    })
    if (result === undefined) return undefined

    maybeFailOnUserErrors({
      payload: result.metafieldsSet,
      failOnUserErrors: ctx.failOnUserErrors,
    })

    payloads.push(result.metafieldsSet)
    for (const mf of result.metafieldsSet?.metafields ?? []) ids.push(mf?.id)
  }

  if (ctx.quiet) {
    printIds(ids)
    return
  }

  return payloads.length === 1 ? payloads[0] : payloads
}

