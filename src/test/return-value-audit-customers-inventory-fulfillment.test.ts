import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('return-value audit: customers, inventory, fulfillment', () => {
  let captured = ''
  let originalWrite: typeof process.stdout.write

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-19T12:00:00.000Z'))

    captured = ''
    originalWrite = process.stdout.write.bind(process.stdout)
    ;(process.stdout as any).write = (chunk: unknown) => {
      captured += typeof chunk === 'string' ? chunk : Buffer.from(chunk as any).toString('utf8')
      return true
    }
  })

  afterEach(() => {
    vi.useRealTimers()
    ;(process.stdout as any).write = originalWrite
    captured = ''
  })

  it('customers update-default-address outputs the updated address with customer context', async () => {
    const { runCustomers } = await import('../cli/verbs/customers')

    const ctx: any = {
      client: {
        mutation: async () => {
          return {
            customerUpdateDefaultAddress: {
              customer: {
                id: 'gid://shopify/Customer/1',
                defaultAddress: {
                  id: 'gid://shopify/MailingAddress/9',
                  address1: '123 Main St',
                  city: 'San Francisco',
                },
              },
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

    await runCustomers({
      ctx,
      verb: 'update-default-address',
      argv: ['--id', 'gid://shopify/Customer/1', '--address-id', 'gid://shopify/MailingAddress/9'],
    })

    const out = JSON.parse(captured.trim())
    expect(out).toMatchObject({
      id: 'gid://shopify/MailingAddress/9',
      customerId: 'gid://shopify/Customer/1',
      isDefault: true,
      address1: '123 Main St',
      city: 'San Francisco',
    })
  })

  it('customers update-default-address respects --quiet by outputting the address ID', async () => {
    const { runCustomers } = await import('../cli/verbs/customers')

    const ctx: any = {
      client: {
        mutation: async () => {
          return {
            customerUpdateDefaultAddress: {
              customer: { id: 'gid://shopify/Customer/1', defaultAddress: { id: 'gid://shopify/MailingAddress/9' } },
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

    await runCustomers({
      ctx,
      verb: 'update-default-address',
      argv: ['--id', 'gid://shopify/Customer/1', '--address-id', 'gid://shopify/MailingAddress/9'],
    })

    expect(captured).toBe('gid://shopify/MailingAddress/9\n')
  })

  it('customers email-marketing-consent-update outputs consent state (not the customer summary)', async () => {
    const { runCustomers } = await import('../cli/verbs/customers')

    const ctx: any = {
      client: {
        mutation: async () => {
          return {
            customerEmailMarketingConsentUpdate: {
              customer: {
                id: 'gid://shopify/Customer/1',
                defaultEmailAddress: {
                  emailAddress: 'a@example.com',
                  marketingState: 'SUBSCRIBED',
                  marketingOptInLevel: 'SINGLE_OPT_IN',
                  marketingUpdatedAt: '2026-02-19T00:00:00Z',
                  sourceLocation: { id: 'gid://shopify/Location/1', name: 'HQ' },
                },
              },
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

    await runCustomers({
      ctx,
      verb: 'email-marketing-consent-update',
      argv: [
        '--id',
        'gid://shopify/Customer/1',
        '--email-marketing-consent',
        '{"marketingState":"SUBSCRIBED"}',
      ],
    })

    const out = JSON.parse(captured.trim())
    expect(out).toMatchObject({
      customerId: 'gid://shopify/Customer/1',
      emailAddress: 'a@example.com',
      marketingState: 'SUBSCRIBED',
      marketingOptInLevel: 'SINGLE_OPT_IN',
      marketingUpdatedAt: '2026-02-19T00:00:00Z',
      sourceLocationId: 'gid://shopify/Location/1',
      sourceLocationName: 'HQ',
    })
  })

  it('customers add-tax-exemptions outputs the updated customer including taxExemptions', async () => {
    const { runCustomers } = await import('../cli/verbs/customers')

    const ctx: any = {
      client: {
        mutation: async () => {
          return {
            customerAddTaxExemptions: {
              customer: {
                id: 'gid://shopify/Customer/1',
                taxExempt: true,
                taxExemptions: ['CA_STATUS_CARD_EXEMPTION'],
              },
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

    await runCustomers({
      ctx,
      verb: 'add-tax-exemptions',
      argv: ['--id', 'gid://shopify/Customer/1', '--exemptions', 'CA_STATUS_CARD_EXEMPTION'],
    })

    const out = JSON.parse(captured.trim())
    expect(out).toMatchObject({
      id: 'gid://shopify/Customer/1',
      taxExempt: true,
      taxExemptions: ['CA_STATUS_CARD_EXEMPTION'],
    })
  })

  it('customers merge outputs resultingCustomerId alongside the job', async () => {
    const { runCustomers } = await import('../cli/verbs/customers')

    const ctx: any = {
      client: {
        mutation: async () => {
          return {
            customerMerge: {
              job: { id: 'gid://shopify/Job/1', done: false },
              resultingCustomerId: 'gid://shopify/Customer/99',
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

    await runCustomers({
      ctx,
      verb: 'merge',
      argv: ['--id', 'gid://shopify/Customer/1', '--other-id', 'gid://shopify/Customer/2'],
    })

    const out = JSON.parse(captured.trim())
    expect(out).toMatchObject({
      job: { id: 'gid://shopify/Job/1', done: false },
      resultingCustomerId: 'gid://shopify/Customer/99',
    })
  })

  it('customers send-invite returns invite request details', async () => {
    const { runCustomers } = await import('../cli/verbs/customers')

    const ctx: any = {
      client: {
        mutation: async () => {
          return {
            customerSendAccountInviteEmail: {
              customer: { id: 'gid://shopify/Customer/1', defaultEmailAddress: { emailAddress: 'a@example.com' } },
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

    await runCustomers({
      ctx,
      verb: 'send-invite',
      argv: ['--id', 'gid://shopify/Customer/1'],
    })

    const out = JSON.parse(captured.trim())
    expect(out.customerId).toBe('gid://shopify/Customer/1')
    expect(out.emailAddress).toBe('a@example.com')
    expect(out.requestedAt).toBe('2026-02-19T12:00:00.000Z')
  })

  it('customers request-data-erasure returns a status wrapper', async () => {
    const { runCustomers } = await import('../cli/verbs/customers')

    const ctx: any = {
      client: {
        mutation: async () => {
          return {
            customerRequestDataErasure: {
              customerId: 'gid://shopify/Customer/1',
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

    await runCustomers({
      ctx,
      verb: 'request-data-erasure',
      argv: ['--id', 'gid://shopify/Customer/1'],
    })

    const out = JSON.parse(captured.trim())
    expect(out).toMatchObject({
      customerId: 'gid://shopify/Customer/1',
      status: 'REQUESTED',
      requestedAt: '2026-02-19T12:00:00.000Z',
    })
  })

  it('inventory deactivate returns the deactivated inventoryLevelId', async () => {
    const { runInventory } = await import('../cli/verbs/inventory')

    const ctx: any = {
      client: {
        mutation: async () => {
          return { inventoryDeactivate: { userErrors: [] } }
        },
      },
      format: 'json',
      quiet: false,
      view: 'summary',
      dryRun: false,
      failOnUserErrors: true,
      warnMissingAccessToken: false,
    }

    await runInventory({
      ctx,
      verb: 'deactivate',
      argv: ['--inventory-level-id', 'gid://shopify/InventoryLevel/1'],
    })

    const out = JSON.parse(captured.trim())
    expect(out).toMatchObject({ inventoryLevelId: 'gid://shopify/InventoryLevel/1', deactivated: true })
  })

  it('fulfillments create-event returns fulfillmentId and fulfillmentEvent', async () => {
    const { runFulfillments } = await import('../cli/verbs/fulfillments')

    const ctx: any = {
      client: {
        mutation: async () => {
          return {
            fulfillmentEventCreate: {
              fulfillmentEvent: {
                id: 'gid://shopify/FulfillmentEvent/1',
                status: 'IN_TRANSIT',
                message: 'Packed',
                happenedAt: '2026-02-19T10:00:00Z',
              },
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

    await runFulfillments({
      ctx,
      verb: 'create-event',
      argv: ['--id', 'gid://shopify/Fulfillment/1', '--status', 'IN_TRANSIT', '--message', 'Packed'],
    })

    const out = JSON.parse(captured.trim())
    expect(out.fulfillmentId).toBe('gid://shopify/Fulfillment/1')
    expect(out.fulfillmentEvent?.id).toBe('gid://shopify/FulfillmentEvent/1')
  })

  it('fulfillment-orders mark-prepared returns the affected fulfillment order IDs', async () => {
    const { runFulfillmentOrders } = await import('../cli/verbs/fulfillment-orders')

    const ctx: any = {
      client: {
        mutation: async () => {
          return { fulfillmentOrderLineItemsPreparedForPickup: { userErrors: [] } }
        },
      },
      format: 'json',
      quiet: false,
      view: 'summary',
      dryRun: false,
      failOnUserErrors: true,
      warnMissingAccessToken: false,
    }

    await runFulfillmentOrders({
      ctx,
      verb: 'mark-prepared',
      argv: ['--id', 'gid://shopify/FulfillmentOrder/1'],
    })

    const out = JSON.parse(captured.trim())
    expect(out).toMatchObject({ fulfillmentOrderIds: ['gid://shopify/FulfillmentOrder/1'] })
  })

  it('fulfillment-orders set-deadline returns the affected fulfillment order IDs', async () => {
    const { runFulfillmentOrders } = await import('../cli/verbs/fulfillment-orders')

    const ctx: any = {
      client: {
        mutation: async () => {
          return { fulfillmentOrdersSetFulfillmentDeadline: { success: true, userErrors: [] } }
        },
      },
      format: 'json',
      quiet: false,
      view: 'summary',
      dryRun: false,
      failOnUserErrors: true,
      warnMissingAccessToken: false,
    }

    await runFulfillmentOrders({
      ctx,
      verb: 'set-deadline',
      argv: [
        '--ids',
        'gid://shopify/FulfillmentOrder/1,gid://shopify/FulfillmentOrder/2',
        '--deadline',
        '2026-02-20T00:00:00Z',
      ],
    })

    const out = JSON.parse(captured.trim())
    expect(out).toMatchObject({
      success: true,
      fulfillmentOrderIds: ['gid://shopify/FulfillmentOrder/1', 'gid://shopify/FulfillmentOrder/2'],
    })
  })
})

