import { CliError } from '../../errors'
import { coerceGid } from '../../gid'
import { printIds } from '../../output'
import { runMutation, type CommandContext } from '../../router'
import { maybeFailOnUserErrors } from '../../userErrors'

const requireProductId = (id: string | undefined) => {
  if (!id) throw new CliError('Missing --product-id', 2)
  return coerceGid(id, 'Product')
}

const requireVariantsInput = (input: any): { variants: any[]; extra: any } => {
  if (Array.isArray(input)) return { variants: input, extra: {} }
  if (input && typeof input === 'object' && Array.isArray(input.variants)) {
    const { variants, ...extra } = input
    return { variants, extra }
  }
  throw new CliError('Missing variants input: pass --input as an array or { variants: [...] }', 2)
}

export const upsertProductVariants = async ({
  ctx,
  productId,
  input,
  allowPartialUpdates,
  strategy,
}: {
  ctx: CommandContext
  productId: string | undefined
  input: any
  allowPartialUpdates: boolean
  strategy: string | undefined
}) => {
  const resolvedProductId = requireProductId(productId)
  const { variants, extra } = requireVariantsInput(input)
  if (variants.length === 0) throw new CliError('variants must include at least one item', 2)

  const toCreate = variants.filter((v) => !v?.id)
  const toUpdate = variants.filter((v) => Boolean(v?.id))

  const createdIds: Array<string | undefined> = []
  const updatedIds: Array<string | undefined> = []

  const out: any = {}

  if (toCreate.length > 0) {
    const result = await runMutation(ctx, {
      productVariantsBulkCreate: {
        __args: {
          productId: resolvedProductId,
          variants: toCreate,
          ...(extra.media ? { media: extra.media } : {}),
          ...(strategy ? { strategy } : extra.strategy ? { strategy: extra.strategy } : {}),
        },
        productVariants: { id: true },
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return undefined
    maybeFailOnUserErrors({
      payload: result.productVariantsBulkCreate,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    out.created = result.productVariantsBulkCreate
    for (const v of result.productVariantsBulkCreate?.productVariants ?? []) createdIds.push(v?.id)
  }

  if (toUpdate.length > 0) {
    const result = await runMutation(ctx, {
      productVariantsBulkUpdate: {
        __args: {
          productId: resolvedProductId,
          variants: toUpdate,
          allowPartialUpdates,
          ...(extra.media ? { media: extra.media } : {}),
        },
        productVariants: { id: true },
        userErrors: { field: true, message: true, code: true },
      },
    })
    if (result === undefined) return undefined
    maybeFailOnUserErrors({
      payload: result.productVariantsBulkUpdate,
      failOnUserErrors: ctx.failOnUserErrors,
    })
    out.updated = result.productVariantsBulkUpdate
    for (const v of result.productVariantsBulkUpdate?.productVariants ?? []) updatedIds.push(v?.id)
  }

  if (ctx.quiet) {
    printIds([...createdIds, ...updatedIds])
    return
  }

  if (toCreate.length > 0 && toUpdate.length === 0) return out.created
  if (toUpdate.length > 0 && toCreate.length === 0) return out.updated
  return out
}

