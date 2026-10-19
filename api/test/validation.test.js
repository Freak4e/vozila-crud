const test = require('node:test');
const assert = require('node:assert/strict');
const { preveriVozilo, veljavenDatum, veljavenId } = require('../src/validation');

const veljavno = {
  registrskaOznaka: 'LJ AB-123', znamka: 'Renault', model: 'Clio',
  letoIzdelave: 2020, kilometri: 45000, datumNaslednjegaPregleda: '2028-02-29'
};

test('Veljavno vozilo: obrezovanje presledkov in ohranitev datuma', () => {
  const result = preveriVozilo({ ...veljavno, registrskaOznaka: '  LJ AB-123  ' });
  assert.deepEqual(result.napake, []);
  assert.deepEqual(result.vozilo, veljavno);
});

test('Vsako polje je obvezno, tudi pri celotni posodobitvi', () => {
  for (const field of Object.keys(veljavno)) {
    const body = { ...veljavno };
    delete body[field];
    assert.ok(preveriVozilo(body).napake.length, field);
  }
});

test('Zavrne napačne tipe, prazna besedila in neveljavno telo', () => {
  for (const body of [null, undefined, [], 'vozilo', 12]) {
    assert.ok(preveriVozilo(body).napake.length);
  }
  for (const field of ['registrskaOznaka', 'znamka', 'model']) {
    for (const value of ['   ', 123, {}, 'a\u0000b']) {
      assert.ok(preveriVozilo({ ...veljavno, [field]: value }).napake.length);
    }
  }
});

test('Celoštevilske meje PostgreSQL in minimalne vrednosti', () => {
  for (const [field, minimum] of [['letoIzdelave', 1886], ['kilometri', 0]]) {
    for (const value of [minimum, 2147483647]) {
      assert.equal(preveriVozilo({ ...veljavno, [field]: value }).napake.length, 0);
    }
    for (const value of [minimum - 1, 2147483648, 2020.5, '2020', null, true]) {
      assert.ok(preveriVozilo({ ...veljavno, [field]: value }).napake.length);
    }
  }
});

test('Koledarski datumi: prestopna leta, dolžina meseca in stroga oblika', () => {
  for (const value of ['2028-02-29', '2000-02-29', '0001-01-01', '9999-12-31']) {
    assert.equal(veljavenDatum(value), true, value);
  }
  for (const value of ['2026-02-29', '1900-02-29', '2026-04-31', '2026-00-10',
    '2026-13-01', '2026-01-00', '2026-1-01', '0000-01-01', '2026-01-01T00:00:00Z', null]) {
    assert.equal(veljavenDatum(value), false, String(value));
  }
});

test('ID: pozitivno celo število brez delnih pretvorb', () => {
  for (const value of ['1', '2147483647']) assert.equal(veljavenId(value), true);
  for (const value of ['0', '-1', '1.5', '12abc', '1e2', '01', '2147483648', '']) {
    assert.equal(veljavenId(value), false, value);
  }
});
