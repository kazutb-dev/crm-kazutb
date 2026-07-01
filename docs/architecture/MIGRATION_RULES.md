# Migration Rules

## Purpose

All future database and data migrations must preserve production compatibility and data safety.

## Migration Sequence

```text
Expand
  -> Backfill
    -> Validate
      -> Migrate reads
        -> Migrate writes
          -> Verify
            -> Deprecate
              -> Cleanup later
```

## Mandatory Rules

- Every migration must be reversible at the schema level when Laravel supports it safely.
- Never drop production data in the same task that introduces replacement behavior.
- Prefer new nullable columns or new tables before switching reads/writes.
- Backfills must be idempotent or explicitly guarded.
- Reads must support old and new structures during transition.
- Writes must dual-write only when rollback and consistency rules are documented.
- Cleanup migrations must happen only after production verification and explicit approval.

## Compatibility Requirements

Every migration task must document:

- Existing data shape.
- New data shape.
- Backfill source and target.
- Validation query or test.
- Read switch plan.
- Write switch plan.
- Rollback strategy.
- Data loss risk.
