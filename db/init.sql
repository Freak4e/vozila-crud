CREATE TABLE IF NOT EXISTS vozila (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    registrska_oznaka TEXT NOT NULL UNIQUE CHECK (length(btrim(registrska_oznaka)) > 0),
    znamka TEXT NOT NULL CHECK (length(btrim(znamka)) > 0),
    model TEXT NOT NULL CHECK (length(btrim(model)) > 0),
    leto_izdelave INTEGER NOT NULL CHECK (leto_izdelave >= 1886),
    kilometri INTEGER NOT NULL CHECK (kilometri >= 0),
    datum_naslednjega_pregleda DATE NOT NULL
        CHECK (datum_naslednjega_pregleda BETWEEN DATE '0001-01-01' AND DATE '9999-12-31')
);
