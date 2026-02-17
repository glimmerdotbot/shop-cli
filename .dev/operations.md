## Proposed CLI conventions

### 1) Command shape

```
shop <resource> <verb> [flags]
```

- **Resources**: plural, kebab-case (`product-variants`, `metafield-definitions`)
- **Verbs**: `create|get|list|update|delete|duplicate|count|…`
- **Nested concepts** only when it adds clarity (`orders edit add-variant` is ok)

### 2) Input story (consistent everywhere)

Every command that accepts an input object supports:

- `--input <json>` (inline JSON string)
- `--input @file.json` (file)
- `--set path=value` (repeatable; builds/patches input)
- `--set-json path='{"k":1}'` (repeatable for arrays/objects)

So you can do any of these:

```bash
shop products create --input @product.json
shop products create --set title="Hat" --set status=ACTIVE
shop products update --id <gid> --set descriptionHtml=@file:desc.html
```

### 3) ID flags

- Default is always `--id <gid>` for the primary target.
- If there are multiple IDs, use explicit names: `--product-id`, `--variant-ids`, `--customer-id`, etc.
- Bulk IDs: `--ids <gid,gid,...>` (comma-separated) and allow repeating: `--id <gid> --id <gid>`.

### 4) Output controls (optional but consistent)

- `--select <path>` (repeatable; dot paths) or `--selection <graphql>`
- `--format json|table|raw`
- `--quiet` (only errors / only IDs)

### 5) List/pagination controls (standard across all `list`)

- `--query <string>` (Shopify search query when supported)
- `--first <n>` (default 50)
- `--after <cursor>`
- `--sort <key>` / `--reverse`

---

# New list: operations → proposed commands + arguments

I’m keeping your tiering and your set of operations, but normalizing flags and naming. (Anything that’s “odd” or unknown stays safely behind `--input` / `--set`.)

## Tier 1 (Core)

| Resource    | Operation             | Kind | Proposed CLI                 | Primary args                                      |                    |
| ----------- | --------------------- | ---: | ---------------------------- | ------------------------------------------------- | ------------------ |
| collections | `collectionCreate`    |    M | `shop collections create`    | `--input <json                                    | @file>`or`--set …` |
| collections | `collectionDelete`    |    M | `shop collections delete`    | `--id <gid>` `--yes?`                             |                    |
| collections | `collections`         |    Q | `shop collections list`      | `--query? --first? --after? --sort? --reverse?`   |                    |
| collections | `collection`          |    Q | `shop collections get`       | `--id <gid>`                                      |                    |
| collections | `collectionUpdate`    |    M | `shop collections update`    | `--id <gid>` + (`--input` / `--set`)              |                    |
| collections | `collectionDuplicate` |    M | `shop collections duplicate` | `--id <gid>` + optional (`--set newTitle=…` etc.) |                    |
| customers   | `customerCreate`      |    M | `shop customers create`      | `--input` / `--set`                               |                    |
| customers   | `customerDelete`      |    M | `shop customers delete`      | `--id <gid>` `--yes?`                             |                    |
| customers   | `customers`           |    Q | `shop customers list`        | list flags                                        |                    |
| customers   | `customer`            |    Q | `shop customers get`         | `--id <gid>`                                      |                    |
| customers   | `customerUpdate`      |    M | `shop customers update`      | `--id <gid>` + input                              |                    |
| orders      | `orderCreate`         |    M | `shop orders create`         | `--input` / `--set`                               |                    |
| orders      | `orderDelete`         |    M | `shop orders delete`         | `--id <gid>` `--yes?`                             |                    |
| orders      | `orders`              |    Q | `shop orders list`           | list flags                                        |                    |
| orders      | `order`               |    Q | `shop orders get`            | `--id <gid>`                                      |                    |
| orders      | `orderUpdate`         |    M | `shop orders update`         | `--id <gid>` + input                              |                    |
| products    | `productCreate`       |    M | `shop products create`       | `--input` / `--set`                               |                    |
| products    | `productDelete`       |    M | `shop products delete`       | `--id <gid>` `--yes?`                             |                    |
| products    | `products`            |    Q | `shop products list`         | list flags                                        |                    |
| products    | `product`             |    Q | `shop products get`          | `--id <gid>`                                      |                    |
| products    | `productUpdate`       |    M | `shop products update`       | `--id <gid>` + input                              |                    |
| products    | `productDuplicate`    |    M | `shop products duplicate`    | `--id <gid>` + optional `--set title=…`           |                    |

---

## Tier 2 (Common)

### Articles / Blogs / Pages (same CRUD pattern)

| Resource | Operation       | Kind | Proposed CLI           | Primary args         |
| -------- | --------------- | ---: | ---------------------- | -------------------- |
| articles | `article`       |    Q | `shop articles get`    | `--id <gid>`         |
| articles | `articleCreate` |    M | `shop articles create` | `--input` / `--set`  |
| articles | `articleDelete` |    M | `shop articles delete` | `--id <gid>`         |
| articles | `articles`      |    Q | `shop articles list`   | list flags           |
| articles | `articleUpdate` |    M | `shop articles update` | `--id <gid>` + input |
| blogs    | `blog`          |    Q | `shop blogs get`       | `--id <gid>`         |
| blogs    | `blogCreate`    |    M | `shop blogs create`    | `--input` / `--set`  |
| blogs    | `blogDelete`    |    M | `shop blogs delete`    | `--id <gid>`         |
| blogs    | `blogs`         |    Q | `shop blogs list`      | list flags           |
| blogs    | `blogUpdate`    |    M | `shop blogs update`    | `--id <gid>` + input |
| pages    | `page`          |    Q | `shop pages get`       | `--id <gid>`         |
| pages    | `pageCreate`    |    M | `shop pages create`    | `--input` / `--set`  |
| pages    | `pageDelete`    |    M | `shop pages delete`    | `--id <gid>`         |
| pages    | `pages`         |    Q | `shop pages list`      | list flags           |
| pages    | `pageUpdate`    |    M | `shop pages update`    | `--id <gid>` + input |

### Catalogs / Markets / Publications / Menus (same CRUD pattern)

| Resource     | Operation           | Kind | Proposed CLI               | Primary args                              |
| ------------ | ------------------- | ---: | -------------------------- | ----------------------------------------- |
| catalogs     | `catalog`           |    Q | `shop catalogs get`        | `--id`                                    |
| catalogs     | `catalogCreate`     |    M | `shop catalogs create`     | input                                     |
| catalogs     | `catalogDelete`     |    M | `shop catalogs delete`     | `--id`                                    |
| catalogs     | `catalogs`          |    Q | `shop catalogs list`       | list flags                                |
| catalogs     | `catalogUpdate`     |    M | `shop catalogs update`     | `--id` + input                            |
| markets      | `market`            |    Q | `shop markets get`         | `--id`                                    |
| markets      | `marketCreate`      |    M | `shop markets create`      | input                                     |
| markets      | `marketDelete`      |    M | `shop markets delete`      | `--id`                                    |
| markets      | `markets`           |    Q | `shop markets list`        | list flags                                |
| markets      | `marketUpdate`      |    M | `shop markets update`      | `--id` + input                            |
| publications | `publication`       |    Q | `shop publications get`    | `--id`                                    |
| publications | `publicationCreate` |    M | `shop publications create` | input                                     |
| publications | `publicationDelete` |    M | `shop publications delete` | `--id`                                    |
| publications | `publications`      |    Q | `shop publications list`   | list flags                                |
| publications | `publicationUpdate` |    M | `shop publications update` | `--id` + input                            |
| menus        | `menu`              |    Q | `shop menus get`           | `--id`                                    |
| menus        | `menuCreate`        |    M | `shop menus create`        | input (or `--set title=… --set handle=…`) |
| menus        | `menuDelete`        |    M | `shop menus delete`        | `--id`                                    |
| menus        | `menus`             |    Q | `shop menus list`          | list flags                                |
| menus        | `menuUpdate`        |    M | `shop menus update`        | `--id` + input                            |

### Company locations / Fulfillment services / Locations

| Resource             | Operation                  | Kind | Proposed CLI                       | Primary args                 |
| -------------------- | -------------------------- | ---: | ---------------------------------- | ---------------------------- |
| company-locations    | `companyLocation`          |    Q | `shop company-locations get`       | `--id`                       |
| company-locations    | `companyLocationCreate`    |    M | `shop company-locations create`    | `--company-id <gid>` + input |
| company-locations    | `companyLocationDelete`    |    M | `shop company-locations delete`    | `--id`                       |
| company-locations    | `companyLocations`         |    Q | `shop company-locations list`      | list flags                   |
| company-locations    | `companyLocationUpdate`    |    M | `shop company-locations update`    | `--id` + input               |
| fulfillment-services | `fulfillmentService`       |    Q | `shop fulfillment-services get`    | `--id`                       |
| fulfillment-services | `fulfillmentServiceCreate` |    M | `shop fulfillment-services create` | input (or `--set name=…`)    |
| fulfillment-services | `fulfillmentServiceDelete` |    M | `shop fulfillment-services delete` | `--id`                       |
| fulfillment-services | `fulfillmentServiceUpdate` |    M | `shop fulfillment-services update` | `--id` + input               |
| locations            | `location`                 |    Q | `shop locations get`               | `--id`                       |
| locations            | `locations`                |    Q | `shop locations list`              | list flags                   |
| locations            | `locationDelete`           |    M | `shop locations delete`            | `--id`                       |

### Inventory (items / shipments / transfers)

| Resource            | Operation                    | Kind | Proposed CLI                         | Primary args            |
| ------------------- | ---------------------------- | ---: | ------------------------------------ | ----------------------- |
| inventory-items     | `inventoryItem`              |    Q | `shop inventory-items get`           | `--id`                  |
| inventory-items     | `inventoryItems`             |    Q | `shop inventory-items list`          | list flags              |
| inventory-items     | `inventoryItemUpdate`        |    M | `shop inventory-items update`        | `--id` + input          |
| inventory-shipments | `inventoryShipment`          |    Q | `shop inventory-shipments get`       | `--id`                  |
| inventory-shipments | `inventoryShipmentCreate`    |    M | `shop inventory-shipments create`    | input                   |
| inventory-shipments | `inventoryShipmentDelete`    |    M | `shop inventory-shipments delete`    | `--id`                  |
| inventory-transfers | `inventoryTransfer`          |    Q | `shop inventory-transfers get`       | `--id`                  |
| inventory-transfers | `inventoryTransferCreate`    |    M | `shop inventory-transfers create`    | input                   |
| inventory-transfers | `inventoryTransferDelete`    |    M | `shop inventory-transfers delete`    | `--id`                  |
| inventory-transfers | `inventoryTransferDuplicate` |    M | `shop inventory-transfers duplicate` | `--id` + optional input |
| inventory-transfers | `inventoryTransfers`         |    Q | `shop inventory-transfers list`      | list flags              |

### Metafields / Metaobjects

| Resource               | Operation                    | Kind | Proposed CLI                         | Primary args                          |
| ---------------------- | ---------------------------- | ---: | ------------------------------------ | ------------------------------------- |
| metafield-definitions  | `metafieldDefinition`        |    Q | `shop metafield-definitions get`     | `--id <gid>` (or schema-specific key) |
| metafield-definitions  | `metafieldDefinitionCreate`  |    M | `shop metafield-definitions create`  | input                                 |
| metafield-definitions  | `metafieldDefinitionDelete`  |    M | `shop metafield-definitions delete`  | `--id <gid>`                          |
| metafield-definitions  | `metafieldDefinitions`       |    Q | `shop metafield-definitions list`    | `--owner-type?` + list flags          |
| metafield-definitions  | `metafieldDefinitionUpdate`  |    M | `shop metafield-definitions update`  | `--id` + input                        |
| metaobjects            | `metaobject`                 |    Q | `shop metaobjects get`               | `--id`                                |
| metaobjects            | `metaobjectCreate`           |    M | `shop metaobjects create`            | input                                 |
| metaobjects            | `metaobjectDelete`           |    M | `shop metaobjects delete`            | `--id`                                |
| metaobjects            | `metaobjects`                |    Q | `shop metaobjects list`              | `--type <str>` + list flags           |
| metaobjects            | `metaobjectUpdate`           |    M | `shop metaobjects update`            | `--id` + input                        |
| metaobject-definitions | `metaobjectDefinition`       |    Q | `shop metaobject-definitions get`    | `--id`                                |
| metaobject-definitions | `metaobjectDefinitionCreate` |    M | `shop metaobject-definitions create` | input                                 |
| metaobject-definitions | `metaobjectDefinitionDelete` |    M | `shop metaobject-definitions delete` | `--id`                                |
| metaobject-definitions | `metaobjectDefinitions`      |    Q | `shop metaobject-definitions list`   | list flags                            |
| metaobject-definitions | `metaobjectDefinitionUpdate` |    M | `shop metaobject-definitions update` | `--id` + input                        |

### Product variants (+ bulk)

| Resource         | Operation                              | Kind | Proposed CLI                                       | Primary args                                 |                             |
| ---------------- | -------------------------------------- | ---: | -------------------------------------------------- | -------------------------------------------- | --------------------------- |
| product-variants | `productVariant`                       |    Q | `shop product-variants get`                        | `--id`                                       |                             |
| product-variants | `productVariants`                      |    Q | `shop product-variants list`                       | list flags                                   |                             |
| product-variants | `productVariantByIdentifier`           |    Q | `shop product-variants get-by-identifier`          | `--input <json                               | @file>` (identifier struct) |
| product-variants | `productVariantAppendMedia`            |    M | `shop product-variants append-media`               | `--id <variant-gid>` + input                 |                             |
| product-variants | `productVariantDetachMedia`            |    M | `shop product-variants detach-media`               | `--id <variant-gid>` + input                 |                             |
| product-variants | `productVariantJoinSellingPlanGroups`  |    M | `shop product-variants add-selling-plan-groups`    | `--id <variant-gid>` `--group-ids <gid,gid>` |                             |
| product-variants | `productVariantLeaveSellingPlanGroups` |    M | `shop product-variants remove-selling-plan-groups` | `--id <variant-gid>` `--group-ids <gid,gid>` |                             |
| product-variants | `productVariantRelationshipBulkUpdate` |    M | `shop product-variants update-relationships`       | `--input <json                               | @file>`                     |
| product-variants | `productVariantsCount`                 |    Q | `shop product-variants count`                      | `--query?`                                   |                             |
| product-variants | `productVariantsBulkCreate`            |    M | `shop product-variants bulk-create`                | `--product-id <gid>` + input                 |                             |
| product-variants | `productVariantsBulkDelete`            |    M | `shop product-variants bulk-delete`                | `--product-id <gid>` `--ids <gid,gid>`       |                             |
| product-variants | `productVariantsBulkUpdate`            |    M | `shop product-variants bulk-update`                | `--product-id <gid>` + input                 |                             |
| product-variants | `productVariantsBulkReorder`           |    M | `shop product-variants reorder`                    | `--product-id <gid>` + input (positions)     |                             |
| products         | `quantityPricingByVariantUpdate`       |    M | `shop product-variants update-quantity-pricing`    | `--price-list-id <gid>` + input              |                             |

### Selling plan groups

| Resource            | Operation                               | Kind | Proposed CLI                               | Primary args                           |
| ------------------- | --------------------------------------- | ---: | ------------------------------------------ | -------------------------------------- |
| selling-plan-groups | `sellingPlanGroupAddProductVariants`    |    M | `shop selling-plan-groups add-variants`    | `--id <gid>` `--variant-ids <gid,gid>` |
| selling-plan-groups | `sellingPlanGroupRemoveProductVariants` |    M | `shop selling-plan-groups remove-variants` | `--id <gid>` `--variant-ids <gid,gid>` |

### Orders edit (special)

| Resource | Operation             | Kind | Proposed CLI                   | Primary args                                                         |
| -------- | --------------------- | ---: | ------------------------------ | -------------------------------------------------------------------- |
| orders   | `orderEditAddVariant` |    M | `shop orders edit add-variant` | `--edit-id <gid>` `--variant-id <gid>` + optional `--set quantity=…` |

---

## Tier 3 (Specialized)

### Carrier services / Cart transforms / Comments

| Resource         | Operation              | Kind | Proposed CLI                   | Primary args   |
| ---------------- | ---------------------- | ---: | ------------------------------ | -------------- |
| carrier-services | `carrierServiceCreate` |    M | `shop carrier-services create` | input          |
| carrier-services | `carrierServiceDelete` |    M | `shop carrier-services delete` | `--id`         |
| carrier-services | `carrierServices`      |    Q | `shop carrier-services list`   | list flags     |
| carrier-services | `carrierService`       |    Q | `shop carrier-services get`    | `--id`         |
| carrier-services | `carrierServiceUpdate` |    M | `shop carrier-services update` | `--id` + input |
| cart-transforms  | `cartTransformCreate`  |    M | `shop cart-transforms create`  | input          |
| cart-transforms  | `cartTransformDelete`  |    M | `shop cart-transforms delete`  | `--id`         |
| cart-transforms  | `cartTransforms`       |    Q | `shop cart-transforms list`    | list flags     |
| comments         | `commentDelete`        |    M | `shop comments delete`         | `--id`         |
| comments         | `comments`             |    Q | `shop comments list`           | list flags     |
| comments         | `comment`              |    Q | `shop comments get`            | `--id`         |

### Customer addresses

| Resource           | Operation               | Kind | Proposed CLI                     | Primary args                  |
| ------------------ | ----------------------- | ---: | -------------------------------- | ----------------------------- |
| customer-addresses | `customerAddressCreate` |    M | `shop customer-addresses create` | `--customer-id <gid>` + input |
| customer-addresses | `customerAddressDelete` |    M | `shop customer-addresses delete` | `--id`                        |
| customer-addresses | `customerAddressUpdate` |    M | `shop customer-addresses update` | `--id` + input                |

### Delivery profiles

| Resource          | Operation               | Kind | Proposed CLI                    | Primary args   |
| ----------------- | ----------------------- | ---: | ------------------------------- | -------------- |
| delivery-profiles | `deliveryProfileCreate` |    M | `shop delivery-profiles create` | input          |
| delivery-profiles | `deliveryProfiles`      |    Q | `shop delivery-profiles list`   | list flags     |
| delivery-profiles | `deliveryProfile`       |    Q | `shop delivery-profiles get`    | `--id`         |
| delivery-profiles | `deliveryProfileUpdate` |    M | `shop delivery-profiles update` | `--id` + input |

### Draft orders (+ bulk + delivery options)

| Resource     | Operation                            | Kind | Proposed CLI                          | Primary args                         |
| ------------ | ------------------------------------ | ---: | ------------------------------------- | ------------------------------------ |
| draft-orders | `draftOrderDuplicate`                |    M | `shop draft-orders duplicate`         | `--id`                               |
| draft-orders | `draftOrderCreate`                   |    M | `shop draft-orders create`            | input                                |
| draft-orders | `draftOrderDelete`                   |    M | `shop draft-orders delete`            | `--id`                               |
| draft-orders | `draftOrders`                        |    Q | `shop draft-orders list`              | list flags                           |
| draft-orders | `draftOrder`                         |    Q | `shop draft-orders get`               | `--id`                               |
| draft-orders | `draftOrderUpdate`                   |    M | `shop draft-orders update`            | `--id` + input                       |
| draft-orders | `draftOrderBulkAddTags`              |    M | `shop draft-orders bulk-add-tags`     | `--ids <gid,gid>` `--tags <tag,tag>` |
| draft-orders | `draftOrderAvailableDeliveryOptions` |    Q | `shop draft-orders delivery-options`  | `--id`                               |
| draft-orders | `draftOrderBulkDelete`               |    M | `shop draft-orders bulk-delete`       | `--ids <gid,gid>`                    |
| draft-orders | `draftOrderCalculate`                |    M | `shop draft-orders calculate`         | input                                |
| draft-orders | `draftOrderComplete`                 |    M | `shop draft-orders complete`          | `--id`                               |
| draft-orders | `draftOrderCreateFromOrder`          |    M | `shop draft-orders create-from-order` | `--order-id <gid>`                   |
| draft-orders | `draftOrderInvoicePreview`           |    M | `shop draft-orders preview-invoice`   | `--id`                               |
| draft-orders | `draftOrderInvoiceSend`              |    M | `shop draft-orders send-invoice`      | `--id` + optional input              |
| draft-orders | `draftOrderBulkRemoveTags`           |    M | `shop draft-orders bulk-remove-tags`  | `--ids <gid,gid>` `--tags <tag,tag>` |
| draft-orders | `draftOrderSavedSearches`            |    Q | `shop draft-orders saved-searches`    | (none)                               |
| draft-orders | `draftOrderTag`                      |    Q | `shop draft-orders tags`              | `--id`                               |
| draft-orders | `draftOrdersCount`                   |    Q | `shop draft-orders count`             | `--query?`                           |

### Files

| Resource | Operation    | Kind | Proposed CLI        | Primary args                                |
| -------- | ------------ | ---: | ------------------- | ------------------------------------------- |
| files    | `fileCreate` |    M | `shop files create` | input                                       |
| files    | `fileDelete` |    M | `shop files delete` | input (or `--ids …` if you add convenience) |
| files    | `files`      |    Q | `shop files list`   | list flags                                  |
| files    | `fileUpdate` |    M | `shop files update` | `--id` + input                              |

### Gift cards

| Resource   | Operation                             | Kind | Proposed CLI                       | Primary args            |
| ---------- | ------------------------------------- | ---: | ---------------------------------- | ----------------------- |
| gift-cards | `giftCardCreate`                      |    M | `shop gift-cards create`           | input                   |
| gift-cards | `giftCards`                           |    Q | `shop gift-cards list`             | list flags              |
| gift-cards | `giftCard`                            |    Q | `shop gift-cards get`              | `--id`                  |
| gift-cards | `giftCardUpdate`                      |    M | `shop gift-cards update`           | `--id` + input          |
| gift-cards | `giftCardConfiguration`               |    Q | `shop gift-cards config`           | (none)                  |
| gift-cards | `giftCardCredit`                      |    M | `shop gift-cards credit`           | `--id` + input (amount) |
| gift-cards | `giftCardDeactivate`                  |    M | `shop gift-cards deactivate`       | `--id`                  |
| gift-cards | `giftCardDebit`                       |    M | `shop gift-cards debit`            | `--id` + input (amount) |
| gift-cards | `giftCardSendNotificationToCustomer`  |    M | `shop gift-cards notify-customer`  | `--id` + optional input |
| gift-cards | `giftCardSendNotificationToRecipient` |    M | `shop gift-cards notify-recipient` | `--id` + optional input |
| gift-cards | `giftCardsCount`                      |    Q | `shop gift-cards count`            | `--query?`              |

### Payment terms / Price lists / Segments

| Resource      | Operation            | Kind | Proposed CLI                | Primary args                            |
| ------------- | -------------------- | ---: | --------------------------- | --------------------------------------- |
| payment-terms | `paymentTermsCreate` |    M | `shop payment-terms create` | input                                   |
| payment-terms | `paymentTermsDelete` |    M | `shop payment-terms delete` | `--id`                                  |
| payment-terms | `paymentTermsUpdate` |    M | `shop payment-terms update` | `--id` + input                          |
| price-lists   | `priceListCreate`    |    M | `shop price-lists create`   | input                                   |
| price-lists   | `priceListDelete`    |    M | `shop price-lists delete`   | `--id`                                  |
| price-lists   | `priceLists`         |    Q | `shop price-lists list`     | list flags                              |
| price-lists   | `priceList`          |    Q | `shop price-lists get`      | `--id`                                  |
| price-lists   | `priceListUpdate`    |    M | `shop price-lists update`   | `--id` + input                          |
| segments      | `segmentCreate`      |    M | `shop segments create`      | input (or `--set name=… --set query=…`) |
| segments      | `segmentDelete`      |    M | `shop segments delete`      | `--id`                                  |
| segments      | `segments`           |    Q | `shop segments list`        | list flags                              |
| segments      | `segment`            |    Q | `shop segments get`         | `--id`                                  |
| segments      | `segmentUpdate`      |    M | `shop segments update`      | `--id` + input                          |

### Selling plan groups (full CRUD)

| Resource            | Operation                | Kind | Proposed CLI                      | Primary args   |
| ------------------- | ------------------------ | ---: | --------------------------------- | -------------- |
| selling-plan-groups | `sellingPlanGroupCreate` |    M | `shop selling-plan-groups create` | input          |
| selling-plan-groups | `sellingPlanGroupDelete` |    M | `shop selling-plan-groups delete` | `--id`         |
| selling-plan-groups | `sellingPlanGroups`      |    Q | `shop selling-plan-groups list`   | list flags     |
| selling-plan-groups | `sellingPlanGroup`       |    Q | `shop selling-plan-groups get`    | `--id`         |
| selling-plan-groups | `sellingPlanGroupUpdate` |    M | `shop selling-plan-groups update` | `--id` + input |

### Subscriptions

| Resource                      | Operation                          | Kind | Proposed CLI                                | Primary args                  |
| ----------------------------- | ---------------------------------- | ---: | ------------------------------------------- | ----------------------------- |
| subscription-billing-attempts | `subscriptionBillingAttemptCreate` |    M | `shop subscription-billing-attempts create` | `--contract-id <gid>` + input |
| subscription-billing-attempts | `subscriptionBillingAttempts`      |    Q | `shop subscription-billing-attempts list`   | list flags                    |
| subscription-billing-attempts | `subscriptionBillingAttempt`       |    Q | `shop subscription-billing-attempts get`    | `--id`                        |

### URL redirects

| Resource      | Operation           | Kind | Proposed CLI                | Primary args   |
| ------------- | ------------------- | ---: | --------------------------- | -------------- |
| url-redirects | `urlRedirectCreate` |    M | `shop url-redirects create` | input          |
| url-redirects | `urlRedirectDelete` |    M | `shop url-redirects delete` | `--id`         |
| url-redirects | `urlRedirects`      |    Q | `shop url-redirects list`   | list flags     |
| url-redirects | `urlRedirect`       |    Q | `shop url-redirects get`    | `--id`         |
| url-redirects | `urlRedirectUpdate` |    M | `shop url-redirects update` | `--id` + input |

### Web pixels / Web presences

| Resource      | Operation           | Kind | Proposed CLI                | Primary args   |
| ------------- | ------------------- | ---: | --------------------------- | -------------- |
| web-pixels    | `webPixelCreate`    |    M | `shop web-pixels create`    | input          |
| web-pixels    | `webPixelDelete`    |    M | `shop web-pixels delete`    | `--id`         |
| web-pixels    | `webPixel`          |    Q | `shop web-pixels get`       | `--id`         |
| web-pixels    | `webPixelUpdate`    |    M | `shop web-pixels update`    | `--id` + input |
| web-presences | `webPresenceCreate` |    M | `shop web-presences create` | input          |
| web-presences | `webPresenceDelete` |    M | `shop web-presences delete` | `--id`         |
| web-presences | `webPresences`      |    Q | `shop web-presences list`   | list flags     |
| web-presences | `webPresenceUpdate` |    M | `shop web-presences update` | `--id` + input |

### Webhooks

| Resource | Operation                   | Kind | Proposed CLI           | Primary args               |
| -------- | --------------------------- | ---: | ---------------------- | -------------------------- |
| webhooks | `webhookSubscriptionCreate` |    M | `shop webhooks create` | input (or `--set topic=…`) |
| webhooks | `webhookSubscriptionDelete` |    M | `shop webhooks delete` | `--id`                     |
| webhooks | `webhookSubscriptions`      |    Q | `shop webhooks list`   | list flags                 |
| webhooks | `webhookSubscription`       |    Q | `shop webhooks get`    | `--id`                     |
| webhooks | `webhookSubscriptionUpdate` |    M | `shop webhooks update` | `--id` + input             |

---

## Two tweaks I’d strongly recommend (based on your original pain)

1. Add **workflow verbs** alongside CRUD for the top “do the thing” flows, e.g.

- `shop products publish --id … --publication-id … --at …`
- `shop products unpublish …`
- `shop inventory set --inventory-item-id … --location-id … --available …`

2. Make `--input` always accept **either an object or array**, and the CLI coerces to the schema (e.g. wraps single objects into a 1-item list when the schema expects a list). That alone will save your agent a ton of retries.

If you want, next I can propose the **exact top 20 workflow commands** (publish, set inventory, attach media, upsert metafields/metaobjects, etc.) and the _user-facing_ arguments for each, while keeping an escape hatch that still maps cleanly to GraphQL.
