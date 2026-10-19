const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { app, pool } = require('../src/server');
let server;
let base;

before(async () => {
  server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise(resolve => server.close(resolve));
  await pool.end();
});

async function request(method, path, body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null, headers: response.headers };
}

test('Express streže slovenski HTML, CSS in JavaScript', async () => {
  for (const [path, contentType, text] of [
    ['/', 'text/html', 'Zadnji API klic'], ['/style.css', 'text/css', ':root'],
    ['/app.js', 'javascript', 'fetch(']
  ]) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 200);
    assert.ok(response.headers.get('content-type').includes(contentType));
    assert.ok((await response.text()).includes(text));
  }
});

test('Neveljavni ID vrne 400 pri GET, PUT in DELETE brez povezave z bazo', async () => {
  for (const method of ['GET', 'PUT', 'DELETE']) {
    for (const id of ['0', '-1', '12abc', '2147483648']) {
      assert.equal((await request(method, `/vozila/${id}`)).status, 400);
    }
  }
});

test('POST in PUT zahtevata vsa polja', async () => {
  for (const [method, path] of [['POST', '/vozila'], ['PUT', '/vozila/1']]) {
    const result = await request(method, path, { znamka: 'Renault' });
    assert.equal(result.status, 400);
    assert.ok(result.data.podrobnosti.length > 0);
  }
});

test('Neveljaven JSON in preveliko telo vrneta razumljivo JSON napako', async () => {
  for (const [body, status] of [['{"znamka":', 400], [JSON.stringify({ model: 'x'.repeat(17000) }), 413]]) {
    const response = await fetch(`${base}/vozila`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body
    });
    assert.equal(response.status, status);
    assert.deepEqual(Object.keys(await response.json()), ['napaka']);
  }
});

test('Neznana pot vrne 404 v JSON obliki', async () => {
  const result = await request('GET', '/ne-obstaja');
  assert.equal(result.status, 404);
  assert.deepEqual(result.data, { napaka: 'Pot ne obstaja.' });
});

test('Dejanski PostgreSQL: CRUD, konflikt, datumi in parametrizacija', {
  skip: process.env.RUN_DB_TESTS !== '1' ? 'Za integracijski test nastavite RUN_DB_TESTS=1 in pripravite PostgreSQL.' : false
}, async () => {
  const registration = `TEST-${randomUUID()}`;
  const vehicle = {
    registrskaOznaka: registration, znamka: "Znamka ' ; --", model: 'Test',
    letoIzdelave: 1886, kilometri: 0, datumNaslednjegaPregleda: '2028-02-29'
  };
  const ids = [];
  try {
    const created = await request('POST', '/vozila', vehicle);
    assert.equal(created.status, 201);
    const id = created.data.id;
    ids.push(id);
    assert.ok(Number.isInteger(id));
    assert.equal(created.headers.get('location'), `/vozila/${id}`);
    assert.deepEqual(created.data, { id, ...vehicle });
    assert.equal((await request('POST', '/vozila', vehicle)).status, 409);

    const second = await request('POST', '/vozila', { ...vehicle, registrskaOznaka: `${registration}-2` });
    assert.equal(second.status, 201);
    ids.push(second.data.id);
    assert.equal((await request('PUT', `/vozila/${second.data.id}`, vehicle)).status, 409);

    const list = await request('GET', '/vozila');
    assert.equal(list.status, 200);
    assert.ok(list.data.some(item => item.id === id));
    assert.deepEqual((await request('GET', `/vozila/${id}`)).data, { id, ...vehicle });

    const updated = { ...vehicle, registrskaOznaka: `${registration}-novo`, znamka: 'Nova', model: 'Drug',
      letoIzdelave: 2024, kilometri: 12345, datumNaslednjegaPregleda: '2029-03-25' };
    const update = await request('PUT', `/vozila/${id}`, updated);
    assert.equal(update.status, 200);
    assert.deepEqual(update.data, { id, ...updated });
    assert.deepEqual((await request('GET', `/vozila/${id}`)).data, { id, ...updated });
    const deleted = await request('DELETE', `/vozila/${id}`);
    assert.equal(deleted.status, 204);
    assert.equal(deleted.data, null);
    assert.equal((await request('GET', `/vozila/${id}`)).status, 404);
    assert.equal((await request('PUT', `/vozila/${id}`, vehicle)).status, 404);
    assert.equal((await request('DELETE', `/vozila/${id}`)).status, 404);
  } finally {
    // Odstranimo samo zapise, ki jih je ustvaril ta preizkus.
    for (const id of ids) await pool.query('DELETE FROM vozila WHERE id = $1', [id]);
  }
});
