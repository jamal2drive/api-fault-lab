import http from 'node:http';
import https from 'node:https';
import { randomUUID } from 'node:crypto';

export const SCENARIOS = new Set([
  'pass-through',
  'latency',
  'http-error',
  'reset-before-upstream',
  'accepted-response-lost',
  'duplicate-upstream'
]);

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade'
]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function sanitizeHeaders(headers) {
  const clean = {};
  for (const [name, value] of Object.entries(headers)) {
    if (!HOP_BY_HOP_HEADERS.has(name.toLowerCase())) clean[name] = value;
  }
  return clean;
}

function normalizeTarget(target) {
  const url = target instanceof URL ? target : new URL(target);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('target must use http: or https:');
  }
  return url;
}

function normalizeHeaderMatch(matchHeader) {
  if (!matchHeader) return null;
  const text = String(matchHeader);
  const separator = text.indexOf(':');
  if (separator <= 0) throw new Error('matchHeader must use name:value');

  const name = text.slice(0, separator).trim().toLowerCase();
  const value = text.slice(separator + 1).trim();
  if (!name || !value) throw new Error('matchHeader must use non-empty name:value');

  return { name, value };
}

function requestMatches(req, matchMethod, matchPath, headerMatch) {
  if (matchMethod && req.method?.toUpperCase() !== matchMethod) return false;
  if (matchPath) {
    const pathname = new URL(req.url ?? '/', 'http://api-fault-lab.local').pathname;
    if (pathname !== matchPath) return false;
  }
  if (headerMatch) {
    const actual = req.headers[headerMatch.name];
    if (Array.isArray(actual)) {
      if (!actual.some((value) => String(value) === headerMatch.value)) return false;
    } else if (actual === undefined || String(actual) !== headerMatch.value) {
      return false;
    }
  }
  return true;
}

function requestUpstream(target, req, body) {
  return new Promise((resolve, reject) => {
    const targetUrl = new URL(req.url ?? '/', target);
    const client = targetUrl.protocol === 'https:' ? https : http;

    const headers = sanitizeHeaders(req.headers);
    headers.host = targetUrl.host;
    headers['content-length'] = String(body.length);

    const upstreamReq = client.request(
      targetUrl,
      {
        method: req.method,
        headers
      },
      (upstreamRes) => {
        const chunks = [];
        upstreamRes.on('data', (chunk) => chunks.push(chunk));
        upstreamRes.on('end', () => {
          resolve({
            statusCode: upstreamRes.statusCode ?? 502,
            statusMessage: upstreamRes.statusMessage,
            headers: sanitizeHeaders(upstreamRes.headers),
            body: Buffer.concat(chunks)
          });
        });
      }
    );

    upstreamReq.on('error', reject);
    if (body.length) upstreamReq.write(body);
    upstreamReq.end();
  });
}

function writeResponse(res, upstream, marker, requestId) {
  const headers = {
    ...upstream.headers,
    'x-api-fault-lab': marker,
    'x-api-fault-lab-request-id': requestId,
    'content-length': Buffer.byteLength(upstream.body)
  };
  res.writeHead(upstream.statusCode, upstream.statusMessage, headers);
  res.end(upstream.body);
}

export function createFaultProxy({
  target,
  scenario = 'pass-through',
  latencyMs = 1500,
  errorStatus = 503,
  every = 1,
  matchMethod,
  matchPath,
  matchHeader,
  logger = console
}) {
  if (!target) throw new Error('target is required');
  const normalizedTarget = normalizeTarget(target);
  if (!SCENARIOS.has(scenario)) throw new Error(`Unknown scenario: ${scenario}`);
  if (!Number.isInteger(every) || every < 1) throw new Error('every must be an integer >= 1');
  if (!Number.isInteger(latencyMs) || latencyMs < 0) throw new Error('latencyMs must be an integer >= 0');
  if (!Number.isInteger(errorStatus) || errorStatus < 400 || errorStatus > 599) {
    throw new Error('errorStatus must be an integer between 400 and 599');
  }

  const normalizedMethod = matchMethod ? String(matchMethod).toUpperCase() : null;
  if (matchPath && !String(matchPath).startsWith('/')) throw new Error('matchPath must start with /');
  const normalizedHeaderMatch = normalizeHeaderMatch(matchHeader);

  let requestCount = 0;
  let matchedRequestCount = 0;

  const server = http.createServer(async (req, res) => {
    requestCount += 1;
    const requestId = randomUUID();
    const matched = requestMatches(req, normalizedMethod, matchPath, normalizedHeaderMatch);
    if (matched) matchedRequestCount += 1;

    const inject = matched && matchedRequestCount % every === 0;
    const activeScenario = inject ? scenario : 'pass-through';
    const startedAt = Date.now();

    const log = (event, extra = {}) => logger.log(JSON.stringify({
      ts: new Date().toISOString(),
      event,
      requestId,
      requestNumber: requestCount,
      matchedRequestNumber: matched ? matchedRequestCount : null,
      method: req.method,
      path: req.url,
      matched,
      scenario: activeScenario,
      ...extra
    }));

    try {
      const body = await readBody(req);
      log('request_received', { bytes: body.length });

      if (activeScenario === 'reset-before-upstream') {
        log('connection_reset_before_upstream', { durationMs: Date.now() - startedAt });
        res.destroy();
        return;
      }

      if (activeScenario === 'http-error') {
        const payload = Buffer.from(JSON.stringify({
          error: 'injected_by_api_fault_lab',
          requestId,
          status: errorStatus
        }));
        res.writeHead(errorStatus, {
          'content-type': 'application/json',
          'content-length': payload.length,
          'x-api-fault-lab': activeScenario,
          'x-api-fault-lab-request-id': requestId
        });
        res.end(payload);
        log('injected_http_error', { statusCode: errorStatus, durationMs: Date.now() - startedAt });
        return;
      }

      if (activeScenario === 'latency') {
        log('latency_started', { latencyMs });
        await sleep(latencyMs);
      }

      if (activeScenario === 'duplicate-upstream') {
        const [first, second] = await Promise.all([
          requestUpstream(normalizedTarget, req, body),
          requestUpstream(normalizedTarget, req, body)
        ]);
        writeResponse(res, first, activeScenario, requestId);
        log('duplicate_upstream_dispatched', {
          firstStatus: first.statusCode,
          secondStatus: second.statusCode,
          durationMs: Date.now() - startedAt
        });
        return;
      }

      const upstream = await requestUpstream(normalizedTarget, req, body);

      if (activeScenario === 'accepted-response-lost') {
        log('upstream_response_discarded', {
          upstreamStatus: upstream.statusCode,
          upstreamBytes: upstream.body.length,
          durationMs: Date.now() - startedAt
        });
        res.destroy();
        return;
      }

      writeResponse(res, upstream, activeScenario, requestId);
      log('response_forwarded', {
        upstreamStatus: upstream.statusCode,
        durationMs: Date.now() - startedAt
      });
    } catch (error) {
      log('proxy_error', { message: error?.message ?? String(error), durationMs: Date.now() - startedAt });
      if (!res.headersSent) {
        const payload = Buffer.from(JSON.stringify({ error: 'proxy_error', requestId }));
        res.writeHead(502, {
          'content-type': 'application/json',
          'content-length': payload.length,
          'x-api-fault-lab': 'proxy-error',
          'x-api-fault-lab-request-id': requestId
        });
        res.end(payload);
      } else {
        res.destroy();
      }
    }
  });

  return server;
}
