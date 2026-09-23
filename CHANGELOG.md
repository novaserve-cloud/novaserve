# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Automated npm package validation script (`scripts/validate-package.mjs`) ensuring binary presence, correct exports, and preventing workspace file leaks.
- 20+ comprehensive unit and integration tests covering the Compiler, Nova IR, Dependency DAG, Topological Resolver, Planner, Config Validator, AWS Provider, and CLI commands.
- Standalone runnable examples: `examples/hello-world`, `examples/rest-api`, and `examples/aws-lambda`.
- Full documentation hierarchy in `docs/` covering installation, quick start, architecture, CLI commands, and provider support matrices.
- Open source governance files (`CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `.github/ISSUE_TEMPLATE/`).

### Fixed
- Fixed critical npm release issue where monorepo root was published instead of the CLI package. Added `"private": true` to root `package.json` and redirected release publishing exclusively through `packages/cli`.
- Fixed missing `bin.nova` and entrypoint issues on published packages.
- Enhanced `nova deploy` error handling with actionable AWS credential troubleshooting and diagnostics.
- Enhanced `nova doctor` with graceful missing configuration fallbacks and Node.js >= 20 checks.

## [2.2.4] - 2026-09-15

### Added
- Production-grade Cloudflare and Docker provider upgrades.
- Real AWS SDK v3 service integrations for Lambda, S3, SQS, API Gateway v2, and DynamoDB.
- Journaled execution engine with step-by-step audit records in `.nova/journal.json`.
- State locking mechanism preventing concurrent deployment collisions.

## [2.1.6] - 2026-08-20

### Changed
- Transitioned project license from MIT to Apache-2.0.
