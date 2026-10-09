# Roadmap

API Fault Lab intentionally starts small. Proposed additions should keep scenarios deterministic and semantically precise.

## Near term

- response truncation after N bytes
- upstream timeout / never-respond scenario
- header-based request matching
- simple JSON scenario files
- optional request/response metadata capture with redaction
- Docker image

## Later, if justified by real use

- sequential multi-step scenarios
- CI assertions around observed fault counts
- reusable scenario presets for common idempotency tests
- npm package publication

## Explicitly out of scope for now

- random production chaos
- traffic load generation
- packet-level network simulation
- application-specific correctness or business-state logic
