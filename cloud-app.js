const cfg = window.BGUAYDI_FIREBASE;
const $ = (selector) => document.querySelector(selector);
const form = $('#byd-login-form');
const status = $('#byd-connection-status');
const accountControls = $('#byd-account-controls');
const picker = $('#byd-vehicle-picker');
const connected = $('#byd-connected-state');
const submit = $('#byd-connect-submit');
let auth, functions, db, unsubscribeData;

function say(message, error = false) {
  status.textContent = message;
  status.dataset.error = error ? 'true' : 'false';
}
function callable(name) {
  return window.__bguaydiSDK.httpsCallable(functions, name);
}
function showConnectedView() {
  document.body.dataset.cloud = 'connected';
  form.hidden = true;
  accountControls.hidden = false;
  connected.hidden = false;
}
function showDisconnectedView() {
  document.body.dataset.cloud = 'disconnected';
  form.hidden = false;
  accountControls.hidden = true;
  picker.hidden = true;
  connected.hidden = true;
  if (unsubscribeData) unsubscribeData();
  unsubscribeData = null;
  document.querySelectorAll('[data-live]').forEach((node) => { node.textContent = '—'; });
  $('#byd-all-fields').hidden = true;
}
function number(value, digits = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? new Intl.NumberFormat('es-ES', { maximumFractionDigits: digits }).format(n) : '—';
}
function pick(object, keys) {
  for (const key of keys) if (object?.[key] !== undefined && object[key] !== null) return object[key];
  return undefined;
}
function renderSnapshot(data) {
  if (!data) return;
  const realtime = data.realtime || {};
  const energy = data.energy || {};
  const near = energy.nearest_energy_consumption || {};
  const cumulative = energy.cumulative_energy_consumption || {};
  $('[data-live="soc"]').textContent = number(pick(realtime, ['elec_percent', 'soc', 'battery_percentage']));
  $('[data-live="range"]').textContent = number(pick(realtime, ['endurance_mileage', 'remaining_range', 'range']));
  $('[data-live="speed"]').textContent = number(pick(realtime, ['speed', 'vehicle_speed']));
  $('[data-live="odometer"]').textContent = number(pick(realtime, ['total_mileage', 'odometer', 'mileage']));
  $('[data-live="recent-consumption"]').textContent = number(pick(near, ['avg_ev_consumption', 'average_consumption']) ?? pick(energy, ['recent_50km_energy_ev']), 1);
  $('[data-live="lifetime-consumption"]').textContent = number(pick(cumulative, ['avg_ev_consumption', 'average_consumption']), 1);
  const stamp = data.capturedAt?.toDate ? data.capturedAt.toDate() : new Date(data.capturedAt);
  $('#byd-last-sync').textContent = Number.isNaN(stamp.getTime()) ? 'Datos BYD sincronizados' : `Última lectura: ${stamp.toLocaleString('es-ES')}`;
  renderAllFields({ realtime, energy });
  $('#byd-all-fields').hidden = false;
  $('#data-mode').innerHTML = '<i></i> DATOS DE BYD';
  say('Vehículo conectado. Datos recibidos desde BYD.');
}
function renderAllFields(groups) {
  const list = $('#byd-field-list');
  list.replaceChildren();
  for (const [groupName, values] of Object.entries(groups)) {
    const group = document.createElement('section');
    const heading = document.createElement('h3');
    heading.textContent = groupName === 'realtime' ? 'Estado del vehículo' : 'Energía';
    group.append(heading);
    const grid = document.createElement('dl');
    const add = (key, value) => {
      if (value === null || value === undefined) return;
      const term = document.createElement('dt');
      term.textContent = key.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toLocaleUpperCase('es-ES'));
      const detail = document.createElement('dd');
      detail.textContent = typeof value === 'object' ? JSON.stringify(value) : String(value);
      grid.append(term, detail);
    };
    const flatten = (object, prefix = '') => {
      for (const [key, value] of Object.entries(object || {})) {
        const path = prefix ? `${prefix} › ${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value)) flatten(value, path);
        else add(path, value);
      }
    };
    flatten(values);
    group.append(grid);
    list.append(group);
  }
}
function startDataListener(user) {
  if (unsubscribeData) unsubscribeData();
  unsubscribeData = window.__bguaydiOnSnapshot(window.__bguaydiDoc(db, 'vehicleData', user.uid), (snapshot) => {
    if (snapshot.exists()) renderSnapshot(snapshot.data());
  }, () => say('No se pudo leer el historial guardado. Revisa la conexión.', true));
}
function showVehiclePicker(vehicles, selectedVin) {
  const select = $('#byd-vehicle-select');
  select.replaceChildren(...vehicles.map((vehicle) => {
    const option = document.createElement('option');
    option.value = vehicle.vin;
    option.textContent = [vehicle.name, vehicle.model].filter(Boolean).join(' · ') || 'BYD';
    return option;
  }));
  if (selectedVin) select.value = selectedVin;
  $('#byd-connected-name').textContent = vehicles.find((v) => v.vin === selectedVin)?.name || 'Vehículo BYD';
  picker.hidden = vehicles.length < 2;
  connected.hidden = false;
}

if (!cfg || cfg.apiKey === 'REEMPLAZAR_API_KEY') {
  say('La app está preparada, pero falta configurar el proyecto Firebase. Consulta GUIA-FIREBASE.md.');
  submit.disabled = true;
} else {
  import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js').then(async (appSdk) => {
    const authSdk = await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js');
    const functionsSdk = await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js');
    const firestoreSdk = await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js');
    const app = appSdk.initializeApp(cfg);
    auth = authSdk.getAuth(app);
    functions = functionsSdk.getFunctions(app, cfg.functionsRegion || 'europe-west1');
    db = firestoreSdk.getFirestore(app);
    window.__bguaydiSDK = { ...authSdk, ...functionsSdk, ...firestoreSdk };
    window.__bguaydiDoc = firestoreSdk.doc;
    window.__bguaydiOnSnapshot = firestoreSdk.onSnapshot;
    authSdk.onAuthStateChanged(auth, (user) => {
      if (user) {
        showConnectedView();
        startDataListener(user);
        callable('get_vehicle_data')().then(({ data }) => {
          if (data.vehicles) showVehiclePicker(data.vehicles, data.vehicle?.vin);
          if (data.vehicle) $('#byd-connected-name').textContent = data.vehicle.name || 'Vehículo conectado';
          if (data.pending) say('Cuenta conectada. Esperando la primera lectura de BYD…');
        }).catch((error) => say(error.message || 'No se pudo cargar el vehículo.', true));
      } else showDisconnectedView();
    });
    // Bind only after Firebase initializes, so a missing project leaves a helpful screen.
    window.__bguaydiSignIn = authSdk.signInWithCustomToken;
    window.__bguaydiSignOut = authSdk.signOut;
    say('Listo para conectar tu cuenta BYD.');
  }).catch((error) => {
    console.error('No se pudo inicializar Firebase', error);
    say('No se pudo iniciar Firebase. Revisa la configuración de la app y vuelve a cargar.', true);
    submit.disabled = true;
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!functions) return;
  const username = $('#byd-username').value.trim();
  const passwordInput = $('#byd-password');
  const password = passwordInput.value;
  submit.disabled = true;
  say('Conectando de forma segura con BYD…');
  try {
    const { data } = await callable('connect_byd')({ username, password, countryCode: 'ES' });
    passwordInput.value = '';
    await window.__bguaydiSignIn(auth, data.token);
    showVehiclePicker(data.vehicles || [], data.selectedVin);
    if (data.selectedVin) {
      await callable('refresh_vehicle_data')();
      say('¡Conectado! Estamos cargando los datos disponibles del coche.');
    } else say('Cuenta validada. Elige el coche que quieres consultar.');
  } catch (error) {
    passwordInput.value = '';
    say(error.message || 'No se pudo conectar. Comprueba los datos e inténtalo de nuevo.', true);
  } finally { submit.disabled = false; }
});

$('#byd-select-vehicle').addEventListener('click', async () => {
  const vin = $('#byd-vehicle-select').value;
  if (!vin) return;
  say('Guardando vehículo y solicitando sus datos…');
  try {
    await callable('choose_vehicle')({ vin });
    await callable('refresh_vehicle_data')();
    $('#byd-connected-name').textContent = $('#byd-vehicle-select').selectedOptions[0].textContent;
    picker.hidden = true;
  } catch (error) { say(error.message || 'No se pudo seleccionar el vehículo.', true); }
});

$('#byd-refresh-now').addEventListener('click', async () => {
  say('Consultando a BYD…');
  try { await callable('refresh_vehicle_data')(); say('Lectura actualizada.'); }
  catch (error) { say(error.message || 'No se pudo actualizar ahora.', true); }
});

$('#byd-disconnect').addEventListener('click', async () => {
  if (!auth?.currentUser) return;
  if (!window.confirm('Se borrarán la conexión BYD, las lecturas y el historial guardado en Bi-guay-Di. ¿Continuar?')) return;
  say('Borrando los datos guardados…');
  try {
    await callable('disconnect_byd')();
    await window.__bguaydiSignOut(auth);
    $('#data-mode').innerHTML = '<i></i> DATOS DE EJEMPLO';
    say('Conexión y datos borrados.');
  } catch (error) { say(error.message || 'No se pudieron borrar los datos.', true); }
});
