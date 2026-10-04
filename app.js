/* Bi-guay-Di v2.0 - Core High-Tech Architecture */
import { SecureVault } from './crypto-vault.js';

// --- DATA STRUCTURE & STATE ---
const STATE = {
  theme: localStorage.getItem('biguaydi-theme') || 'original',
  fontSize: Number(localStorage.getItem('biguaydi-size')) || 3,
  view: 'dashboard',
  energySource: localStorage.getItem('biguaydi-energy-source') || 'solar', // grid, solar, mixed
  prices: {
    kwhGrid: Number(localStorage.getItem('biguaydi-kwh-grid')) || 0.15,
    kwhSolar: Number(localStorage.getItem('biguaydi-kwh-solar')) || 0.00,
    solarPct: Number(localStorage.getItem('biguaydi-solar-pct')) || 80, // % of solar in mixed mode
    gas95: Number(localStorage.getItem('biguaydi-gas95')) || 1.62,
    diesel: Number(localStorage.getItem('biguaydi-diesel')) || 1.54,
    iceConsumption: Number(localStorage.getItem('biguaydi-ice-cons')) || 6.2, // l/100km Gasoline
    dieselConsumption: Number(localStorage.getItem('biguaydi-diesel-cons')) || 5.2, // l/100km Diesel
    fuelType: localStorage.getItem('biguaydi-fuel-type') || 'gas95' // gas95 or diesel
  },
  // Default real or sample metrics for Dolphin Surf
  vehicle: {
    soc: 78,
    range: 312,
    odometer: 14280,
    speed: 0,
    power: 0.0,
    charging: false,
    gear: 'P',
    tempCabin: 21.5,
    tempExt: 19.0,
    soh: 99.2,
    voltageHV: 348.5,
    voltage12v: 13.6,
    avgConsumption50km: 13.8, // kWh/100km
    lifetimeConsumption: 14.2, // kWh/100km
    tires: { fl: 2.5, fr: 2.5, rl: 2.6, rr: 2.6 }
  },
  trips: [
    { id: 1, title: 'Trabajo ➔ Casa', date: 'Hoy, 18:20', distance: 22.4, energy: 3.1, avgWh: 138, duration: '28 min' },
    { id: 2, title: 'Casa ➔ Gimnasio', date: 'Hoy, 07:45', distance: 8.5, energy: 1.2, avgWh: 141, duration: '12 min' },
    { id: 3, title: 'Madrid ➔ Toledo', date: 'Ayer', distance: 74.2, energy: 11.2, avgWh: 150, duration: '52 min' },
    { id: 4, title: 'Recados urbanos', date: '02 Oct', distance: 14.8, energy: 1.9, avgWh: 128, duration: '25 min' }
  ]
};

// Car images corresponding to themes
const CAR_IMAGES = {
  original: 'PICTURES/BYD_Dolphin_Surf_ORIGINAL.jfif',
  blue: 'PICTURES/BYD_Dolphin_Surf_AZUL.jfif',
  red: 'PICTURES/BYD_Dolphin_Surf_ROJO.jfif',
  green: 'PICTURES/BYD_Dolphin_Surf_VERDE.jfif',
  violet: 'PICTURES/BYD_Dolphin_Surf_VIOLETA.jfif'
};

// --- TOAST NOTIFICATIONS ---
export function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}
window.showToast = showToast;

// --- VIEW NAVIGATION ---
function initNavigation() {
  const navButtons = document.querySelectorAll('[data-target-view]');
  navButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetView = btn.dataset.targetView;
      switchView(targetView);
    });
  });
}

function switchView(viewName) {
  STATE.view = viewName;
  document.querySelectorAll('.app-view').forEach(view => {
    view.classList.toggle('active', view.id === `view-${viewName}`);
  });
  document.querySelectorAll('[data-target-view]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.targetView === viewName);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- THEME & CUSTOMIZATION ---
function setTheme(theme) {
  if (!CAR_IMAGES[theme]) theme = 'original';
  STATE.theme = theme;
  document.body.dataset.theme = theme;
  localStorage.setItem('biguaydi-theme', theme);

  document.querySelectorAll('.theme-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.theme === theme);
  });

  const carImg = document.getElementById('car-render-img');
  if (carImg) {
    carImg.src = CAR_IMAGES[theme];
  }

  // Update meta theme-color for PWA header bar
  const themeColors = {
    original: '#071411',
    blue: '#08131c',
    red: '#180d10',
    green: '#081710',
    violet: '#100d19'
  };
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = themeColors[theme] || '#071411';
}

function setFontSize(level) {
  level = Math.min(5, Math.max(1, Number(level) || 3));
  STATE.fontSize = level;
  localStorage.setItem('biguaydi-size', level);
  document.body.dataset.size = level;
  const slider = document.getElementById('font-size-slider');
  const label = document.getElementById('font-size-display');
  if (slider) slider.value = level;
  if (label) label.textContent = `${level} / 5`;
}

// --- CALCULATIONS: ELECTRICITY VS PETROL ---
function getEffectiveElectricityPrice() {
  if (STATE.energySource === 'solar') return STATE.prices.kwhSolar;
  if (STATE.energySource === 'grid') return STATE.prices.kwhGrid;
  // Mixed
  const solarShare = STATE.prices.solarPct / 100;
  return (STATE.prices.kwhSolar * solarShare) + (STATE.prices.kwhGrid * (1 - solarShare));
}

function updateCalculations() {
  const evKwh100km = STATE.vehicle.avgConsumption50km;
  const costPerKwh = getEffectiveElectricityPrice();
  
  // Cost per 100km Electric
  const costEv100 = (evKwh100km * costPerKwh);

  // Cost per 100km Gasoline 95 & Diesel
  const costGas100 = (STATE.prices.iceConsumption * STATE.prices.gas95);
  const costDiesel100 = (STATE.prices.dieselConsumption * STATE.prices.diesel);

  // Active comparison based on selected fuelType
  const costSelectedIce100 = STATE.prices.fuelType === 'diesel' ? costDiesel100 : costGas100;
  const savings100 = Math.max(0, costSelectedIce100 - costEv100);
  const savingsPct = costSelectedIce100 > 0 ? ((savings100 / costSelectedIce100) * 100) : 0;

  // Monthly estimate based on 1.200 km / month average
  const kmMonth = 1200;
  const monthlyEvCost = (kmMonth / 100) * costEv100;
  const monthlyIceCost = (kmMonth / 100) * costSelectedIce100;
  const monthlySavings = monthlyIceCost - monthlyEvCost;

  // CO2 Emitted ICE vs EV
  const evCo2PerKm = STATE.energySource === 'solar' ? 0 : 38; // g/km
  const iceCo2PerKm = STATE.prices.fuelType === 'diesel' ? 140 : 145; // g/km
  const co2AvoidedKgMonthly = ((iceCo2PerKm - evCo2PerKm) * kmMonth) / 1000;
  const treesEquivalent = Math.max(1, Math.round(co2AvoidedKgMonthly * 12 / 21));

  // DOM Updates
  const elCostEv = document.getElementById('calc-ev-cost-100');
  const elCostIce = document.getElementById('calc-ice-cost-100');
  const elCostGas = document.getElementById('calc-gas-cost-100');
  const elCostDiesel = document.getElementById('calc-diesel-cost-100');
  const elSavings100 = document.getElementById('calc-savings-100');
  const elSavingsPct = document.getElementById('calc-savings-pct');
  const elMonthlySavings = document.getElementById('calc-monthly-savings');
  const elCo2Kg = document.getElementById('calc-co2-kg');
  const elTrees = document.getElementById('calc-trees');
  const elEffectiveRate = document.getElementById('calc-effective-rate');

  if (elCostEv) elCostEv.textContent = `${costEv100.toFixed(2)} €`;
  if (elCostIce) elCostIce.textContent = `${costSelectedIce100.toFixed(2)} €`;
  if (elCostGas) elCostGas.textContent = `${costGas100.toFixed(2)} €`;
  if (elCostDiesel) elCostDiesel.textContent = `${costDiesel100.toFixed(2)} €`;
  if (elSavings100) elSavings100.textContent = `${savings100.toFixed(2)} €`;
  if (elSavingsPct) elSavingsPct.textContent = `-${savingsPct.toFixed(0)}%`;
  if (elMonthlySavings) elMonthlySavings.textContent = `${monthlySavings.toFixed(1)} €`;
  if (elCo2Kg) elCo2Kg.textContent = `${co2AvoidedKgMonthly.toFixed(0)} kg`;
  if (elTrees) elTrees.textContent = `${treesEquivalent} árboles/año`;
  if (elEffectiveRate) elEffectiveRate.textContent = `${costPerKwh.toFixed(3)} €/kWh`;

  // Update dynamic modern 3-bar comparison chart
  const barEv = document.getElementById('calc-bar-ev');
  const barGas = document.getElementById('calc-bar-gas');
  const barDiesel = document.getElementById('calc-bar-diesel');
  const maxCost = Math.max(costGas100, costDiesel100, costEv100, 1);

  if (barEv) {
    barEv.style.height = `${Math.min(100, Math.max(14, (costEv100 / maxCost) * 100))}%`;
    const valEv = document.getElementById('calc-bar-val-ev');
    if (valEv) valEv.textContent = `${costEv100.toFixed(2)}€`;
  }
  if (barGas) {
    barGas.style.height = `${Math.min(100, Math.max(14, (costGas100 / maxCost) * 100))}%`;
    const valGas = document.getElementById('calc-bar-val-gas');
    if (valGas) valGas.textContent = `${costGas100.toFixed(2)}€`;
  }
  if (barDiesel) {
    barDiesel.style.height = `${Math.min(100, Math.max(14, (costDiesel100 / maxCost) * 100))}%`;
    const valDiesel = document.getElementById('calc-bar-val-diesel');
    if (valDiesel) valDiesel.textContent = `${costDiesel100.toFixed(2)}€`;
  }
}

// --- RENDER VEHICLE HUD & METRICS ---
function renderVehicleHUD() {
  const v = STATE.vehicle;
  
  // Dashboard primary ring
  const socVal = document.getElementById('hud-soc-val');
  const socRing = document.getElementById('hud-soc-ring');
  const rangeVal = document.getElementById('hud-range-val');
  const odoVal = document.getElementById('hud-odometer-val');
  const consVal = document.getElementById('hud-cons-val');

  if (socVal) socVal.textContent = v.soc;
  if (rangeVal) rangeVal.textContent = v.range;
  if (odoVal) odoVal.textContent = v.odometer.toLocaleString('es-ES');
  if (consVal) consVal.textContent = v.avgConsumption50km.toFixed(1);

  if (socRing) {
    // 2 * PI * r = 2 * PI * 70 approx 440
    const circumference = 440;
    const offset = circumference - (v.soc / 100) * circumference;
    socRing.style.strokeDashoffset = offset;
  }

  // Telemetry page values
  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setEl('tel-speed', `${v.speed} km/h`);
  setEl('tel-power', `${v.power > 0 ? '+' : ''}${v.power.toFixed(1)} kW`);
  setEl('tel-gear', v.gear);
  setEl('tel-soh', `${v.soh.toFixed(1)}%`);
  setEl('tel-volt-hv', `${v.voltageHV.toFixed(1)} V`);
  setEl('tel-volt-12v', `${v.voltage12v.toFixed(1)} V`);
  setEl('tel-lifetime-cons', `${v.lifetimeConsumption.toFixed(1)} kWh/100km`);
  setEl('tel-temp-ext', `${v.tempExt}°C`);
  setEl('tel-temp-cabin', `${v.tempCabin}°C`);

  // Tire pressures
  setEl('tire-fl', `${v.tires.fl} bar`);
  setEl('tire-fr', `${v.tires.fr} bar`);
  setEl('tire-rl', `${v.tires.rl} bar`);
  setEl('tire-rr', `${v.tires.rr} bar`);
}

// --- TRIPS RENDER ---
function renderTrips() {
  const container = document.getElementById('trips-list');
  if (!container) return;

  const costPerKwh = getEffectiveElectricityPrice();
  const gasPrice = STATE.prices.gas95;
  const iceCons = STATE.prices.iceConsumption;

  container.innerHTML = STATE.trips.map(trip => {
    const tripCostEv = trip.energy * costPerKwh;
    const tripCostIce = (trip.distance / 100) * iceCons * gasPrice;
    const tripSavings = Math.max(0, tripCostIce - tripCostEv);

    return `
      <article class="trip-card">
        <div class="trip-card-main">
          <div class="trip-route-badge">⌖</div>
          <div class="trip-details">
            <div class="trip-title">
              <b>${trip.title}</b>
              <span class="trip-time">${trip.date} · ${trip.duration}</span>
            </div>
            <div class="trip-stats-row">
              <span><b>${trip.distance.toFixed(1)}</b> km</span>
              <span><b>${trip.energy.toFixed(2)}</b> kWh</span>
              <span><b>${trip.avgWh}</b> Wh/km</span>
            </div>
          </div>
        </div>
        <div class="trip-cost-badge">
          <div class="trip-ev-cost">${tripCostEv.toFixed(2)} €</div>
          <div class="trip-ice-comp"><del>${tripCostIce.toFixed(2)}€</del> <span class="badge-saving">-${tripSavings.toFixed(2)}€</span></div>
        </div>
      </article>
    `;
  }).join('');
}

// --- ENCRYPTED VAULT INTEGRATION ---
function initSecurityVault() {
  const saveBtn = document.getElementById('vault-save-btn');
  const unlockBtn = document.getElementById('vault-unlock-btn');
  const wipeBtn = document.getElementById('vault-wipe-btn');
  const statusEl = document.getElementById('vault-status');

  const updateVaultState = () => {
    const hasEncryptedData = Boolean(localStorage.getItem('biguaydi_encrypted_vault'));
    const rememberedSession = localStorage.getItem('biguaydi_vault_session');
    
    // Auto-restore session if user chose to remember on this device
    if (!window.__vaultDecrypted && rememberedSession) {
      try {
        window.__vaultDecrypted = JSON.parse(rememberedSession);
      } catch (_) {
        localStorage.removeItem('biguaydi_vault_session');
      }
    }

    const vaultSetupBox = document.getElementById('vault-setup-box');
    const vaultUnlockBox = document.getElementById('vault-unlock-box');
    const vaultActiveBox = document.getElementById('vault-active-box');

    if (window.__vaultDecrypted) {
      if (vaultSetupBox) vaultSetupBox.hidden = true;
      if (vaultUnlockBox) vaultUnlockBox.hidden = true;
      if (vaultActiveBox) vaultActiveBox.hidden = false;
      if (statusEl) statusEl.textContent = 'Bóveda local desbloqueada y activa';
    } else if (hasEncryptedData) {
      if (vaultSetupBox) vaultSetupBox.hidden = true;
      if (vaultUnlockBox) vaultUnlockBox.hidden = false;
      if (vaultActiveBox) vaultActiveBox.hidden = true;
      if (statusEl) statusEl.textContent = 'Bóveda cifrada protegida con PIN';
    } else {
      if (vaultSetupBox) vaultSetupBox.hidden = false;
      if (vaultUnlockBox) vaultUnlockBox.hidden = true;
      if (vaultActiveBox) vaultActiveBox.hidden = true;
      if (statusEl) statusEl.textContent = 'Sin credenciales cifradas';
    }
  };

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const user = document.getElementById('byd-input-user')?.value.trim();
      const pass = document.getElementById('byd-input-pass')?.value;
      const pin = document.getElementById('vault-input-pin')?.value || '1234';
      const remember = document.getElementById('vault-remember-me')?.checked;

      if (!user || !pass) {
        showToast('Introduce usuario y contraseña de BYD');
        return;
      }

      try {
        const payload = JSON.stringify({ user, pass, createdAt: new Date().toISOString() });
        const encrypted = await SecureVault.encrypt(payload, pin);
        localStorage.setItem('biguaydi_encrypted_vault', encrypted);
        window.__vaultDecrypted = { user, pass };

        if (remember) {
          localStorage.setItem('biguaydi_vault_session', JSON.stringify({ user, pass }));
        } else {
          localStorage.removeItem('biguaydi_vault_session');
        }

        showToast('Credenciales cifradas con éxito');
        updateVaultState();
      } catch (err) {
        showToast('Error al cifrar credenciales');
      }
    });
  }

  if (unlockBtn) {
    unlockBtn.addEventListener('click', async () => {
      const pin = document.getElementById('vault-unlock-pin')?.value;
      const remember = document.getElementById('vault-unlock-remember')?.checked;
      const encrypted = localStorage.getItem('biguaydi_encrypted_vault');
      if (!pin || !encrypted) return;

      try {
        const json = await SecureVault.decrypt(encrypted, pin);
        window.__vaultDecrypted = JSON.parse(json);

        if (remember) {
          localStorage.setItem('biguaydi_vault_session', JSON.stringify(window.__vaultDecrypted));
        }

        showToast('Bóveda descifrada con éxito');
        updateVaultState();
      } catch (e) {
        showToast('PIN incorrecto');
      }
    });
  }

  if (wipeBtn) {
    wipeBtn.addEventListener('click', () => {
      if (confirm('¿Eliminar de forma segura todas las credenciales y datos locales?')) {
        localStorage.removeItem('biguaydi_encrypted_vault');
        localStorage.removeItem('biguaydi_vault_session');
        window.__vaultDecrypted = null;
        updateVaultState();
        showToast('Datos locales borrados por completo');
      }
    });
  }

  // Live Sync trigger button
  const syncBtn = document.getElementById('vault-sync-now-btn');
  if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
      if (!window.__vaultDecrypted) {
        showToast('Desbloquea primero la bóveda con tu PIN');
        return;
      }
      let backendUrl = (localStorage.getItem('biguaydi_backend_url') || '').trim();
      if (!backendUrl) {
        showToast('Escribe primero la URL del conector de Render');
        return;
      }
      backendUrl = backendUrl.replace(/\/+$/, '');
      syncBtn.disabled = true;
      syncBtn.textContent = '⏳ Conectando con BYD Cloud...';
      try {
        const resp = await fetch(`${backendUrl}/api/telemetry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: window.__vaultDecrypted.user,
            password: window.__vaultDecrypted.pass
          })
        });
        let data = {};
        try {
          data = await resp.json();
        } catch (_) {
          data = { detail: resp.statusText };
        }
        if (!resp.ok) {
          throw new Error(data.detail || `Error HTTP ${resp.status}`);
        }

        // Apply live telemetry to STATE
        const rt = data.realtime || {};
        const eg = data.energy || {};
        if (rt.elec_percent !== undefined) STATE.vehicle.soc = Number(rt.elec_percent);
        if (rt.endurance_mileage !== undefined) STATE.vehicle.range = Number(rt.endurance_mileage);
        if (rt.total_mileage !== undefined) STATE.vehicle.odometer = Number(rt.total_mileage);
        if (rt.vehicle_speed !== undefined) STATE.vehicle.speed = Number(rt.vehicle_speed);
        if (eg.nearest_energy_consumption?.avg_ev_consumption) {
          STATE.vehicle.avgConsumption50km = Number(eg.nearest_energy_consumption.avg_ev_consumption);
        }

        renderVehicleHUD();
        updateCalculations();
        showToast('✓ Telemetría de BYD actualizada en vivo');
      } catch (err) {
        showToast(`Fallo de conexión: ${err.message}`);
      } finally {
        syncBtn.disabled = false;
        syncBtn.textContent = '🔄 Sincronizar coche ahora';
      }
    });
  }

  updateVaultState();
}

// --- INIT APP ---
export function initApp() {
  initNavigation();
  setTheme(STATE.theme);
  setFontSize(STATE.fontSize);
  renderVehicleHUD();
  updateCalculations();
  renderTrips();
  initSecurityVault();

  // Theme choices
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => setTheme(btn.dataset.theme));
  });

  // Font slider
  const slider = document.getElementById('font-size-slider');
  if (slider) {
    slider.addEventListener('input', (e) => setFontSize(e.target.value));
  }

  // Energy source choices
  document.querySelectorAll('.energy-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.energy-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      STATE.energySource = chip.dataset.energy;
      localStorage.setItem('biguaydi-energy-source', STATE.energySource);
      updateCalculations();
      renderTrips();
      showToast(`Modo cambiado: ${chip.textContent.trim()}`);
    });
  });

  // Price inputs sync
  const bindInput = (id, key, subkey) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = STATE[key][subkey];
    el.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val)) {
        STATE[key][subkey] = val;
        localStorage.setItem(`biguaydi-${subkey}`, val);
        updateCalculations();
        renderTrips();
      }
    });
  };

  bindInput('cfg-kwh-grid', 'prices', 'kwhGrid');
  bindInput('cfg-kwh-solar', 'prices', 'kwhSolar');
  bindInput('cfg-solar-pct', 'prices', 'solarPct');
  bindInput('cfg-gas-price', 'prices', 'gas95');
  bindInput('cfg-diesel-price', 'prices', 'diesel');
  bindInput('cfg-ice-cons', 'prices', 'iceConsumption');
  bindInput('cfg-diesel-cons', 'prices', 'dieselConsumption');

  // Fuel selector chips (Gasolina vs Diésel)
  document.querySelectorAll('.fuel-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.fuel-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      STATE.prices.fuelType = chip.dataset.fuel;
      localStorage.setItem('biguaydi-fuel-type', STATE.prices.fuelType);
      updateCalculations();
      renderTrips();
      showToast(`Comparando con: ${chip.textContent.trim()}`);
    });
  });

  // Daily market prices fetcher (REE & MITECO)
  const fetchMarketBtn = document.getElementById('btn-fetch-market-prices');
  if (fetchMarketBtn) {
    fetchMarketBtn.addEventListener('click', async () => {
      let backendUrl = (localStorage.getItem('biguaydi_backend_url') || 'https://biguaydi-api.onrender.com').trim().replace(/\/+$/, '');
      fetchMarketBtn.disabled = true;
      fetchMarketBtn.textContent = '⏳ Consultando REE y MITECO...';
      try {
        const resp = await fetch(`${backendUrl}/api/prices`);
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.detail || 'Error consultando precios');
        
        if (data.kwhGrid) {
          STATE.prices.kwhGrid = Number(data.kwhGrid);
          localStorage.setItem('biguaydi-kwh-grid', data.kwhGrid);
          const inpGrid = document.getElementById('cfg-kwh-grid');
          if (inpGrid) inpGrid.value = data.kwhGrid;
        }
        if (data.gas95) {
          STATE.prices.gas95 = Number(data.gas95);
          localStorage.setItem('biguaydi-gas-price', data.gas95);
          const inpGas = document.getElementById('cfg-gas-price');
          if (inpGas) inpGas.value = data.gas95;
        }
        if (data.diesel) {
          STATE.prices.diesel = Number(data.diesel);
          localStorage.setItem('biguaydi-diesel', data.diesel);
          const inpDie = document.getElementById('cfg-diesel-price');
          if (inpDie) inpDie.value = data.diesel;
        }

        updateCalculations();
        renderTrips();
        showToast(`✓ Medias hoy: Luz ${data.kwhGrid}€/kWh · Gasolina ${data.gas95}€/L · Diésel ${data.diesel}€/L`);
      } catch (err) {
        showToast(`No se pudieron obtener precios: ${err.message}`);
      } finally {
        fetchMarketBtn.disabled = false;
        fetchMarketBtn.textContent = '📡 Obtener medias hoy (REE / MITECO)';
      }
    });
  }

        updateCalculations();
        renderTrips();
        showToast(`✓ Precios oficiales actualizados: Luz ${data.kwhGrid}€/kWh · Gasolina ${data.gas95}€/L`);
      } catch (err) {
        showToast(`No se pudieron obtener precios: ${err.message}`);
      } finally {
        fetchMarketBtn.disabled = false;
        fetchMarketBtn.textContent = '📡 Obtener medias hoy (REE / MITECO)';
      }
    });
  }

  const backendInput = document.getElementById('cfg-backend-url');
  if (backendInput) {
    backendInput.value = localStorage.getItem('biguaydi_backend_url') || '';
    backendInput.addEventListener('input', (e) => {
      localStorage.setItem('biguaydi_backend_url', e.target.value.trim());
    });
  }

  // Register service worker for PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

// Auto start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
