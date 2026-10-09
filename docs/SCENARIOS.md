# Scenario semantics

The most important rule in API Fault Lab is that each scenario has a precise meaning. Tests should be able to reason about whether the upstream was reached and what the caller was allowed to observe.

## `pass-through`

The request is forwarded once and the upstream response is returned normally. This is the control case.

## `latency`

The proxy waits for the configured delay before forwarding the request once. It does not change the response.

## `http-error`

The proxy returns the configured HTTP 4xx/5xx response without sending the request upstream.

**Known state:** upstream was not reached.

## `reset-before-upstream`

The client connection is destroyed before the proxy sends the request upstream.

**Known state:** upstream was not reached.

## `accepted-response-lost`

The proxy sends the request upstream exactly once and waits until the upstream response is received. It then destroys the client connection instead of forwarding that response.

**Caller-visible state:** network failure.

**Upstream state:** request was dispatched once and may have committed a side effect.

This creates an intentionally ambiguous outcome from the caller's perspective.

## `duplicate-upstream`

The proxy dispatches the same request upstream twice in parallel and returns the first response.

This scenario can create duplicate side effects. Use only with disposable, local, sandbox, or explicitly authorized targets.

## Selectors and cadence

`--match-method` and `--match-path` decide which requests are eligible for fault injection. Unmatched requests pass through.

`--every N` is counted only across matching requests. This keeps scenario timing stable even when unrelated health checks or reads pass through the proxy.
