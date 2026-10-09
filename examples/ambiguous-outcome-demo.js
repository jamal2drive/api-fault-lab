import http from 'node:http';
import { createFaultProxy } from '../src/proxy.js';

const state = { orders: [] };

const upstream = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/orders') {
    const order = { id: `ord_${state.orders.length + 1}` };
    state.orders.push(order);
    res.writeHead(201, { 'content-type': 'application/json' });
    res.end(JSON.stringify(order));
    return;
  }
  res.writeHead(404);
  res.end();
});

await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
const upstreamPort = upstream.address().port;

const proxy = createFaultProxy({
  target: `http://127.0.0.1:${upstreamPort}`,
  scenario: 'accepted-response-lost',
  matchMethod: 'POST',
  matchPath: '/orders',
  logger: { log() {} }
});

await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve));
const proxyPort = proxy.address().port;

console.log('Sending POST /orders through API Fault Lab...');
try {
  await fetch(`http://127.0.0.1:${proxyPort}/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sku: 'demo' })
  });
} catch {
  console.log('Client result: network failure (no response received)');
}

console.log(`Upstream state: ${state.orders.length} order(s) exist`);
console.log('Meaning: the client observed failure, but the mutation succeeded.');

await new Promise((resolve) => proxy.close(resolve));
await new Promise((resolve) => upstream.close(resolve));
