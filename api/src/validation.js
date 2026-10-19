const MAX_INTEGER = 2147483647;

function veljavenDatum(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [leto, mesec, dan] = value.split('-').map(Number);
  const prestopno = leto % 4 === 0 && (leto % 100 !== 0 || leto % 400 === 0);
  const dnevi = [31, prestopno ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return leto >= 1 && mesec >= 1 && mesec <= 12 && dan >= 1 && dan <= dnevi[mesec - 1];
}

function preveriVozilo(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { napake: ['Telo zahtevka mora biti JSON objekt s podatki vozila.'] };
  }

  const napake = [];
  const vozilo = {};
  for (const polje of ['registrskaOznaka', 'znamka', 'model']) {
    if (typeof body[polje] !== 'string' || !body[polje].trim() || body[polje].includes('\u0000')) {
      napake.push(`${polje}: vnesite neprazno besedilo brez ničelnega znaka.`);
    } else {
      vozilo[polje] = body[polje].trim();
    }
  }

  for (const [polje, najmanj] of [['letoIzdelave', 1886], ['kilometri', 0]]) {
    if (!Number.isInteger(body[polje]) || body[polje] < najmanj || body[polje] > MAX_INTEGER) {
      napake.push(`${polje}: vnesite celo število med ${najmanj} in ${MAX_INTEGER}.`);
    } else {
      vozilo[polje] = body[polje];
    }
  }

  if (!veljavenDatum(body.datumNaslednjegaPregleda)) {
    napake.push('datumNaslednjegaPregleda: vnesite veljaven datum v obliki YYYY-MM-DD (leto 0001–9999).');
  } else {
    vozilo.datumNaslednjegaPregleda = body.datumNaslednjegaPregleda;
  }
  return { napake, vozilo };
}

function veljavenId(value) {
  return /^[1-9]\d*$/.test(value) && Number(value) <= MAX_INTEGER;
}

module.exports = { preveriVozilo, veljavenDatum, veljavenId };
