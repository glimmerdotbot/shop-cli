# Plan: Comprehensive --help Documentation System

## Current State

The CLI has 3 levels of help, all currently hardcoded static strings:

1. **Top-level** (`shop --help`): Lists all resources and their verbs in `src/cli.ts:printHelp()`
2. **Resource-level** (`shop products --help`): Lists verbs for that resource, inside each `run*()` function
3. **Verb-level** (`shop products create --help`): **Does not exist** - this is the gap

The GraphQL schema (`schema/2026-04.graphql`, 61k lines) contains rich field documentation for all input types (descriptions, types, nullability).

## Goals

| Level | Trigger | Content |
|-------|---------|---------|
| Top | `shop`, `shop --help` | Overview, list all resources, global flags, examples |
| Resource | `shop products`, `shop products --help` | List verbs for resource, brief description of each |
| Verb | `shop products create`, `shop products create --help` | Required flags, optional flags from schema, examples |

## Architectural Approaches

### Option A: Static JSON metadata files (hand-maintained)

Create `src/cli/commands/<resource>/<verb>.json` files:

```json
{
  "resource": "products",
  "verb": "create",
  "description": "Create a new product",
  "inputType": "ProductInput",
  "requiredFlags": ["--set title=<string>"],
  "examples": [
    "shop products create --set title=\"My Product\" --set status=ACTIVE"
  ]
}
```

**Pros**: Simple, explicit control, works offline
**Cons**: ~150+ files to maintain, easily drifts from schema, duplicates info in code

### Option B: Build-time schema extraction (codegen)

Add a codegen step that parses `schema/2026-04.graphql` and generates TypeScript/JSON metadata:

```
npm run codegen:help  # runs after genql, produces src/generated/help-metadata.ts
```

This extracts from the schema:
- Input type fields with descriptions, types, nullability
- Enum values with descriptions
- Mutation/query argument documentation

**Pros**: Always in sync with schema, rich documentation from source
**Cons**: Requires parser (graphql-js), build step, still needs hand-maintained command metadata

### Option C: Runtime schema introspection

At runtime, load the schema.graphql file and parse it when generating help. Cache the parse result.

**Pros**: No build step, always fresh
**Cons**: Slower startup, larger memory footprint, still need command→input type mappings

### Option D: Unified command registry with schema integration (Recommended)

Create a declarative command registry that:
1. Defines all commands with their flags and metadata
2. References GraphQL input types for `--set` flag documentation
3. Generates help at runtime from the registry
4. Can also drive the router (replacing the if-chain)

## Recommended Architecture (Option D)

### 1. Command Spec Definition

Create `src/cli/commands/spec.ts`:

```typescript
export type FlagSpec = {
  name: string           // e.g., 'id', 'tags', 'publication'
  type: 'string' | 'boolean'
  multiple?: boolean
  required?: boolean
  description: string
  example?: string
}

export type VerbSpec = {
  verb: string           // e.g., 'create', 'list', 'publish'
  description: string
  flags: FlagSpec[]
  inputType?: string     // GraphQL input type name, e.g., 'ProductInput'
  examples?: string[]
}

export type ResourceSpec = {
  resource: string       // e.g., 'products'
  description: string
  verbs: VerbSpec[]
}

export const commandRegistry: ResourceSpec[] = [...]
```

### 2. Schema Metadata Extraction (Build-time)

Create `scripts/extract-schema-help.ts`:
- Parse `schema/2026-04.graphql` using `graphql-js`
- Extract all `input *Input` types with field names, types, descriptions
- Generate `src/generated/input-help.ts`:

```typescript
export const inputTypeHelp: Record<string, InputFieldHelp[]> = {
  ProductInput: [
    { name: 'title', type: 'String', description: 'The name for the product...', required: false },
    { name: 'descriptionHtml', type: 'String', description: 'The description of the product...', required: false },
    // ...
  ],
  // ...
}
```

Add to package.json: `"codegen:help": "tsx scripts/extract-schema-help.ts"`
Run after `genql` codegen.

### 3. Help Rendering

Create `src/cli/help.ts`:

```typescript
export function renderTopLevelHelp(): string
export function renderResourceHelp(resource: string): string
export function renderVerbHelp(resource: string, verb: string): string
```

These functions:
- Look up specs in the command registry
- For verbs with `inputType`, merge in schema field docs from `input-help.ts`
- Format output with consistent styling

### 4. Integration with Router

Modify `src/cli.ts` and `src/cli/router.ts`:

```typescript
// In src/cli.ts main():
if (!verb) {
  // shop products (no verb) → show resource help
  console.log(renderResourceHelp(resource))
  return
}

// In each verb handler or at router level:
if (wantsHelp) {
  console.log(renderVerbHelp(resource, verb))
  return
}
```

### 5. Gradual Migration

Since commands are still being implemented:

1. **Phase 1**: Create the registry infrastructure and help renderer
2. **Phase 2**: Populate specs for existing commands (can be done incrementally)
3. **Phase 3**: New commands are added to registry first
4. **Phase 4**: Optionally, generate the router dispatch from the registry

## File Structure

```
src/cli/
├── commands/
│   ├── registry.ts          # Command specs for all resources
│   └── spec.ts               # Type definitions
├── help/
│   ├── render.ts             # Help text rendering functions
│   └── format.ts             # Formatting utilities (columns, wrapping)
└── generated/
    └── input-help.ts         # Auto-generated from schema

scripts/
└── extract-schema-help.ts    # Schema parser for help metadata
```

## Handling "Thousands of Fields"

The schema has ~500+ input types, each with 5-50 fields. Strategies:

1. **Lazy loading**: Don't parse schema until help is requested
2. **Categorization**: Group fields into "Common", "Advanced", etc. based on nullability
3. **Truncation**: Show first N fields with "... and M more. Use --help-all for complete list"
4. **Field filtering**: Only show non-deprecated, commonly-used fields by default

## Example Output

```
$ shop products create --help

Create a new product

Usage:
  shop products create [flags]

Required:
  --set title=<string>         The name for the product

Common fields (via --set):
  --set status=<ACTIVE|DRAFT|ARCHIVED>
  --set vendor=<string>        The name of the product's vendor
  --set productType=<string>   The product type that merchants define
  --set tags=<string[]>        Searchable keywords (comma-separated)
  --set descriptionHtml=<HTML> The description with HTML tags

Additional fields (31 more):
  Run with --help-full to see all available fields

Input options:
  --input <json|@file>         Full ProductInput as JSON
  --set <path>=<value>         Set individual field (repeatable)
  --set-json <path>=<json>     Set field with JSON value (repeatable)

Examples:
  shop products create --set title="Hat" --set status=ACTIVE
  shop products create --input @product.json
  shop products create --set title=Hat --set 'tags=["summer","featured"]'
```

## Implementation Steps

1. Create type definitions (`spec.ts`)
2. Create schema extraction script (`extract-schema-help.ts`)
3. Run extraction, generate `input-help.ts`
4. Create help rendering functions (`render.ts`)
5. Create command registry with specs for 2-3 resources
6. Wire up help rendering in `cli.ts` and router
7. Test all 3 help levels work
8. Incrementally add specs for remaining resources

## Design Decisions

1. `shop products` (no verb) → show resource help (not an error)
2. No colorized output (plain text)
3. No machine-readable help format
4. Show up to 15 `--set` fields by default before truncating
