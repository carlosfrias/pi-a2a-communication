# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this repository, please report it responsibly:

- **Email:** carlos.frias@hey.com
- **Do NOT** open a public GitHub issue for security vulnerabilities

Please include:
1. A description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Suggested mitigation (if any)

I will acknowledge your report within 48 hours and provide a resolution timeline within 7 days.

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest release | ✅ |
| Previous major release | ⚠️ Security fixes only |
| Older versions | ❌ |

## Security Measures

This repository has the following security measures in place:

- **Secret scanning:** Enabled (GitHub native)
- **Push protection:** Enabled
- **Dependabot:** Enabled for dependency vulnerabilities
- **`.gitignore`:** Comprehensive patterns for secret files

## Credential Policy

- **No credentials in source code** — all credentials are stored in a password manager and referenced via environment variables or runtime secret injection
- **`.env` files are gitignored** — use `.env.example` or `.env.template` for documentation
- **Private keys are gitignored** — `.pem`, `.p12`, `.jks`, `id_rsa`, `id_ed25519` patterns
- If you find a hardcoded credential, it is a bug — please report it

## Dependency Security

- Dependencies are scanned for known vulnerabilities via Dependabot
- New dependencies should be audited before adoption
- Pin dependency versions where possible

## Disclosure Policy

- Security vulnerabilities will be disclosed after a fix is released and users have had time to update
- CVEs will be requested for significant vulnerabilities
- Credit will be given to reporters unless they request anonymity
