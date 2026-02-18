# Plan: `--view all` and `--include` for Resource Queries

This plan adds `--view all` to fetch all scalar and object fields, plus `--include` to opt-in to specific connections.

## Problem

Currently users must know which fields exist and manually add them with `--select`:

```bash
# Tedious - need to know and list every field
shop products get --id 123 --select seo.title --select seo.description --select vendor --select ...
```

There's no way to say "give me everything".

## Solution

Add `--view all` that includes all scalar fields plus nested object fields, and `--include` to opt-in to connections:

```bash
shop products get --id 123 --view all                                      # all scalars + objects
shop products get --id 123 --view all --include variants                   # + variants connection
shop products get --id 123 --view all --include variants --include media   # + multiple connections
```

## Why This Design

The challenges with "fetch everything" are:

1. **Circular references**: `Product → variants → ProductVariant → product → Product`
2. **Query explosion**: Connections can have thousands of items
3. **Required arguments**: Some fields like `contextualPricing(context: ...)` can't be auto-selected

This design sidesteps all of them:

- `--view all` only includes scalars and object fields (no connections, no circular refs)
- `--include` is explicit opt-in (user chooses which connections)
- Fields with required args are skipped (same as current `scalar` filtering in linkTypeMap)

## Prerequisites

This plan depends on the introspection utilities from PLAN-fields-command.md:

- `getFields(typeName)` - returns field info including `isScalar`, `isConnection`, `hasRequiredArgs`
- `getType(typeName)` - returns the LinkedType for a GraphQL type
- `resourceToType` - maps CLI resource names to GraphQL type names

## Implementation

### Step 1: Create selection builder

Create `src/cli/selection/buildAllSelection.ts`:

```typescript
import { getType, getFields, type FieldInfo } from '../introspection'
import { CliError } from '../errors'

type Selection = Record<string, any>

/**
 * Validate that all --include targets are valid connection fields without required args.
 * Throws CliError if any are invalid.
 */
export const validateIncludes = (typeName: string, includes: string[]) => {
  const fields = getFields(typeName)
  const fieldMap = new Map(fields.map(f => [f.name, f]))

  for (const name of includes) {
    const field = fieldMap.get(name)
    if (!field) {
      throw new CliError(`Unknown field: ${name}`, 2)
    }
    if (!field.isConnection) {
      throw new CliError(`Field "${name}" is not a connection field. Use --select for non-connection fields.`, 2)
    }
    if (field.hasRequiredArgs) {
      throw new CliError(`Connection "${name}" has required arguments and cannot be used with --include.`, 2)
    }
  }
}

/**
 * Build a selection that includes all scalar fields and nested object fields.
 * Skips connections and fields with required arguments.
 */
export const buildAllSelection = (
  typeName: string,
  includeConnections: string[] = [],
  depth = 0,
  maxDepth = 2,
  visited = new Set<string>()
): Selection => {
  // Prevent infinite recursion from circular types
  if (visited.has(typeName) || depth > maxDepth) {
    return {}
  }
  visited.add(typeName)

  const fields = getFields(typeName)
  const selection: Selection = {}

  for (const field of fields) {
    // Skip fields with required arguments
    if (field.hasRequiredArgs) continue

    if (field.isScalar) {
      // Scalar field - just select it
      selection[field.name] = true
    } else if (field.isConnection) {
      // Connection field - only include if explicitly requested
      if (includeConnections.includes(field.name)) {
        const nodeType = field.typeName.replace('Connection', '')
        selection[field.name] = {
          __args: { first: 10 },
          nodes: buildAllSelection(nodeType, [], depth + 1, maxDepth, new Set(visited)),
          pageInfo: { hasNextPage: true, endCursor: true }
        }
      }
    } else {
      // Object field - recurse to get its fields
      const nested = buildAllSelection(field.typeName, [], depth + 1, maxDepth, new Set(visited))
      if (Object.keys(nested).length > 0) {
        selection[field.name] = nested
      }
    }
  }

  return selection
}
```

### Step 2: Add view and include handling

Modify `src/cli/selection/select.ts` to support `--view all`:

```typescript
import { buildAllSelection, validateIncludes } from './buildAllSelection'
import { resourceToType } from '../introspection/resources'

export const resolveSelection = ({
  resource,
  view,
  baseSelection,
  select,
  selection,
  include,
  ensureId,
}: {
  resource?: string
  view?: string
  baseSelection: Record<string, any>
  select?: string[]
  selection?: string
  include?: string[]  // new
  ensureId?: boolean
}) => {
  // Handle --view all
  if (view === 'all' && resource) {
    const typeName = resourceToType[resource]
    if (typeName) {
      // Validate --include targets before building selection
      if (include?.length) {
        validateIncludes(typeName, include)  // throws if invalid
      }

      let result = buildAllSelection(typeName, include ?? [])
      // Merge any additional --select paths
      if (select) {
        for (const path of select) {
          result = mergeDotPath(result, path)
        }
      }
      if (ensureId) {
        result = ensureIdSelected(result)
      }
      return result
    }
  }

  // ... existing logic for other views
}
```

### Step 3: Parse --include flag

In `src/cli/router.ts`, add `--include` to `parseStandardArgs`:

```typescript
export const parseStandardArgs = ({ argv, extraOptions }: { ... }) => {
  // ... existing parsing

  // Parse --include (repeatable)
  const include: string[] = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--include' && argv[i + 1]) {
      include.push(argv[i + 1])
      i++
    }
  }

  return {
    // ... existing fields
    include: include.length > 0 ? include : undefined,
  }
}
```

### Step 4: Pass include to resolveSelection

In verb handlers (or a shared helper), pass the `include` array:

```typescript
const selection = resolveSelection({
  resource: 'products',
  view: ctx.view,
  baseSelection: getProductSelection(ctx.view) as any,
  select: args.select,
  selection: (args as any).selection,
  include: args.include,  // new
  ensureId: ctx.quiet,
})
```

### Step 5: Update help

In `src/cli/help/registry.ts`, update the view flag and add --include:

```typescript
const flagView = flag('--view summary|ids|full|raw|all', 'Select a built-in view')
const flagInclude = flag('--include <connection>', 'Include a connection field with --view all (repeatable)')
```

## Example Output

```bash
$ shop products get --id 123 --view all --dry-run

query {
  product(id: "gid://shopify/Product/123") {
    id
    title
    handle
    status
    vendor
    productType
    createdAt
    updatedAt
    tags
    description
    descriptionHtml
    isGiftCard
    hasOnlyDefaultVariant
    hasOutOfStockVariants
    totalInventory
    tracksInventory
    seo {
      title
      description
    }
    priceRangeV2 {
      minVariantPrice {
        amount
        currencyCode
      }
      maxVariantPrice {
        amount
        currencyCode
      }
    }
    featuredImage {
      id
      url
      altText
      width
      height
    }
    # ... other object fields
  }
}
```

```bash
$ shop products get --id 123 --view all --include variants --dry-run

query {
  product(id: "gid://shopify/Product/123") {
    # ... all the above, plus:
    variants(first: 10) {
      nodes {
        id
        title
        sku
        price
        # ... all variant scalar fields
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/cli/selection/buildAllSelection.ts` | Create - selection builder |
| `src/cli/selection/select.ts` | Modify - handle `--view all` |
| `src/cli/router.ts` | Modify - parse `--include` flag |
| `src/cli/help/registry.ts` | Modify - add flag descriptions |

## Testing

1. Unit tests for `buildAllSelection` with various types
2. Test circular reference handling (Product → variants → product)
3. Test `--include` with single and multiple connections
4. Test combining `--view all` with `--select` for additional fields
5. Verify query doesn't exceed Shopify's complexity limits

## Edge Cases

1. **Unknown connection name**: Error if `--include foo` where `foo` isn't a connection field
2. **Required args on connection**: Error if `--include` targets a connection with required arguments
3. **Nested connections**: Only expand one level of connections (the included one); don't recurse into nested connections
4. **Required args on nested fields**: Skip them, same as top-level
5. **Empty types**: Some object fields may have no selectable sub-fields after filtering; skip them
