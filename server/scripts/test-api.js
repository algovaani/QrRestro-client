/**
 * Smoke-test public + auth API routes (run while server is up).
 * Usage: node scripts/test-api.js [baseUrl]
 */
const http = require('http');
const https = require('https');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: require('path').join(__dirname, '../.env') });

const base = (process.argv[2] || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, '');

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path.startsWith('http') ? path : `${base}${path}`);
    const lib = url.protocol === 'https:' ? https : http;
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    };
    const req = lib.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        let json = null;
        try { json = data ? JSON.parse(data) : null; } catch { /* non-json */ }
        resolve({ status: res.statusCode, json, raw: data });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  const results = [];
  const ok = (name, pass, detail = '') => results.push({ name, pass, detail });

  console.log(`Testing API at ${base}\n`);

  const health = await request('GET', '/api/health');
  ok('GET /api/health', health.status === 200 && health.json?.status === 'ok', `db=${health.json?.db}`);

  const badApi = await request('GET', '/api/does-not-exist');
  ok('Unknown API 404', badApi.status === 404, String(badApi.status));

  const plans = await request('GET', '/api/public/membership-plans');
  ok('GET /api/public/membership-plans', plans.status === 200 && plans.json?.success, `count=${plans.json?.plans?.length ?? 0}`);

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/restaurant_qr');
  const User = require('../models/User');
  const Table = require('../models/Table');
  const admin = await User.findOne({ role: 'Admin' }).select('_id email');
  const table = admin ? await Table.findOne({ adminId: admin._id }).select('tableNumber') : null;

  if (admin && table) {
    const menuPath = `/api/public/menu/${admin._id}/table/${table.tableNumber}`;
    const menu = await request('GET', menuPath);
    ok('GET public menu', menu.status === 200 && menu.json?.success, menuPath);

    const activePath = `/api/public/orders/table/${admin._id}/${table.tableNumber}/active`;
    const active = await request('GET', activePath);
    ok('GET active table orders', active.status === 200 && active.json?.success, activePath);
  } else {
    ok('Public menu (seed data)', false, 'No admin/table in DB — run npm run seed');
  }

  const login = await request('POST', '/api/auth/login', {
    email: admin?.email || 'admin@restaurant.com',
    password: 'admin123'
  });
  const token = login.json?.token;
  ok('POST /api/auth/login', login.status === 200 && !!token);

  if (token) {
    for (const path of ['/api/tables', '/api/orders', '/api/menu', '/api/categories', '/api/settings', '/api/dashboard/stats']) {
      const r = await request('GET', path, null, token);
      ok(`GET ${path}`, r.status === 200 && r.json?.success !== false, String(r.status));
    }
  }

  await mongoose.disconnect();

  const spa = await request('GET', '/');
  ok('SPA index (production)', spa.status === 200 && spa.raw.includes('<!DOCTYPE html'), String(spa.status));

  console.log('\n--- Results ---');
  let failed = 0;
  for (const r of results) {
    const mark = r.pass ? 'PASS' : 'FAIL';
    if (!r.pass) failed++;
    console.log(`${mark}  ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
  }
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
