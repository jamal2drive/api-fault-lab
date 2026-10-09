import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createFaultProxy } from '../src/proxy.js';

const silentLogger = { log() {} };

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

function startUpstream(handler) {
  const server = http.createServer(handler);
  return listen(server).then((port) => ({ server, url: `http://127.0.0.1:${port}` }));
}

async function withProxy(options, fn) {
  const proxy = createFaultProxy({ ...options, logger: silentLogger });
  const port = await listen(proxy);
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await close(proxy);
  }
}

test('pass-through forwards response and marker', async () => {
  const upstream = await startUpstream((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  });

  try {
    await withProxy({ target: upstream.url }, async (proxyUrl) => {
      const res = await fetch(`${proxyUrl}/hello`);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('x-api-fault-lab'), 'pass-through');
      assert.ok(res.headers.get('x-api-fault-lab-request-id'));
      assert.deepEqual(await res.json(), { ok: true });
    });
  } finally {
    await close(upstream.server);
  }
});

test('http-error fails without touching upstream', async () => {
  let hits = 0;
  const upstream = await startUpstream((req, res) => {
    hits += 1;
    res.end('ok');
  });

  try {
    await withProxy({ target: upstream.url, scenario: 'http-error', errorStatus: 429 }, async (proxyUrl) => {
      const res = await fetch(`${proxyUrl}/pay`, { method: 'POST', body: 'x' });
      assert.equal(res.status, 429);
      assert.equal(hits, 0);
    });
  } finally {
    await close(upstream.server);
  }
});

test('accepted-response-lost sends upstream once but client receives no response', async () => {
  let hits = 0;
  const upstream = await startUpstream((req, res) => {
    hits += 1;
    res.writeHead(201, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ orderId: 'ord_123' }));
  });

  try {
    await withProxy({ target: upstream.url, scenario: 'accepted-response-lost' }, async (proxyUrl) => {
      await assert.rejects(() => fetch(`${proxyUrl}/orders`, { method: 'POST', body: '{}' }));
      assert.equal(hits, 1);
    });
  } finally {
    await close(upstream.server);
  }
});

test('reset-before-upstream drops connection and never reaches upstream', async () => {
  let hits = 0;
  const upstream = await startUpstream((req, res) => {
    hits += 1;
    res.end('ok');
  });

  try {
    await withProxy({ target: upstream.url, scenario: 'reset-before-upstream' }, async (proxyUrl) => {
      await assert.rejects(() => fetch(`${proxyUrl}/orders`, { method: 'POST', body: '{}' }));
      assert.equal(hits, 0);
    });
  } finally {
    await close(upstream.server);
  }
});

test('duplicate-upstream dispatches request twice', async () => {
  let hits = 0;
  const upstream = await startUpstream((req, res) => {
    hits += 1;
    res.writeHead(200);
    res.end(`hit-${hits}`);
  });

  try {
    await withProxy({ target: upstream.url, scenario: 'duplicate-upstream' }, async (proxyUrl) => {
      const res = await fetch(`${proxyUrl}/mutation`, { method: 'POST', body: 'x' });
      assert.equal(res.status, 200);
      await res.text();
      assert.equal(hits, 2);
    });
  } finally {
    await close(upstream.server);
  }
});

test('every=N injects deterministically across matching requests', async () => {
  let hits = 0;
  const upstream = await startUpstream((req, res) => {
    hits += 1;
    res.end('ok');
  });

  try {
    await withProxy({ target: upstream.url, scenario: 'http-error', every: 2 }, async (proxyUrl) => {
      const r1 = await fetch(`${proxyUrl}/x`);
      const r2 = await fetch(`${proxyUrl}/x`);
      assert.equal(r1.status, 200);
      assert.equal(r2.status, 503);
      assert.equal(hits, 1);
    });
  } finally {
    await close(upstream.server);
  }
});

test('method and path matching leave unrelated traffic untouched', async () => {
  let hits = 0;
  const upstream = await startUpstream((req, res) => {
    hits += 1;
    res.end('ok');
  });

  try {
    await withProxy({
      target: upstream.url,
      scenario: 'http-error',
      errorStatus: 500,
      matchMethod: 'POST',
      matchPath: '/orders'
    }, async (proxyUrl) => {
      const getOrders = await fetch(`${proxyUrl}/orders`);
      const postOther = await fetch(`${proxyUrl}/other`, { method: 'POST' });
      const postOrders = await fetch(`${proxyUrl}/orders`, { method: 'POST' });

      assert.equal(getOrders.status, 200);
      assert.equal(postOther.status, 200);
      assert.equal(postOrders.status, 500);
      assert.equal(hits, 2);
    });
  } finally {
    await close(upstream.server);
  }
});

test('every=N counts matching requests, not unrelated traffic', async () => {
  let hits = 0;
  const upstream = await startUpstream((req, res) => {
    hits += 1;
    res.end('ok');
  });

  try {
    await withProxy({
      target: upstream.url,
      scenario: 'http-error',
      every: 2,
      matchMethod: 'POST',
      matchPath: '/orders'
    }, async (proxyUrl) => {
      assert.equal((await fetch(`${proxyUrl}/health`)).status, 200);
      assert.equal((await fetch(`${proxyUrl}/orders`, { method: 'POST' })).status, 200);
      assert.equal((await fetch(`${proxyUrl}/health`)).status, 200);
      assert.equal((await fetch(`${proxyUrl}/orders`, { method: 'POST' })).status, 503);
      assert.equal(hits, 3);
    });
  } finally {
    await close(upstream.server);
  }
});

test('invalid proxy options fail fast', () => {
  assert.throws(() => createFaultProxy({ target: 'ftp://example.com' }), /http/);
  assert.throws(() => createFaultProxy({ target: 'http://example.com', every: 0 }), /every/);
  assert.throws(() => createFaultProxy({ target: 'http://example.com', errorStatus: 200 }), /errorStatus/);
  assert.throws(() => createFaultProxy({ target: 'http://example.com', matchPath: 'orders' }), /matchPath/);
});
