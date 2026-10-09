# Changelog

## 0.2.1

- documentation-only privacy hardening before public release
- removed wording that could be confused with application-specific architecture
- repeated source, secret, path, and project-name scans

All notable changes to API Fault Lab are documented here.

## 0.2.0

- Added HTTP method and exact-path selectors.
- Changed `--every N` to count matching requests only.
- Added request IDs to forwarded/injected responses.
- Added target and option validation.
- Added hop-by-hop header filtering.
- Added a self-contained ambiguous-outcome demo.
- Expanded tests and GitHub project scaffolding.

## 0.1.0

- Initial reverse proxy.
- Added pass-through, latency, HTTP error, reset-before-upstream, accepted-response-lost, and duplicate-upstream scenarios.
- Added deterministic `--every N` cadence and JSONL logging.
