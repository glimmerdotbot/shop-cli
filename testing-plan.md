# Plan: GraphQL Query/Mutation Validation Tests for 100% Coverage

## Goal
Ensure every command in ShopCLI produces GraphQL queries/mutations that are valid against the Shopify Admin GraphQL schema.

## Current State Analysis

### What We Have
- **66 verb handler files** in `/src/cli/verbs/`
- **Type-safe GraphQL operations** via genql code generation
- **GraphQL schema** at `/schema/2026-04.graphql` (91,595 lines)
- **Generated types** in `/src/generated/admin-2026-04/`
- **`--dry-run` flag** that prints GraphQL operations without executing
- **No existing test infrastructure** (only TypeScript type checking)

### Key Insight: Dry-Run as Test Foundation
The `--dry-run` flag already generates the GraphQL query/mutation strings without executing them. This is the perfect hook for validation testing.

---

## Decisions

1. **Test Runner**: Vitest
2. **Validation Approach**: Schema validation + variable type checking (no real API calls)
3. **Coverage Scope**: Every resource/verb combination, with all applicable flags tested together where possible
4. **CI/CD Integration**: Not included (manual runs only)

---

## Proposed Architecture

### Phase 1: Test Infrastructure Setup

1. **Install Vitest**
   ```bash
   npm install -D vitest
   ```

2. **GraphQL validation** - Already have `graphql` package for schema parsing

3. **Create test configuration**
   - `vitest.config.ts`
   - Test scripts in `package.json`

### Phase 2: GraphQL Validation Library

Create test utilities in `/src/test/graphql/`:

**File: `validateGraphQL.ts`**

```typescript
import { buildSchema, parse, validate, TypeInfo, visitWithTypeInfo, visit, isInputType, getNullableType, isListType, isNonNullType, GraphQLInputType } from 'graphql'
import { readFileSync } from 'fs'
import { join } from 'path'

// Load and parse schema once
const schemaPath = join(__dirname, '../../../schema/2026-04.graphql')
const schemaSource = readFileSync(schemaPath, 'utf-8')
const schema = buildSchema(schemaSource)

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export function validateGraphQLOperation(query: string, variables?: Record<string, unknown>): ValidationResult {
  const errors: string[] = []

  // 1. Parse the query
  let document
  try {
    document = parse(query)
  } catch (e) {
    return { valid: false, errors: [`Parse error: ${(e as Error).message}`] }
  }

  // 2. Validate query against schema
  const validationErrors = validate(schema, document)
  if (validationErrors.length > 0) {
    errors.push(...validationErrors.map(e => e.message))
  }

  // 3. Validate variable types (if variables provided)
  if (variables && Object.keys(variables).length > 0) {
    const variableErrors = validateVariableTypes(document, variables)
    errors.push(...variableErrors)
  }

  return { valid: errors.length === 0, errors }
}

function validateVariableTypes(document: any, variables: Record<string, unknown>): string[] {
  // Extract variable definitions from the document and validate types
  const errors: string[] = []
  const variableDefs = document.definitions[0]?.variableDefinitions ?? []

  for (const varDef of variableDefs) {
    const varName = varDef.variable.name.value
    const varValue = variables[varName]

    // Check if required variable is missing
    if (varDef.type.kind === 'NonNullType' && varValue === undefined) {
      errors.push(`Missing required variable: $${varName}`)
    }
  }

  return errors
}
```

**File: `runDryRun.ts`**

```typescript
import { spawn } from 'child_process'
import { join } from 'path'

export interface DryRunResult {
  query: string
  variables: Record<string, unknown>
}

export async function runCommandDryRun(args: string[]): Promise<DryRunResult> {
  const cliPath = join(__dirname, '../../../cli.ts')

  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['tsx', cliPath, ...args, '--dry-run'], {
      cwd: join(__dirname, '../../..'),
      env: {
        ...process.env,
        // Provide dummy credentials to avoid auth errors
        SHOPIFY_ACCESS_TOKEN: 'test-token',
        SHOP_DOMAIN: 'test-shop.myshopify.com',
      },
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data) => { stdout += data })
    child.stderr.on('data', (data) => { stderr += data })

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed with code ${code}: ${stderr}`))
        return
      }

      try {
        const result = JSON.parse(stdout)
        resolve(result)
      } catch {
        reject(new Error(`Failed to parse dry-run output: ${stdout}`))
      }
    })
  })
}
```

**File: `commandRegistry.ts`**

```typescript
export interface CommandSpec {
  resource: string
  verb: string
  args: string[]  // Minimum required arguments
  description?: string
}

// Registry of all commands with their minimum required arguments
export const commands: CommandSpec[] = [
  // Products
  { resource: 'products', verb: 'list', args: [] },
  { resource: 'products', verb: 'get', args: ['--id', 'gid://shopify/Product/1'] },
  { resource: 'products', verb: 'create', args: ['--set', 'title=Test'] },
  { resource: 'products', verb: 'update', args: ['--id', 'gid://shopify/Product/1', '--set', 'title=Updated'] },
  { resource: 'products', verb: 'delete', args: ['--id', 'gid://shopify/Product/1', '--yes'] },
  { resource: 'products', verb: 'duplicate', args: ['--id', 'gid://shopify/Product/1', '--new-title', 'Copy'] },
  { resource: 'products', verb: 'set-status', args: ['--id', 'gid://shopify/Product/1', '--status', 'ACTIVE'] },
  { resource: 'products', verb: 'add-tags', args: ['--id', 'gid://shopify/Product/1', '--tags', 'tag1,tag2'] },
  { resource: 'products', verb: 'remove-tags', args: ['--id', 'gid://shopify/Product/1', '--tags', 'tag1'] },
  // ... (continue for all 200+ commands)
]
```

### Phase 3: Command Discovery & Execution Harness

Create a system to:

1. **Discover all commands** by parsing the router and verb files
2. **Generate test cases** for each command
3. **Execute commands with `--dry-run`** to capture GraphQL output
4. **Validate the output** against the schema

**Approach A: Static Command Registry**

Create a comprehensive list of all commands with their required arguments:

```typescript
// /src/test/commandRegistry.ts
export const commands = [
  { resource: 'products', verb: 'list', args: [] },
  { resource: 'products', verb: 'get', args: ['--id', '123'] },
  { resource: 'products', verb: 'create', args: ['--set', 'title=Test'] },
  // ... all 200+ commands
]
```

**Approach B: Dynamic Command Discovery**

Parse the router and verb files to automatically discover commands:

```typescript
// Scan /src/cli/verbs/ directory
// Extract command definitions from each file
// Generate test cases automatically
```

**Recommendation**: Start with Approach A for reliability, then automate discovery in Phase 5.

### Phase 4: Test Generation & Execution

For each command:

1. **Build the command arguments** with minimal required input
2. **Execute with `--dry-run`** to capture GraphQL
3. **Parse the output** to extract the query/mutation string
4. **Validate against schema**
5. **Report results**

**Main Test File: `src/test/graphql/schema-validation.test.ts`**

This single test file iterates over all commands in the registry:

```typescript
import { describe, it, expect } from 'vitest'
import { commands } from './commandRegistry'
import { runCommandDryRun } from './runDryRun'
import { validateGraphQLOperation } from './validateGraphQL'

describe('GraphQL Schema Validation', () => {
  // Group tests by resource
  const byResource = commands.reduce((acc, cmd) => {
    if (!acc[cmd.resource]) acc[cmd.resource] = []
    acc[cmd.resource].push(cmd)
    return acc
  }, {} as Record<string, typeof commands>)

  for (const [resource, resourceCommands] of Object.entries(byResource)) {
    describe(resource, () => {
      for (const cmd of resourceCommands) {
        it(`${cmd.verb} generates valid GraphQL`, async () => {
          const result = await runCommandDryRun([cmd.resource, cmd.verb, ...cmd.args])

          const validation = validateGraphQLOperation(result.query, result.variables)

          expect(validation.valid, `GraphQL validation failed:\n${validation.errors.join('\n')}`).toBe(true)
        })
      }
    })
  }
})
```

**Coverage Enforcement: `src/test/graphql/coverage.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { commands } from './commandRegistry'
import { getAllResourceVerbs } from './extractVerbs'

describe('Command Coverage', () => {
  it('all resource/verb combinations are in the registry', () => {
    const allVerbs = getAllResourceVerbs() // Extracts from router.ts and verb files
    const registeredVerbs = new Set(commands.map(c => `${c.resource}:${c.verb}`))

    const missing = allVerbs.filter(v => !registeredVerbs.has(v))

    expect(missing, `Missing commands in registry:\n${missing.join('\n')}`).toEqual([])
  })
})
```

### Phase 5: Coverage Tracking & Reporting

1. **Create a command manifest** listing all expected commands
2. **Track which commands have tests**
3. **Generate coverage report** showing tested vs untested commands
4. **Fail CI if coverage drops below 100%**

```typescript
// /src/test/coverage.ts
export interface CommandCoverage {
  resource: string
  verb: string
  tested: boolean
  variations: string[]  // Different flag combinations tested
}

export function generateCoverageReport(): {
  total: number
  tested: number
  percentage: number
  untested: string[]
}
```

### Phase 6: Automated Test Generation

Create a script that:

1. **Scans all verb handler files**
2. **Extracts command definitions** from function signatures
3. **Generates test stubs** for new commands
4. **Keeps tests in sync** with code changes

---

## Implementation Steps

### Step 1: Setup Test Infrastructure
- [ ] Install Vitest: `npm install -D vitest`
- [ ] Create `vitest.config.ts`
- [ ] Add test script to `package.json`: `"test:graphql": "vitest run src/test/graphql"`
- [ ] Create `/src/test/graphql/` directory structure

### Step 2: Create Validation Utilities
- [ ] `src/test/graphql/validateGraphQL.ts` - Schema validation + variable type checking
- [ ] `src/test/graphql/runDryRun.ts` - Execute commands with --dry-run and capture output
- [ ] `src/test/graphql/commandRegistry.ts` - Registry of all commands with required args

### Step 3: Build Command Registry
Based on router.ts analysis, there are **56 resources** to test:
- products, product-variants, collections, customers, orders, order-edit
- inventory, returns, fulfillment-orders, fulfillments, inventory-items, inventory-shipments
- files, publications, articles, blogs, pages, comments, menus
- catalogs, markets, draft-orders, url-redirects, segments, saved-searches
- script-tags, carrier-services, webhooks, subscription-contracts, subscription-billing, subscription-drafts
- metafield-definitions, metaobjects, metaobject-definitions, selling-plan-groups
- companies, company-contacts, company-locations, store-credit, delegate-tokens
- themes, cart-transforms, validations, checkout-branding, delivery-profiles, delivery-customizations
- web-pixels, server-pixels, marketing-activities, bulk-operations, app-billing
- config, translations, events, functions, graphql

For each resource, extract verbs from:
1. The help text in each verb file (e.g., `'Verbs:\n  create|get|list|update|delete'`)
2. The `if (verb === '...')` blocks in the code

### Step 4: Write Tests
For each resource/verb combination:
1. Determine minimum required arguments (e.g., `--id` for get/update/delete, `--set` for create)
2. Run command with `--dry-run` flag
3. Parse JSON output to get `{ query, variables }`
4. Validate query against schema
5. Validate variable types match schema expectations

### Step 5: Achieve 100% Coverage
- Generate test for every resource/verb combination
- Track coverage with a manifest file
- Fail if any command is missing tests

---

## Estimated Command Count

Based on the router analysis:

| Resource | Verbs | Commands |
|----------|-------|----------|
| products | 15+ | list, get, create, update, delete, duplicate, set-status, add-tags, remove-tags, publish, unpublish, metafields upsert, media add, media upload, etc. |
| customers | 5 | list, get, create, update, delete |
| orders | 7+ | list, get, create, update, delete, close, open |
| collections | 8+ | list, get, create, update, delete, add-products, remove-products, reorder |
| ... | ... | ... |
| **Total** | **~40 resources** | **~200+ commands** |

---

## Success Criteria

1. **Every command has at least one test** that validates its GraphQL output
2. **All tests pass** against the current schema version
3. **CI fails** if any GraphQL validation errors are introduced
4. **Coverage report** shows 100% command coverage
5. **New commands** automatically require corresponding tests

---

## Special Cases to Handle

### 1. Commands That Don't Produce GraphQL
Some commands may not produce GraphQL output in `--dry-run` mode:
- `config` commands (local config management)
- Commands that require prior queries to resolve IDs (e.g., `products publish-all`)

**Solution:** Mark these in the registry with a `skipValidation: true` flag and test them separately.

### 2. Commands with Sub-verbs
Some commands have sub-verbs like `products metafields upsert`:

```typescript
{ resource: 'products', verb: 'metafields', args: ['upsert', '--id', '...', '--set', '...'] }
```

### 3. Commands Requiring File Inputs
Commands like `products media upload` require actual files:

**Solution:** Either:
- Skip these specific variations (test `media add` with URLs instead)
- Create temporary test fixtures

### 4. The `graphql` Command
The raw `graphql query` and `graphql mutation` commands are special - they execute arbitrary GraphQL:

```typescript
{ resource: 'graphql', verb: 'query', args: ['{ shop { name } }'] }
{ resource: 'graphql', verb: 'mutation', args: ['mutation { ... }'] }
```

These should be tested with sample valid queries.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Schema changes break tests | Version schema tests, update schema regularly |
| Commands require complex inputs | Create fixture data generators |
| Some commands have side effects | Use `--dry-run` exclusively for validation |
| Test maintenance burden | Automate test generation where possible |

---

## Verb Extraction Utility

To ensure 100% coverage, we need to automatically extract all verbs from the codebase:

**File: `src/test/graphql/extractVerbs.ts`**

```typescript
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

// Map of resource names to their verb file names
const resourceToFile: Record<string, string> = {
  'products': 'products.ts',
  'product-variants': 'product-variants.ts',
  'customers': 'customers.ts',
  // ... (extracted from router.ts)
}

export function getAllResourceVerbs(): string[] {
  const verbs: string[] = []
  const verbsDir = join(__dirname, '../../cli/verbs')

  for (const [resource, filename] of Object.entries(resourceToFile)) {
    const filepath = join(verbsDir, filename)
    const content = readFileSync(filepath, 'utf-8')

    // Extract verbs from if (verb === '...') patterns
    const verbMatches = content.matchAll(/if\s*\(\s*verb\s*===\s*['"]([^'"]+)['"]\s*\)/g)
    for (const match of verbMatches) {
      verbs.push(`${resource}:${match[1]}`)
    }

    // Also check for verb comparisons in other patterns
    const orMatches = content.matchAll(/verb\s*===\s*['"]([^'"]+)['"]\s*\|\|\s*verb\s*===\s*['"]([^'"]+)['"]/g)
    for (const match of orMatches) {
      verbs.push(`${resource}:${match[1]}`)
      verbs.push(`${resource}:${match[2]}`)
    }
  }

  return [...new Set(verbs)] // Deduplicate
}
```

This approach ensures:
1. **No manual tracking** - Verbs are extracted directly from code
2. **Automatic detection** - New verbs added to code will cause test failures until added to registry
3. **100% coverage guarantee** - Coverage test fails if any verb is missing

---

## Files to Create

```
src/test/graphql/
├── validateGraphQL.ts          # Schema validation + variable type checking
├── runDryRun.ts                # Execute commands with --dry-run
├── extractVerbs.ts             # Extract verbs from verb files (for coverage)
├── commandRegistry.ts          # All commands with required args
├── schema-validation.test.ts   # Main test file (iterates all commands)
└── coverage.test.ts            # Ensures all verbs are tested

vitest.config.ts                # Vitest configuration
```

**Note:** We use a data-driven approach with a single test file rather than one file per resource. This:
- Reduces boilerplate
- Makes it easy to add new commands (just add to registry)
- Keeps tests consistent

---

## Next Steps

1. **Answer the clarifying questions above** to finalize approach
2. **Begin Phase 1** - Install test framework
3. **Create validation utilities** (Phase 2)
4. **Start with products tests** as proof of concept
5. **Expand to all resources** systematically
