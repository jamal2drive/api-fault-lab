#!/usr/bin/env node
import { createFaultProxy, SCENARIOS } from './proxy.js';

const VERSION = '0.2.1';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function printHelp() {
  console.log(`api-fault-lab v${VERSION}\n\nUsage:\n  api-fault-lab --target <url> [options]\n\nOptions:\n  --target <url>          Upstream API base URL (required)\n  --port <number>         Local proxy port (default: 8787)\n  --scenario <name>       Fault scenario (default: pass-through)\n  --latency-ms <number>   Delay for latency scenario (default: 1500)\n  --error-status <number> Status for http-error scenario (default: 503)\n  --every <number>        Inject on every Nth matching request (default: 1)\n  --match-method <method> Only inject for this HTTP method, e.g. POST\n  --match-path <path>     Only inject for this exact URL path, e.g. /orders\n  --match-header <n:v>    Only inject when this request header exactly matches\n  --list-scenarios        Print scenario names and exit\n  --version               Print version and exit\n  --help                  Show this help\n\nScenarios:\n  ${[...SCENARIOS].join('\n  ')}\n\nSafety:\n  Use against local, test, or sandbox systems. Some scenarios intentionally\n  duplicate or interrupt requests and can cause real side effects.\n`);
}

function parseInteger(name, value, { min, max } = {}) {
  const number = Number(value);
  if (!Number.isInteger(number)) throw new Error(`${name} must be an integer`);
  if (min !== undefined && number < min) throw new Error(`${name} must be >= ${min}`);
  if (max !== undefined && number > max) throw new Error(`${name} must be <= ${max}`);
  return number;
}

const args = parseArgs(process.argv.slice(2));

if (args.version) {
  console.log(VERSION);
  process.exit(0);
}

if (args['list-scenarios']) {
  console.log([...SCENARIOS].join('\n'));
  process.exit(0);
}

if (args.help || !args.target) {
  printHelp();
  process.exit(args.help ? 0 : 1);
}

try {
  const port = parseInteger('port', args.port ?? 8787, { min: 1, max: 65535 });
  const latencyMs = parseInteger('latency-ms', args['latency-ms'] ?? 1500, { min: 0 });
  const errorStatus = parseInteger('error-status', args['error-status'] ?? 503, { min: 400, max: 599 });
  const every = parseInteger('every', args.every ?? 1, { min: 1 });
  const scenario = args.scenario ?? 'pass-through';

  const server = createFaultProxy({
    target: args.target,
    scenario,
    latencyMs,
    errorStatus,
    every,
    matchMethod: args['match-method'],
    matchPath: args['match-path'],
    matchHeader: args['match-header']
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`API Fault Lab listening on http://127.0.0.1:${port}`);
    console.log(`Target: ${args.target}`);
    console.log(`Scenario: ${scenario}`);
    console.log(`Fault cadence: every ${every} matching request(s)`);
    if (args['match-method']) console.log(`Match method: ${String(args['match-method']).toUpperCase()}`);
    if (args['match-path']) console.log(`Match path: ${args['match-path']}`);
    if (args['match-header']) console.log(`Match header: ${args['match-header']}`);
  });

  process.on('SIGINT', () => server.close(() => process.exit(0)));
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
} catch (error) {
  console.error(`api-fault-lab: ${error?.message ?? String(error)}`);
  process.exit(1);
}
