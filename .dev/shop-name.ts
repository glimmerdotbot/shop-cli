import 'dotenv/config'
import { createShopifyAdminClient } from '../src/adminClient'

const shopDomain = process.env.SHOPIFY_SHOP
const accessToken = process.env.SHOPIFY_ACCESS_TOKEN

if (!shopDomain) {
  throw new Error('Missing env var SHOPIFY_SHOP, e.g. your-shop.myshopify.com')
}
if (!accessToken) {
  throw new Error('Missing env var SHOPIFY_ACCESS_TOKEN (Admin API access token)')
}

const client = createShopifyAdminClient({ shopDomain, accessToken })

const result = await client.query({
  shop: {
    name: true,
    primaryDomain: { url: true },
  },
})

console.log(`${result.shop.name} (${result.shop.primaryDomain?.url ?? 'no domain'})`)
