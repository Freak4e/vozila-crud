# Evidenca vozil

REST CRUD aplikacija za evidenco vozil, izdelana z Node.js, Express in
PostgreSQL. API in baza sta namenjena izvajanju v ločenih Docker zabojnikih.
API uporablja knjižnico `pg` brez ORM, Express pa streže tudi spletni testni
odjemalec v slovenščini.

## Predpogoji

- Nameščen in zagnan Docker Desktop z Docker Compose in podporo za Linux zabojnike.
- Prosta vrata gostitelja, določena s `PORT` v `.env`; trenutna nastavitev je `3000`.
- Spletni brskalnik in internetna povezava za prenos slik.

Za zagon prek objavljenih slik lokalna namestitev Node.js ali PostgreSQL ni potrebna.

## Zagon z objavljenima slikama

Ukaze izvedi v korenu projekta, kjer je `docker-compose.yml`. Primeri so za PowerShell.

1. Če `.env` še ne obstaja, kopiraj vzorec. Obstoječe datoteke s svojimi nastavitvami ne prepisuj:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Uredi `.env`. V trenutnem vzorcu manjkata naslednji vrstici, zato ju dodaj:

   ```dotenv
   DOCKERHUB_USER=freak4ee
   IMAGE_TAG=1.0.0
   ```

   | Nastavitev | Vrednost oziroma namen |
   | --- | --- |
   | `DOCKERHUB_USER` | `freak4ee`; uporabniško ime iz trenutnega projekta |
   | `IMAGE_TAG` | `1.0.0`; oznaka obeh slik |
   | `PORT` | `3000`; objavljena vrata API-ja na gostitelju |
   | `PGDATABASE` | `vozila`; ime baze |
   | `PGUSER` | `vozila_app`; uporabnik baze |
   | `PGPASSWORD` | Nastavi lastno geslo namesto vzorčne vrednosti |
   | `PGHOST`, `PGPORT` | Vzorec vsebuje `localhost` in `5432` za lokalni razvoj; Compose za API izrecno nastavi `db` in `5432` |

   Compose preslika `PGDATABASE`, `PGUSER` in `PGPASSWORD` v nastavitve obeh
   storitev. Baza jih prejme kot `POSTGRES_DB`, `POSTGRES_USER` in
   `POSTGRES_PASSWORD`. Ob prvi inicializaciji ustvari uporabnika in bazo.
   Sprememba teh vrednosti v `.env` pozneje ne spremeni že inicializirane baze.
   `.env` je izključen iz Gita in se ne kopira v sliki.

3. Prenesi sliki, zaženi storitvi in preveri njuno stanje:

   ```powershell
   docker compose pull
   docker compose up -d
   docker compose ps
   ```

   Baza mora doseči stanje `healthy`, API pa mora biti zagnan.
   Compose uporablja `image:` brez `build:`, zato ta postopek uporabi
   objavljeni sliki in ne gradi lokalne kode.

4. Odpri **http://localhost:3000/**. Če spremeniš `PORT`, uporabi
   `http://localhost:<PORT>/`. Vmesnik odpiraj prek strežnika, ne kot lokalno HTML datoteko.

## Docker Hub sliki

Podatki so povzeti iz trenutnega `.env` in `docker-compose.yml`;
datoteke `dockerhub-links.txt` v projektu ni.

| Storitev | Repozitorij | Slika z oznako |
| --- | --- | --- |
| API | [freak4ee/vozila-api](https://hub.docker.com/r/freak4ee/vozila-api) | `freak4ee/vozila-api:1.0.0` |
| Baza | [freak4ee/vozila-db](https://hub.docker.com/r/freak4ee/vozila-db) | `freak4ee/vozila-db:1.0.0` |

Javna dostopnost repozitorijev in obstoj oznake `1.0.0` pri tej posodobitvi
nista bila preverjena. Za opisani zagon morata biti obe sliki s to oznako javno dostopni.

## Izbrana demonstracija storitve

Izbrana možnost iz navodil naloge je **spletni testni odjemalec**, izdelan
s HTML, CSS in JavaScript, ki ga streže Express. Odjemalec prek `fetch` in
relativnih HTTP poti kliče dejanski REST API; podatki se shranjujejo v PostgreSQL.

Izvorna koda je v `api/public/index.html`, `api/public/style.css` in
`api/public/app.js`. Naslednji koraki so navodila za demonstracijo,
ne poročilo o izvedenih preizkusih:

1. **Create – dodajanje:** v obrazec vnesi registracijo `LJ AB-123`, znamko
   `Renault`, model `Clio`, leto `2020`, kilometre `45000` in datum pregleda
   `2027-06-15`. Klikni »Dodaj vozilo« in zabeleži ID. Pričakovani odgovor je `201`.
2. **Read – branje:** klikni »Prikaži vsa vozila«, nato poišči ustvarjeno vozilo
   po ID. Seznam in posamezno vozilo se pridobita z ločenima GET zahtevkoma (`200`).
3. **Update – posodobitev:** klikni »Uredi«, v predizpolnjenem obrazcu spremeni
   kilometre na `46000` in shrani (`200`). Ponovno poišči isti ID in preveri
   shranjeno kilometrino.
4. **Delete – brisanje:** klikni »Izbriši« in potrdi (`204`, brez vsebine).
   Ponovno iskanje istega ID mora vrniti `404`; vozila ne sme biti več na seznamu.

Po uspešni spremembi se seznam samodejno osveži. Razdelek **»Zadnji API klic«**
prikazuje metodo, pot, poslani JSON, status in prejeti JSON oziroma oznako
odgovora brez vsebine. Izbirnik zadnjih desetih klicev omogoča pregled POST,
PUT ali DELETE tudi po samodejni osvežitvi z GET. Ta zgodovina ni shramba vozil.

## Preverjanje trajne hrambe

1. Dodaj novo vozilo in zabeleži njegov ID ter podatke; pred tem preizkusom ga ne izbriši.
2. V istem projektu ustavi in odstrani zabojnika ter ju ponovno ustvari:

   ```powershell
   docker compose down
   docker compose up -d
   docker compose ps
   ```

3. Po pripravljenosti storitev ponovno odpri odjemalca in poišči isti ID.
   Vozilo in njegovi podatki morajo ostati shranjeni.

Ohrani isti Compose projekt in podatkovni volumen. **`docker compose down -v`
izbriše tudi podatkovni volumen in s tem shranjene podatke**, zato ga pri tem
preizkusu ne uporabi. Opisani postopek ni potrdilo o že preverjeni trajni hrambi.

## Kako je sestavljena Docker rešitev

- **`api/Dockerfile`:** osnova `node:24-alpine`, namestitev produkcijskih
  odvisnosti z `npm ci --omit=dev`, kopiranje `src` in `public` ter zagon
  `node src/server.js` kot uporabnik `node`. Kontekst gradnje je `./api`.
- **`db/Dockerfile`:** osnova `postgres:17-alpine`; kopira `init.sql` v
  `/docker-entrypoint-initdb.d/01-init.sql`. Kontekst gradnje je `./db`.
  Skripta ustvari tabelo z omejitvami. **Samodejno se izvede samo ob
  inicializaciji praznega podatkovnega imenika**, ne ob vsakem zagonu.
- **Omrežje:** obe storitvi uporabljata `vozila_network`. API doseže bazo
  prek imena storitve `db` na notranjih vratih `5432`; baza nima objavljenih vrat gostitelja.
- **Vrata API-ja:** strežnik posluša na `0.0.0.0:3000`; preslikava
  `${PORT}:3000` poveže izbrana vrata gostitelja z vrati API-ja v zabojniku.
- **Trajna hramba:** imenovani volumen `postgres_data` je priklopljen na
  `/var/lib/postgresql/data`, kar ustreza uporabljeni različici PostgreSQL 17.
- **Pripravljenost:** `pg_isready` preverja bazo, API pa ima
  `depends_on` s pogojem `service_healthy`. To ureja začetni vrstni red;
  healthcheck ne preverja celotnega CRUD ali obstoja tabele.

## API in struktura kode

| Metoda in pot | Namen | Uspešen status |
| --- | --- | --- |
| `POST /vozila` | Dodajanje | `201` |
| `GET /vozila` | Seznam | `200` |
| `GET /vozila/:id` | Posamezno vozilo | `200` |
| `PUT /vozila/:id` | Posodobitev vseh podatkovnih polj | `200` |
| `DELETE /vozila/:id` | Brisanje | `204` |

`api/src/server.js` vsebuje poti API-ja, povezavo `pg.Pool`, parametrizirane
SQL poizvedbe in obravnavo napak; `api/src/validation.js` preverja podatke.
`db/init.sql` definira tabelo. `api/package.json` in `api/package-lock.json`
določata odvisnosti, preizkusi pa so v `api/test/`.

POST in PUT zahtevata JSON s polji `registrskaOznaka`, `znamka`, `model`,
`letoIzdelave`, `kilometri` in `datumNaslednjegaPregleda`; ID ustvari baza.
Registracija je enolična, leto je celo število najmanj 1886, kilometri pa
celo število najmanj 0. Datum je veljaven `YYYY-MM-DD` in se v isti obliki
vrne brez premika časovnega pasu. Napake uporabljajo statuse `400` za
neveljavne podatke, `404` za neobstoječe vozilo in `409` za podvojeno registracijo.

## Neobvezni lokalni razvoj brez Dockerja

Ta način zahteva Node.js 22 ali novejši, npm in dosegljiv PostgreSQL.
Pripravi bazo in uporabnika, v korenskem `.env` nastavi vseh pet spremenljivk
`PG*` ter `PORT`. `dotenv` vedno bere ta korenski `.env`, obstoječe okoljske
spremenljivke pa imajo prednost. Za lokalno bazo uporabi `PGHOST=localhost`.

Iz korena projekta izvedi (parametre baze prilagodi svojim nastavitvam):

```powershell
psql -h localhost -p 5432 -U vozila_app -d vozila -W -v ON_ERROR_STOP=1 -f db/init.sql
cd api
npm.cmd ci
npm.cmd start
```

`psql` ne bere `.env`; `-W` zahteva geslo v pozivu. Uporabnik mora imeti
pravico ustvarjanja tabele. SQL skripta sama ne ustvari baze ali uporabnika.
Za samodejni ponovni zagon uporabi `npm.cmd run dev`; na drugih sistemih
lahko namesto `npm.cmd` uporabiš `npm`.

## Preizkusi in dosedanji rezultati

Za lokalne preizkuse v mapi `api` uporabi `npm.cmd test`. Privzeti preizkusi
ne potrebujejo baze. Za integracijski CRUD najprej pripravi ločeno testno
PostgreSQL bazo s tabelo iz `db/init.sql` in nastavi `PG*` nanjo, nato izvedi:

```powershell
$env:RUN_DB_TESTS = '1'
npm.cmd test
Remove-Item Env:RUN_DB_TESTS
```

Integracijski preizkus uporablja dejansko bazo in odstrani samo svoja
začasna zapisa. Brez te nastavitve se preskoči.

Dosedanja preverjanja, ločena od zgornjih navodil:

- Ob prvotni pripravi: uspešna namestitev z `npm ci`, 11 uspešnih preizkusov
  in en preskočen integracijski preizkus; v brskalniku preverjen vmesnik
  ter obravnava neveljavnih podatkov in nedosegljive baze.
- Ob pregledu Docker konfiguracije: uspešen `docker compose config --quiet`,
  veljavna sintaksa petih JavaScript datotek in usklajenost odvisnosti.
- Pri tej posodobitvi je bila pregledana vsebina projekta in spremenjen samo
  README. Gradnja, objava in zagon slik, uspešen celoten CRUD s PostgreSQL
  ter trajna hramba niso bili izvedeni ali potrjeni.
