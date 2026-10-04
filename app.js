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
  trips: (function() {
    try {
      const saved = localStorage.getItem('biguaydi-trips');
      return saved ? JSON.parse(saved) : [
        { id: 1, title: 'Trabajo ➔ Casa', date: 'Hoy, 18:20', distance: 22.4, energy: 3.1, avgWh: 138, duration: '28 min' },
        { id: 2, title: 'Casa ➔ Gimnasio', date: 'Hoy, 07:45', distance: 8.5, energy: 1.2, avgWh: 141, duration: '12 min' },
        { id: 3, title: 'Madrid ➔ Toledo', date: 'Ayer', distance: 74.2, energy: 11.2, avgWh: 150, duration: '52 min' },
        { id: 4, title: 'Recados urbanos', date: '02 Oct', distance: 14.8, energy: 1.9, avgWh: 128, duration: '25 min' }
      ];
    } catch (_) {
      return [];
    }
  })(),
  autoRecorder: {
    lastOdometer: Number(localStorage.getItem('biguaydi-recorder-odo')) || 14280,
    status: 'Activo'
  }
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

  setEl('tel-speed', `${v.speed} km/h`);
  setEl('tel-power', `${v.power > 0 ? '+' : ''}${v.power.toFixed(1)} kW`);
  setEl('tel-gear', v.gear);
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

  // 2. Render List of Trip Cards
  if (STATE.trips.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:36px 20px; color:var(--text-muted); background:var(--panel-card); border:1px solid var(--panel-border); border-radius:var(--radius-sm);">
        <span style="font-size:32px; display:block; margin-bottom:8px;">🚗</span>
        <b>Sin trayectos registrados todavía</b>
        <p style="font-size:12.5px; margin-top:4px;">Pulsa en "Simular y Probar Trayecto" o sincroniza con tu coche para registrar automáticamente.</p>
      </div>
    `;
  } else {
    container.innerHTML = STATE.trips.map(trip => {
      const tripCostEv = trip.energy * costPerKwh;
      const tripCostGas = (trip.distance / 100) * iceCons * gasPrice;
      const tripCostDiesel = (trip.distance / 100) * dieselCons * dieselPrice;
      const tripSavingsGas = Math.max(0, tripCostGas - tripCostEv);
      const tripSavingsDiesel = Math.max(0, tripCostDiesel - tripCostEv);

      return `
        <article class="trip-card ${trip.isNew ? 'new-arrival' : ''}" id="trip-card-${trip.id}">
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
            <div class="trip-ice-comp" style="font-size:11.5px; line-height:1.4;">
              <div>Gas: <del>${tripCostGas.toFixed(2)}€</del> <b class="badge-saving badge-gas">-${tripSavingsGas.toFixed(2)}€</b></div>
              <div>Diésel: <del>${tripCostDiesel.toFixed(2)}€</del> <b class="badge-saving badge-diesel">-${tripSavingsDiesel.toFixed(2)}€</b></div>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  // 3. Render the Impactful SVG Chart
  renderTripsChart();
}

function renderTripsChart() {
  const chartBox = document.getElementById('trips-chart-container');
  if (!chartBox) return;

  const trips = STATE.trips.slice(0, 6).reverse();
  if (trips.length === 0) {
    chartBox.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-dim); font-size:12px;">Sin datos suficientes para graficar</div>';
    return;
  }

  const costPerKwh = getEffectiveElectricityPrice();
  const gasPrice = STATE.prices.gas95;
  const dieselPrice = STATE.prices.diesel;
  const iceCons = STATE.prices.iceConsumption;
  const dieselCons = STATE.prices.dieselConsumption;

  const data = trips.map(t => {
    const costEv = t.energy * costPerKwh;
    const costGas = (t.distance / 100) * iceCons * gasPrice;
    const costDiesel = (t.distance / 100) * dieselCons * dieselPrice;
    return {
      title: t.title.split(' ')[0] || `V${t.id}`,
      dist: t.distance.toFixed(1) + 'km',
      wh: t.avgWh,
      costEv,
      costGas,
      costDiesel
    };
  });

  const maxCost = Math.max(...data.map(d => Math.max(d.costEv, d.costGas, d.costDiesel)), 1.5);
  const minWh = Math.min(...data.map(d => d.wh), 100);
  const maxWh = Math.max(...data.map(d => d.wh), 200);

  const W = Math.max(500, data.length * 96);
  const H = 210;
  const padL = 40;
  const padR = 25;
  const padT = 30;
  const padB = 40;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const slotW = plotW / data.length;
  const barW = Math.min(18, (slotW - 20) / 3);
  const linePoints = [];

  let barsSvg = '';
  data.forEach((d, i) => {
    const cx = padL + i * slotW + slotW / 2;
    const xEv = cx - barW * 1.5;
    const xGas = cx - barW * 0.5;
    const xDiesel = cx + barW * 0.5;

    const hEv = Math.max(8, (d.costEv / maxCost) * plotH);
    const hGas = Math.max(8, (d.costGas / maxCost) * plotH);
    const hDiesel = Math.max(8, (d.costDiesel / maxCost) * plotH);

    const yEv = padT + (plotH - hEv);
    const yGas = padT + (plotH - hGas);
    const yDiesel = padT + (plotH - hDiesel);

    const whNorm = (d.wh - minWh) / Math.max(1, maxWh - minWh);
    const yWh = padT + (plotH - (whNorm * (plotH * 0.6) + (plotH * 0.2)));
    linePoints.push({ x: cx, y: yWh, val: d.wh });

    barsSvg += `
      <g class="chart-trip-group">
        <!-- EV Bar -->
        <rect x="${xEv}" y="${yEv}" width="${barW - 2}" height="${hEv}" rx="3" fill="url(#tripEvGrad)" />
        <rect x="${xEv}" y="${yEv}" width="${barW - 2}" height="2" rx="1" fill="#fff" filter="url(#glowHead)" />
        <text x="${xEv + (barW - 2)/2}" y="${yEv - 5}" font-size="9" fill="var(--accent)" text-anchor="middle" font-family="var(--mono)">${d.costEv.toFixed(2)}€</text>

        <!-- Gas Bar -->
        <rect x="${xGas}" y="${yGas}" width="${barW - 2}" height="${hGas}" rx="3" fill="url(#tripGasGrad)" />
        <rect x="${xGas}" y="${yGas}" width="${barW - 2}" height="2" rx="1" fill="#fff" filter="url(#glowGas)" />
        <text x="${xGas + (barW - 2)/2}" y="${yGas - 5}" font-size="9" fill="#ff8c73" text-anchor="middle" font-family="var(--mono)">${d.costGas.toFixed(1)}€</text>

        <!-- Diesel Bar -->
        <rect x="${xDiesel}" y="${yDiesel}" width="${barW - 2}" height="${hDiesel}" rx="3" fill="url(#tripDieGrad)" />
        <rect x="${xDiesel}" y="${yDiesel}" width="${barW - 2}" height="2" rx="1" fill="#fff" filter="url(#glowDie)" />
        <text x="${xDiesel + (barW - 2)/2}" y="${yDiesel - 5}" font-size="9" fill="#f5cc7f" text-anchor="middle" font-family="var(--mono)">${d.costDiesel.toFixed(1)}€</text>

        <!-- Labels -->
        <text x="${cx}" y="${H - 18}" font-size="11" font-weight="600" fill="var(--text)" text-anchor="middle" font-family="var(--sans)">${d.title}</text>
        <text x="${cx}" y="${H - 5}" font-size="9.5" fill="var(--text-muted)" text-anchor="middle" font-family="var(--mono)">${d.dist}</text>
      </g>
    `;
  });

  const pointsStr = linePoints.map(p => `${p.x},${p.y}`).join(' ');
  const dotsSvg = linePoints.map(p => `
    <circle cx="${p.x}" cy="${p.y}" r="4" fill="#4ce0d2" stroke="#060c0a" stroke-width="2" filter="url(#glowCyan)" />
    <text x="${p.x}" y="${p.y - 8}" font-size="9" fill="#4ce0d2" text-anchor="middle" font-weight="700" font-family="var(--mono)">${p.val}</text>
  `).join('');

  chartBox.innerHTML = `
    <svg class="trips-svg-canvas" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="tripEvGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="var(--accent)" />
          <stop offset="100%" stop-color="#0b3823" />
        </linearGradient>
        <linearGradient id="tripGasGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#ff8c73" />
          <stop offset="100%" stop-color="#4d170c" />
        </linearGradient>
        <linearGradient id="tripDieGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#f5cc7f" />
          <stop offset="100%" stop-color="#47310a" />
        </linearGradient>
        <filter id="glowHead" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
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

      <line x1="${padL}" y1="${padT + plotH * 0.25}" x2="${W - padR}" y2="${padT + plotH * 0.25}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3 3" />
      <line x1="${padL}" y1="${padT + plotH * 0.5}" x2="${W - padR}" y2="${padT + plotH * 0.5}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3 3" />
      <line x1="${padL}" y1="${padT + plotH * 0.75}" x2="${W - padR}" y2="${padT + plotH * 0.75}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3 3" />
      <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="rgba(255,255,255,0.15)" />

      ${barsSvg}

      <polyline fill="none" stroke="#4ce0d2" stroke-width="2.5" stroke-dasharray="4 3" points="${pointsStr}" opacity="0.85" />
      ${dotsSvg}
    </svg>
  `;
}

// --- AUTO TRIP RECORDER ENGINE & SIMULATOR ---
function initAutoTripRecorder() {
  const btnSim = document.getElementById('btn-simulate-trip');
  const btnReset = document.getElementById('btn-reset-trips');

  if (btnSim) {
    btnSim.addEventListener('click', () => {
      const routes = [
        { title: 'Trabajo ➔ Ciudad', dist: 18.6, wh: 132 },
        { title: 'Autovía / Ronda', dist: 29.4, wh: 148 },
        { title: 'Centro Comercial', dist: 11.2, wh: 126 },
        { title: 'Escapada Sierra', dist: 54.0, wh: 156 },
        { title: 'Ruta M-40 / Aeropuerto', dist: 24.8, wh: 139 }
      ];
      const sample = routes[Math.floor(Math.random() * routes.length)];
      const deltaOdo = sample.dist;

      STATE.vehicle.odometer = Number((STATE.vehicle.odometer + deltaOdo).toFixed(1));

      const newTrip = {
        id: Date.now(),
        title: sample.title,
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
      renderVehicleHUD();
      showToast(`⚡ ¡Nuevo trayecto de ${sample.dist} km registrado automáticamente!`);

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
      if (confirm('¿Restablecer el historial de trayectos a los valores iniciales?')) {
        STATE.trips = [
          { id: 1, title: 'Trabajo ➔ Casa', date: 'Hoy, 18:20', distance: 22.4, energy: 3.1, avgWh: 138, duration: '28 min' },
          { id: 2, title: 'Casa ➔ Gimnasio', date: 'Hoy, 07:45', distance: 8.5, energy: 1.2, avgWh: 141, duration: '12 min' },
          { id: 3, title: 'Madrid ➔ Toledo', date: 'Ayer', distance: 74.2, energy: 11.2, avgWh: 150, duration: '52 min' },
          { id: 4, title: 'Recados urbanos', date: '02 Oct', distance: 14.8, energy: 1.9, avgWh: 128, duration: '25 min' }
        ];
        localStorage.setItem('biguaydi-trips', JSON.stringify(STATE.trips));
        renderTrips();
        showToast('Historial de trayectos restablecido');
      }
    });
  }
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

        // Check if odometer has advanced to automatically record completed trip
        const prevOdo = Number(localStorage.getItem('biguaydi-recorder-odo')) || STATE.vehicle.odometer;
        if (rt.total_mileage && Number(rt.total_mileage) > prevOdo) {
          const delta = Number((Number(rt.total_mileage) - prevOdo).toFixed(1));
          if (delta >= 0.3) {
            const avgWh = Math.round((STATE.vehicle.avgConsumption50km || 13.8) * 10);
            const autoTrip = {
              id: Date.now(),
              title: `Ruta Detectada (${delta} km)`,
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
  initAutoTripRecorder();
  initSecurityVault();

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
        showToast(`✓ Precios oficiales actualizados (${dateStr}): Luz ${data.kwhGrid}€/kWh · Gasolina ${data.gas95}€/L · Diésel ${data.diesel}€/L`);
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
