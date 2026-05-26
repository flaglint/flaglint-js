# Security Policy

## Reporting a Vulnerability

Please report suspected vulnerabilities privately by opening a GitHub Security Advisory:

https://github.com/flaglint/flaglint/security/advisories/new

If GitHub advisories are unavailable, email the maintainer listed on the npm package page
with the following details:

- Affected FlagLint version (run `flaglint --version`)
- Steps to reproduce
- Observed impact

Do not open a public GitHub issue for a security vulnerability until it has been triaged
and a fix is available.

Maintainers aim to acknowledge reports within 5 business days and to publish a patch
release for confirmed vulnerabilities as soon as practical.

## Supported Versions

Security fixes are provided for the latest published version of FlagLint.
Older versions are not actively patched — upgrade to the latest release.

| Version | Supported |
|---------|-----------|
| Latest  | Yes       |
| Older   | No        |

## Reporting a False Positive or Unsupported Pattern

If FlagLint flags a call site it should not (false positive), or misses a pattern it
should detect (false negative), open a GitHub Issue with a minimal reproduction:

https://github.com/flaglint/flaglint/issues/new?template=unsupported_pattern.yml

Include the source snippet, the FlagLint version, and the command you ran.
Label the issue `false-positive` or `unsupported-pattern`.

## Scope

FlagLint is a local static-analysis CLI. It reads source files from the directory
you point it at and writes reports or transformed files to disk.
It makes no outbound network connections during a flag scan or migration.
No source code is transmitted to any external service.

See [docs/trust.md](docs/trust.md) for a full trust and provenance statement.
