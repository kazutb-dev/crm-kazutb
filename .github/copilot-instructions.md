# Copilot Instructions — CRM KazUTB

## Workspace and Deployment Boundaries

- Use `/var/www/laravel-react-dev` as the only workspace for planning and implementation.
- Treat `/var/www/laravel-react` as production checkout for deploy/sync verification only.
- Do not initialize or manage GSD artifacts in the production checkout.

## Release Safety Invariant

- Before any release activity, production git tree must be clean.
- Use `scripts/deploy/deploy.sh` from the dev repository as the deployment entrypoint.

## Current Priority

- Prioritize migration stabilization and release-security hardening over new feature expansion.
