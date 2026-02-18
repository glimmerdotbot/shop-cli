# Help System Plan (Implemented)

This plan tracks the schema-driven help system that powers `shop --help`, resource help, and verb help.

## Phase 1 (completed)

- Added a command registry for all currently implemented resources and verbs.
- Added help rendering for top-level, resource-level, and verb-level help.
- Added schema extraction to surface input fields and enum values for `--set` help.
- Integrated help rendering into `src/cli.ts` so help never runs command handlers.

## Phase 2 (next)

- For each new resource/command:
  - Add a verb entry in `src/cli/help/registry.ts`.
  - Set the GraphQL operation name and input arg name so schema help is automatic.
  - Add required flags and any custom flags.
  - Add at least one example.
- Add targeted flag groups for new workflows (bulk, async jobs, imports/exports).
- Expand truncation rules for very large input types (consider `--help-full` support per verb).
- Optionally generate registry stubs from the schema + `UNIMPLEMENTED_ANALYSIS.md`.
