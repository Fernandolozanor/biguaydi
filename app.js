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
    fuelType: localStorage.getItem('biguaydi-fuel-type') || 'gas95', // gas95 or diesel
    date: localStorage.getItem('biguaydi-prices-date') || new Date().toLocaleDateString('es-ES')
  },
  selectedTripCategory: 'all',
  // Loaded from cache or default values for Dolphin Surf
  vehicle: (function() {
    try {
      const saved = localStorage.getItem('biguaydi-vehicle');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {
      soc: 78,
      range: 312,
      odometer: 14280,
      speed: 0,
      power: 0.0,
      charging: false,
      gear: 'P',
      driveStatus: 'Estacionado (P)',
      driveMode: 'ECO Inteligente',
      tempCabin: 21.5,
      tempExt: 19.0,
      soh: 99.2,
      voltageHV: 348.5,
      voltage12v: 13.6,
      avgConsumption50km: 13.8, // kWh/100km
      lifetimeConsumption: 14.2, // kWh/100km
      tires: { fl: 2.5, fr: 2.5, rl: 2.6, rr: 2.6 }
    };
  })(),
  trips: (function() {
    try {
      const saved = localStorage.getItem('biguaydi-trips');
      const list = saved ? JSON.parse(saved) : [
        { id: 1, title: 'Trabajo ➔ Casa', category: 'trabajo', date: 'Hoy, 18:20', distance: 22.4, energy: 3.1, avgWh: 138, duration: '28 min' },
        { id: 2, title: 'Casa ➔ Gimnasio', category: 'personal', date: 'Hoy, 07:45', distance: 8.5, energy: 1.2, avgWh: 141, duration: '12 min' },
        { id: 3, title: 'Ruta Clientes Centro', category: 'chofer', date: 'Ayer', distance: 74.2, energy: 11.2, avgWh: 150, duration: '52 min' },
        { id: 4, title: 'Compras & Supermercado', category: 'compras', date: '02 Oct', distance: 14.8, energy: 1.9, avgWh: 128, duration: '25 min' }
      ];
      return list.map(t => ({ category: 'trabajo', ...t }));
    } catch (_) {
      return [];
    }
  })(),
  autoRecorder: {
    lastOdometer: Number(localStorage.getItem('biguaydi-recorder-odo')) || 14280,
    status: 'Activo'
  }
};

export const TRIP_CATEGORIES = {
  trabajo: { label: 'Trabajo', icon: '💼', color: '#6db6ff' },
  compras: { label: 'Compras', icon: '🛒', color: '#ffb347' },
  chofer: { label: 'Chófer', icon: '👔', color: '#c7f36b' },
  ocio: { label: 'Ocio', icon: '🏖️', color: '#ff7597' },
  personal: { label: 'Personal', icon: '🏠', color: '#b388ff' }
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
  const handleNavClick = (btn) => {
    const targetView = btn.dataset.targetView;
    if (targetView) {
      switchView(targetView);
    }
  };

  document.querySelectorAll('[data-target-view]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleNavClick(btn);
    });
  });
}

function switchView(viewName) {
  STATE.view = viewName;
  document.querySelectorAll('.app-view').forEach(view => {
    const match = view.id === `view-${viewName}`;
    view.classList.toggle('active', match);
    if (match) {
      view.style.display = 'block';
    } else {
      view.style.display = 'none';
    }
  });
  document.querySelectorAll('[data-target-view]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.targetView === viewName);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- THEME & CUSTOMIZATION ---
function setTheme(theme) {
  if (!theme || !CAR_IMAGES[theme]) {
    theme = localStorage.getItem('biguaydi-theme') || STATE.theme || 'original';
  }
  if (!CAR_IMAGES[theme]) theme = 'original';

  STATE.theme = theme;
  document.body.dataset.theme = theme;
  localStorage.setItem('biguaydi-theme', theme);

  document.querySelectorAll('.theme-picker-row [data-theme]').forEach(b => {
    b.classList.toggle('active', b.dataset.theme === theme);
  });

  const carImg = document.getElementById('car-render-img');
  if (carImg && CAR_IMAGES[theme]) {
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
  renderTripsChart();
  updateCalculations();
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

  // Savings against BOTH fuels
  const savingsGas100 = Math.max(0, costGas100 - costEv100);
  const savingsGasPct = costGas100 > 0 ? ((savingsGas100 / costGas100) * 100) : 0;

  const savingsDiesel100 = Math.max(0, costDiesel100 - costEv100);
  const savingsDieselPct = costDiesel100 > 0 ? ((savingsDiesel100 / costDiesel100) * 100) : 0;

  // Monthly estimate based on 1.200 km / month average
  const kmMonth = 1200;
  const monthlyEvCost = (kmMonth / 100) * costEv100;
  const monthlyGasCost = (kmMonth / 100) * costGas100;
  const monthlyDieselCost = (kmMonth / 100) * costDiesel100;
  const monthlySavingsGas = monthlyGasCost - monthlyEvCost;
  const monthlySavingsDiesel = monthlyDieselCost - monthlyEvCost;

  // CO2 Emitted ICE vs EV
  const evCo2PerKm = STATE.energySource === 'solar' ? 0 : 38; // g/km
  const iceCo2PerKm = 142; // g/km average
  const co2AvoidedKgMonthly = ((iceCo2PerKm - evCo2PerKm) * kmMonth) / 1000;
  const treesEquivalent = Math.max(1, Math.round(co2AvoidedKgMonthly * 12 / 21));

  // Dashboard Highlight DOM Updates
  const elCostEv = document.getElementById('calc-ev-cost-100');
  const elIceGasCost = document.getElementById('calc-ice-gas-cost');
  const elIceDieselCost = document.getElementById('calc-ice-diesel-cost');
  const elMonthlySavings = document.getElementById('calc-monthly-savings');
  const elSavingsMonthGas = document.getElementById('calc-savings-month-gas');
  const elSavingsMonthDiesel = document.getElementById('calc-savings-month-diesel');
  const elCo2Kg = document.getElementById('calc-co2-kg');
  const elTrees = document.getElementById('calc-trees');

  if (elCostEv) elCostEv.textContent = `${costEv100.toFixed(2)} €`;
  if (elIceGasCost) elIceGasCost.textContent = `${costGas100.toFixed(2)} €`;
  if (elIceDieselCost) elIceDieselCost.textContent = `${costDiesel100.toFixed(2)} €`;
  if (elMonthlySavings) elMonthlySavings.textContent = `${monthlySavingsGas.toFixed(1)} €`;
  if (elSavingsMonthGas) elSavingsMonthGas.textContent = `${monthlySavingsGas.toFixed(1)} €`;
  if (elSavingsMonthDiesel) elSavingsMonthDiesel.textContent = `${monthlySavingsDiesel.toFixed(1)} €`;
  if (elCo2Kg) elCo2Kg.textContent = `${co2AvoidedKgMonthly.toFixed(0)} kg`;
  if (elTrees) elTrees.textContent = `${treesEquivalent} árboles/año`;

  // Calculator View Dual Comparison DOM Updates
  const elCostGas = document.getElementById('calc-gas-cost-100');
  const elCostDiesel = document.getElementById('calc-diesel-cost-100');
  const elSavingsGas100 = document.getElementById('calc-savings-gas-100');
  const elSavingsGasPct = document.getElementById('calc-savings-gas-pct');
  const elSavingsDiesel100 = document.getElementById('calc-savings-diesel-100');
  const elSavingsDieselPct = document.getElementById('calc-savings-diesel-pct');
  const elEffectiveRate = document.getElementById('calc-effective-rate');

  if (elCostGas) elCostGas.textContent = `${costGas100.toFixed(2)} €`;
  if (elCostDiesel) elCostDiesel.textContent = `${costDiesel100.toFixed(2)} €`;
  if (elSavingsGas100) elSavingsGas100.textContent = `${savingsGas100.toFixed(2)} €`;
  if (elSavingsGasPct) elSavingsGasPct.textContent = `-${savingsGasPct.toFixed(0)}%`;
  if (elSavingsDiesel100) elSavingsDiesel100.textContent = `${savingsDiesel100.toFixed(2)} €`;
  if (elSavingsDieselPct) elSavingsDieselPct.textContent = `-${savingsDieselPct.toFixed(0)}%`;
  if (elEffectiveRate) elEffectiveRate.textContent = `${costPerKwh.toFixed(3)} €/kWh`;

  const displayDate = STATE.prices.date || localStorage.getItem('biguaydi-prices-date') || new Date().toLocaleDateString('es-ES');
  const elPricesDate = document.getElementById('prices-update-date');
  const elCalcPricesDate = document.getElementById('calc-prices-date');
  if (elPricesDate) elPricesDate.textContent = displayDate;
  if (elCalcPricesDate) elCalcPricesDate.textContent = displayDate;

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
    // 2 * PI * r = 2 * PI * 66 approx 415
    const circumference = 415;
    const offset = circumference - (v.soc / 100) * circumference;
    socRing.style.strokeDashoffset = offset;
  }

  // Telemetry page values
  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setEl('tel-drive-status', v.driveStatus || `Estacionado (${v.gear})`);
  setEl('tel-speed', `${v.speed} km/h${v.speed === 0 ? ' · Detenido' : ''}`);
  setEl('tel-power', `${v.power > 0 ? '+' : ''}${v.power.toFixed(1)} kW${v.charging ? ' (Carga)' : (v.speed > 0 ? ' (Tracción)' : ' (Reposo)')}`);
  setEl('tel-gear', v.gear);
  setEl('tel-drive-mode', v.driveMode || 'ECO Inteligente');
  setEl('tel-soh', `${v.soh.toFixed(1)}%`);
  setEl('tel-volt-hv', `${v.voltageHV.toFixed(1)} V`);
  setEl('tel-volt-12v', `${v.voltage12v.toFixed(1)} V`);
  setEl('tel-lifetime-cons', `${v.lifetimeConsumption.toFixed(1)} kWh/100km`);
  setEl('tel-temp-ext', `${v.tempExt}°C`);
  setEl('tel-temp-cabin', `${v.tempCabin}°C`);

  // Tire pressures (Telemetry page and Dashboard Chassis HUD)
  setEl('tire-fl', `${v.tires.fl} bar`);
  setEl('tire-fr', `${v.tires.fr} bar`);
  setEl('tire-rl', `${v.tires.rl} bar`);
  setEl('tire-rr', `${v.tires.rr} bar`);

  setEl('hud-tire-fl', `${v.tires.fl} bar`);
  setEl('hud-tire-fr', `${v.tires.fr} bar`);
  setEl('hud-tire-rl', `${v.tires.rl} bar`);
  setEl('hud-tire-rr', `${v.tires.rr} bar`);
}

// --- TRIPS RENDER, KPIS & IMPACTFUL CHART ---
function renderTrips() {
  const container = document.getElementById('trips-list');
  if (!container) return;

  const costPerKwh = getEffectiveElectricityPrice();
  const gasPrice = STATE.prices.gas95;
  const dieselPrice = STATE.prices.diesel;
  const iceCons = STATE.prices.iceConsumption;
  const dieselCons = STATE.prices.dieselConsumption;

  // 1. Compute Aggregated KPIs
  let totalDistance = 0;
  let totalEnergy = 0;
  let totalCostEv = 0;
  let totalCostGas = 0;
  let totalCostDiesel = 0;

  STATE.trips.forEach(trip => {
    totalDistance += trip.distance;
    totalEnergy += trip.energy;
    const costEv = trip.energy * costPerKwh;
    const costGas = (trip.distance / 100) * iceCons * gasPrice;
    const costDiesel = (trip.distance / 100) * dieselCons * dieselPrice;
    totalCostEv += costEv;
    totalCostGas += costGas;
    totalCostDiesel += costDiesel;
  });

  const totalSavingsGas = Math.max(0, totalCostGas - totalCostEv);
  const totalSavingsDiesel = Math.max(0, totalCostDiesel - totalCostEv);
  const avgKwh100km = totalDistance > 0 ? ((totalEnergy / totalDistance) * 100) : 0;
  const avgWh = totalDistance > 0 ? Math.round((totalEnergy * 1000) / totalDistance) : 0;
  const co2AvoidedKg = (totalDistance * 104) / 1000;

  // Update KPI DOM elements
  const elDist = document.getElementById('kpi-trip-distance');
  const elCount = document.getElementById('kpi-trip-count');
  const elSavings = document.getElementById('kpi-trip-savings');
  const elSavGas = document.getElementById('kpi-trip-sav-gas');
  const elSavDiesel = document.getElementById('kpi-trip-sav-diesel');
  const elEff = document.getElementById('kpi-trip-efficiency');
  const elWh = document.getElementById('kpi-trip-wh');
  const elCo2 = document.getElementById('kpi-trip-co2');
  const elOdoBase = document.getElementById('recorder-base-odo');

  if (elDist) elDist.textContent = `${totalDistance.toFixed(1)} km`;
  if (elCount) elCount.textContent = STATE.trips.length;
  if (elSavings) elSavings.textContent = `${totalSavingsGas.toFixed(2)} €`;
  if (elSavGas) elSavGas.textContent = `${totalSavingsGas.toFixed(2)}€`;
  if (elSavDiesel) elSavDiesel.textContent = `${totalSavingsDiesel.toFixed(2)}€`;
  if (elEff) elEff.textContent = `${avgKwh100km.toFixed(1)} kWh`;
  if (elWh) elWh.textContent = avgWh;
  if (elCo2) elCo2.textContent = `${co2AvoidedKg.toFixed(1)} kg`;
  if (elOdoBase) elOdoBase.textContent = `${STATE.vehicle.odometer.toLocaleString('es-ES')} km`;

  // 2. Filter Trips by Active Category
  const activeCat = STATE.selectedTripCategory || 'all';
  const chips = document.querySelectorAll('#trip-category-filters .trip-filter-chip');
  chips.forEach(chip => {
    chip.classList.toggle('active', chip.dataset.category === activeCat);
  });

  const displayedTrips = activeCat === 'all'
    ? STATE.trips
    : STATE.trips.filter(t => (t.category || 'trabajo') === activeCat);

  // Render List of Trip Cards
  if (displayedTrips.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:36px 20px; color:var(--text-muted); background:var(--panel-card); border:1px solid var(--panel-border); border-radius:var(--radius-sm);">
        <span style="font-size:32px; display:block; margin-bottom:8px;">🚗</span>
        <b>Sin trayectos en esta categoría</b>
        <p style="font-size:12.5px; margin-top:4px;">${activeCat === 'all' ? 'Pulsa en "Simular y Probar Trayecto" o sincroniza con tu coche para registrar automáticamente.' : 'No hay viajes categorizados como ' + (TRIP_CATEGORIES[activeCat]?.label || activeCat) + '.'}</p>
      </div>
    `;
  } else {
    container.innerHTML = displayedTrips.map((trip, idx) => {
      const tripCostEv = trip.energy * costPerKwh;
      const tripCostGas = (trip.distance / 100) * iceCons * gasPrice;
      const tripCostDiesel = (trip.distance / 100) * dieselCons * dieselPrice;
      const tripSavingsGas = Math.max(0, tripCostGas - tripCostEv);
      const tripSavingsDiesel = Math.max(0, tripCostDiesel - tripCostEv);
      const catKey = trip.category || 'trabajo';
      const catObj = TRIP_CATEGORIES[catKey] || TRIP_CATEGORIES.trabajo;

      return `
        <article class="trip-card ${trip.isNew ? 'new-arrival' : ''}" id="trip-card-${trip.id}" data-id="${trip.id}" draggable="true">
          <div class="trip-card-main">
            <div class="trip-route-badge reorder-handle" title="Arrastra o usa las flechas para mover" data-id="${trip.id}">⌖</div>
            <div class="trip-details">
              <div class="trip-title">
                <b>${trip.title}</b>
                <span class="trip-category-tag ${catKey}">${catObj.icon} ${catObj.label}</span>
                <span class="trip-time">${trip.date} · ${trip.duration}</span>
              </div>
              <div class="trip-stats-row">
                <span><b>${trip.distance.toFixed(1)}</b> km</span>
                <span><b>${trip.energy.toFixed(2)}</b> kWh</span>
                <span><b>${trip.avgWh}</b> Wh/km</span>
              </div>
            </div>
          </div>
          <div class="trip-card-right">
            <div class="trip-cost-badge">
              <div class="trip-ev-cost">${tripCostEv.toFixed(2)} €</div>
              <div class="trip-ice-comp">
                <div>Gas: ${tripCostGas.toFixed(2)}€ <b class="badge-saving badge-gas">-${tripSavingsGas.toFixed(2)}€</b></div>
                <div>Diésel: ${tripCostDiesel.toFixed(2)}€ <b class="badge-saving badge-diesel">-${tripSavingsDiesel.toFixed(2)}€</b></div>
              </div>
            </div>
            <div class="trip-card-actions">
              <button class="trip-action-btn btn-move-up" data-id="${trip.id}" title="Subir orden" type="button" ${idx === 0 ? 'disabled style="opacity:0.35;"' : ''}>▲</button>
              <button class="trip-action-btn btn-move-down" data-id="${trip.id}" title="Bajar orden" type="button" ${idx === displayedTrips.length - 1 ? 'disabled style="opacity:0.35;"' : ''}>▼</button>
              <button class="trip-action-btn btn-edit-trip" data-id="${trip.id}" title="Editar trayecto" type="button">✏️</button>
              <button class="trip-action-btn btn-delete-trip" data-id="${trip.id}" title="Eliminar trayecto" type="button">🗑️</button>
            </div>
          </div>
        </article>
      `;
    }).join('');

    // Event delegation for reordering, editing, and deleting
    container.onclick = (e) => {
      const btnEdit = e.target.closest('.btn-edit-trip');
      const btnDelete = e.target.closest('.btn-delete-trip');
      const btnUp = e.target.closest('.btn-move-up');
      const btnDown = e.target.closest('.btn-move-down');

      if (btnEdit) {
        e.preventDefault();
        const id = Number(btnEdit.dataset.id);
        openEditTripModal(id);
      } else if (btnDelete) {
        e.preventDefault();
        const id = Number(btnDelete.dataset.id);
        deleteTrip(id);
      } else if (btnUp) {
        e.preventDefault();
        const id = Number(btnUp.dataset.id);
        moveTrip(id, -1);
      } else if (btnDown) {
        e.preventDefault();
        const id = Number(btnDown.dataset.id);
        moveTrip(id, 1);
      }
    };

    initTripDragAndDrop();
  }

  // 3. Render the Impactful SVG Chart
  renderTripsChart();
}

export function moveTrip(id, direction) {
  const index = STATE.trips.findIndex(t => t.id === id);
  if (index === -1) return;
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= STATE.trips.length) return;

  const [trip] = STATE.trips.splice(index, 1);
  STATE.trips.splice(targetIndex, 0, trip);
  localStorage.setItem('biguaydi-trips', JSON.stringify(STATE.trips));
  renderTrips();
  showToast('✓ Posición del trayecto actualizada');
}

export function initTripDragAndDrop() {
  const cards = document.querySelectorAll('.trip-card[draggable="true"]');
  let draggedId = null;

  cards.forEach(card => {
    card.addEventListener('dragstart', (e) => {
      draggedId = Number(card.dataset.id);
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(draggedId));
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      cards.forEach(c => c.classList.remove('drag-over'));
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      card.classList.add('drag-over');
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-over');
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-over');
      const targetId = Number(card.dataset.id);
      if (draggedId && targetId && draggedId !== targetId) {
        const fromIdx = STATE.trips.findIndex(t => t.id === draggedId);
        const toIdx = STATE.trips.findIndex(t => t.id === targetId);
        if (fromIdx !== -1 && toIdx !== -1) {
          const [moved] = STATE.trips.splice(fromIdx, 1);
          STATE.trips.splice(toIdx, 0, moved);
          localStorage.setItem('biguaydi-trips', JSON.stringify(STATE.trips));
          renderTrips();
          showToast('✓ Trayecto reordenado con éxito');
        }
      }
    });
  });
}

function renderTripsChart() {
  const chartBox = document.getElementById('trips-chart-container');
  if (!chartBox) return;

  const trips = STATE.trips.slice(0, 8).reverse();
  if (trips.length === 0) {
    chartBox.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-dim); font-size:12px;">Sin datos suficientes para graficar</div>';
    return;
  }

  const gasPrice = STATE.prices.gas95;
  const dieselPrice = STATE.prices.diesel;
  const iceCons = STATE.prices.iceConsumption;
  const dieselCons = STATE.prices.dieselConsumption;

  const data = trips.map(t => {
    const costGas = (t.distance / 100) * iceCons * gasPrice;
    const costDiesel = (t.distance / 100) * dieselCons * dieselPrice;
    return {
      title: t.title.split(' ')[0] || `V${t.id}`,
      dist: t.distance.toFixed(1) + 'km',
      wh: t.avgWh,
      costGas,
      costDiesel
    };
  });

  const maxCost = Math.max(...data.map(d => Math.max(d.costGas, d.costDiesel)), 1.5);
  const minWh = Math.min(...data.map(d => d.wh), 100);
  const maxWh = Math.max(...data.map(d => d.wh), 200);

  // Responsive dimensions: Mobile fits comfortably and scrolls smoothly if needed; Desktop is wide
  const isMobile = window.innerWidth <= 768;
  const W = isMobile ? Math.max(340, data.length * 82) : Math.max(900, data.length * 125);
  const H = isMobile ? 220 : 250;
  const padL = isMobile ? 44 : 52;
  const padR = isMobile ? 20 : 30;
  const padT = isMobile ? 28 : 34;
  const padB = isMobile ? 42 : 46;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const slotW = plotW / data.length;
  const barW = Math.min(isMobile ? 20 : 26, Math.max(12, slotW * 0.22));
  const barGap = isMobile ? 4 : 6;
  const fontScale = 0.85 + (STATE.fontSize - 1) * 0.12;
  const linePoints = [];

  let barsSvg = '';
  data.forEach((d, i) => {
    const cx = padL + i * slotW + slotW / 2;
    const xGas = cx - barW - (barGap / 2);
    const xDiesel = cx + (barGap / 2);

    const hGas = Math.max(10, (d.costGas / maxCost) * plotH);
    const hDiesel = Math.max(10, (d.costDiesel / maxCost) * plotH);

    const yGas = padT + (plotH - hGas);
    const yDiesel = padT + (plotH - hDiesel);

    const whNorm = (d.wh - minWh) / Math.max(1, maxWh - minWh);
    const yWh = padT + (plotH - (whNorm * (plotH * 0.6) + (plotH * 0.2)));
    linePoints.push({ x: cx, y: yWh, val: d.wh });

    barsSvg += `
      <g class="chart-trip-group">
        <!-- Gasolina 95 Bar -->
        <rect x="${xGas}" y="${yGas}" width="${barW}" height="${hGas}" rx="4" fill="url(#tripGasGrad)" />
        <rect x="${xGas}" y="${yGas}" width="${barW}" height="2.5" rx="1" fill="#fff" filter="url(#glowGas)" />
        <text x="${xGas + barW / 2}" y="${yGas - 6}" font-size="${(10.5 * fontScale).toFixed(1)}" class="chart-text-val" font-weight="600" fill="#ff8c73" text-anchor="middle" font-family="var(--mono)">${d.costGas.toFixed(2)}€</text>

        <!-- Diésel A Bar -->
        <rect x="${xDiesel}" y="${yDiesel}" width="${barW}" height="${hDiesel}" rx="4" fill="url(#tripDieGrad)" />
        <rect x="${xDiesel}" y="${yDiesel}" width="${barW}" height="2.5" rx="1" fill="#fff" filter="url(#glowDie)" />
        <text x="${xDiesel + barW / 2}" y="${yDiesel - 6}" font-size="${(10.5 * fontScale).toFixed(1)}" class="chart-text-val" font-weight="600" fill="#f5cc7f" text-anchor="middle" font-family="var(--mono)">${d.costDiesel.toFixed(2)}€</text>

        <!-- Labels -->
        <text x="${cx}" y="${H - 22}" font-size="${(12 * fontScale).toFixed(1)}" class="chart-text-title" font-weight="600" fill="var(--text)" text-anchor="middle" font-family="var(--sans)">${d.title}</text>
        <text x="${cx}" y="${H - 7}" font-size="${(10.5 * fontScale).toFixed(1)}" class="chart-text-sub" fill="var(--text-muted)" text-anchor="middle" font-family="var(--mono)">${d.dist}</text>
      </g>
    `;
  });

  // Y-axis grid lines and price labels
  const steps = 4;
  let gridSvg = '';
  for (let s = 0; s <= steps; s++) {
    const yVal = padT + (plotH * (s / steps));
    const euroVal = (maxCost * (1 - s / steps)).toFixed(1);
    gridSvg += `
      <line x1="${padL}" y1="${yVal}" x2="${W - padR}" y2="${yVal}" stroke="${s === steps ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)'}" stroke-dasharray="${s === steps ? 'none' : '4 4'}" />
      <text x="${padL - 8}" y="${yVal + 3.5}" font-size="${(10 * fontScale).toFixed(1)}" class="chart-text-axis" fill="var(--text-muted)" text-anchor="end" font-family="var(--mono)">${euroVal}€</text>
    `;
  }

  const pointsStr = linePoints.map(p => `${p.x},${p.y}`).join(' ');
  const dotsSvg = linePoints.map(p => `
    <circle cx="${p.x}" cy="${p.y}" r="4.5" fill="#4ce0d2" stroke="#060c0a" stroke-width="2" filter="url(#glowCyan)" />
    <text x="${p.x}" y="${p.y - 8}" font-size="${(9.5 * fontScale).toFixed(1)}" class="chart-text-val" fill="#4ce0d2" text-anchor="middle" font-weight="700" font-family="var(--mono)">${p.val}</text>
  `).join('');

  chartBox.innerHTML = `
    <svg class="trips-svg-canvas" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="tripGasGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#ff8c73" />
          <stop offset="100%" stop-color="#4d170c" />
        </linearGradient>
        <linearGradient id="tripDieGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#f5cc7f" />
          <stop offset="100%" stop-color="#47310a" />
        </linearGradient>
        <filter id="glowGas" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="glowDie" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="glowCyan" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      ${gridSvg}
      ${barsSvg}

      <polyline fill="none" stroke="#4ce0d2" stroke-width="2.5" stroke-dasharray="4 3" points="${pointsStr}" opacity="0.9" />
      ${dotsSvg}
    </svg>
  `;
}

// --- AUTO TRIP RECORDER ENGINE & SIMULATOR ---
function initAutoTripRecorder() {
  const btnSim = document.getElementById('btn-simulate-trip');
  const btnReset = document.getElementById('btn-reset-trips');
  const filterRow = document.getElementById('trip-category-filters');

  // Filter chips click handler
  if (filterRow) {
    filterRow.addEventListener('click', (e) => {
      const chip = e.target.closest('.trip-filter-chip');
      if (!chip) return;
      STATE.selectedTripCategory = chip.dataset.category || 'all';
      renderTrips();
    });
  }

  if (btnSim) {
    btnSim.addEventListener('click', () => {
      const routes = [
        { title: 'Trabajo ➔ Ciudad', dist: 18.6, wh: 132, category: 'trabajo' },
        { title: 'Autovía / Ronda', dist: 29.4, wh: 148, category: 'ocio' },
        { title: 'Centro Comercial', dist: 11.2, wh: 126, category: 'compras' },
        { title: 'Escapada Sierra', dist: 54.0, wh: 156, category: 'ocio' },
        { title: 'Traslado Directivo', dist: 24.8, wh: 139, category: 'chofer' }
      ];
      const sample = routes[Math.floor(Math.random() * routes.length)];
      const deltaOdo = sample.dist;

      STATE.vehicle.odometer = Number((STATE.vehicle.odometer + deltaOdo).toFixed(1));

      // Dynamic Tracción & Marcha Simulation for immediate live feedback
      const simSpeed = Math.floor(45 + Math.random() * 35);
      const simPower = Number((12.5 + Math.random() * 9.5).toFixed(1));
      STATE.vehicle.speed = simSpeed;
      STATE.vehicle.gear = 'D';
      STATE.vehicle.power = simPower;
      STATE.vehicle.driveStatus = `En Marcha (${simSpeed} km/h · Tracción)`;
      STATE.vehicle.driveMode = 'SPORT Dinámico';
      renderVehicleHUD();
      localStorage.setItem('biguaydi-vehicle', JSON.stringify(STATE.vehicle));

      // Reset to parked after active driving simulation
      setTimeout(() => {
        STATE.vehicle.speed = 0;
        STATE.vehicle.gear = 'P';
        STATE.vehicle.power = 0.0;
        STATE.vehicle.driveStatus = 'Estacionado (P)';
        STATE.vehicle.driveMode = 'ECO Inteligente';
        renderVehicleHUD();
        localStorage.setItem('biguaydi-vehicle', JSON.stringify(STATE.vehicle));
      }, 3800);

      const newTrip = {
        id: Date.now(),
        title: sample.title,
        category: sample.category || 'trabajo',
        date: 'Hoy, ' + new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        distance: sample.dist,
        energy: Number(((sample.dist * sample.wh) / 1000).toFixed(2)),
        avgWh: sample.wh,
        duration: Math.max(8, Math.round(sample.dist * 1.5)) + ' min',
        isNew: true
      };

      STATE.trips.unshift(newTrip);
      localStorage.setItem('biguaydi-trips', JSON.stringify(STATE.trips));
      localStorage.setItem('biguaydi-recorder-odo', STATE.vehicle.odometer);

      renderTrips();
      showToast(`⚡ ¡Nuevo trayecto de ${sample.dist} km (${TRIP_CATEGORIES[newTrip.category]?.label || 'Trabajo'}) registrado!`);

      setTimeout(() => {
        const firstCard = document.querySelector('.trip-card');
        if (firstCard) {
          firstCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (confirm('¿Restablecer el historial de trayectos a los valores iniciales de prueba?')) {
        STATE.trips = [
          { id: 1, title: 'Trabajo ➔ Casa', category: 'trabajo', date: 'Hoy, 18:20', distance: 22.4, energy: 3.1, avgWh: 138, duration: '28 min' },
          { id: 2, title: 'Casa ➔ Gimnasio', category: 'personal', date: 'Hoy, 07:45', distance: 8.5, energy: 1.2, avgWh: 141, duration: '12 min' },
          { id: 3, title: 'Ruta Clientes Centro', category: 'chofer', date: 'Ayer', distance: 74.2, energy: 11.2, avgWh: 150, duration: '52 min' },
          { id: 4, title: 'Compras & Supermercado', category: 'compras', date: '02 Oct', distance: 14.8, energy: 1.9, avgWh: 128, duration: '25 min' }
        ];
        localStorage.setItem('biguaydi-trips', JSON.stringify(STATE.trips));
        renderTrips();
        showToast('Historial de trayectos restablecido');
      }
    });
  }

  // Clear all trips
  const btnClearAll = document.getElementById('btn-clear-all-trips');
  if (btnClearAll) {
    btnClearAll.addEventListener('click', () => {
      if (STATE.trips.length === 0) {
        showToast('El historial ya está vacío');
        return;
      }
      if (confirm('¿Vaciar por completo todo el historial de trayectos registrados?')) {
        STATE.trips = [];
        localStorage.setItem('biguaydi-trips', JSON.stringify([]));
        renderTrips();
        showToast('🗑️ Historial de trayectos vaciado');
      }
    });
  }

  // Edit Modal Event Handlers
  const formEdit = document.getElementById('form-edit-trip');
  const btnCancel = document.getElementById('btn-cancel-edit-trip');
  const btnClose = document.getElementById('btn-close-edit-modal');
  const modal = document.getElementById('modal-edit-trip');

  if (btnCancel) btnCancel.addEventListener('click', closeEditTripModal);
  if (btnClose) btnClose.addEventListener('click', closeEditTripModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeEditTripModal();
    });
  }

  if (formEdit) {
    formEdit.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = Number(document.getElementById('edit-trip-id').value);
      const tripIndex = STATE.trips.findIndex(t => t.id === id);
      if (tripIndex !== -1) {
        const dist = parseFloat(document.getElementById('edit-trip-distance').value) || 0;
        const wh = parseInt(document.getElementById('edit-trip-wh').value, 10) || 138;
        const energy = Number(((dist * wh) / 1000).toFixed(2));
        const cat = document.getElementById('edit-trip-category')?.value || 'trabajo';

        STATE.trips[tripIndex] = {
          ...STATE.trips[tripIndex],
          title: document.getElementById('edit-trip-title').value.trim() || 'Ruta',
          category: cat,
          date: document.getElementById('edit-trip-date').value.trim() || 'Hoy',
          distance: dist,
          avgWh: wh,
          energy: energy,
          duration: document.getElementById('edit-trip-duration').value.trim() || `${Math.round(dist * 1.5)} min`,
          isNew: false
        };

        localStorage.setItem('biguaydi-trips', JSON.stringify(STATE.trips));
        renderTrips();
        closeEditTripModal();
        showToast('✓ Trayecto actualizado con éxito');
      }
    });
  }
}

// --- TRIP EDIT & DELETE HELPERS ---
export function openEditTripModal(id) {
  const trip = STATE.trips.find(t => t.id === id);
  if (!trip) return;

  const modal = document.getElementById('modal-edit-trip');
  const idInput = document.getElementById('edit-trip-id');
  const titleInput = document.getElementById('edit-trip-title');
  const catInput = document.getElementById('edit-trip-category');
  const dateInput = document.getElementById('edit-trip-date');
  const distInput = document.getElementById('edit-trip-distance');
  const whInput = document.getElementById('edit-trip-wh');
  const durInput = document.getElementById('edit-trip-duration');

  if (idInput) idInput.value = trip.id;
  if (titleInput) titleInput.value = trip.title;
  if (catInput) catInput.value = trip.category || 'trabajo';
  if (dateInput) dateInput.value = trip.date;
  if (distInput) distInput.value = trip.distance;
  if (whInput) whInput.value = trip.avgWh;
  if (durInput) durInput.value = trip.duration;

  if (modal) modal.hidden = false;
}

export function closeEditTripModal() {
  const modal = document.getElementById('modal-edit-trip');
  if (modal) modal.hidden = true;
}

export function deleteTrip(id) {
  const trip = STATE.trips.find(t => t.id === id);
  if (!trip) return;
  const confirmed = window.confirm(`¿Estás seguro de que deseas eliminar el trayecto "${trip.title}" (${trip.distance.toFixed(1)} km)? Esta acción no se puede deshacer.`);
  if (!confirmed) return;

  STATE.trips = STATE.trips.filter(t => t.id !== id);
  localStorage.setItem('biguaydi-trips', JSON.stringify(STATE.trips));
  renderTrips();
  showToast('🗑️ Trayecto eliminado');
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

        const autoSyncSetup = document.getElementById('vault-setup-auto-sync')?.checked;
        if (autoSyncSetup !== undefined) {
          localStorage.setItem('biguaydi_auto_sync', autoSyncSetup ? 'true' : 'false');
        }

        showToast('Credenciales cifradas con éxito');
        updateVaultState();
        if (localStorage.getItem('biguaydi_auto_sync') !== 'false') {
          syncVehicleTelemetry(false);
        }
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
        if (localStorage.getItem('biguaydi_auto_sync') !== 'false') {
          syncVehicleTelemetry(false);
        }
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
        updateTopSyncBadge('idle', 'DESCONECTADO');
        showToast('Datos locales borrados por completo');
      }
    });
  }

  // Auto-sync setting checkbox
  const autoSyncBootEl = document.getElementById('cfg-auto-sync-boot');
  if (autoSyncBootEl) {
    autoSyncBootEl.checked = localStorage.getItem('biguaydi_auto_sync') !== 'false';
    autoSyncBootEl.addEventListener('change', (e) => {
      localStorage.setItem('biguaydi_auto_sync', e.target.checked ? 'true' : 'false');
      showToast(e.target.checked ? '✓ Conexión automática activada al abrir' : 'Conexión automática desactivada');
    });
  }

  // Live Sync trigger button
  const syncBtn = document.getElementById('vault-sync-now-btn');
  if (syncBtn) {
    syncBtn.addEventListener('click', () => {
      syncVehicleTelemetry(false);
    });
  }

  updateVaultState();
}

// --- TOP BAR SYNC STATUS BADGE ---
export function updateTopSyncBadge(status, customText) {
  const badge = document.getElementById('top-sync-badge');
  const textEl = document.getElementById('top-sync-text');
  if (!badge) return;

  badge.classList.remove('syncing', 'connected', 'error');

  if (status === 'syncing') {
    badge.classList.add('syncing');
    if (textEl) textEl.textContent = customText || 'CONECTANDO...';
  } else if (status === 'connected') {
    badge.classList.add('connected');
    if (textEl) textEl.textContent = customText || 'CONECTADO';
  } else if (status === 'error') {
    badge.classList.add('error');
    if (textEl) textEl.textContent = customText || 'RECONECTAR';
  } else {
    if (textEl) textEl.textContent = customText || 'DATOS ACTIVOS';
  }
}

// --- TELEMETRY SYNC ENGINE ---
export async function syncVehicleTelemetry(isAutoBoot = false) {
  const syncBtn = document.getElementById('vault-sync-now-btn');

  if (!window.__vaultDecrypted) {
    if (!isAutoBoot) {
      showToast('Desbloquea primero la bóveda con tu PIN');
    }
    updateTopSyncBadge('idle', 'DESCONECTADO');
    return false;
  }

  let backendUrl = (localStorage.getItem('biguaydi_backend_url') || '').trim();
  if (!backendUrl) {
    backendUrl = 'https://biguaydi-api.onrender.com';
  }
  backendUrl = backendUrl.replace(/\/+$/, '');

  if (syncBtn) {
    syncBtn.disabled = true;
    syncBtn.textContent = '⏳ Conectando con BYD Cloud...';
  }
  updateTopSyncBadge('syncing', 'CONECTANDO...');

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
    if (rt.gear !== undefined) STATE.vehicle.gear = String(rt.gear);
    else STATE.vehicle.gear = STATE.vehicle.speed > 0 ? 'D' : 'P';
    if (rt.power !== undefined) STATE.vehicle.power = Number(rt.power);
    else if (rt.power_kw !== undefined) STATE.vehicle.power = Number(rt.power_kw);
    if (rt.charging !== undefined) STATE.vehicle.charging = Boolean(rt.charging);
    if (rt.voltage_hv !== undefined) STATE.vehicle.voltageHV = Number(rt.voltage_hv);
    if (rt.voltage_12v !== undefined) STATE.vehicle.voltage12v = Number(rt.voltage_12v);
    if (rt.temp_cabin !== undefined) STATE.vehicle.tempCabin = Number(rt.temp_cabin);
    if (rt.temp_ext !== undefined) STATE.vehicle.tempExt = Number(rt.temp_ext);

    STATE.vehicle.driveStatus = STATE.vehicle.charging
      ? '⚡ Cargando Batería'
      : (STATE.vehicle.speed > 0
        ? `En Marcha (${STATE.vehicle.speed} km/h · Marcha ${STATE.vehicle.gear})`
        : `Estacionado (${STATE.vehicle.gear})`);

    if (rt.drive_mode) STATE.vehicle.driveMode = rt.drive_mode;

    if (eg.nearest_energy_consumption?.avg_ev_consumption) {
      STATE.vehicle.avgConsumption50km = Number(eg.nearest_energy_consumption.avg_ev_consumption);
    }

    localStorage.setItem('biguaydi-vehicle', JSON.stringify(STATE.vehicle));

    // Check if odometer has advanced to automatically record completed trip
    const prevOdo = Number(localStorage.getItem('biguaydi-recorder-odo')) || STATE.vehicle.odometer;
    if (rt.total_mileage && Number(rt.total_mileage) > prevOdo) {
      const delta = Number((Number(rt.total_mileage) - prevOdo).toFixed(1));
      if (delta >= 0.3) {
        const avgWh = Math.round((STATE.vehicle.avgConsumption50km || 13.8) * 10);
        const autoTrip = {
          id: Date.now(),
          title: `Ruta Detectada (${delta} km)`,
          category: 'trabajo',
          date: 'Hoy, ' + new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
          distance: delta,
          energy: Number(((delta * avgWh) / 1000).toFixed(2)),
          avgWh: avgWh,
          duration: Math.max(3, Math.round(delta * 1.6)) + ' min',
          isNew: true
        };
        STATE.trips.unshift(autoTrip);
        localStorage.setItem('biguaydi-trips', JSON.stringify(STATE.trips));
        renderTrips();
        showToast(`🚗 ¡Trayecto completado detectado: ${delta} km guardados!`);
      }
    }
    if (rt.total_mileage) {
      localStorage.setItem('biguaydi-recorder-odo', rt.total_mileage);
    }

    renderVehicleHUD();
    updateCalculations();
    updateTopSyncBadge('connected', 'CONECTADO');
    lastTelemetrySyncTime = Date.now();
    showToast(isAutoBoot ? '⚡ Coche conectado automáticamente al abrir la app' : '✓ Telemetría de BYD actualizada en vivo');
    return true;
  } catch (err) {
    updateTopSyncBadge('error', 'RECONECTAR');
    if (!isAutoBoot) {
      showToast(`Fallo de conexión: ${err.message}`);
    } else {
      console.warn('Auto-boot sync notice:', err.message);
      showToast(`Aviso al abrir: No se pudo conectar (${err.message})`);
    }
    return false;
  } finally {
    if (syncBtn) {
      syncBtn.disabled = false;
      syncBtn.textContent = '🔄 Sincronizar coche ahora';
    }
  }
}

// --- INIT APP ---
export function initApp() {
  initNavigation();
  setTheme(STATE.theme);
  setFontSize(STATE.fontSize);
  renderVehicleHUD();
  updateCalculations();
  renderTrips();
  initAutoTripRecorder();
  initSecurityVault();

  // Top sync badge click listener (quick sync from anywhere)
  const topSyncBadge = document.getElementById('top-sync-badge');
  if (topSyncBadge) {
    topSyncBadge.addEventListener('click', (e) => {
      e.preventDefault();
      syncVehicleTelemetry(false);
    });
  }

  // Automatic connection on app startup if session is saved
  const autoSyncOnBoot = localStorage.getItem('biguaydi_auto_sync') !== 'false';
  if (autoSyncOnBoot && window.__vaultDecrypted) {
    setTimeout(() => {
      syncVehicleTelemetry(true);
    }, 350);
  } else if (window.__vaultDecrypted) {
    updateTopSyncBadge('connected', 'BÓVEDA LISTA');
  }

  // Theme choices (strictly scoped to theme picker buttons with data-theme)
  document.querySelectorAll('.theme-picker-row [data-theme]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (btn.dataset.theme) {
        setTheme(btn.dataset.theme);
      }
    });
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
        const todayStr = new Date().toLocaleDateString('es-ES');
        STATE.prices.date = todayStr;
        localStorage.setItem('biguaydi-prices-date', todayStr);
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

  // Daily market prices fetcher manual button
  const fetchMarketBtn = document.getElementById('btn-fetch-market-prices');
  if (fetchMarketBtn) {
    fetchMarketBtn.addEventListener('click', () => {
      refreshMarketPrices(false);
    });
  }

  // Auto-refresh daily electricity & fuel prices on startup if not updated today
  const todayStr = new Date().toLocaleDateString('es-ES');
  if (STATE.prices.date !== todayStr) {
    setTimeout(() => {
      refreshMarketPrices(true);
    }, 600);
  }

  const backendInput = document.getElementById('cfg-backend-url');
  if (backendInput) {
    backendInput.value = localStorage.getItem('biguaydi_backend_url') || '';
    backendInput.addEventListener('input', (e) => {
      localStorage.setItem('biguaydi_backend_url', e.target.value.trim());
    });
  }

  // Initialize Aggressive Service Worker Auto-Update
  initServiceWorkerAutoUpdate();
}

// --- DAILY MARKET PRICES FETCHER (REE & MITECO) ---
export async function refreshMarketPrices(silent = false) {
  const fetchMarketBtn = document.getElementById('btn-fetch-market-prices');
  let backendUrl = (localStorage.getItem('biguaydi_backend_url') || '').trim();
  if (!backendUrl) {
    backendUrl = 'https://biguaydi-api.onrender.com';
  }
  backendUrl = backendUrl.replace(/\/+$/, '');

  if (fetchMarketBtn) {
    fetchMarketBtn.disabled = true;
    fetchMarketBtn.textContent = '⏳ Consultando REE y MITECO...';
  }

  try {
    const resp = await fetch(`${backendUrl}/api/prices`);
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.detail || 'Error consultando precios');

    let dateStr = new Date().toLocaleDateString('es-ES');
    if (data.date) {
      const parts = data.date.split('-');
      if (parts.length === 3) {
        dateStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }
    STATE.prices.date = dateStr;
    localStorage.setItem('biguaydi-prices-date', dateStr);

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
    if (!silent) {
      showToast(`✓ Precios oficiales actualizados (${dateStr}): Luz ${data.kwhGrid}€/kWh · Gasolina ${data.gas95}€/L · Diésel ${data.diesel}€/L`);
    }
  } catch (err) {
    if (!silent) {
      showToast(`No se pudieron obtener precios: ${err.message}`);
    }
  } finally {
    if (fetchMarketBtn) {
      fetchMarketBtn.disabled = false;
      fetchMarketBtn.textContent = '📡 Obtener medias hoy (REE / MITECO)';
    }
  }
}

// --- PWA SERVICE WORKER AUTO-UPDATE ENGINE ---
let lastTelemetrySyncTime = 0;

function initServiceWorkerAutoUpdate() {
  if (!('serviceWorker' in navigator)) return;

  let isRefreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!isRefreshing) {
      isRefreshing = true;
      window.location.reload();
    }
  });

  navigator.serviceWorker.register('./sw.js').then((reg) => {
    // 1. Force check for updates every time app opens
    reg.update().catch(() => {});

    // 2. If a new service worker is already waiting, activate immediately
    if (reg.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    // 3. When an update is detected, activate as soon as installed
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      }
    });
  }).catch(() => {});

  // 4. Also check for update whenever the user returns to the app / unlocks phone
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) reg.update().catch(() => {});
      }).catch(() => {});

      // Refresh vehicle telemetry if more than 5 minutes have passed
      const autoSyncEnabled = localStorage.getItem('biguaydi_auto_sync') !== 'false';
      if (autoSyncEnabled && window.__vaultDecrypted && (Date.now() - lastTelemetrySyncTime > 5 * 60 * 1000)) {
        syncVehicleTelemetry(true);
      }
    }
  });
}

// Auto start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
