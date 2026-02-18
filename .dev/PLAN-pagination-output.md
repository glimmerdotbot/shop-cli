# Plan: Improved Pagination Output

## Problem

Currently, pagination info is dumped as raw JSON to stdout at the end of list command output:

```json
{
  "pageInfo": {
    "hasNextPage": false,
    "endCursor": "eyJsYXN0X2lkIjo3ODE1MDY4MDkwNDEwLCJsYXN0X3ZhbHVlIjoiNzgxNTA2ODA5MDQxMCJ9"
  }
}
```

Issues:
1. Goes to stdout, polluting pipeable data
2. Raw JSON with opaque cursor - not actionable
3. Shows even when `hasNextPage: false` (useless)

## Goals

1. Pagination hints go to **stderr** (keep stdout clean for piping)
2. Show a **copy-pasteable command** instead of raw cursor
3. Only show when there **is** a next page
4. Works across all `--format` and `--view` combinations

## Behavior Matrix

| Format     | View      | Quiet | stdout                          | stderr (if hasNextPage)                          |
|------------|-----------|-------|---------------------------------|--------------------------------------------------|
| `json`     | any       | no    | `{ nodes: [...], pageInfo: {..., nextPageCommand: "..." } }` | (nothing) |
| `json`     | any       | yes   | IDs only (one per line)         | (nothing - no pagination hint in quiet mode)     |
| `table`    | any       | no    | table output                    | `Next page: shop products list --after "..."`    |
| `table`    | any       | yes   | IDs only                        | (nothing)                                        |
| `raw`      | any       | no    | compact JSON (single line)      | `Next page: shop products list --after "..."`    |
| `raw`      | any       | yes   | IDs only                        | (nothing)                                        |
| `markdown` | any       | no    | markdown output                 | `Next page: shop products list --after "..."`    |
| `markdown` | any       | yes   | IDs only                        | (nothing)                                        |

### Design Decisions

1. **JSON format**: Keep pagination in stdout as part of the response object (structured data should stay together), but add `nextPageCommand` field for convenience.

2. **Non-JSON formats**: Pagination hint goes to stderr as human-readable text. This keeps stdout pipeable.

3. **Quiet mode**: No pagination hints at all. Quiet mode is for scripting where you just want IDs - if you need pagination, use normal mode.

4. **Only show when `hasNextPage: true`**: No point showing "no next page" or cursors when you're at the end.

## Implementation

### 1. Extend `printConnection` signature

The function needs to know the original command to reconstruct it with `--after`. Options:

**Option A: Pass command info explicitly**
```typescript
export const printConnection = ({
  connection,
  format,
  quiet,
  command,  // { resource: string, verb: string, args: Record<string, unknown> }
}: { ... }) => { ... }
```

**Option B: Pass just the parts needed to build the command**
```typescript
export const printConnection = ({
  connection,
  format,
  quiet,
  nextPageArgs,  // { base: 'shop products list', first?: number, query?: string, sort?: string, reverse?: boolean }
}: { ... }) => { ... }
```

Recommendation: **Option B** - simpler, doesn't require threading full command context.

### 2. Add helper to build next page command

```typescript
// src/cli/output.ts
const buildNextPageCommand = (
  base: string,
  endCursor: string,
  args: { first?: number; query?: string; sort?: string; reverse?: boolean }
): string => {
  const parts = [base]
  if (args.first && args.first !== 50) parts.push(`--first ${args.first}`)
  parts.push(`--after "${endCursor}"`)
  if (args.query) parts.push(`--query "${args.query}"`)
  if (args.sort) parts.push(`--sort ${args.sort}`)
  if (args.reverse) parts.push('--reverse')
  return parts.join(' ')
}
```

### 3. Update `printConnection` logic

```typescript
export const printConnection = ({
  connection,
  format,
  quiet,
  nextPageArgs,
}: {
  connection: { nodes?: any[]; pageInfo?: { hasNextPage?: boolean; endCursor?: string } }
  format: OutputFormat
  quiet: boolean
  nextPageArgs?: { base: string; first?: number; query?: string; sort?: string; reverse?: boolean }
}) => {
  const nodes = connection.nodes ?? []
  const pageInfo = connection.pageInfo
  const hasNextPage = pageInfo?.hasNextPage === true
  const endCursor = pageInfo?.endCursor

  // Quiet mode: just IDs, no pagination
  if (quiet) {
    printIds(nodes.map((n) => n?.id))
    return
  }

  // Build next page command if applicable
  const nextPageCommand = hasNextPage && endCursor && nextPageArgs
    ? buildNextPageCommand(nextPageArgs.base, endCursor, nextPageArgs)
    : undefined

  if (format === 'json') {
    // JSON: include pagination in structured output
    const output: any = { nodes }
    if (hasNextPage && pageInfo) {
      output.pageInfo = {
        hasNextPage: true,
        endCursor,
        ...(nextPageCommand ? { nextPageCommand } : {}),
      }
    }
    printJson(output)
    return
  }

  if (format === 'table') {
    const rows = nodes.map(/* ... */)
    console.table(rows)
    if (nextPageCommand) {
      process.stderr.write(`\nNext page: ${nextPageCommand}\n`)
    }
    return
  }

  if (format === 'raw') {
    printJson(nodes, false)  // Just the nodes array
    if (nextPageCommand) {
      process.stderr.write(`Next page: ${nextPageCommand}\n`)
    }
    return
  }

  if (format === 'markdown') {
    // ... existing markdown node printing ...
    if (nextPageCommand) {
      process.stderr.write(`\n---\nNext page: ${nextPageCommand}\n`)
    }
    return
  }
}
```

### 4. Update all verb list implementations

Each verb's `list` handler needs to pass `nextPageArgs`. Example for products:

```typescript
// Before
printConnection({ connection: result.products, format: ctx.format, quiet: ctx.quiet })

// After
printConnection({
  connection: result.products,
  format: ctx.format,
  quiet: ctx.quiet,
  nextPageArgs: {
    base: 'shop products list',
    first,
    query,
    sort: sortKey,
    reverse,
  },
})
```

This needs to be done for all ~40+ verb files with list commands.

### 5. Consider: Simplify with a shared helper

To avoid repeating `nextPageArgs` construction in every verb, could add a helper:

```typescript
// src/cli/verbs/_shared.ts
export const buildListNextPageArgs = (
  resource: string,
  args: { first?: number; query?: unknown; sort?: unknown; reverse?: unknown }
) => ({
  base: `shop ${resource} list`,
  first: typeof args.first === 'number' ? args.first : undefined,
  query: typeof args.query === 'string' ? args.query : undefined,
  sort: typeof args.sort === 'string' ? args.sort : undefined,
  reverse: args.reverse === true,
})
```

## Questions

1. **What about nested pagination?** (e.g., `--select variants` returning a connection inside nodes)
   - For now: don't add nextPageCommand for nested connections - that would require a different command structure
   - Future: could add guidance like "For variants pagination, use: shop product-variants list --product-id ..."

2. **Should we include other args in nextPageCommand?** (e.g., `--format`, `--view`, `--select`)
   - Recommendation: No. Keep it minimal. User can add those themselves. The cursor is the critical part.

3. **What about `--selection` (custom GraphQL selection)?**
   - Could include if provided, but it's verbose. Omit for cleaner output.

## Files to Modify

1. `src/cli/output.ts` - Core changes to `printConnection`
2. `src/cli/verbs/_shared.ts` - Add `buildListNextPageArgs` helper
3. All verb files with list commands (~40+ files) - Pass `nextPageArgs`

## Testing

1. Verify stdout remains clean JSON for `--format json`
2. Verify stderr gets the hint for table/markdown/raw
3. Verify no hint shown when `hasNextPage: false`
4. Verify quiet mode shows no pagination
5. Verify the generated command is valid and works when copy-pasted
