# Implementation Rules

## Required Workflow

Every implementation task must follow this sequence:

1. Read the relevant current implementation.
2. Explain the current architecture.
3. Explain why it should change.
4. Explain exactly what will change.
5. Explain impact on database, API, frontend, RBAC, organization, workflow, audit, performance, and compatibility.
6. Choose the safest implementation when risk exists.
7. Implement the smallest behavior-preserving change.
8. Validate the affected module and any shared bootstrapping path.
9. Document rollback.

## Safe Extraction Pattern

```text
Existing Controller / Route / Middleware
  -> New Application Service
    -> Existing Models / Existing Services
```

This pattern preserves existing behavior while moving ownership gradually.

## Forbidden Patterns

- Big Bang rewrites.
- Deleting working functionality before replacement is verified.
- Dropping or destructively changing production data.
- Moving multiple unrelated modules in one task.
- Replacing controllers, routes, or APIs without compatibility adapters.
- Introducing RBAC, organization, or workflow changes inside unrelated feature refactors.

## Validation Expectations

Use the narrowest reliable validation first, then broader checks when safe:

- Autoload/bootstrap validation for structural changes.
- Route listing for routing compatibility.
- Targeted feature tests for changed behavior.
- Broader test suites only when the change touches shared behavior.
