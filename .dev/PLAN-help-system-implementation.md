# Plan: 100% Help Coverage + Consistency

## Goal
Make the help system cover every routed command and ensure consistent output across all resources/verbs.

## Steps
1) Inventory routed resources + verbs
   - Derive a definitive list from `src/cli/router.ts` and `src/cli/verbs/*.ts` (multi-word verbs included).
   - Compare against `src/cli/help/registry.ts` to identify missing resources/verbs and mismatched names.

2) Centralize help rendering
   - Use `src/cli/help/render.ts` for top-level, resource-level, and verb-level help.
   - Allow `shop <resource> --help` and `shop <resource> <verb> --help` to return consistent output without running handlers.

3) Expand the registry to 100% coverage
   - Add every routed resource and verb to `src/cli/help/registry.ts`.
   - Ensure each `VerbSpec` has operation name, input arg (if any), required flags, optional flags, output flags, examples, and notes.
   - Normalize patterns (CRUD, list pagination, bulk, async, multi-step workflows).

4) Optional: add a lightweight coverage check
   - Add a small script (or test) that asserts registry coverage against routed verbs.
   - Useful to prevent regressions when new commands land.

## Deliverables
- Updated `src/cli/help/registry.ts` with full command coverage.
- Updated help wiring in `src/cli.ts` (and/or `src/cli/router.ts`) for consistent help output.
- Optional coverage check if approved.
