# Admin API coverage report (2026-04)

Root field coverage (Query + Mutation) based on CLI --dry-run GraphQL payloads.

## Totals

- Query fields: 269
- Mutation fields: 496
- Used Query fields: 249
- Used Mutation fields: 459
- Missing Query fields: 20
- Missing Mutation fields: 37

## Missing (grouped by prefix)

### Queries

- `checkout` (3)
- `order` (3)
- `inventory` (2)
- `locations` (2)
- `reverse` (2)
- `assigned` (1)
- `deletion` (1)
- `delivery` (1)
- `job` (1)
- `location` (1)
- `manual` (1)
- `pending` (1)
- `returnable` (1)

### Mutations

- `order` (8)
- `inventory` (6)
- `fulfillment` (5)
- `delivery` (4)
- `reverse` (3)
- `event` (2)
- `menu` (2)
- `product` (2)
- `app` (1)
- `checkout` (1)
- `collection` (1)
- `location` (1)
- `return` (1)

## Notes

- Full missing field lists are in the JSON report.
- Grouping is heuristic: the prefix is the leading camelCase word of the root field name.

## Dry-run errors

Commands that threw during --dry-run (still captured any printed GraphQL payloads): 0

