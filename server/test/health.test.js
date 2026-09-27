import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';

test('GET /api/health reports a healthy API', async () => {
  const response = await request(createApp()).get('/api/health').expect(200);
  assert.equal(response.body.data.status, 'ok');
  assert.equal(response.body.data.service, 'nutrilens-api');
  assert.match(response.body.data.timestamp, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(typeof response.body.data.uptimeSeconds, 'number');
  assert.deepEqual(response.body.data.database, {
    name: 'nutrilens',
    status: 'disconnected',
  });
});

test('unknown API routes use the stable error shape', async () => {
  const response = await request(createApp()).get('/api/unknown').expect(404);
  assert.deepEqual(response.body.error, {
    code: 'ROUTE_NOT_FOUND',
    message: 'No route matches GET /api/unknown.',
  });
});
