import http from 'node:http';

const orders = [];

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/orders') {
    const order = { orderId: `order_${orders.length + 1}`, accepted: true };
    orders.push(order);
    res.writeHead(201, { 'content-type': 'application/json' });
    res.end(JSON.stringify(order));
    return;
  }

  if (req.method === 'GET' && req.url === '/orders') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ orders }));
    return;
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'not_found' }));
});

server.listen(9090, '127.0.0.1', () => {
  console.log('Mock API on http://127.0.0.1:9090');
});
