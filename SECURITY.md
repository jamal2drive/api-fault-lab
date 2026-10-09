# Security and responsible use

API Fault Lab is designed for authorized reliability testing of local, disposable, sandbox, staging, or otherwise controlled systems.

Some scenarios can create real side effects. In particular, `duplicate-upstream` deliberately sends a request twice, while `accepted-response-lost` deliberately hides an upstream response after dispatch.

Do not use destructive scenarios against production systems unless you own the system, understand the consequences, and have explicit authorization.

## Reporting a vulnerability

If you discover a security issue in API Fault Lab itself, report it privately to the repository maintainer. Please do not publish exploit details in a public issue before the maintainer has had a reasonable opportunity to investigate.
