# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.x     | ✅ Active support  |
| 1.x     | ❌ End of life     |

## Reporting a Vulnerability

The NovaServe team takes security seriously. We appreciate your efforts to responsibly disclose your findings.

**Please DO NOT open a public GitHub issue for security vulnerabilities.**

### Reporting Process

1. **Email**: Send a detailed report to the repository owner via GitHub's private vulnerability reporting:
   - Navigate to the [Security tab](https://github.com/sazamansari/NovaServe-/security/advisories) of this repository
   - Click **"Report a vulnerability"**

2. **What to include in your report**:
   - Description of the vulnerability and its potential impact
   - Steps to reproduce the issue
   - Affected versions
   - Any proof-of-concept code (if available)
   - Suggested remediation (if you have one)

### Response Timeline

| Stage | Timeframe |
|-------|-----------|
| Acknowledgment | Within 48 hours |
| Initial assessment | Within 7 days |
| Fix or mitigation | Within 30 days (critical), 90 days (high/medium) |
| Public disclosure | After fix is released |

## Security Design Principles

NovaServe is designed with security-first principles:

- **Least-privilege IAM**: The compiler auto-generates minimal IAM policies from the dependency graph
- **Secret scanning**: `nova security` audits IR graphs for hardcoded secrets and wildcard policies  
- **Production protection**: Destructive actions on production are blocked by default
- **Atomic state**: Deployment state uses atomic file operations to prevent corruption
- **No credential logging**: Secrets and credentials are masked in all logs and plan output
- **Dependency audit**: Run `pnpm audit` to check for known vulnerabilities in dependencies

## Scope

The following are **in scope** for security reports:
- NovaServe core engine (`packages/core`)
- CLI (`packages/cli`)
- AWS/Azure/GCP/Cloudflare provider adapters
- SDK (`packages/sdk`)
- Authentication package (`packages/auth`)

The following are **out of scope**:
- Vulnerabilities in third-party dependencies (please report those upstream)
- Vulnerabilities in user-authored application code

## Acknowledgments

We thank all security researchers who responsibly disclose vulnerabilities. Contributors who report valid security issues will be acknowledged in release notes (unless they prefer to remain anonymous).
