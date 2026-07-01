# Coding Rules

## Purpose

These rules govern future implementation tasks. TASK-001 itself changes no executable behavior.

## General Rules

- Implement one task at a time.
- Do not modify unrelated modules.
- Prefer extraction over rewriting.
- Preserve existing routes, APIs, controllers, frontend behavior, database compatibility, permissions, workflows, and integrations.
- Do not remove legacy behavior until replacement behavior is implemented, tested, verified, switched, and rollback-safe.

## Layer Rules

- Controllers must not contain business rules.
- Middleware must not contain business rules.
- Route closures must not contain domain writes or workflows.
- Application services own use cases and transaction boundaries.
- Domain services own business rules.
- Infrastructure services own external system calls only.
- Contracts define stable boundaries where multiple layers or modules depend on the same behavior.
- DTOs are introduced only when they reduce coupling for a concrete use case.

## Model Rules

- Do not add new cross-domain relationships to `User`.
- Do not add new business callbacks to Eloquent models for cross-domain side effects.
- Do not add security-sensitive mass assignment fields without a dedicated application service and review.
- Existing model behavior may remain during migration but must not expand as a pattern.

## Abstraction Rules

- Do not create base classes without an immediate implementation consumer.
- Prefer concrete application services first.
- Extract interfaces only when there are multiple implementations, external integration boundaries, or test seams that justify them.
