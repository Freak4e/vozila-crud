const path = require('node:path');
const express = require('express');
const { Pool } = require('pg');
const { preveriVozilo, veljavenId } = require('./validation');

// Vedno beremo .env v korenu projekta, ne glede na trenutno delovno mapo.
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

// pg sam prebere PGHOST, PGPORT, PGDATABASE, PGUSER in PGPASSWORD.
const pool = new Pool({ connectionTimeoutMillis: 5000 });
pool.on('error', () => console.error('Prekinjena povezava z bazo podatkov.'));

const app = express();
app.disable('x-powered-by');
app.disable('etag');
app.use(express.json({ limit: '16kb' }));
app.use(express.static(path.resolve(__dirname, '../public')));

// Ista preslikava velja za SELECT in RETURNING. Datum ostane besedilo:
// to_char prepreči pretvorbo DATE v JavaScript Date in premik časovnega pasu.
const stolpci = `
  id,
  registrska_oznaka AS "registrskaOznaka",
  znamka,
  model,
  leto_izdelave AS "letoIzdelave",
  kilometri,
  to_char(datum_naslednjega_pregleda, 'YYYY-MM-DD') AS "datumNaslednjegaPregleda"`;

app.param('id', (req, res, next, id) => {
  if (!veljavenId(id)) return res.status(400).json({ napaka: 'ID mora biti pozitivno celo število do 2147483647.' });
  req.voziloId = Number(id);
  next();
});

function preveriTelo(req, res, next) {
  const { napake, vozilo } = preveriVozilo(req.body);
  if (napake.length) return res.status(400).json({ napaka: 'Neveljavni podatki vozila.', podrobnosti: napake });
  req.vozilo = vozilo;
  next();
}

function vrednosti(vozilo) {
  return [vozilo.registrskaOznaka, vozilo.znamka, vozilo.model,
    vozilo.letoIzdelave, vozilo.kilometri, vozilo.datumNaslednjegaPregleda];
}

app.get('/vozila', async (req, res) => {
  const result = await pool.query(`SELECT ${stolpci} FROM vozila ORDER BY id`);
  res.json(result.rows);
});

app.get('/vozila/:id', async (req, res) => {
  const result = await pool.query(`SELECT ${stolpci} FROM vozila WHERE id = $1`, [req.voziloId]);
  if (!result.rowCount) return res.status(404).json({ napaka: 'Vozilo ne obstaja.' });
  res.json(result.rows[0]);
});

app.post('/vozila', preveriTelo, async (req, res) => {
  const result = await pool.query(`
    INSERT INTO vozila (registrska_oznaka, znamka, model, leto_izdelave, kilometri, datum_naslednjega_pregleda)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING ${stolpci}`, vrednosti(req.vozilo));
  res.status(201).location(`/vozila/${result.rows[0].id}`).json(result.rows[0]);
});

app.put('/vozila/:id', preveriTelo, async (req, res) => {
  const result = await pool.query(`
    UPDATE vozila SET registrska_oznaka = $1, znamka = $2, model = $3,
      leto_izdelave = $4, kilometri = $5, datum_naslednjega_pregleda = $6
    WHERE id = $7 RETURNING ${stolpci}`, [...vrednosti(req.vozilo), req.voziloId]);
  if (!result.rowCount) return res.status(404).json({ napaka: 'Vozilo ne obstaja.' });
  res.json(result.rows[0]);
});

app.delete('/vozila/:id', async (req, res) => {
  const result = await pool.query('DELETE FROM vozila WHERE id = $1 RETURNING id', [req.voziloId]);
  if (!result.rowCount) return res.status(404).json({ napaka: 'Vozilo ne obstaja.' });
  res.status(204).end();
});

app.use((req, res) => res.status(404).json({ napaka: 'Pot ne obstaja.' }));

// Express 5 sem posreduje tudi zavrnjene obljube iz async funkcij.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ napaka: 'Telo zahtevka ni veljaven JSON.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ napaka: 'Telo zahtevka je preveliko (največ 16 KB).' });
  }
  if (err.status === 400 || err.status === 415) {
    return res.status(err.status).json({ napaka: 'Neveljavna oblika ali kodiranje zahtevka.' });
  }
  if (err.code === '23505') {
    return res.status(409).json({ napaka: 'Vozilo s to registrsko oznako že obstaja.' });
  }
  if (['23502', '23514', '22007', '22008', '22003', '22P02'].includes(err.code)) {
    return res.status(400).json({ napaka: 'Podatki ne ustrezajo omejitvam vozila.' });
  }
  console.error('Zahtevka ni bilo mogoče obdelati. Preverite dosegljivost in nastavitev baze.');
  res.status(500).json({ napaka: 'Napaka strežnika. Poskusite znova pozneje.' });
});

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('PORT mora biti celo število med 1 in 65535.');
    process.exit(1);
  }
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Evidenca vozil: http://localhost:${port}`);
  });
  server.on('error', () => {
    console.error('Strežnika ni mogoče zagnati. Preverite vrata PORT.');
    process.exit(1);
  });
  const ustavi = () => {
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.once('SIGINT', ustavi);
  process.once('SIGTERM', ustavi);
}

module.exports = { app, pool };
