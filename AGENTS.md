# AGENTS.md - Contributing to shop-cli

This guide helps AI agents contribute effectively to the shop-cli codebase.

## Project Overview

**shop-cli** is a command-line interface for Shopify's Admin GraphQL API. Commands follow the pattern:

```
shop <resource> <verb> [flags]
```

Examples:
```bash
shop products list --query "status:active" --first 10
shop customers create --set email=test@example.com
shop orders get --id 123 --view full
```

## Critical Requirements

### 1. Output Formats and Views

When adding commands, you **must** support the output system properly.

**Output Formats** (`--format`):
| Format | Description |
|--------|-------------|
| `json` | Pretty-printed JSON (default) |
| `jsonl` | One JSON object per line |
| `table` | ASCII table |
| `markdown` | Markdown table |
| `raw` | Unformatted |

**Views** (`--view`):
| View | Description |
|------|-------------|
| `summary` | Key fields only (default) |
| `full` | Extended fields |
| `ids` | ID field only |
| `raw` | All available fields |

**Implementation Pattern**:
```typescript
// Define selections per view
const getProductSelection = (view: CommandContext['view']) => {
  if (view === 'ids') return { id: true } as const
  if (view === 'full') return { id: true, title: true, createdAt: true, tags: true } as const
  return { id: true, title: true } as const // summary
}

// Use in verb handler
const selection = getProductSelection(ctx.view)
```

**Output Functions** (from `src/cli/output.ts`):
- `printJson(data, pretty)` - Single object
- `printNode({ node, format, quiet })` - Single resource
- `printConnection({ connection, format, quiet, base, first })` - Paginated list

For list operations, `printConnection` automatically:
- Outputs items in the chosen format
- Prints pagination hint to stderr (unless `--quiet`)

### 2. Tests

**Run tests before submitting**:
```bash
npm run typecheck    # Type checking
npm run test         # All tests
npm run check:help   # Help coverage
```

**Test location**: `src/test/`

**Key test files**:
- `output-jsonl.test.ts` - Output formatting
- `graphql/coverage.test.ts` - Schema coverage

**Writing tests** - capture stdout:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('my feature', () => {
  let captured = ''
  let originalWrite: typeof process.stdout.write

  beforeEach(() => {
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

  it('outputs correctly', () => {
    // test code
    expect(captured).toContain('expected output')
  })
})
```

### 3. Help Documentation

**Every command needs a help entry** in `src/cli/help/registry.ts`.

**Adding a verb**:
```typescript
// In the appropriate resource's verbs array
{
  verb: 'archive',
  description: 'Archive a product',
  operation: { type: 'mutation', name: 'productUpdate', inputArg: 'input' },
  input: { mode: 'none' },
  requiredFlags: [flagId],
  output: { view: true },
  examples: ['shop products archive --id 123'],
}
```

**Common flag definitions** (reuse these):
```typescript
const flagId = flag('--id <gid>', 'Resource ID')
const flagIds = flag('--ids <gid,gid,...>', 'Resource IDs (comma-separated or repeatable)')
const flagFirst = flag('--first <n>', 'Page size (default: 50)')
const flagQuery = flag('--query <string>', 'Search query')
```

**Verify coverage**:
```bash
npm run check:help
```

## Directory Structure

```
src/
├── cli.ts                    # Entry point, global args
├── cli/
│   ├── router.ts             # Command routing
│   ├── output.ts             # Output formatting
│   ├── input.ts              # Input parsing (--set, --input)
│   ├── gid.ts                # ID coercion (123 → gid://shopify/Product/123)
│   ├── verbs/                # Command implementations
│   │   ├── _shared.ts        # Shared utilities
│   │   ├── products.ts       # shop products ...
│   │   └── [resource].ts     # One file per resource
│   ├── workflows/            # Multi-step operations
│   └── help/
│       ├── registry.ts       # Command specs (update this!)
│       ├── render.ts         # Help rendering
│       └── spec.ts           # Type definitions
├── generated/
│   ├── admin-2026-04/        # GenQL generated code
│   └── help/schema-help.ts   # Schema field descriptions
└── test/                     # Tests
```

## Adding a New Command

### Step 1: Implement the verb

In `src/cli/verbs/<resource>.ts`:

```typescript
if (verb === 'archive') {
  const args = parseStandardArgs({ argv })
  const id = requireId(args.id as any, 'Product')

  const result = await runMutation(ctx, {
    productUpdate: {
      __args: { id, input: { status: 'ARCHIVED' } },
      product: getProductSelection(ctx.view),
      userErrors: { code: true, message: true },
    },
  })

  maybeFailOnUserErrors(result.productUpdate?.userErrors, ctx.failOnUserErrors)

  if (result.productUpdate?.product) {
    printJson(result.productUpdate.product, ctx.format !== 'raw')
  }
}
```

### Step 2: Add help entry

In `src/cli/help/registry.ts`:

```typescript
{
  verb: 'archive',
  description: 'Archive a product',
  operation: { type: 'mutation', name: 'productUpdate' },
  requiredFlags: [flagId],
  output: { view: true },
}
```

### Step 3: Test

```bash
npm run typecheck
npm run check:help
npm run test
```

## Common Patterns

### Input handling

```typescript
const built = buildInput({
  inputArg: args.input as any,
  setArgs: args.set as any,
  setJsonArgs: args['set-json'] as any,
})

if (!built.used) {
  throw new CliError('Missing --input or --set', 2)
}
```

### ID coercion

```typescript
// Users can pass numeric IDs
const id = requireId(args.id as any, 'Product')
// 123 → gid://shopify/Product/123
```

### Pagination

```typescript
const result = await runQuery(ctx, {
  products: {
    __args: {
      first: parseFirst(args.first),
      after: args.after as any,
      query: args.query as any,
    },
    nodes: selection,
    pageInfo: { hasNextPage: true, endCursor: true },
  },
})

printConnection({
  connection: result.products,
  format: ctx.format,
  quiet: ctx.quiet,
  base: 'shop products list',
  first: parseFirst(args.first),
})
```

### Error handling

```typescript
import { CliError } from '../errors'

// User-facing errors
throw new CliError('Product not found', 2)

// GraphQL user errors
maybeFailOnUserErrors(result.mutation?.userErrors, ctx.failOnUserErrors)
```

## Important Notes

1. **Selections must use `as const`** for GenQL type safety:
   ```typescript
   const selection = { id: true, title: true } as const
   ```

2. **Always handle userErrors** from mutations

3. **Use shared utilities** from `_shared.ts`:
   - `parseFirst(value)` - page size
   - `requireId(id, type)` - require and coerce ID
   - `parseIds(value, type)` - parse multiple IDs
   - `buildListNextPageArgs()` - pagination hints

4. **Global flags** are parsed in `cli.ts` and available via `ctx`:
   - `ctx.format` - output format
   - `ctx.view` - output view
   - `ctx.quiet` - minimal output
   - `ctx.dryRun` - print GraphQL only

## Checklist

Before submitting changes:

- [ ] Command outputs correctly in all formats (`json`, `jsonl`, `table`)
- [ ] Command respects `--view` flag
- [ ] Command respects `--quiet` flag
- [ ] Help entry added in `registry.ts`
- [ ] `npm run typecheck` passes
- [ ] `npm run check:help` passes
- [ ] `npm run test` passes
- [ ] Pagination works (if list operation)
- [ ] User errors are handled properly
