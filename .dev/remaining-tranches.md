# Remaining work: 4 concurrent tranches

Goal: implement the remaining operations + workflows described in `.dev/operations.md` and `.dev/workflows.md`, on top of the CLI skeleton already in `src/cli/*` and `src/cli/verbs/*`.

This doc splits the remaining work into **four tranches that can proceed in parallel** with minimal overlap. Each tranche “owns” a set of files/directories so multiple people can work concurrently without repeatedly conflicting.

Notes on structure today:

- Entry point: `src/cli.ts`
- Shared CLI helpers: `src/cli/*`
- Resource handlers: `src/cli/verbs/*.ts`
- Router: `src/cli/router.ts` (expected to be the only common touchpoint when adding new resources)

If you want truly zero conflicts, nominate a single person to do “router wiring” changes (small edits to `src/cli/router.ts`) while others build their tranche’s new files.

---

## Tranche 1 — CLI core capabilities (selection, output, UX)

**Primary objective:** implement the remaining cross-cutting CLI conventions so all resource/workflow commands benefit, without needing to touch individual resource verbs repeatedly.

**Work items (from notes):**

- `--selection <graphql>` support (raw selection override / passthrough)
- `--select <path>` **dot-path** support (and predictable connection defaults/caps)
- Views/presets: make `--view summary|ids|full|raw` consistent + extensible
- Output:
  - `--format table` improvements (columns, pageInfo, quiet mode)
  - `--quiet` behavior consistency (IDs-only wherever possible)
- Error handling:
  - consistent non-zero exit on `userErrors` (already present) + clear printing
  - consistent printing for GraphQL errors (e.g. `GenqlError`)
- Flag parsing consistency:
  - ensure global flags and per-command flags are well-separated
  - add `--help` at resource/verb level (optional)
- Add lightweight tests for the “pure” pieces (input building, select parsing, GID coercion) if desired.

**Owned files / directories (avoid conflicts):**

- `src/cli/input.ts`
- `src/cli/output.ts`
- `src/cli/userErrors.ts`
- New: `src/cli/selection/*` (recommended place for `--select`/`--selection` implementation)
- New: `src/cli/flags/*` (optional; only if you want to refactor parsing)

**Avoid touching:**

- `src/cli/verbs/*` (except to optionally adopt the new selection/output helpers once stable)
- `src/cli/router.ts` (unless you’re also the nominated “router wiring” person)

**Deliverable:** shared helpers that resource/workflow tranches can consume with only small, local changes.

---

## Tranche 2 — Product-facing workflows (no file uploads)

**Primary objective:** implement high-leverage product workflows from `.dev/workflows.md` that don’t require staged uploads / file creation.

**Commands to implement (recommended):**

- `shop publications resolve` (resolve publication GID by name/handle)
- `shop products publish` / `shop products unpublish`
- `shop products publish-all` (lists publications then publishes)
- `shop products metafields upsert` (uses metafieldsSet / appropriate mutation)
- `shop product-variants upsert` (bulk-ish convenience wrapper if feasible without uploads)

**Owned files / directories (avoid conflicts):**

- `src/cli/verbs/products.ts` (workflow verbs under `products`)
- New: `src/cli/workflows/products/*`
- New: `src/cli/workflows/publications/*` (if you want a tiny helper used by multiple workflows)

**Avoid touching:**

- `src/cli/verbs/files.ts` (doesn’t exist yet; keep uploads out of this tranche)
- `src/cli/verbs/inventory.ts` (keep inventory out of this tranche)
- `src/cli/router.ts` (unless adding a new top-level resource like `publications`)

**Integration note:** if you add a new top-level resource (`publications`), that requires a small router update. Everything else can stay under `products` to avoid router conflicts.

---

## Tranche 3 — Inventory + files/media uploads (staged uploads pipeline)

**Primary objective:** implement workflows that require multi-step operations and/or staging files.

**Commands to implement (recommended):**

- `shop inventory set` / `shop inventory adjust`
  - supporting lookups: locations list/get (if needed), inventoryItem resolution (if needed)
- `shop files upload` (staged upload + create file + return GIDs)
- `shop products media upload` (internally uses staged upload + fileCreate + attach)
- `shop products media add` (URL-based attach, if it depends on the same plumbing you build here)

**Owned files / directories (avoid conflicts):**

- New: `src/cli/verbs/inventory.ts`
- New: `src/cli/verbs/files.ts`
- New: `src/cli/workflows/files/*`
- New: `src/cli/workflows/inventory/*`
- Optionally: extend `src/cli/gid.ts` if you need extra coercions (try to keep edits additive)

**Expected shared touchpoint:**

- `src/cli/router.ts` to register `inventory` and `files` as top-level resources.

**Avoid touching:**

- `src/cli/verbs/products.ts` unless you’re implementing `products media upload` (if you do, keep changes localized and delegate shared upload plumbing to `src/cli/workflows/files/*`).

---

## Tranche 4 — Expand CRUD resources (Tier 2 + Tier 3)

**Primary objective:** implement the remaining “CRUD-ish” operations from `.dev/operations.md` as standard `create|get|list|update|delete|duplicate|count` verbs.

**Suggested resource grouping (pick a set; keep it disjoint from other tranches):**

- Content: `articles`, `blogs`, `pages`, `comments`
- Merchandising/structure: `menus`, `publications`, `catalogs`, `markets`
- Draft orders: `draft-orders` (+ delivery options, invoice preview/send, bulk tags)
- Redirects + segments: `url-redirects`, `segments`
- Webhooks: `webhooks`
- Meta: `metafield-definitions`, `metaobjects`, `metaobject-definitions`
- Selling plans: `selling-plan-groups` (full CRUD if not taken by Tranche 2)

**Owned files / directories (avoid conflicts):**

- New: one file per resource in `src/cli/verbs/<resource>.ts`
  - e.g. `src/cli/verbs/pages.ts`, `src/cli/verbs/webhooks.ts`, etc.

**Expected shared touchpoint:**

- `src/cli/router.ts` to register each new top-level resource.

**Conflict minimization tip:**

- Batch router wiring into a single small PR (or have a single person do it), while each resource implementation lands as “new files only” PRs.

---

## Shared conventions (keep consistent across tranches)

- `--id` is the primary target identifier; accept numeric and coerce to the implied GID type when the resource is known.
- `--input`, `--set`, `--set-json` should work everywhere that accepts an input object.
- `list` commands should support `--query`, `--first`, `--after`, `--sort`, `--reverse` when the underlying API supports it.
- Default output should be stable and shallow (`summary`), with `--view full` for richer output.
- Deleting should require `--yes`.

---

## Where to track progress

- Update `dev/cli-progress.md` as each tranche lands (implemented commands + gaps).

