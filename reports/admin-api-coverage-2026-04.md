# Admin API coverage report (2026-04)

Root field coverage (Query + Mutation) based on CLI --dry-run GraphQL payloads.

## Totals

- Query fields: 269
- Mutation fields: 496
- Used Query fields: 157
- Used Mutation fields: 317
- Missing Query fields: 112
- Missing Mutation fields: 179

## Missing (grouped by prefix)

### Queries

- `product` (11)
- `app` (7)
- `customer` (7)
- `discount` (5)
- `market` (4)
- `segment` (4)
- `automatic` (3)
- `checkout` (3)
- `collection` (3)
- `order` (3)
- `shop` (3)
- `subscription` (3)
- `url` (3)
- `article` (2)
- `available` (2)
- `consent` (2)
- `finance` (2)
- `inventory` (2)
- `locations` (2)
- `marketing` (2)
- `metaobject` (2)
- `reverse` (2)
- `assigned` (1)
- `backup` (1)
- `blogs` (1)
- `catalog` (1)
- `catalogs` (1)
- `channel` (1)
- `channels` (1)
- `code` (1)
- `company` (1)
- `current` (1)
- `deletion` (1)
- `delivery` (1)
- `domain` (1)
- `file` (1)
- `job` (1)
- `location` (1)
- `manual` (1)
- `markets` (1)
- `metafield` (1)
- `nodes` (1)
- `online` (1)
- `pages` (1)
- `pending` (1)
- `primary` (1)
- `privacy` (1)
- `public` (1)
- `publications` (1)
- `published` (1)
- `returnable` (1)
- `segments` (1)
- `shopifyql` (1)
- `standard` (1)
- `tender` (1)
- `web` (1)
- `webhook` (1)

### Mutations

- `product` (25)
- `customer` (24)
- `company` (9)
- `market` (9)
- `subscription` (9)
- `order` (8)
- `app` (6)
- `inventory` (6)
- `url` (6)
- `fulfillment` (5)
- `delivery` (4)
- `price` (4)
- `selling` (4)
- `comment` (3)
- `discount` (3)
- `metafield` (3)
- `payment` (3)
- `pub` (3)
- `reverse` (3)
- `web` (3)
- `bulk` (2)
- `collection` (2)
- `event` (2)
- `gift` (2)
- `menu` (2)
- `metaobject` (2)
- `publishable` (2)
- `quantity` (2)
- `segment` (2)
- `staged` (2)
- `standard` (2)
- `backup` (1)
- `catalog` (1)
- `checkout` (1)
- `combined` (1)
- `companies` (1)
- `consent` (1)
- `data` (1)
- `draft` (1)
- `file` (1)
- `location` (1)
- `metafields` (1)
- `privacy` (1)
- `return` (1)
- `shop` (1)
- `shopify` (1)
- `storefront` (1)
- `tax` (1)

## Notes

- Full missing field lists are in the JSON report.
- Grouping is heuristic: the prefix is the leading camelCase word of the root field name.

## Dry-run errors

Commands that threw during --dry-run (still captured any printed GraphQL payloads): 0

