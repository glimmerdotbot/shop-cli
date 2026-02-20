import { CliError } from './errors'

export type ShopifyGidType =
  | 'AbandonedCheckout'
  | 'Abandonment'
  | 'AndroidApplication'
  | 'App'
  | 'Metafield'
  | 'Job'
  | 'Product'
  | 'ProductOption'
  | 'ProductOptionValue'
  | 'ProductFeed'
  | 'ProductVariant'
  | 'Collection'
  | 'Customer'
  | 'CustomerPaymentMethod'
  | 'CustomerSegmentMembersQuery'
  | 'StaffMember'
  | 'Order'
  | 'OrderTransaction'
  | 'CalculatedOrder'
  | 'CalculatedLineItem'
  | 'CalculatedDiscountApplication'
  | 'CalculatedShippingLine'
  | 'AppInstallation'
  | 'AppSubscription'
  | 'DiscountAutomaticNode'
  | 'DiscountCodeNode'
  | 'DiscountNode'
  | 'DiscountRedeemCode'
  | 'DiscountRedeemCodeBulkCreation'
  | 'InventoryItem'
  | 'InventoryLevel'
  | 'InventoryShipment'
  | 'InventoryTransfer'
  | 'InventoryTransferLineItem'
  | 'Location'
  | 'FulfillmentOrder'
  | 'Fulfillment'
  | 'FulfillmentHold'
  | 'FulfillmentService'
  | 'FulfillmentConstraintRule'
  | 'GiftCard'
  | 'Return'
  | 'ReturnLineItem'
  | 'ReturnReasonDefinition'
  | 'ReturnableFulfillment'
  | 'DeliveryProfile'
  | 'DeliveryCustomization'
  | 'DeliveryCarrierService'
  | 'File'
  | 'PaymentTerms'
  | 'PaymentTermsTemplate'
  | 'PaymentSchedule'
  | 'PaymentMandate'
  | 'PaymentCustomization'
  | 'PriceList'
  | 'Publication'
  | 'Refund'
  | 'Article'
  | 'Blog'
  | 'Page'
  | 'Comment'
  | 'Event'
  | 'Menu'
  | 'Channel'
  | 'Catalog'
  | 'Market'
  | 'MarketRegionCountry'
  | 'MarketWebPresence'
  | 'BusinessEntity'
  | 'Company'
  | 'CompanyAddress'
  | 'CompanyContact'
  | 'CompanyContactRole'
  | 'CompanyContactRoleAssignment'
  | 'CompanyLocation'
  | 'CompanyLocationStaffMemberAssignment'
  | 'StoreCreditAccount'
  | 'StorefrontAccessToken'
  | 'DraftOrder'
  | 'DraftOrderTag'
  | 'BulkOperation'
  | 'UrlRedirect'
  | 'UrlRedirectImport'
  | 'Segment'
  | 'SavedSearch'
  | 'ScriptTag'
  | 'CartTransform'
  | 'Validation'
  | 'OnlineStoreTheme'
  | 'CheckoutProfile'
  | 'WebPixel'
  | 'ServerPixel'
  | 'MarketingActivity'
  | 'MarketingEvent'
  | 'WebhookSubscription'
  | 'Domain'
  | 'ExternalVideo'
  | 'MediaImage'
  | 'Model3d'
  | 'MetafieldDefinition'
  | 'Metaobject'
  | 'MetaobjectDefinition'
  | 'Shop'
  | 'MarketWebPresence'
  | 'SellingPlanGroup'
  | 'ShippingPackage'
  | 'ShopifyPaymentsDispute'
  | 'ShopifyPaymentsDisputeEvidence'
  | 'SubscriptionContract'
  | 'SubscriptionDraft'
  | 'SubscriptionLine'
  | 'SubscriptionManualDiscount'
  | 'SubscriptionBillingAttempt'
  | 'Video'
  | 'AppleApplication'
  | 'CashTrackingSession'
  | 'PointOfSaleDevice'
  | 'CustomerAccountPage'
  | 'FlowActionDefinition'
  | 'MailingAddress'

export const isGid = (value: string) => value.trim().startsWith('gid://')

export const parseShopifyGid = (value: string) => {
  const raw = value.trim()
  if (!raw.startsWith('gid://')) throw new CliError(`Invalid Shopify GID: ${value}`, 2)

  // Allow additional slashes in the id segment (rare, but possible if the id isn't purely numeric).
  // gid://shopify/<Type>/<id...>
  const parts = raw.split('/')
  const scheme = parts[0]
  const host = parts[2]
  const type = parts[3]
  const id = parts.slice(4).join('/')

  if (scheme !== 'gid:' || host !== 'shopify' || !type || !id) {
    throw new CliError(`Invalid Shopify GID: ${value}`, 2)
  }

  return { raw, type, id }
}

export const getShopifyGidType = (value: string) => parseShopifyGid(value).type

export const assertShopifyGidType = (
  value: string,
  expectedType: ShopifyGidType,
  label = 'GID',
) => {
  const parsed = parseShopifyGid(value)
  if (parsed.type !== expectedType) {
    throw new CliError(
      `${label} must be a Shopify GID of type ${expectedType}. Got type ${parsed.type}: ${parsed.raw}`,
      2,
    )
  }
  return parsed.raw
}

export const assertShopifyGidTypeIn = (
  value: string,
  allowedTypes: readonly ShopifyGidType[],
  label = 'GID',
) => {
  const parsed = parseShopifyGid(value)
  if (!allowedTypes.includes(parsed.type as ShopifyGidType)) {
    throw new CliError(
      `${label} must be a Shopify GID of type one of ${allowedTypes.join(', ')}. Got type ${parsed.type}: ${parsed.raw}`,
      2,
    )
  }
  return parsed.raw
}

export const coerceGid = (value: string, type: ShopifyGidType, label = `ID for ${type}`) => {
  const raw = value.trim()
  if (isGid(raw)) return assertShopifyGidType(raw, type, label)
  if (!/^\d+$/.test(raw)) {
    throw new CliError(
      `Expected a numeric ID or full GID for ${type}. Got: ${value}`,
      2,
    )
  }
  return `gid://shopify/${type}/${raw}`
}
