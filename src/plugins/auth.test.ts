import { describe, it, expect } from 'vitest';
import { buildApp } from '../app.js';

describe('auth (no DB required)', () => {
  it('rejects protected routes without a token', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/accounts/some-id' });
    expect(res.statusCode).toBe(401);
  });

  it('rejects a malformed token', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/accounts/some-id',
      headers: { authorization: 'Bearer garbage' }
    });
    expect(res.statusCode).toBe(401);
  });

  it('lets a valid token through to the handler (fails downstream without a DB, not on auth)', async () => {
    const app = buildApp();
    await app.ready();
    const token = app.jwt.sign({ sub: 'user-1', username: 'analyst', role: 'analyst' });

    const res = await app.inject({
      method: 'GET',
      url: '/accounts/some-id',
      headers: { authorization: `Bearer ${token}` }
    });

    expect(res.statusCode).not.toBe(401);
  });

  it('blocks an analyst from an admin-only route', async () => {
    const app = buildApp();
    await app.ready();
    const token = app.jwt.sign({ sub: 'user-1', username: 'analyst', role: 'analyst' });

    const res = await app.inject({
      method: 'POST',
      url: '/detection/run',
      headers: { authorization: `Bearer ${token}` }
    });

    expect(res.statusCode).toBe(403);
  });

  it('lets an admin through an admin-only route (fails downstream without a DB, not on role)', async () => {
    const app = buildApp();
    await app.ready();
    const token = app.jwt.sign({ sub: 'user-2', username: 'admin', role: 'admin' });

    const res = await app.inject({
      method: 'POST',
      url: '/detection/run',
      headers: { authorization: `Bearer ${token}` }
    });

    expect(res.statusCode).not.toBe(403);
  });
});
