# Repository guidance

API Fault Lab is a zero-dependency Node.js fault-injection proxy. Changes should preserve deterministic, testable behavior.

## Working rules

- Support Node.js 20+.
- Keep runtime dependencies at zero unless there is a strong, documented reason to change that policy.
- Prefer small, explicit failure scenarios over broad or random behavior.
- Every scenario must define whether the upstream is reached, how many times it is reached, and what the caller observes.
- New or changed behavior must include tests.
- Keep the project domain-agnostic. Do not add private integrations, proprietary application logic, credentials, fixtures from private systems, or customer data.
- Destructive scenarios must be documented clearly in `SECURITY.md` or scenario documentation.

## Validation

Before proposing a change, run:

```bash
npm run check
npm run demo
```

## Useful files

- `src/proxy.js` — proxy and scenario behavior
- `src/cli.js` — CLI parsing and validation
- `test/` — executable behavior tests
- `docs/SCENARIOS.md` — scenario semantics
- `ROADMAP.md` — proposed future work
- `CONTRIBUTING.md` — contributor expectations
