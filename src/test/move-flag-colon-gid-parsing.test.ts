import { afterEach, beforeEach, describe, expect, it } from 'vitest'

describe('colon-delimited flags with GIDs', () => {
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

  it('products media reorder parses --move <gid>:<pos> and stringifies UnsignedInt64 newPosition', async () => {
    const { runProducts } = await import('../cli/verbs/products')

    let request: any
    const ctx: any = {
      client: {
        mutation: async (req: any) => {
          request = req
          return {
            productReorderMedia: {
              job: { id: 'gid://shopify/Job/1', done: true },
              userErrors: [],
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

    await runProducts({
      ctx,
      verb: 'media reorder',
      argv: ['--product-id', 'gid://shopify/Product/1', '--move', 'gid://shopify/MediaImage/27811138732074:0'],
    })

    expect(request?.productReorderMedia?.__args?.moves).toEqual([
      { id: 'gid://shopify/MediaImage/27811138732074', newPosition: '0' },
    ])

    // Also verify --moves JSON (numbers) gets normalized to strings for UnsignedInt64.
    request = undefined
    captured = ''

    await runProducts({
      ctx,
      verb: 'media reorder',
      argv: [
        '--product-id',
        'gid://shopify/Product/1',
        '--moves',
        '[{"id":"gid://shopify/MediaImage/27811138732074","newPosition":0}]',
      ],
    })

    expect(request?.productReorderMedia?.__args?.moves).toEqual([
      { id: 'gid://shopify/MediaImage/27811138732074', newPosition: '0' },
    ])
  })

  it('collections reorder-products stringifies UnsignedInt64 newPosition', async () => {
    const { runCollections } = await import('../cli/verbs/collections')

    let request: any
    const ctx: any = {
      client: {
        mutation: async (req: any) => {
          request = req
          return {
            collectionReorderProducts: {
              job: { id: 'gid://shopify/Job/2', done: true },
              userErrors: [],
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

    await runCollections({
      ctx,
      verb: 'reorder-products',
      argv: ['--id', 'gid://shopify/Collection/1', '--move', 'gid://shopify/Product/2:0'],
    })

    expect(request?.collectionReorderProducts?.__args?.moves).toEqual([{ id: 'gid://shopify/Product/2', newPosition: '0' }])
  })

  it('reverse-deliveries create-with-shipping parses --line-item <gid>:<qty> from the right', async () => {
    const { runReverseDeliveries } = await import('../cli/verbs/reverse-deliveries')

    let request: any
    const ctx: any = {
      client: {
        mutation: async (req: any) => {
          request = req
          return {
            reverseDeliveryCreateWithShipping: {
              reverseDelivery: { id: 'gid://shopify/ReverseDelivery/1' },
              userErrors: [],
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

    await runReverseDeliveries({
      ctx,
      verb: 'create-with-shipping',
      argv: [
        '--reverse-fulfillment-order-id',
        'gid://shopify/ReverseFulfillmentOrder/1',
        '--line-item',
        'gid://shopify/ReverseFulfillmentOrderLineItem/123:2',
      ],
    })

    expect(request?.reverseDeliveryCreateWithShipping?.__args?.reverseDeliveryLineItems).toEqual([
      { reverseFulfillmentOrderLineItemId: 'gid://shopify/ReverseFulfillmentOrderLineItem/123', quantity: 2 },
    ])
  })

  it('reverse-fulfillment-orders dispose parses --disposition with optional trailing locationId', async () => {
    const { runReverseFulfillmentOrders } = await import('../cli/verbs/reverse-fulfillment-orders')

    let request: any
    const ctx: any = {
      client: {
        mutation: async (req: any) => {
          request = req
          return {
            reverseFulfillmentOrderDispose: {
              reverseFulfillmentOrderLineItems: { id: 'gid://shopify/ReverseFulfillmentOrderLineItem/123' },
              userErrors: [],
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

    await runReverseFulfillmentOrders({
      ctx,
      verb: 'dispose',
      argv: ['--disposition', 'gid://shopify/ReverseFulfillmentOrderLineItem/123:2:DONATED'],
    })

    expect(request?.reverseFulfillmentOrderDispose?.__args?.dispositionInputs).toEqual([
      { reverseFulfillmentOrderLineItemId: 'gid://shopify/ReverseFulfillmentOrderLineItem/123', quantity: 2, dispositionType: 'DONATED' },
    ])

    request = undefined
    captured = ''

    await runReverseFulfillmentOrders({
      ctx,
      verb: 'dispose',
      argv: [
        '--disposition',
        'gid://shopify/ReverseFulfillmentOrderLineItem/123:2:RESTOCKED:gid://shopify/Location/456',
      ],
    })

    expect(request?.reverseFulfillmentOrderDispose?.__args?.dispositionInputs).toEqual([
      {
        reverseFulfillmentOrderLineItemId: 'gid://shopify/ReverseFulfillmentOrderLineItem/123',
        quantity: 2,
        dispositionType: 'RESTOCKED',
        locationId: 'gid://shopify/Location/456',
      },
    ])
  })
})

