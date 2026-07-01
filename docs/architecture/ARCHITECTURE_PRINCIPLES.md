# Architecture Principles

## Purpose

These principles define the mandatory baseline for evolving the Laravel CRM into an Enterprise Modular Monolith without breaking existing production behavior.

## Fixed Source-of-Truth Decisions

- Active Directory owns authentication, identity proof, and identity attributes only.
- Active Directory does not own roles, permissions, organization, workflow, grants, or effective authority.
- CRM owns RBAC, roles, scoped grants, delegations, workflow, organization, effective authority, and audit.
- Platonus is the future academic source and must integrate through staging, conflict handling, and explicit effective-state application.

## Layering

```text
Presentation
  -> Application
    -> Domain
      -> Infrastructure
```

## Mandatory Rules

- Routes do not contain business logic.
- Middleware does not contain business decisions; it may call application or authority services only.
- Controllers validate, authorize, orchestrate, and return responses only.
- Application services own use cases and transactions.
- Domain services own business rules that do not belong to a single aggregate root.
- Infrastructure services own external systems and never decide business authority.
- Models must not gain new cross-domain responsibilities.
- `User` must evolve toward identity only.
- Existing behavior must remain backward-compatible until replacement behavior is implemented, tested, verified, and switched.

## Namespace Strategy

| Namespace | Purpose |
|---|---|
| `App\Application` | Use-case orchestration and application services. |
| `App\Domain` | Domain rules, domain services, and future context-owned domain code. |
| `App\Infrastructure` | External gateways, adapters, clients, and integration-specific mapping. |
| `App\Contracts` | Interfaces and stable contracts shared across layers. |
| `App\DTO` | Data transfer objects for commands, queries, and responses when concrete tasks require them. |
| `App\Shared` | Shared kernel primitives only, such as stable identifiers and generic value objects. |
| `App\Support` | Laravel support utilities and framework-adjacent helpers. |

## Autoload Policy

The existing Composer PSR-4 mapping `App\` => `app/` covers all baseline namespaces. Do not add Composer autoload mappings unless a future task proves a concrete need.
