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

## Clarifying Questions

Before finalizing this plan, I need to clarify:

1. **Test Runner Preference**: Do you have a preference for the test framework? Options:
   - **Vitest** (recommended - fast, modern, TypeScript-first)
   - **Jest** (widely used, more mature ecosystem)
   - **Node.js built-in test runner** (minimal dependencies)

2. **Validation Approach**: How strict should validation be?
   - **Schema validation only** - Ensure queries parse and validate against schema
   - **Schema + execution simulation** - Also verify variables match expected types
   - **Schema + real API validation** - Actually hit a test store (slower, requires credentials)

3. **Coverage Scope**: What counts as "100% coverage"?
   - Every verb handler file has at least one test?
   - Every public command (resource + verb combination)?
   - Every code path within each verb (e.g., different flag combinations)?

4. **CI/CD Integration**: Should the plan include CI setup (GitHub Actions, etc.)?

---

## Proposed Architecture

### Phase 1: Test Infrastructure Setup

1. **Install test framework** (Vitest recommended)
   ```bash
   npm install -D vitest @vitest/coverage-v8
   ```

2. **Add GraphQL validation utilities**
   ```bash
   npm install -D graphql  # Already have this for schema parsing
   ```

3. **Create test configuration**
   - `vitest.config.ts`
   - Test scripts in `package.json`

### Phase 2: GraphQL Validation Library

Create a test utility module that:

1. **Loads the GraphQL schema** from `/schema/2026-04.graphql`
2. **Validates query strings** against the schema using the `graphql` package's `validate()` function
3. **Extracts variables** and validates their types
4. **Reports detailed errors** for invalid operations

**File: `/src/test/validateGraphQL.ts`**

```typescript
import { buildSchema, parse, validate, Source } from 'graphql'
import { readFileSync } from 'fs'
import { join } from 'path'

const schemaPath = join(__dirname, '../../schema/2026-04.graphql')
const schemaSource = readFileSync(schemaPath, 'utf-8')
const schema = buildSchema(schemaSource)

export function validateGraphQLOperation(operation: string): {
  valid: boolean
  errors: string[]
} {
  try {
    const document = parse(new Source(operation))
    const errors = validate(schema, document)
    return {
      valid: errors.length === 0,
      errors: errors.map(e => e.message)
    }
  } catch (e) {
    return {
      valid: false,
      errors: [(e as Error).message]
    }
  }
}
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

**Example Test File:**

```typescript
// /src/test/commands/products.test.ts
import { describe, it, expect } from 'vitest'
import { runCommandDryRun, validateGraphQLOperation } from '../testUtils'

describe('products commands', () => {
  it('products list generates valid GraphQL', async () => {
    const graphql = await runCommandDryRun(['products', 'list'])
    const result = validateGraphQLOperation(graphql)
    expect(result.valid).toBe(true)
  })

  it('products get generates valid GraphQL', async () => {
    const graphql = await runCommandDryRun(['products', 'get', '--id', 'gid://shopify/Product/123'])
    const result = validateGraphQLOperation(graphql)
    expect(result.valid).toBe(true)
  })

  it('products create generates valid GraphQL', async () => {
    const graphql = await runCommandDryRun([
      'products', 'create',
      '--set', 'title=Test Product'
    ])
    const result = validateGraphQLOperation(graphql)
    expect(result.valid).toBe(true)
  })

  // ... more test cases
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
- [ ] Install Vitest and dependencies
- [ ] Create `vitest.config.ts`
- [ ] Add test scripts to `package.json`
- [ ] Create `/src/test/` directory structure

### Step 2: Create Validation Utilities
- [ ] Implement `validateGraphQLOperation()` function
- [ ] Create `runCommandDryRun()` test helper
- [ ] Add error formatting utilities

### Step 3: Build Command Registry
- [ ] Audit all 66 verb files
- [ ] Document every resource/verb combination
- [ ] Identify required vs optional arguments
- [ ] Create registry data structure

### Step 4: Write Initial Tests
- [ ] Start with high-traffic commands (products, orders, customers)
- [ ] Add tests for all CRUD operations
- [ ] Cover edge cases (empty inputs, special characters)

### Step 5: Achieve 100% Coverage
- [ ] Generate tests for all remaining commands
- [ ] Test different view modes (summary, full, ids)
- [ ] Test selection variations
- [ ] Test error paths

### Step 6: CI Integration
- [ ] Add test job to CI pipeline
- [ ] Configure coverage thresholds
- [ ] Add pre-commit hooks

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

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Schema changes break tests | Version schema tests, update schema regularly |
| Commands require complex inputs | Create fixture data generators |
| Some commands have side effects | Use `--dry-run` exclusively for validation |
| Test maintenance burden | Automate test generation where possible |

---

## Files to Create

```
/src/test/
├── setup.ts                    # Test setup, schema loading
├── validateGraphQL.ts          # GraphQL validation utility
├── testUtils.ts                # runCommandDryRun, helpers
├── commandRegistry.ts          # All commands with args
├── coverage.ts                 # Coverage tracking
├── commands/
│   ├── products.test.ts
│   ├── customers.test.ts
│   ├── orders.test.ts
│   ├── collections.test.ts
│   ├── ... (one per resource)
│   └── graphql.test.ts         # Raw GraphQL command
└── fixtures/
    ├── inputs/                 # Sample input data
    └── expected/               # Expected GraphQL outputs (optional)

/vitest.config.ts               # Vitest configuration
```

---

## Next Steps

1. **Answer the clarifying questions above** to finalize approach
2. **Begin Phase 1** - Install test framework
3. **Create validation utilities** (Phase 2)
4. **Start with products tests** as proof of concept
5. **Expand to all resources** systematically
