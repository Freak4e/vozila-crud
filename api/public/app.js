const form = document.querySelector('#vehicle-form');
const rows = document.querySelector('#vehicles');
const message = document.querySelector('#message');
const historySelect = document.querySelector('#call-history');
let editingId = null;
let busy = false;
// Zgodovina je le prikaz zahtevkov te seje, nikoli vir podatkov o vozilih.
const calls = [];

function showMessage(text, type = '') {
  message.textContent = text;
  message.className = `message ${type}`;
}

function showCall(call) {
  document.querySelector('#request-method').textContent = call.method;
  document.querySelector('#request-path').textContent = call.path;
  document.querySelector('#response-status').textContent = call.status ? `HTTP ${call.status}` : 'Brez HTTP odgovora';
  document.querySelector('#request-body').textContent = call.body === undefined
    ? 'Brez telesa zahtevka.' : JSON.stringify(call.body, null, 2);
  document.querySelector('#response-body').textContent = call.empty
    ? 'Odgovor brez vsebine.' : typeof call.response === 'string'
      ? call.response : JSON.stringify(call.response, null, 2);
}

function recordCall(call) {
  calls.unshift(call);
  if (calls.length > 10) calls.pop();
  historySelect.replaceChildren();
  calls.forEach((item, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `${index === 0 ? 'Zadnji: ' : ''}${item.method} ${item.path} → ${item.status || 'omrežna napaka'}`;
    historySelect.append(option);
  });
  showCall(call);
}

historySelect.addEventListener('change', () => {
  const call = calls[Number(historySelect.value)];
  if (call) showCall(call);
});

async function api(method, path, body) {
  const call = { method, path, body, status: null, empty: false };
  let response;
  try {
    response = await fetch(path, {
      method,
      cache: 'no-store',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    call.status = response.status;
    const text = await response.text();
    call.empty = text.length === 0;
    try { call.response = text ? JSON.parse(text) : null; }
    catch { call.response = text; }
  } catch {
    call.response = 'Povezava s strežnikom ni uspela. Preverite, ali je API zagnan.';
    recordCall(call);
    throw new Error(call.response);
  }
  recordCall(call);
  if (!response.ok) {
    const details = Array.isArray(call.response?.podrobnosti) ? ` ${call.response.podrobnosti.join(' ')}` : '';
    throw new Error(`${call.response?.napaka || 'Zahtevek ni uspel.'}${details} (HTTP ${response.status})`);
  }
  return call.response;
}

async function perform(action) {
  if (busy) return;
  busy = true;
  document.querySelectorAll('button, input, select').forEach(control => { control.disabled = true; });
  showMessage('Obdelava zahtevka …');
  try { await action(); }
  catch (error) { showMessage(error.message, 'error'); }
  finally {
    busy = false;
    document.querySelectorAll('button, input, select').forEach(control => { control.disabled = false; });
  }
}

function renderVehicles(vehicles, summary) {
  rows.replaceChildren();
  document.querySelector('#list-summary').textContent = summary;
  if (!vehicles.length) {
    const cell = document.createElement('td');
    cell.colSpan = 8;
    cell.textContent = 'Ni vozil. Dodajte prvo vozilo z obrazcem.';
    const row = document.createElement('tr');
    row.append(cell);
    rows.append(row);
  }
  for (const vehicle of vehicles) {
    const row = document.createElement('tr');
    for (const key of ['id', 'registrskaOznaka', 'znamka', 'model', 'letoIzdelave', 'kilometri', 'datumNaslednjegaPregleda']) {
      const cell = document.createElement('td');
      cell.textContent = vehicle[key];
      row.append(cell);
    }
    const actions = document.createElement('td');
    for (const [label, className, handler] of [
      ['Uredi', 'secondary', () => editVehicle(vehicle.id)],
      ['Izbriši', 'danger', () => deleteVehicle(vehicle.id)]
    ]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.className = className;
      button.addEventListener('click', handler);
      actions.append(button);
    }
    row.append(actions);
    rows.append(row);
  }
}

async function loadVehicles() {
  try {
    const vehicles = await api('GET', '/vozila');
    renderVehicles(vehicles, `Vsa vozila · Število zapisov: ${vehicles.length}`);
  } catch (error) {
    renderVehicles([], 'Seznam ni na voljo.');
    rows.querySelector('td').textContent = 'Podatkov ni mogoče naložiti. Poskusite znova.';
    throw error;
  }
}

function resetForm() {
  editingId = null;
  form.reset();
  document.querySelector('#form-title').textContent = 'Dodaj vozilo';
  document.querySelector('#form-mode').textContent = 'POST /vozila';
  document.querySelector('#save').textContent = 'Dodaj vozilo';
  document.querySelector('#cancel').hidden = true;
}

function editVehicle(id) {
  return perform(async () => {
    const vehicle = await api('GET', `/vozila/${id}`);
    editingId = vehicle.id;
    for (const control of form.elements) {
      if (control.name) control.value = vehicle[control.name];
    }
    document.querySelector('#form-title').textContent = `Uredi vozilo #${id}`;
    document.querySelector('#form-mode').textContent = `PUT /vozila/${id}`;
    document.querySelector('#save').textContent = 'Shrani spremembe';
    document.querySelector('#cancel').hidden = false;
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showMessage(`Vozilo #${id} je naloženo v obrazec.`);
  });
}

async function refreshAfterChange(success) {
  try {
    await loadVehicles();
    showMessage(success, 'success');
  } catch (error) {
    showMessage(`${success} Osvežitev seznama ni uspela: ${error.message}`, 'error');
  }
}

function deleteVehicle(id) {
  if (busy || !window.confirm(`Res želite izbrisati vozilo #${id}?`)) return;
  return perform(async () => {
    await api('DELETE', `/vozila/${id}`);
    if (editingId === id) resetForm();
    await refreshAfterChange(`Vozilo #${id} je izbrisano.`);
  });
}

form.addEventListener('submit', event => {
  event.preventDefault();
  // Preberemo pred onemogočanjem kontrol (FormData izpusti onemogočena polja).
  const data = Object.fromEntries(new FormData(form));
  data.letoIzdelave = Number(data.letoIzdelave);
  data.kilometri = Number(data.kilometri);
  const id = editingId;
  perform(async () => {
    const vehicle = await api(id === null ? 'POST' : 'PUT', id === null ? '/vozila' : `/vozila/${id}`, data);
    resetForm();
    await refreshAfterChange(`Vozilo #${vehicle.id} je ${id === null ? 'dodano' : 'posodobljeno'}.`);
  });
});

document.querySelector('#search-form').addEventListener('submit', event => {
  event.preventDefault();
  const id = document.querySelector('#search-id').value;
  perform(async () => {
    try {
      const vehicle = await api('GET', `/vozila/${encodeURIComponent(id)}`);
      renderVehicles([vehicle], `Rezultat iskanja · ID ${vehicle.id}`);
      showMessage(`Vozilo #${vehicle.id} je najdeno.`, 'success');
    } catch (error) {
      renderVehicles([], 'Iskanje ni uspelo.');
      rows.querySelector('td').textContent = 'Ni rezultata za prikaz. Za celoten seznam izberite »Prikaži vsa vozila«.';
      throw error;
    }
  });
});

document.querySelector('#refresh').addEventListener('click', () => perform(async () => {
  await loadVehicles();
  showMessage('Seznam vozil je osvežen.', 'success');
}));
document.querySelector('#cancel').addEventListener('click', () => {
  resetForm();
  showMessage('Urejanje je preklicano.');
});

perform(async () => {
  await loadVehicles();
  showMessage('Seznam vozil je naložen.', 'success');
});
