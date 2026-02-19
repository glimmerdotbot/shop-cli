import { describe, expect, it } from 'vitest'

describe('required flag error messages', () => {
  it('products variants update reports missing --variant-id (not --id)', async () => {
    const { runProducts } = await import('../cli/verbs/products')

    const ctx: any = {
      client: {},
      format: 'json',
      quiet: false,
      view: 'summary',
      dryRun: false,
      failOnUserErrors: true,
      warnMissingAccessToken: false,
    }

    await expect(
      runProducts({ ctx, verb: 'variants update', argv: ['--id', '123'] }),
    ).rejects.toMatchObject({ message: 'Missing --variant-id', exitCode: 2 })
  })

  it('product-variants get-by-identifier reports missing --product-id (not --id)', async () => {
    const { runProductVariants } = await import('../cli/verbs/product-variants')

    const ctx: any = {
      client: {},
      format: 'json',
      quiet: false,
      view: 'summary',
      dryRun: false,
      failOnUserErrors: true,
      warnMissingAccessToken: false,
    }

    await expect(
      runProductVariants({ ctx, verb: 'get-by-identifier', argv: ['--sku', 'TEST-SKU'] }),
    ).rejects.toMatchObject({ message: 'Missing --product-id', exitCode: 2 })
  })
})

