# Contributing

Thanks for helping improve API Fault Lab.

## Local development

Requirements: Node.js 20+.

```bash
npm test
npm run check
npm run demo
```

## Scenario design rules

A new fault scenario should answer these questions unambiguously:

1. Was the upstream reached?
2. If yes, how many times?
3. What did the caller observe?
4. Is the outcome known or ambiguous from the caller's perspective?
5. Can the scenario create real side effects?

Please keep scenarios deterministic by default and add tests for those semantics.

## Scope

Prefer small, composable failure modes over application-specific behavior. API Fault Lab should remain domain-agnostic and must not depend on private product models, private integrations, or proprietary application logic.

## Pull requests

- keep changes focused
- add or update tests
- update README/docs when CLI behavior changes
- call out any scenario that can duplicate or mutate upstream state
