import { afterEach, beforeEach, describe, expect, it } from 'vitest'

describe('return value audit: collections & orders', () => {
  let captured = ''
  let originalWrite: typeof process.stdout.write

  beforeEach(() => {
    captured = ''
    originalWrite = process.stdout.write.bind(process.stdout)
    ;(process.stdout as any).write = (chunk: unknown) => {
      captured += typeof chunk === 'string' ? chunk : Buffer.from(chunk as any).toString('utf8')
      return true
    }
  })

  afterEach(() => {
    ;(process.stdout as any).write = originalWrite
    captured = ''
  })

  it('collections add-products returns job + collectionId + productIds', async () => {
    const { runCollections } = await import('../cli/verbs/collections')

    const ctx: any = {
      client: {
        mutation: async (request: any) => {
          expect(request?.collectionAddProductsV2?.__args?.id).toBe('gid://shopify/Collection/1')
          expect(request?.collectionAddProductsV2?.__args?.productIds).toEqual([
            'gid://shopify/Product/10',
            'gid://shopify/Product/11',
          ])
          return {
            collectionAddProductsV2: { job: { id: 'gid://shopify/Job/100', done: false }, userErrors: [] },
          }
        },
      },
      format: 'json',
      quiet: false,
      view: 'summary',
      dryRun: false,
      failOnUserErrors: true,
      warnMissingAccessToken: false,
    }

    await runCollections({
      ctx,
      verb: 'add-products',
      argv: ['--id', 'gid://shopify/Collection/1', '--product-id', 'gid://shopify/Product/10', '--product-id', '11'],
    })

    const out = JSON.parse(captured.trim())
    expect(out).toMatchObject({
      job: { id: 'gid://shopify/Job/100', done: false },
      collectionId: 'gid://shopify/Collection/1',
      productIds: ['gid://shopify/Product/10', 'gid://shopify/Product/11'],
    })
  })

  it('collections add-products respects --quiet by printing job.id', async () => {
    const { runCollections } = await import('../cli/verbs/collections')

    const ctx: any = {
      client: {
        mutation: async () => {
          return { collectionAddProductsV2: { job: { id: 'gid://shopify/Job/101', done: false }, userErrors: [] } }
        },
      },
      format: 'json',
      quiet: true,
      view: 'summary',
      dryRun: false,
      failOnUserErrors: true,
      warnMissingAccessToken: false,
    }

    await runCollections({
      ctx,
      verb: 'add-products',
      argv: ['--id', 'gid://shopify/Collection/1', '--product-id', 'gid://shopify/Product/10'],
    })

    expect(captured).toBe('gid://shopify/Job/101\n')
  })

  it('collections reorder-products returns job + collectionId + moves', async () => {
    const { runCollections } = await import('../cli/verbs/collections')

    const ctx: any = {
      client: {
        mutation: async (request: any) => {
          expect(request?.collectionReorderProducts?.__args?.id).toBe('gid://shopify/Collection/1')
          expect(request?.collectionReorderProducts?.__args?.moves).toEqual([
            { id: 'gid://shopify/Product/10', newPosition: '0' },
            { id: 'gid://shopify/Product/11', newPosition: '3' },
          ])
          return { collectionReorderProducts: { job: { id: 'gid://shopify/Job/102', done: true }, userErrors: [] } }
        },
      },
      format: 'json',
      quiet: false,
      view: 'summary',
      dryRun: false,
      failOnUserErrors: true,
      warnMissingAccessToken: false,
    }

    await runCollections({
      ctx,
      verb: 'reorder-products',
      argv: ['--id', 'gid://shopify/Collection/1', '--move', '10:0', '--move', 'gid://shopify/Product/11:3'],
    })

    const out = JSON.parse(captured.trim())
    expect(out).toMatchObject({
      job: { id: 'gid://shopify/Job/102', done: true },
      collectionId: 'gid://shopify/Collection/1',
      moves: [
        { id: 'gid://shopify/Product/10', newPosition: '0' },
        { id: 'gid://shopify/Product/11', newPosition: '3' },
      ],
    })
  })

  it('collections duplicate returns job + collectionId (quiet prints job.id)', async () => {
    const { runCollections } = await import('../cli/verbs/collections')

    const ctx: any = {
      client: {
        query: async (request: any) => {
          expect(request?.collection?.__args?.id).toBe('gid://shopify/Collection/1')
          return { collection: { title: 'Original' } }
        },
        mutation: async () => {
          return {
            collectionDuplicate: {
              collection: { id: 'gid://shopify/Collection/2' },
              job: { id: 'gid://shopify/Job/103', done: false },
              userErrors: [],
            },
          }
        },
      },
      format: 'json',
      quiet: true,
      view: 'summary',
      dryRun: false,
      failOnUserErrors: true,
      warnMissingAccessToken: false,
    }

    await runCollections({ ctx, verb: 'duplicate', argv: ['--id', 'gid://shopify/Collection/1'] })
    expect(captured).toBe('gid://shopify/Job/103\n')
  })

  it('orders cancel returns job + orderId + request context', async () => {
    const { runOrders } = await import('../cli/verbs/orders')

    const ctx: any = {
      client: {
        mutation: async (request: any) => {
          expect(request?.orderCancel?.__args?.orderId).toBe('gid://shopify/Order/1')
          expect(request?.orderCancel?.__args?.refund).toBe(true)
          expect(request?.orderCancel?.__args?.restock).toBe(false)
          expect(request?.orderCancel?.__args?.reason).toBe('FRAUD')
          return {
            orderCancel: {
              job: { id: 'gid://shopify/Job/200', done: false },
              orderCancelUserErrors: [],
            },
          }
        },
      },
      format: 'json',
      quiet: false,
      view: 'summary',
      dryRun: false,
      failOnUserErrors: true,
      warnMissingAccessToken: false,
    }

    await runOrders({
      ctx,
      verb: 'cancel',
      argv: ['--id', 'gid://shopify/Order/1', '--refund', '--restock', 'false', '--reason', 'FRAUD'],
    })

    const out = JSON.parse(captured.trim())
    expect(out).toMatchObject({
      job: { id: 'gid://shopify/Job/200', done: false },
      orderId: 'gid://shopify/Order/1',
      refund: true,
      restock: false,
      reason: 'FRAUD',
      notifyCustomer: false,
    })
  })

  it('orders capture returns orderId + transaction + order displayFinancialStatus', async () => {
    const { runOrders } = await import('../cli/verbs/orders')

    const ctx: any = {
      client: {
        mutation: async (request: any) => {
          expect(request?.orderCapture?.__args?.input?.id).toBe('gid://shopify/Order/1')
          return {
            orderCapture: {
              transaction: {
                id: 'gid://shopify/OrderTransaction/1',
                kind: 'CAPTURE',
                status: 'SUCCESS',
                amount: '10.00',
                createdAt: '2026-01-01T00:00:00Z',
              },
              userErrors: [],
            },
          }
        },
        query: async (request: any) => {
          expect(request?.order?.__args?.id).toBe('gid://shopify/Order/1')
          return { order: { id: 'gid://shopify/Order/1', displayFinancialStatus: 'PAID' } }
        },
      },
      format: 'json',
      quiet: false,
      view: 'summary',
      dryRun: false,
      failOnUserErrors: true,
      warnMissingAccessToken: false,
    }

    await runOrders({
      ctx,
      verb: 'capture',
      argv: [
        '--id',
        'gid://shopify/Order/1',
        '--parent-transaction-id',
        'gid://shopify/OrderTransaction/0',
        '--amount',
        '10.00',
        '--currency',
        'USD',
      ],
    })

    const out = JSON.parse(captured.trim())
    expect(out).toMatchObject({
      orderId: 'gid://shopify/Order/1',
      transaction: { id: 'gid://shopify/OrderTransaction/1', kind: 'CAPTURE', status: 'SUCCESS' },
      order: { id: 'gid://shopify/Order/1', displayFinancialStatus: 'PAID' },
    })
  })

  it('orders risk-assessment-create returns orderId + orderRiskAssessment (quiet prints orderId)', async () => {
    const { runOrders } = await import('../cli/verbs/orders')

    const ctx: any = {
      client: {
        mutation: async () => {
          return {
            orderRiskAssessmentCreate: {
              orderRiskAssessment: {
                riskLevel: 'HIGH',
                facts: [{ sentiment: 'NEGATIVE', description: 'Chargeback history' }],
              },
              userErrors: [],
            },
          }
        },
      },
      format: 'json',
      quiet: true,
      view: 'summary',
      dryRun: false,
      failOnUserErrors: true,
      warnMissingAccessToken: false,
    }

    await runOrders({
      ctx,
      verb: 'risk-assessment-create',
      argv: ['--id', 'gid://shopify/Order/1', '--risk-level', 'HIGH', '--facts', '[{\"sentiment\":\"NEGATIVE\",\"description\":\"Chargeback history\"}]'],
    })

    expect(captured).toBe('gid://shopify/Order/1\n')
  })

  it('orders create-mandate-payment returns job + orderId + paymentReferenceId + paymentStatus', async () => {
    const { runOrders } = await import('../cli/verbs/orders')

    const ctx: any = {
      client: {
        mutation: async (request: any) => {
          expect(request?.orderCreateMandatePayment?.__args?.id).toBe('gid://shopify/Order/1')
          return {
            orderCreateMandatePayment: {
              job: { id: 'gid://shopify/Job/201', done: false },
              paymentReferenceId: 'payref_1',
              userErrors: [],
            },
          }
        },
        query: async (request: any) => {
          expect(request?.orderPaymentStatus?.__args?.orderId).toBe('gid://shopify/Order/1')
          expect(request?.orderPaymentStatus?.__args?.paymentReferenceId).toBe('payref_1')
          return {
            orderPaymentStatus: {
              paymentReferenceId: 'payref_1',
              status: 'PENDING',
              errorMessage: null,
              translatedErrorMessage: null,
              transactions: [
                {
                  id: 'gid://shopify/OrderTransaction/2',
                  kind: 'SALE',
                  status: 'PENDING',
                  amount: '10.00',
                  createdAt: '2026-01-01T00:00:00Z',
                },
              ],
            },
          }
        },
      },
      format: 'json',
      quiet: false,
      view: 'summary',
      dryRun: false,
      failOnUserErrors: true,
      warnMissingAccessToken: false,
    }

    await runOrders({
      ctx,
      verb: 'create-mandate-payment',
      argv: [
        '--id',
        'gid://shopify/Order/1',
        '--mandate-id',
        'gid://shopify/PaymentMandate/1',
        '--idempotency-key',
        'abc',
      ],
    })

    const out = JSON.parse(captured.trim())
    expect(out).toMatchObject({
      job: { id: 'gid://shopify/Job/201', done: false },
      orderId: 'gid://shopify/Order/1',
      paymentReferenceId: 'payref_1',
      paymentStatus: { paymentReferenceId: 'payref_1', status: 'PENDING' },
    })
  })
})
