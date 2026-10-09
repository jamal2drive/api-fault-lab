# API Fault Lab

**Deterministic fault injection for API clients and integrations.**

API Fault Lab is a small, zero-dependency reverse proxy that reproduces the failure modes ordinary mocks usually miss: ambiguous outcomes, connection resets, duplicate dispatch, deterministic latency, and injected HTTP errors.

It is built for local development, CI, sandboxes, and staging environments.

> **Safety:** use API Fault Lab only with systems you control or are authorized to test. Some scenarios intentionally duplicate requests or hide successful responses and can create real side effects.

## The failure this project cares about most

A production mutation can succeed while the caller sees only a network failure:

```text
client              API Fault Lab              upstream
  | POST /orders           |                       |
  |----------------------->| POST /orders          |
  |                        |---------------------->|
  |                        |        201 Created    |
  |                        |<----------------------|
  |   connection dropped  X                       |
  |
  | caller saw failure, but the order may exist
```

That is not equivalent to "the request failed." It is an **ambiguous outcome**. API Fault Lab makes it easy to reproduce this state on demand.

## Requirements

- Node.js 20+
- No runtime dependencies

## 60-second demo

Clone the repository, then run:

```bash
npm test
npm run demo
```

Expected demo output:

```text
Sending POST /orders through API Fault Lab...
Client result: network failure (no response received)
Upstream state: 1 order(s) exist
Meaning: the client observed failure, but the mutation succeeded.
```

## Quick start

Start the included test API:

```bash
node examples/mock-api.js
```

Start API Fault Lab in another terminal:

```bash
node src/cli.js \
  --target http://127.0.0.1:9090 \
  --scenario accepted-response-lost \
  --match-method POST \
  --match-path /orders \
  --port 8787
```

Send a request through the proxy:

```bash
curl -i -X POST http://127.0.0.1:8787/orders \
  -H 'content-type: application/json' \
  -d '{"sku":"demo"}'
```

The upstream accepts the order, but the client connection is dropped before the response is delivered. Query the mock API directly to see that the order exists:

```bash
curl http://127.0.0.1:9090/orders
```

## Scenarios

| Scenario | What it simulates | Upstream reached? | Client gets upstream response? |
| --- | --- | ---: | ---: |
| `pass-through` | Control / normal traffic | Yes | Yes |
| `latency` | Deterministic network/service delay | Yes | Yes, delayed |
| `http-error` | Injected 4xx/5xx without dispatch | No | No |
| `reset-before-upstream` | Connection loss before dispatch | No | No |
| `accepted-response-lost` | Mutation succeeds, response disappears | Yes, once | No |
| `duplicate-upstream` | Accidental duplicate dispatch | Yes, twice | First response |

See [docs/SCENARIOS.md](docs/SCENARIOS.md) for exact semantics.

## Target only the request you care about

Faults can be restricted by HTTP method and exact URL path:

```bash
node src/cli.js \
  --target http://127.0.0.1:9090 \
  --scenario accepted-response-lost \
  --match-method POST \
  --match-path /orders
```

Unmatched requests pass through normally.

## Deterministic cadence

Use `--every N` to inject the fault on every Nth **matching** request:

```bash
node src/cli.js \
  --target http://127.0.0.1:9090 \
  --scenario http-error \
  --error-status 503 \
  --match-method POST \
  --match-path /orders \
  --every 3
```

The first two matching requests pass through; the third receives the injected fault; then the cycle repeats.

## Structured logs

Each request emits one-line JSON events containing fields such as:

- timestamp
- request ID
- global request number
- matching-request number
- method and path
- whether the request matched the selector
- active scenario
- upstream status when known
- duration

Successful forwarded responses also include:

```text
x-api-fault-lab: <scenario>
x-api-fault-lab-request-id: <uuid>
```

## CLI

```text
api-fault-lab --target <url> [options]

--target <url>          Upstream API base URL (required)
--port <number>         Local proxy port (default: 8787)
--scenario <name>       Fault scenario (default: pass-through)
--latency-ms <number>   Delay for latency scenario (default: 1500)
--error-status <number> Status for http-error scenario (default: 503)
--every <number>        Inject on every Nth matching request (default: 1)
--match-method <method> Only inject for this HTTP method, e.g. POST
--match-path <path>     Only inject for this exact URL path, e.g. /orders
--list-scenarios        Print scenario names and exit
--version               Print version and exit
--help                  Show help
```

## Why deterministic instead of random chaos?

This project is meant to make a hard failure **repeatable enough to become a test**. Random fault injection is valuable for other kinds of resilience work, but it is deliberately not the default here.

## Non-goals

API Fault Lab is not intended to be:

- a production reverse proxy
- a load-testing framework
- a general network emulator
- an application-specific mock server
- a system that decides whether a business operation truly succeeded

It injects controlled failures; your application remains responsible for recovery, idempotency, state verification, and domain correctness.

## Development

```bash
npm test
npm run check
npm run demo
```

CI runs the test suite on supported Node.js versions.

## Roadmap

Near-term ideas are tracked in [ROADMAP.md](ROADMAP.md). Contributions are welcome, especially small deterministic scenarios with precise semantics and tests.

## Responsible use

Read [SECURITY.md](SECURITY.md) before using destructive scenarios. Keep duplicate-dispatch and response-loss tests limited to local, disposable, sandbox, or explicitly authorized systems.

## License

MIT
