/* Bi-guay-Di v2.0 - Core High-Tech Architecture */
import { SecureVault } from './crypto-vault.js';

// Format real calendar date as "DD/MM/YYYY, HH:mm"
export function formatRealTripDate(dateObj) {
  const d = (dateObj instanceof Date && !isNaN(dateObj.getTime())) ? dateObj : new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year}, ${hours}:${minutes}`;
}

// Parse date string into epoch timestamp milliseconds
export function parseDateStringToTimestamp(str) {
  if (!str || typeof str !== 'string') return 0;
  const raw = str.trim();

  // Match DD/MM/YYYY, HH:mm or DD/MM/YYYY HH:mm
  const dmyMatch = raw.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})(?:[,\s]+(\d{1,2}):(\d{2}))?/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const hours = dmyMatch[4] !== undefined ? parseInt(dmyMatch[4], 10) : 12;
    const minutes = dmyMatch[5] !== undefined ? parseInt(dmyMatch[5], 10) : 0;
    const parsedDate = new Date(year, month, day, hours, minutes, 0, 0);
    if (!isNaN(parsedDate.getTime())) return parsedDate.getTime();
  }

  // Match ISO YYYY-MM-DD or datetime-local YYYY-MM-DDTHH:mm
  const isoMatch = raw.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2}))?/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    const hours = isoMatch[4] !== undefined ? parseInt(isoMatch[4], 10) : 12;
    const minutes = isoMatch[5] !== undefined ? parseInt(isoMatch[5], 10) : 0;
    const parsedDate = new Date(year, month, day, hours, minutes, 0, 0);
    if (!isNaN(parsedDate.getTime())) return parsedDate.getTime();
  }

  const standardParse = Date.parse(raw);
  if (!isNaN(standardParse)) return standardParse;

  return 0;
}

// --- DATA STRUCTURE & STATE ---
const STATE = {
  theme: localStorage.getItem('biguaydi-theme') || 'original',
  fontSize: Number(localStorage.getItem('biguaydi-size')) || 3,
  view: 'dashboard',
  energySource: localStorage.getItem('biguaydi-energy-source') || 'solar', // grid, solar, mixed
  solarSeason: localStorage.getItem('biguaydi-solar-season') || 'auto', // spring, summer, autumn, winter, auto
  solarLocation: (function() {
    try {
      const saved = localStorage.getItem('biguaydi-solar-location');
      return saved ? JSON.parse(saved) : { lat: 40.4168, lon: -3.7038, name: 'Madrid (Ref)' };
    } catch (_) {
      return { lat: 40.4168, lon: -3.7038, name: 'Madrid (Ref)' };
    }
  })(),
  prices: {
    kwhGrid: Number(localStorage.getItem('biguaydi-kwh-grid')) || 0.15,
    kwhSolar: Number(localStorage.getItem('biguaydi-kwh-solar')) || 0.00,
    solarPct: Number(localStorage.getItem('biguaydi-solar-pct')) || 80, // % of solar in mixed mode
    solarSeasonalPct: (function() {
      try {
        const saved = localStorage.getItem('biguaydi-seasonal-pcts');
        return saved ? JSON.parse(saved) : { spring: 75, summer: 90, autumn: 65, winter: 40 };
      } catch (_) {
        return { spring: 75, summer: 90, autumn: 65, winter: 40 };
      }
    })(),
    gas95: Number(localStorage.getItem('biguaydi-gas95')) || 1.62,
    diesel: Number(localStorage.getItem('biguaydi-diesel')) || 1.54,
    iceConsumption: Number(localStorage.getItem('biguaydi-ice-cons')) || 6.2, // l/100km Gasoline
    dieselConsumption: Number(localStorage.getItem('biguaydi-diesel-cons')) || 5.2, // l/100km Diesel
    fuelType: localStorage.getItem('biguaydi-fuel-type') || 'gas95', // gas95 or diesel
    date: localStorage.getItem('biguaydi-prices-date') || new Date().toLocaleDateString('es-ES')
  },
  selectedTripCategory: 'all',
  selectedTripPeriod: localStorage.getItem('biguaydi-trip-period') || 'all',
  customDateFrom: localStorage.getItem('biguaydi-trip-date-from') || '',
  customDateTo: localStorage.getItem('biguaydi-trip-date-to') || '',
  tripSort: localStorage.getItem('biguaydi-trip-sort') || 'recent',
  chartGroupMode: localStorage.getItem('biguaydi-chart-group') || 'auto', // auto, trip, day, week, month, year
  chartExpanded: localStorage.getItem('biguaydi-chart-expanded') === 'true',
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
      let list = [];
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) list = parsed;
      }

      let mutated = false;
      const now = new Date();
      const migrated = list.map((t, idx) => {
        const copy = { category: 'trabajo', ...t };
        // Deduce timestamp if missing
        if (!copy.timestamp || isNaN(Number(copy.timestamp))) {
          if (typeof copy.id === 'number' && copy.id > 1600000000000) {
            copy.timestamp = copy.id;
          } else {
            // Heuristic based on index or existing date string
            copy.timestamp = now.getTime() - (idx * 3600000 * 4);
          }
          mutated = true;
        } else {
          copy.timestamp = Number(copy.timestamp);
        }

        // Convert relative "Hoy" / "Ayer" or missing date to real formatted calendar date
        const dStr = (typeof copy.date === 'string') ? copy.date.trim() : '';
        const dLower = dStr.toLowerCase();
        if (!dStr || dLower.includes('hoy') || dLower.includes('ayer')) {
          const tripDateObj = new Date(copy.timestamp);
          copy.date = formatRealTripDate(tripDateObj);
          mutated = true;
        }

        return copy;
      });

      if (mutated && migrated.length > 0) {
        try {
          localStorage.setItem('biguaydi-trips', JSON.stringify(migrated));
        } catch (_) {}
      }

      return migrated;
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

// --- SOLAR ASTRONOMICAL ENGINE & DAYLIGHT CALCULATION ---
export function calculateDaylightHours(date, lat = 40.4168) {
  const d = date instanceof Date ? date : new Date(date || Date.now());
  const startOfYear = new Date(d.getFullYear(), 0, 0);
  const diff = d - startOfYear;
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));

  // Solar declination formula (Cooper, 1969)
  const declination = 23.45 * Math.sin(((360 / 365) * (dayOfYear - 81)) * (Math.PI / 180));
  const latRad = lat * (Math.PI / 180);
  const decRad = declination * (Math.PI / 180);

  // Hour angle at sunrise/sunset
  const cosHourAngle = -Math.tan(latRad) * Math.tan(decRad);
  const clampedCos = Math.max(-1, Math.min(1, cosHourAngle));
  const hourAngle = Math.acos(clampedCos) * (180 / Math.PI);
  const daylightHours = (2 * hourAngle) / 15;

  return Number(daylightHours.toFixed(1));
}

export function getSeasonFromDate(date) {
  const d = date instanceof Date ? date : new Date(date || Date.now());
  const month = d.getMonth() + 1; // 1-12
  const day = d.getDate();

  // Astronomical season thresholds (Northern Hemisphere)
  if ((month === 3 && day >= 20) || month === 4 || month === 5 || (month === 6 && day < 21)) {
    return 'spring';
  } else if ((month === 6 && day >= 21) || month === 7 || month === 8 || (month === 9 && day < 23)) {
    return 'summer';
  } else if ((month === 9 && day >= 23) || month === 10 || month === 11 || (month === 12 && day < 21)) {
    return 'autumn';
  } else {
    return 'winter';
  }
}

export function getActiveSeason() {
  if (STATE.solarSeason && STATE.solarSeason !== 'auto') {
    return STATE.solarSeason;
  }
  return getSeasonFromDate(new Date());
}

export function getSeasonalSolarPct(season) {
  const s = season || getActiveSeason();
  const pcts = STATE.prices.solarSeasonalPct || { spring: 75, summer: 90, autumn: 65, winter: 40 };
  return Number(pcts[s]) || 80;
}

// --- CALCULATIONS: ELECTRICITY VS PETROL ---
export function getEffectiveElectricityPrice(forTrip = null) {
  if (STATE.energySource === 'solar') return STATE.prices.kwhSolar;
  if (STATE.energySource === 'grid') return STATE.prices.kwhGrid;

  // Mixed mode: calculate solar share based on trip date or current season
  let solarSharePct = STATE.prices.solarPct;
  if (forTrip) {
    const tripTimestamp = typeof forTrip === 'object' ? getTripTimestamp(forTrip) : Number(forTrip);
    if (tripTimestamp > 0) {
      const tripSeason = getSeasonFromDate(new Date(tripTimestamp));
      solarSharePct = getSeasonalSolarPct(tripSeason);
    }
  } else {
    // Current live configuration
    solarSharePct = (STATE.solarSeason === 'auto')
      ? getSeasonalSolarPct(getActiveSeason())
      : STATE.prices.solarPct;
  }

  const solarShare = Math.max(0, Math.min(100, solarSharePct)) / 100;
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

  // Real trips in current month (NO fictitious data)
  const monthTrips = (STATE.trips || []).filter(t => isTripInPeriod(t, 'month'));
  const monthKm = monthTrips.reduce((acc, t) => acc + (Number(t.distance) || 0), 0);
  const monthKwh = monthTrips.reduce((acc, t) => acc + (Number(t.energy) || 0), 0);

  let monthlyEvCost = 0;
  let monthlyGasCost = 0;
  let monthlyDieselCost = 0;
  let monthlySavingsGas = 0;
  let monthlySavingsDiesel = 0;

  if (monthKm > 0) {
    monthlyEvCost = monthKwh > 0 ? (monthKwh * costPerKwh) : ((monthKm / 100) * costEv100);
    monthlyGasCost = (monthKm / 100) * costGas100;
    monthlyDieselCost = (monthKm / 100) * costDiesel100;
    monthlySavingsGas = Math.max(0, monthlyGasCost - monthlyEvCost);
    monthlySavingsDiesel = Math.max(0, monthlyDieselCost - monthlyEvCost);
  }

  // CO2 Emitted ICE vs EV based on real month km
  const evCo2PerKm = STATE.energySource === 'solar' ? 0 : 38; // g/km
  const iceCo2PerKm = 142; // g/km average
  const co2AvoidedKgMonthly = monthKm > 0 ? (((iceCo2PerKm - evCo2PerKm) * monthKm) / 1000) : 0;
  const treesEquivalent = monthKm > 0 ? Math.max(1, Math.round(co2AvoidedKgMonthly * 12 / 21)) : 0;

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

  if (elMonthlySavings) {
    if (monthKm > 0) {
      elMonthlySavings.textContent = `${monthlySavingsGas.toFixed(2)} €`;
    } else {
      elMonthlySavings.textContent = `0.00 €`;
    }
  }
  if (elSavingsMonthGas) {
    elSavingsMonthGas.textContent = monthKm > 0 ? `${monthlySavingsGas.toFixed(2)} €` : `0.00 €`;
  }
  if (elSavingsMonthDiesel) {
    elSavingsMonthDiesel.textContent = monthKm > 0 ? `${monthlySavingsDiesel.toFixed(2)} €` : `0.00 €`;
  }
  if (elCo2Kg) {
    elCo2Kg.textContent = monthKm > 0 ? `${co2AvoidedKgMonthly.toFixed(1)} kg` : `0 kg`;
  }
  if (elTrees) {
    elTrees.textContent = monthKm > 0 
      ? `Equivalente a ${treesEquivalent} árbol${treesEquivalent > 1 ? 'es' : ''}/año` 
      : 'Sin trayectos este mes';
  }

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

  // Update high-tech Solar Home Scheme visualization
  renderSolarHomeScheme();
}

// --- RENDER HIGH-TECH SOLAR HOME SCHEME ---
export function renderSolarHomeScheme() {
  const isAuto = (STATE.solarSeason === 'auto');
  const effectiveSeason = isAuto
    ? getSeasonFromDate(new Date())
    : (STATE.solarSeason || 'summer');

  const loc = STATE.solarLocation || { lat: 40.4168, lon: -3.7038, name: 'Madrid' };

  // Representative dates for each season to reflect daylight variation across seasons:
  // Summer solstice (~June 21), Spring equinox (~March 21), Autumn equinox (~Sept 22), Winter solstice (~Dec 21)
  const currentYear = new Date().getFullYear();
  const seasonDates = {
    spring: new Date(currentYear, 2, 21), // 21 March
    summer: new Date(currentYear, 5, 21), // 21 June
    autumn: new Date(currentYear, 8, 22), // 22 September
    winter: new Date(currentYear, 11, 21) // 21 December
  };

  const evalDate = isAuto ? new Date() : (seasonDates[effectiveSeason] || new Date());
  const daylightHours = calculateDaylightHours(evalDate, loc.lat);
  const seasonalPct = getSeasonalSolarPct(effectiveSeason);

  // Update text badges
  const seasonLabels = {
    spring: 'PRIMAVERA',
    summer: 'VERANO',
    autumn: 'OTOÑO',
    winter: 'INVIERNO'
  };

  const badgeEl = document.getElementById('solar-season-badge');
  if (badgeEl) {
    badgeEl.textContent = `${seasonLabels[effectiveSeason] || 'ACTUAL'} · ${daylightHours}h sol/día (${loc.name || 'GPS'})`;
  }

  const estPctEl = document.getElementById('solar-est-pct-display');
  if (estPctEl) {
    estPctEl.textContent = `${seasonalPct}% Solar`;
  }

  const svgHours = document.getElementById('svg-solar-hours-text');
  if (svgHours) {
    svgHours.textContent = `${daylightHours}h Sol / Día`;
  }

  const svgPower = document.getElementById('svg-solar-power-text');
  if (svgPower) {
    // Estimated seasonal peak kWp based on solar irradiance
    const seasonKwP = { spring: '4.2 kWp', summer: '5.4 kWp', autumn: '3.6 kWp', winter: '2.4 kWp' };
    svgPower.textContent = seasonKwP[effectiveSeason] || '4.5 kWp';
  }

  // Update SVG Celestial & Nature Visuals according to season
  const sunElem = document.getElementById('solar-sun-elem');
  const sunHalo = document.getElementById('sun-halo');
  const skyStop0 = document.getElementById('sky-stop-0');
  const skyStop1 = document.getElementById('sky-stop-1');
  const tree1 = document.getElementById('tree-canopy-1');
  const tree2 = document.getElementById('tree-canopy-2');
  const tree3 = document.getElementById('tree-canopy-3');
  const extrasGroup = document.getElementById('season-extras');

  // Season specific palettes and sun orbital positions
  const seasonThemes = {
    summer: {
      sunPos: 'translate(370, 45)',
      haloR: '30',
      haloColor: 'rgba(255, 215, 0, 0.28)',
      sky0: '#0b1d22',
      sky1: '#040d0f',
      treeColor1: '#1ea66a',
      treeColor2: '#3ddc8c',
      treeColor3: '#158352',
      extras: '<circle cx="18" cy="46" r="3" fill="#ff7597"/><circle cx="28" cy="50" r="3" fill="#ffd700"/><circle cx="48" cy="48" r="3" fill="#6db6ff"/>'
    },
    spring: {
      sunPos: 'translate(350, 58)',
      haloR: '25',
      haloColor: 'rgba(255, 220, 100, 0.22)',
      sky0: '#0c1b1c',
      sky1: '#050e0f',
      treeColor1: '#2ec978',
      treeColor2: '#57f29f',
      treeColor3: '#229e5c',
      extras: '<circle cx="20" cy="48" r="3.5" fill="#ff75b5"/><circle cx="34" cy="52" r="3.5" fill="#ffffff"/><circle cx="44" cy="49" r="3" fill="#ffd700"/>'
    },
    autumn: {
      sunPos: 'translate(330, 72)',
      haloR: '22',
      haloColor: 'rgba(255, 140, 50, 0.22)',
      sky0: '#1a1412',
      sky1: '#0c0808',
      treeColor1: '#d97724',
      treeColor2: '#f59e0b',
      treeColor3: '#b45309',
      extras: '<path d="M 12 55 Q 16 52 20 56" stroke="#d97724" stroke-width="1.5" fill="none"/><path d="M 46 54 Q 50 51 54 55" stroke="#f59e0b" stroke-width="1.5" fill="none"/>'
    },
    winter: {
      sunPos: 'translate(310, 85)',
      haloR: '18',
      haloColor: 'rgba(180, 220, 255, 0.20)',
      sky0: '#0a141e',
      sky1: '#060c12',
      treeColor1: '#3a5f6e',
      treeColor2: '#568498',
      treeColor3: '#254452',
      extras: '<polygon points="12,185 24,182 36,185" fill="#e2f1f8" opacity="0.8"/><polygon points="120,185 135,183 150,185" fill="#e2f1f8" opacity="0.8"/><circle cx="32" cy="18" r="3" fill="#e2f1f8" opacity="0.75"/>'
    }
  };

  const st = seasonThemes[effectiveSeason] || seasonThemes.summer;

  if (sunElem) sunElem.setAttribute('transform', st.sunPos);
  if (sunHalo) {
    sunHalo.setAttribute('r', st.haloR);
    sunHalo.setAttribute('fill', st.haloColor);
  }
  if (skyStop0) skyStop0.setAttribute('stop-color', st.sky0);
  if (skyStop1) skyStop1.setAttribute('stop-color', st.sky1);
  if (tree1) tree1.setAttribute('fill', st.treeColor1);
  if (tree2) tree2.setAttribute('fill', st.treeColor2);
  if (tree3) tree3.setAttribute('fill', st.treeColor3);
  if (extrasGroup) extrasGroup.innerHTML = st.extras;
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

  const isDriving = v.speed > 0 || (v.gear === 'D' && Math.abs(v.power) > 0.5);
  const isCharging = Boolean(v.charging);
  const isRegen = v.power < 0;

  let activityText = 'EN REPOSO';
  if (isCharging) activityText = '⚡ CARGANDO';
  else if (isDriving) activityText = isRegen ? '🌱 REGEN ACTIVA' : '⚡ TRACCIÓN ACTIVA';

  setEl('tel-activity-badge', activityText);
  setEl('tel-drive-status', v.driveStatus || `Estacionado (${v.gear})`);
  setEl('tel-speed', `${v.speed} km/h${v.speed === 0 ? ' · Detenido' : ''}`);

  const powerDisplayStr = `${v.power > 0 ? '+' : ''}${v.power.toFixed(1)} kW`;
  setEl('tel-power-display', powerDisplayStr);
  setEl('tel-power', `${powerDisplayStr} ${isCharging ? '(Carga)' : (v.speed > 0 ? (isRegen ? '(Regeneración)' : '(Tracción)') : '(Auxiliares 12V/BMS)')}`);
  setEl('tel-gear', v.gear);
  setEl('tel-drive-mode', v.driveMode || 'ECO Inteligente');

  // Gear cluster PRND highlighting
  const gearPills = document.querySelectorAll('#tel-gear-cluster .gear-pill');
  gearPills.forEach(p => {
    p.classList.toggle('active', p.dataset.gear === v.gear);
  });

  // Power flux bar calculation (center = 50%)
  const fluxBar = document.getElementById('tel-flux-bar');
  if (fluxBar) {
    if (isCharging) {
      const pct = Math.min(48, Math.max(8, (Math.abs(v.power) / 60) * 48));
      fluxBar.style.left = '50%';
      fluxBar.style.width = `${pct}%`;
      fluxBar.style.background = 'linear-gradient(90deg, #ffd700, #ff8c73)';
    } else if (v.power >= 0) {
      const pct = Math.min(48, (v.power / 60) * 48);
      fluxBar.style.left = '50%';
      fluxBar.style.width = `${Math.max(2, pct)}%`;
      fluxBar.style.background = 'linear-gradient(90deg, #4ce0d2, #6db6ff)';
    } else {
      // Regen
      const pct = Math.min(48, (Math.abs(v.power) / 40) * 48);
      fluxBar.style.left = `${50 - pct}%`;
      fluxBar.style.width = `${pct}%`;
      fluxBar.style.background = 'linear-gradient(90deg, #38ef7d, #11998e)';
    }
  }

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

let currentCo2FactIndex = -1;

export function getRandomCo2Fact(kg) {
  const val = Math.max(0.5, kg);
  const stoveHours = Math.max(1, Math.round(val / 0.5));
  const washCycles = Math.max(1, Math.round(val / 0.65));
  const phonesCharged = Math.max(10, Math.round(val / 0.008));
  const treeDays = Math.max(1, Math.round((val / 21) * 365));
  const tvHours = Math.max(1, Math.round(val / 0.04));
  const flightKm = Math.max(1, Math.round(val / 0.15));

  const facts = [
    `Equivale a una estufa de 2.000W encendida durante ${stoveHours} horas.`,
    `Equivale a evitar el gasto de ${washCycles} lavadoras con agua caliente.`,
    `Equivale a cargar la batería de tu móvil ${phonesCharged.toLocaleString('es-ES')} veces.`,
    `Equivale al CO₂ que absorbe un pino mediterráneo durante ${treeDays} días.`,
    `Equivale a tener una Smart TV encendida durante ${tvHours} horas seguidas.`,
    `Equivale a las emisiones de un pasajero en avión durante ${flightKm} km.`
  ];

  // Rotate to a different fact each time
  currentCo2FactIndex = (currentCo2FactIndex + 1 + Math.floor(Math.random() * (facts.length - 1))) % facts.length;
  return facts[currentCo2FactIndex];
}

export function getTripTimestamp(trip) {
  if (!trip) return 0;

  // 1. Explicit millisecond timestamp (authoritative)
  if (trip.timestamp && !isNaN(Number(trip.timestamp)) && Number(trip.timestamp) > 0) {
    return Number(trip.timestamp);
  }

  // 2. Fallback to numeric id if epoch timestamp (> 1600000000000)
  if (typeof trip.id === 'number' && trip.id > 1600000000000) {
    return trip.id;
  }

  // 3. If explicit string date exists, parse it
  if (typeof trip.date === 'string' && trip.date.trim()) {
    const parsed = parseDateStringToTimestamp(trip.date);
    if (parsed > 0) return parsed;

    const raw = trip.date.trim();
    const dLower = raw.toLowerCase();

    // Check for HH:mm in string, e.g. "Hoy, 18:13", "Ayer, 21:00", "05 Oct, 14:30"
    let hours = 12;
    let minutes = 0;
    const timeMatch = raw.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      hours = parseInt(timeMatch[1], 10);
      minutes = parseInt(timeMatch[2], 10);
    }

    const now = new Date();
    if (dLower.includes('hoy')) {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0).getTime();
    }
    if (dLower.includes('ayer')) {
      const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000));
      return new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), hours, minutes, 0, 0).getTime();
    }

    // Spanish abbreviations like "02 Oct" or "02 Oct, 14:30"
    const spanishMonths = {
      ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
      jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11
    };
    const dayMonthMatch = raw.match(/(\d{1,2})\s+([a-zA-Z]{3})/);
    if (dayMonthMatch) {
      const day = parseInt(dayMonthMatch[1], 10);
      const mStr = dayMonthMatch[2].toLowerCase();
      if (spanishMonths[mStr] !== undefined) {
        return new Date(now.getFullYear(), spanishMonths[mStr], day, hours, minutes, 0, 0).getTime();
      }
    }
  }

  // 4. Numeric id fallback
  return Number(trip.id) || 0;
}

function isTripInPeriod(trip, period) {
  if (!period || period === 'all') return true;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekStart = todayStart - (6 * 24 * 60 * 60 * 1000); // last 7 days
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const tripTime = getTripTimestamp(trip);

  if (period === 'today') return tripTime >= todayStart;
  if (period === 'week') return tripTime >= weekStart;
  if (period === 'month') return tripTime >= monthStart;

  if (period === 'custom') {
    let match = true;
    if (STATE.customDateFrom) {
      const fromParts = STATE.customDateFrom.split('-');
      if (fromParts.length === 3) {
        const fromStart = new Date(Number(fromParts[0]), Number(fromParts[1]) - 1, Number(fromParts[2]), 0, 0, 0, 0).getTime();
        if (tripTime < fromStart) match = false;
      }
    }
    if (STATE.customDateTo) {
      const toParts = STATE.customDateTo.split('-');
      if (toParts.length === 3) {
        const toEnd = new Date(Number(toParts[0]), Number(toParts[1]) - 1, Number(toParts[2]), 23, 59, 59, 999).getTime();
        if (tripTime > toEnd) match = false;
      }
    }
    return match;
  }

  return true;
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

  // Active Time Period Filter
  const activePeriod = STATE.selectedTripPeriod || 'all';
  const periodChips = document.querySelectorAll('#trip-period-filters .trip-period-chip');
  periodChips.forEach(pChip => {
    pChip.classList.toggle('active', pChip.dataset.period === activePeriod);
  });

  // Calendar panel visibility and input values sync
  const calPanel = document.getElementById('trip-period-calendar-panel');
  const inputFrom = document.getElementById('trip-date-from');
  const inputTo = document.getElementById('trip-date-to');
  if (calPanel) {
    calPanel.style.display = (activePeriod === 'custom') ? 'flex' : 'none';
  }
  if (inputFrom && STATE.customDateFrom) inputFrom.value = STATE.customDateFrom;
  if (inputTo && STATE.customDateTo) inputTo.value = STATE.customDateTo;

  // Base trips filtered by time period (for both aggregated KPIs and listing)
  const periodTrips = STATE.trips.filter(t => isTripInPeriod(t, activePeriod));

  // 1. Compute Aggregated KPIs for the Selected Period
  let totalDistance = 0;
  let totalEnergy = 0;
  let totalCostEv = 0;
  let totalCostGas = 0;
  let totalCostDiesel = 0;

  periodTrips.forEach(trip => {
    totalDistance += trip.distance;
    totalEnergy += trip.energy;
    const tripCostPerKwh = getEffectiveElectricityPrice(trip);
    const costEv = trip.energy * tripCostPerKwh;
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
  const avgDistPerTrip = periodTrips.length > 0 ? (totalDistance / periodTrips.length) : 0;

  // Real estimated range on 100% battery (Dolphin Surf Blade Battery: 44.9 kWh net)
  const batteryCapacityKwh = 44.9;
  const estimatedRealRange100 = avgKwh100km > 0
    ? Math.round((batteryCapacityKwh / avgKwh100km) * 100)
    : 310;
  // Percentage compared to WLTP standard (310 km)
  const rangeFillPct = Math.max(30, Math.min(100, Math.round((estimatedRealRange100 / 310) * 100)));

  // Update KPI DOM elements
  const elDist = document.getElementById('kpi-trip-distance');
  const elCount = document.getElementById('kpi-trip-count');
  const elAvgDist = document.getElementById('kpi-trip-avg-dist');
  const elSavings = document.getElementById('kpi-trip-savings');
  const elTotalCost = document.getElementById('kpi-trip-total-cost');
  const elSavGas = document.getElementById('kpi-trip-sav-gas');
  const elSavDiesel = document.getElementById('kpi-trip-sav-diesel');
  const elEff = document.getElementById('kpi-trip-efficiency');
  const elWh = document.getElementById('kpi-trip-wh');
  const elRealRange = document.getElementById('kpi-trip-real-range');
  const elRangeComp = document.getElementById('kpi-trip-range-comp');
  const elBatteryFill = document.getElementById('kpi-trip-battery-fill');
  const elCo2 = document.getElementById('kpi-trip-co2');
  const elCo2Fact = document.getElementById('kpi-trip-co2-fact');
  const elOdoBase = document.getElementById('recorder-base-odo');

  if (elDist) elDist.textContent = `${totalDistance.toFixed(1)} km`;
  if (elCount) elCount.textContent = periodTrips.length;
  if (elAvgDist) elAvgDist.textContent = `${avgDistPerTrip.toFixed(1)} km`;
  if (elSavings) elSavings.textContent = `${totalSavingsGas.toFixed(2)} €`;
  if (elTotalCost) elTotalCost.textContent = `${totalCostEv.toFixed(2)} €`;
  if (elSavGas) elSavGas.textContent = `${totalSavingsGas.toFixed(2)}€`;
  if (elSavDiesel) elSavDiesel.textContent = `${totalSavingsDiesel.toFixed(2)}€`;
  if (elEff) elEff.textContent = `${avgKwh100km.toFixed(1)} kWh`;
  if (elWh) elWh.textContent = avgWh;
  if (elRealRange) elRealRange.textContent = `${estimatedRealRange100} km`;
  if (elRangeComp) {
    const diffKm = estimatedRealRange100 - 310;
    const diffStr = diffKm >= 0 ? `+${diffKm}` : `${diffKm}`;
    elRangeComp.textContent = `${diffStr} km vs 310 WLTP`;
    elRangeComp.title = `Comparativa frente a la autonomía homologada WLTP oficial (310 km)`;
  }
  if (elBatteryFill) elBatteryFill.style.width = `${rangeFillPct}%`;
  if (elCo2) elCo2.textContent = `${co2AvoidedKg.toFixed(1)} kg`;
  if (elCo2Fact) elCo2Fact.textContent = getRandomCo2Fact(co2AvoidedKg);
  if (elOdoBase) elOdoBase.textContent = `${STATE.vehicle.odometer.toLocaleString('es-ES')} km`;

  // Dynamic update of mini split cost/savings bar ratio
  const totalComb = totalCostEv + totalSavingsGas;
  if (totalComb > 0) {
    const costPct = Math.max(10, Math.min(90, Math.round((totalCostEv / totalComb) * 100)));
    const savePct = 100 - costPct;
    const costSeg = document.querySelector('.trip-mini-split-bar .cost-seg');
    const saveSeg = document.querySelector('.trip-mini-split-bar .save-seg');
    if (costSeg && saveSeg) {
      costSeg.style.width = `${costPct}%`;
      saveSeg.style.width = `${savePct}%`;
    }
  }

  // Dynamic mini bars for distance variation across recent trips
  const miniBars = document.querySelectorAll('.dist-mini-chart .mini-bar');
  if (miniBars.length > 0 && periodTrips.length > 0) {
    const recentTrips = periodTrips.slice(0, miniBars.length);
    const maxRecentDist = Math.max(...recentTrips.map(t => t.distance), 1);
    miniBars.forEach((bar, bIdx) => {
      const tripItem = recentTrips[bIdx];
      if (tripItem) {
        const heightPct = Math.max(25, Math.round((tripItem.distance / maxRecentDist) * 100));
        bar.style.height = `${heightPct}%`;
        bar.title = `${tripItem.distance} km`;
      }
    });
  }

  // 2. Filter & Sort Trips
  const activeCat = STATE.selectedTripCategory || 'all';
  const chips = document.querySelectorAll('#trip-category-filters .trip-filter-chip');
  chips.forEach(chip => {
    chip.classList.toggle('active', chip.dataset.category === activeCat);
  });

  const sortSelect = document.getElementById('trip-sort-select');
  if (sortSelect && sortSelect.value !== STATE.tripSort) {
    sortSelect.value = STATE.tripSort;
  }

  // Base list filtered by time period AND category
  let filtered = activeCat === 'all'
    ? [...periodTrips]
    : periodTrips.filter(t => (t.category || 'trabajo') === activeCat);

  // Sorting logic
  const sortMode = STATE.tripSort || 'recent';
  if (sortMode === 'oldest') {
    // Oldest first (lowest timestamp first)
    filtered.sort((a, b) => getTripTimestamp(a) - getTripTimestamp(b));
  } else if (sortMode === 'recent') {
    // Most recent first (highest timestamp first)
    filtered.sort((a, b) => getTripTimestamp(b) - getTripTimestamp(a));
  } else if (sortMode === 'dist-desc') {
    filtered.sort((a, b) => b.distance - a.distance);
  } else if (sortMode === 'dist-asc') {
    filtered.sort((a, b) => a.distance - b.distance);
  } else if (sortMode === 'savings-desc') {
    filtered.sort((a, b) => {
      const savA = ((a.distance / 100) * iceCons * gasPrice) - (a.energy * costPerKwh);
      const savB = ((b.distance / 100) * iceCons * gasPrice) - (b.energy * costPerKwh);
      return savB - savA;
    });
  } // 'custom' keeps current STATE.trips array order without automatic sorting

  const displayedTrips = filtered;

  // Render List of Trip Cards
  if (displayedTrips.length === 0) {
    const periodLabels = {
      all: 'todos los registros',
      today: 'el día de hoy',
      week: 'la última semana',
      month: 'este mes',
      custom: (STATE.customDateFrom || STATE.customDateTo)
        ? `el rango ${STATE.customDateFrom || '...'} a ${STATE.customDateTo || '...'}`
        : 'el rango de fechas seleccionado'
    };
    const periodText = periodLabels[activePeriod] || 'el periodo seleccionado';
    container.innerHTML = `
      <div style="text-align:center; padding:36px 20px; color:var(--text-muted); background:var(--panel-card); border:1px solid var(--panel-border); border-radius:var(--radius-sm);">
        <span style="font-size:32px; display:block; margin-bottom:8px;">🚗</span>
        <b>Sin trayectos para ${periodText}</b>
        <p style="font-size:12.5px; margin-top:4px;">${activeCat === 'all' ? 'Prueba seleccionando "Todos" en el periodo o pulsa "Simular y Probar Trayecto".' : 'No hay viajes categorizados como ' + (TRIP_CATEGORIES[activeCat]?.label || activeCat) + ' en ' + periodText + '.'}</p>
      </div>
    `;
  } else {
    container.innerHTML = displayedTrips.map((trip, idx) => {
      const tripCostPerKwh = getEffectiveElectricityPrice(trip);
      const tripCostEv = trip.energy * tripCostPerKwh;
      const tripCostGas = (trip.distance / 100) * iceCons * gasPrice;
      const tripCostDiesel = (trip.distance / 100) * dieselCons * dieselPrice;
      const tripSavingsGas = Math.max(0, tripCostGas - tripCostEv);
      const tripSavingsDiesel = Math.max(0, tripCostDiesel - tripCostEv);
      const catKey = trip.category || 'trabajo';
      const catObj = TRIP_CATEGORIES[catKey] || TRIP_CATEGORIES.trabajo;

      return `
        <article class="trip-card ${trip.isNew ? 'new-arrival' : ''}" id="trip-card-${trip.id}" data-id="${trip.id}" draggable="true">
          <!-- CABECERA DE LA TARJETA: ÍCONO REORDENAR, TÍTULO, CATEGORÍA Y FECHA -->
          <div class="trip-card-header">
            <div class="trip-header-left">
              <div class="trip-route-badge reorder-handle" title="Arrastra o usa las flechas para mover" data-id="${trip.id}">⌖</div>
              <div class="trip-title-block">
                <div class="trip-title-line">
                  <b class="trip-name">${trip.title}</b>
                  <span class="trip-category-tag ${catKey}">${catObj.icon} ${catObj.label}</span>
                </div>
                <div class="trip-time-stamp">
                  <span>📅 ${trip.date}</span>
                  <span class="bullet">·</span>
                  <span>⏱️ ${trip.duration}</span>
                </div>
              </div>
            </div>

            <!-- BOTONES DE ACCIÓN (SUBIR, BAJAR, EDITAR, BORRAR) -->
            <div class="trip-card-actions">
              <button class="trip-action-btn btn-move-up" data-id="${trip.id}" title="Subir orden" type="button" ${idx === 0 ? 'disabled style="opacity:0.35;"' : ''}>▲</button>
              <button class="trip-action-btn btn-move-down" data-id="${trip.id}" title="Bajar orden" type="button" ${idx === displayedTrips.length - 1 ? 'disabled style="opacity:0.35;"' : ''}>▼</button>
              <button class="trip-action-btn btn-edit-trip" data-id="${trip.id}" title="Editar trayecto" type="button">✏️</button>
              <button class="trip-action-btn btn-delete-trip" data-id="${trip.id}" title="Eliminar trayecto" type="button">🗑️</button>
            </div>
          </div>

          <!-- CUERPO DE LA TARJETA: MÉTRICAS FÍSICAS Y AUDITORÍA ECONÓMICA -->
          <div class="trip-card-body">
            <!-- BLOQUE 1: MÉTRICAS DEL VEHÍCULO -->
            <div class="trip-metrics-grid">
              <div class="trip-metric-item">
                <span class="metric-label">DISTANCIA</span>
                <b class="metric-val">${trip.distance.toFixed(1)} <small>km</small></b>
              </div>
              <div class="trip-metric-item">
                <span class="metric-label">ENERGÍA</span>
                <b class="metric-val">${trip.energy.toFixed(2)} <small>kWh</small></b>
              </div>
              <div class="trip-metric-item">
                <span class="metric-label">EFICIENCIA</span>
                <b class="metric-val">${trip.avgWh} <small>Wh/km</small></b>
              </div>
            </div>

            <!-- BLOQUE 2: COSTE REAL Y AHORRO FRENTE A TÉRMICOS -->
            <div class="trip-financial-box">
              <div class="trip-ev-cost-badge">
                <span class="cost-label">COSTE EV</span>
                <span class="cost-number">${tripCostEv.toFixed(2)} €</span>
              </div>
              <div class="trip-ice-savings-tags">
                <div class="savings-tag-row">
                  <span class="ice-type">Gas 95: ${tripCostGas.toFixed(2)}€</span>
                  <span class="badge-saving badge-gas">-${tripSavingsGas.toFixed(2)} €</span>
                </div>
                <div class="savings-tag-row">
                  <span class="ice-type">Diésel: ${tripCostDiesel.toFixed(2)}€</span>
                  <span class="badge-saving badge-diesel">-${tripSavingsDiesel.toFixed(2)} €</span>
                </div>
              </div>
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
  STATE.tripSort = 'custom';
  localStorage.setItem('biguaydi-trip-sort', 'custom');
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
          STATE.tripSort = 'custom';
          localStorage.setItem('biguaydi-trip-sort', 'custom');
          localStorage.setItem('biguaydi-trips', JSON.stringify(STATE.trips));
          renderTrips();
          showToast('✓ Trayecto reordenado con éxito');
        }
      }
    });
  });
}

function groupTripsByPeriod(trips, mode) {
  const groups = new Map();
  const spanishShortMonths = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  trips.forEach(t => {
    const ts = getTripTimestamp(t);
    const d = new Date(ts);
    let key = '';
    let title = '';
    let sortKey = 0;

    if (mode === 'day') {
      const year = d.getFullYear();
      const month = d.getMonth();
      const day = d.getDate();
      key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      title = `${String(day).padStart(2, '0')} ${spanishShortMonths[month]}`;
      sortKey = new Date(year, month, day).getTime();
    } else if (mode === 'week') {
      // Calculate ISO week
      const target = new Date(d.valueOf());
      const dayNr = (d.getDay() + 6) % 7;
      target.setDate(target.getDate() - dayNr + 3);
      const firstThursday = target.valueOf();
      target.setMonth(0, 1);
      if (target.getDay() !== 4) {
        target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
      }
      const weekNo = 1 + Math.ceil((firstThursday - target) / 604800000);
      const year = d.getFullYear();
      key = `${year}-W${String(weekNo).padStart(2, '0')}`;
      title = `Sem ${weekNo} (${spanishShortMonths[d.getMonth()]})`;
      sortKey = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dayNr).getTime();
    } else if (mode === 'month') {
      const year = d.getFullYear();
      const month = d.getMonth();
      key = `${year}-${String(month + 1).padStart(2, '0')}`;
      title = `${spanishShortMonths[month]} ${String(year).slice(2)}`;
      sortKey = new Date(year, month, 1).getTime();
    } else if (mode === 'year') {
      const year = d.getFullYear();
      key = `${year}`;
      title = `${year}`;
      sortKey = new Date(year, 0, 1).getTime();
    }

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        title,
        sortKey,
        distance: 0,
        energy: 0,
        whWeightedSum: 0,
        count: 0,
        trips: []
      });
    }

    const g = groups.get(key);
    g.distance += (t.distance || 0);
    g.energy += (t.energy || 0);
    g.whWeightedSum += (t.avgWh || 140) * (t.distance || 0);
    g.count += 1;
    g.trips.push(t);
  });

  return Array.from(groups.values())
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(g => ({
      title: g.title,
      dist: `${g.distance.toFixed(1)} km`,
      distance: g.distance,
      energy: g.energy,
      avgWh: g.distance > 0 ? Math.round(g.whWeightedSum / g.distance) : 140,
      count: g.count,
      isGroup: true
    }));
}

function renderTripsChart() {
  const chartBox = document.getElementById('trips-chart-container');
  if (!chartBox) return;

  const costPerKwh = getEffectiveElectricityPrice();
  const gasPrice = STATE.prices.gas95;
  const dieselPrice = STATE.prices.diesel;
  const iceCons = STATE.prices.iceConsumption;
  const dieselCons = STATE.prices.dieselConsumption;

  // Active time period filtered trips
  const activePeriod = STATE.selectedTripPeriod || 'all';
  const periodTrips = STATE.trips.filter(t => isTripInPeriod(t, activePeriod));

  if (periodTrips.length === 0) {
    chartBox.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-dim); font-size:12px;">Sin datos suficientes para graficar</div>';
    return;
  }

  // Update Controls Active States (Pills & Expand)
  const pills = document.querySelectorAll('#trips-chart-group-pills .chart-pill-btn');
  pills.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.group === (STATE.chartGroupMode || 'auto'));
  });

  const btnExpand = document.getElementById('btn-chart-expand');
  if (btnExpand) {
    btnExpand.classList.toggle('active', !!STATE.chartExpanded);
    const expandText = btnExpand.querySelector('.expand-text');
    if (expandText) {
      expandText.textContent = STATE.chartExpanded ? 'Plegar vista' : 'Desplegar todo';
    }
  }

  // Screen width & container dimension determination
  const containerW = chartBox.parentElement ? chartBox.parentElement.clientWidth : window.innerWidth;
  const isMobile = window.innerWidth <= 768;
  const hasEvCost = costPerKwh > 0;
  const padL = isMobile ? 44 : 52;
  const padR = isMobile ? 20 : 30;
  const padT = isMobile ? 28 : 34;
  const padB = isMobile ? 42 : 46;
  const availablePlotW = Math.max(280, containerW - padL - padR - 36);

  // Maximum items that fit comfortably without collapsing or cramming bars
  // Min slot width per group is ~60px on mobile, ~78px on desktop
  const minComfortSlotW = isMobile ? 62 : 80;
  const maxComfortableItems = Math.max(4, Math.floor(availablePlotW / minComfortSlotW));

  // Determine effective aggregation mode
  let effectiveMode = STATE.chartGroupMode || 'auto';
  if (effectiveMode === 'auto') {
    // If not expanded, we auto-group down hierarchical levels until count <= maxComfortableItems
    if (!STATE.chartExpanded) {
      if (periodTrips.length <= maxComfortableItems) {
        effectiveMode = 'trip';
      } else {
        const byDays = groupTripsByPeriod(periodTrips, 'day');
        if (byDays.length <= maxComfortableItems) {
          effectiveMode = 'day';
        } else {
          const byWeeks = groupTripsByPeriod(periodTrips, 'week');
          if (byWeeks.length <= maxComfortableItems) {
            effectiveMode = 'week';
          } else {
            const byMonths = groupTripsByPeriod(periodTrips, 'month');
            if (byMonths.length <= maxComfortableItems) {
              effectiveMode = 'month';
            } else {
              effectiveMode = 'year';
            }
          }
        }
      }
    } else {
      // Expanded view with auto defaults to individual trips (or day if trip count > 60)
      effectiveMode = periodTrips.length > 50 ? 'day' : 'trip';
    }
  }

  // Update Header title subtitle to reflect current group mode
  const headingEl = document.getElementById('trips-chart-heading');
  if (headingEl) {
    const modeNames = {
      trip: 'Trayectos Individuales',
      day: 'Agrupado por Días',
      week: 'Agrupado por Semanas',
      month: 'Agrupado por Meses',
      year: 'Agrupado por Años'
    };
    headingEl.textContent = `Comparativa Económica (${modeNames[effectiveMode] || 'Por Trayecto'})`;
  }

  // Build dataset according to effectiveMode
  let rawData = [];
  if (effectiveMode === 'trip') {
    // Chronological order (oldest to newest)
    const sortedTrips = [...periodTrips].sort((a, b) => getTripTimestamp(a) - getTripTimestamp(b));
    const items = (!STATE.chartExpanded && sortedTrips.length > maxComfortableItems)
      ? sortedTrips.slice(-maxComfortableItems)
      : sortedTrips;

    rawData = items.map(t => {
      const tripCostPerKwh = getEffectiveElectricityPrice(t);
      return {
        title: t.title.split(' ')[0] || `V${t.id}`,
        dist: t.distance.toFixed(1) + ' km',
        wh: t.avgWh,
        costGas: (t.distance / 100) * iceCons * gasPrice,
        costDiesel: (t.distance / 100) * dieselCons * dieselPrice,
        costEv: t.energy * tripCostPerKwh,
        count: 1
      };
    });
  } else {
    // Grouped by day, week, month, year
    const grouped = groupTripsByPeriod(periodTrips, effectiveMode);
    const items = (!STATE.chartExpanded && grouped.length > maxComfortableItems)
      ? grouped.slice(-maxComfortableItems)
      : grouped;

    rawData = items.map(g => ({
      title: g.title,
      dist: g.dist,
      wh: g.avgWh,
      costGas: (g.distance / 100) * iceCons * gasPrice,
      costDiesel: (g.distance / 100) * dieselCons * dieselPrice,
      costEv: g.energy * costPerKwh,
      count: g.count
    }));
  }

  if (rawData.length === 0) {
    chartBox.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-dim); font-size:12px;">Sin datos suficientes para graficar</div>';
    return;
  }

  const maxCost = Math.max(...rawData.map(d => Math.max(d.costGas, d.costDiesel, d.costEv)), 1.5);
  const minWh = Math.min(...rawData.map(d => d.wh), 100);
  const maxWh = Math.max(...rawData.map(d => d.wh), 200);

  // Layout calculations
  // If expanded or item count requires scrolling, calculate wide SVG canvas and enable horizontal scroll
  const desiredSlotW = isMobile ? (hasEvCost ? 82 : 72) : (hasEvCost ? 110 : 96);
  const naturalWidth = padL + padR + (rawData.length * desiredSlotW);
  const fittedWidth = Math.max(340, containerW - 20);

  let W = fittedWidth;
  if (STATE.chartExpanded || naturalWidth > fittedWidth) {
    W = Math.max(fittedWidth, naturalWidth);
  }

  const H = isMobile ? 230 : 260;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const slotW = plotW / rawData.length;

  const barCount = hasEvCost ? 3 : 2;
  const barW = Math.min(isMobile ? (hasEvCost ? 14 : 18) : (hasEvCost ? 20 : 25), Math.max(8, slotW * (hasEvCost ? 0.17 : 0.22)));
  const barGap = isMobile ? 2.5 : 4.5;
  const totalGroupW = (barCount * barW) + ((barCount - 1) * barGap);
  const fontScale = 0.85 + (STATE.fontSize - 1) * 0.12;
  const linePoints = [];

  let barsSvg = '';
  rawData.forEach((d, i) => {
    const cx = padL + i * slotW + slotW / 2;
    const startX = cx - (totalGroupW / 2);

    let xEv = 0;
    let xGas = 0;
    let xDiesel = 0;

    if (hasEvCost) {
      xEv = startX;
      xGas = startX + barW + barGap;
      xDiesel = startX + (2 * (barW + barGap));
    } else {
      xGas = startX;
      xDiesel = startX + barW + barGap;
    }

    const hGas = Math.max(8, (d.costGas / maxCost) * plotH);
    const hDiesel = Math.max(8, (d.costDiesel / maxCost) * plotH);
    const hEv = hasEvCost ? Math.max(5, (d.costEv / maxCost) * plotH) : 0;

    const yGas = padT + (plotH - hGas);
    const yDiesel = padT + (plotH - hDiesel);
    const yEv = padT + (plotH - hEv);

    const whNorm = (d.wh - minWh) / Math.max(1, maxWh - minWh);
    const yWh = padT + (plotH - (whNorm * (plotH * 0.6) + (plotH * 0.2)));
    linePoints.push({ x: cx, y: yWh, val: d.wh });

    // Anti-collision algorithm between Wh dashed line/circle and bar price labels
    const collisionDist = 18;
    let textYGas = yGas - 5;
    let textYDiesel = yDiesel - 5;
    let textYEv = yEv - 5;

    if (Math.abs(textYGas - yWh) < collisionDist) {
      textYGas = (yWh <= textYGas) ? Math.min(yGas + 14, H - 35) : Math.max(padT - 6, yWh - 16);
    }
    if (Math.abs(textYDiesel - yWh) < collisionDist) {
      textYDiesel = (yWh <= textYDiesel) ? Math.min(yDiesel + 14, H - 35) : Math.max(padT - 6, yWh - 16);
    }
    if (hasEvCost && Math.abs(textYEv - yWh) < collisionDist) {
      textYEv = (yWh <= textYEv) ? Math.min(yEv + 14, H - 35) : Math.max(padT - 6, yWh - 16);
    }

    let evBarSvg = '';
    if (hasEvCost) {
      evBarSvg = `
        <rect x="${xEv}" y="${yEv}" width="${barW}" height="${hEv}" rx="3" fill="url(#tripEvGrad)" />
        <rect x="${xEv}" y="${yEv}" width="${barW}" height="2" rx="1" fill="#fff" filter="url(#glowGreen)" />
        <rect x="${xEv - 2}" y="${textYEv - 9}" width="${barW + 4}" height="11" rx="2" fill="rgba(6,12,10,0.78)" />
        <text x="${xEv + barW / 2}" y="${textYEv}" font-size="${((hasEvCost ? 9 : 10) * fontScale).toFixed(1)}" class="chart-text-val" font-weight="700" fill="var(--accent)" text-anchor="middle" font-family="var(--mono)">${d.costEv.toFixed(2)}€</text>
      `;
    }

    barsSvg += `
      <g class="chart-trip-group">
        ${evBarSvg}

        <!-- Gasolina 95 Bar -->
        <rect x="${xGas}" y="${yGas}" width="${barW}" height="${hGas}" rx="3" fill="url(#tripGasGrad)" />
        <rect x="${xGas}" y="${yGas}" width="${barW}" height="2" rx="1" fill="#fff" filter="url(#glowGas)" />
        <rect x="${xGas - 3}" y="${textYGas - 9}" width="${barW + 6}" height="11" rx="2" fill="rgba(6,12,10,0.78)" />
        <text x="${xGas + barW / 2}" y="${textYGas}" font-size="${((hasEvCost ? 9 : 10) * fontScale).toFixed(1)}" class="chart-text-val" font-weight="600" fill="#ff8c73" text-anchor="middle" font-family="var(--mono)">${d.costGas.toFixed(2)}€</text>

        <!-- Diésel A Bar -->
        <rect x="${xDiesel}" y="${yDiesel}" width="${barW}" height="${hDiesel}" rx="3" fill="url(#tripDieGrad)" />
        <rect x="${xDiesel}" y="${yDiesel}" width="${barW}" height="2" rx="1" fill="#fff" filter="url(#glowDie)" />
        <rect x="${xDiesel - 3}" y="${textYDiesel - 9}" width="${barW + 6}" height="11" rx="2" fill="rgba(6,12,10,0.78)" />
        <text x="${xDiesel + barW / 2}" y="${textYDiesel}" font-size="${((hasEvCost ? 9 : 10) * fontScale).toFixed(1)}" class="chart-text-val" font-weight="600" fill="#f5cc7f" text-anchor="middle" font-family="var(--mono)">${d.costDiesel.toFixed(2)}€</text>

        <!-- Labels (X Axis) -->
        <text x="${cx}" y="${H - 22}" font-size="${(11.5 * fontScale).toFixed(1)}" class="chart-text-title" font-weight="600" fill="var(--text)" text-anchor="middle" font-family="var(--sans)">${d.title}</text>
        <text x="${cx}" y="${H - 7}" font-size="${(10 * fontScale).toFixed(1)}" class="chart-text-sub" fill="var(--text-muted)" text-anchor="middle" font-family="var(--mono)">${d.dist}</text>
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

  // Update dynamic chart legend to show or hide the green EV cost indicator
  const legendEvItem = document.getElementById('trips-legend-ev-cost');
  if (legendEvItem) {
    legendEvItem.style.display = hasEvCost ? 'inline-flex' : 'none';
  }

  chartBox.innerHTML = `
    <svg class="trips-svg-canvas" viewBox="0 0 ${W} ${H}" style="min-width:${W}px; width:${W}px;" preserveAspectRatio="none">
      <defs>
        <linearGradient id="tripEvGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="var(--accent)" />
          <stop offset="100%" stop-color="#1b4d2e" />
        </linearGradient>
        <linearGradient id="tripGasGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#ff8c73" />
          <stop offset="100%" stop-color="#4d170c" />
        </linearGradient>
        <linearGradient id="tripDieGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#f5cc7f" />
          <stop offset="100%" stop-color="#47310a" />
        </linearGradient>
        <filter id="glowGreen" x="-20%" y="-50%" width="140%" height="200%">
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

      ${gridSvg}
      ${barsSvg}

      <polyline fill="none" stroke="#4ce0d2" stroke-width="2.5" stroke-dasharray="4 3" points="${pointsStr}" opacity="0.9" />
      ${dotsSvg}
    </svg>
  `;

  // Auto-scroll to end so user sees newest data when overflowed
  setTimeout(() => {
    chartBox.scrollLeft = chartBox.scrollWidth;
  }, 50);
}

// --- AUTO TRIP RECORDER ENGINE & SIMULATOR ---
function initAutoTripRecorder() {
  const btnSim = document.getElementById('btn-simulate-trip');
  const btnReset = document.getElementById('btn-reset-trips');
  const filterRow = document.getElementById('trip-category-filters');

  // Period filter chips click handler (Todos, Hoy, Última semana, Este mes, Personalizado)
  const periodRow = document.getElementById('trip-period-filters');
  if (periodRow) {
    periodRow.addEventListener('click', (e) => {
      const chip = e.target.closest('.trip-period-chip');
      if (!chip) return;
      STATE.selectedTripPeriod = chip.dataset.period || 'all';
      localStorage.setItem('biguaydi-trip-period', STATE.selectedTripPeriod);
      renderTrips();
      const periodNames = {
        all: 'Todos los periodos',
        today: 'Hoy',
        week: 'Última semana',
        month: 'Este mes',
        custom: 'Rango personalizado'
      };
      showToast(`📅 Periodo acumulado: ${periodNames[STATE.selectedTripPeriod] || STATE.selectedTripPeriod}`);
    });
  }

  // Custom date range calendar buttons and inputs
  const btnApplyCal = document.getElementById('btn-calendar-apply');
  const btnClearCal = document.getElementById('btn-calendar-clear');
  const inputDateFrom = document.getElementById('trip-date-from');
  const inputDateTo = document.getElementById('trip-date-to');

  if (btnApplyCal) {
    btnApplyCal.addEventListener('click', () => {
      const valFrom = inputDateFrom ? inputDateFrom.value : '';
      const valTo = inputDateTo ? inputDateTo.value : '';
      STATE.customDateFrom = valFrom;
      STATE.customDateTo = valTo;
      localStorage.setItem('biguaydi-trip-date-from', valFrom);
      localStorage.setItem('biguaydi-trip-date-to', valTo);
      STATE.selectedTripPeriod = 'custom';
      localStorage.setItem('biguaydi-trip-period', 'custom');
      renderTrips();
      const rangeText = (valFrom && valTo)
        ? `${valFrom} al ${valTo}`
        : (valFrom ? `desde ${valFrom}` : (valTo ? `hasta ${valTo}` : 'todas'));
      showToast(`📅 Filtro aplicado: ${rangeText}`);
    });
  }

  if (btnClearCal) {
    btnClearCal.addEventListener('click', () => {
      if (inputDateFrom) inputDateFrom.value = '';
      if (inputDateTo) inputDateTo.value = '';
      STATE.customDateFrom = '';
      STATE.customDateTo = '';
      localStorage.removeItem('biguaydi-trip-date-from');
      localStorage.removeItem('biguaydi-trip-date-to');
      STATE.selectedTripPeriod = 'all';
      localStorage.setItem('biguaydi-trip-period', 'all');
      renderTrips();
      showToast('📅 Fechas restablecidas a todos los periodos');
    });
  }

  if (inputDateFrom) {
    inputDateFrom.addEventListener('change', () => {
      STATE.customDateFrom = inputDateFrom.value;
      localStorage.setItem('biguaydi-trip-date-from', inputDateFrom.value);
      if (STATE.selectedTripPeriod === 'custom') renderTrips();
    });
  }

  if (inputDateTo) {
    inputDateTo.addEventListener('change', () => {
      STATE.customDateTo = inputDateTo.value;
      localStorage.setItem('biguaydi-trip-date-to', inputDateTo.value);
      if (STATE.selectedTripPeriod === 'custom') renderTrips();
    });
  }

  // Filter chips click handler
  if (filterRow) {
    filterRow.addEventListener('click', (e) => {
      const chip = e.target.closest('.trip-filter-chip');
      if (!chip) return;
      STATE.selectedTripCategory = chip.dataset.category || 'all';
      renderTrips();
    });
  }

  // Sort order selector listener
  const sortSelect = document.getElementById('trip-sort-select');
  if (sortSelect) {
    sortSelect.value = STATE.tripSort || 'recent';
    sortSelect.addEventListener('change', () => {
      STATE.tripSort = sortSelect.value;
      localStorage.setItem('biguaydi-trip-sort', sortSelect.value);
      renderTrips();
      const sortLabels = {
        recent: 'Más recientes primero',
        oldest: 'Más antiguos primero',
        custom: 'Orden personalizado manual',
        'dist-desc': 'Mayor distancia',
        'dist-asc': 'Menor distancia',
        'savings-desc': 'Mayor ahorro'
      };
      showToast(`⇅ Orden: ${sortLabels[sortSelect.value] || sortSelect.value}`);
    });
  }

  // Chart Interactive Grouping Pills Listener
  const chartPillsRow = document.getElementById('trips-chart-group-pills');
  if (chartPillsRow) {
    chartPillsRow.addEventListener('click', (e) => {
      const btn = e.target.closest('.chart-pill-btn');
      if (!btn) return;
      STATE.chartGroupMode = btn.dataset.group || 'auto';
      localStorage.setItem('biguaydi-chart-group', STATE.chartGroupMode);
      renderTripsChart();
      const groupLabels = {
        auto: 'Automática Inteligente',
        trip: 'Por Viaje Individual',
        day: 'Por Días',
        week: 'Por Semanas',
        month: 'Por Meses',
        year: 'Por Años'
      };
      showToast(`📊 Agrupación: ${groupLabels[STATE.chartGroupMode] || STATE.chartGroupMode}`);
    });
  }

  // Chart Full Expand / Collapse Button Listener
  const btnChartExpand = document.getElementById('btn-chart-expand');
  if (btnChartExpand) {
    btnChartExpand.addEventListener('click', () => {
      STATE.chartExpanded = !STATE.chartExpanded;
      localStorage.setItem('biguaydi-chart-expanded', String(STATE.chartExpanded));
      renderTripsChart();
      showToast(STATE.chartExpanded ? '↔ Gráfico desplegado al completo (desliza horizontalmente)' : '⇤ Gráfico replegado y ajustado');
    });
  }

  // Auto-resize chart on orientation change or window resize
  window.addEventListener('resize', () => {
    if (STATE.view === 'trips') {
      renderTripsChart();
    }
  });

  // Interactive CO2 curiosity rotation on tap
  const btnCo2Card = document.getElementById('btn-next-co2-fact');
  if (btnCo2Card) {
    btnCo2Card.addEventListener('click', () => {
      const elCo2Fact = document.getElementById('kpi-trip-co2-fact');
      if (elCo2Fact) {
        let totalDistance = 0;
        STATE.trips.forEach(t => totalDistance += t.distance);
        const co2AvoidedKg = (totalDistance * 104) / 1000;
        elCo2Fact.textContent = getRandomCo2Fact(co2AvoidedKg);
      }
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

      const nowTs = Date.now();
      const newTrip = {
        id: nowTs,
        timestamp: nowTs,
        title: sample.title,
        category: sample.category || 'trabajo',
        date: formatRealTripDate(new Date(nowTs)),
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
        const baseNow = Date.now();
        STATE.trips = [
          { id: baseNow - 3600000 * 2, timestamp: baseNow - 3600000 * 2, title: 'Trabajo ➔ Casa', category: 'trabajo', date: formatRealTripDate(new Date(baseNow - 3600000 * 2)), distance: 22.4, energy: 3.1, avgWh: 138, duration: '28 min' },
          { id: baseNow - 3600000 * 8, timestamp: baseNow - 3600000 * 8, title: 'Casa ➔ Gimnasio', category: 'personal', date: formatRealTripDate(new Date(baseNow - 3600000 * 8)), distance: 8.5, energy: 1.2, avgWh: 141, duration: '12 min' },
          { id: baseNow - 86400000, timestamp: baseNow - 86400000, title: 'Ruta Clientes Centro', category: 'chofer', date: formatRealTripDate(new Date(baseNow - 86400000)), distance: 74.2, energy: 11.2, avgWh: 150, duration: '52 min' },
          { id: baseNow - 86400000 * 3, timestamp: baseNow - 86400000 * 3, title: 'Compras & Supermercado', category: 'compras', date: formatRealTripDate(new Date(baseNow - 86400000 * 3)), distance: 14.8, energy: 1.9, avgWh: 128, duration: '25 min' }
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

        const rawDate = document.getElementById('edit-trip-date').value.trim();
        const parsedTs = parseDateStringToTimestamp(rawDate);
        const resolvedTs = parsedTs > 0 ? parsedTs : (STATE.trips[tripIndex].timestamp || Date.now());
        const formattedDate = parsedTs > 0 ? formatRealTripDate(new Date(parsedTs)) : (rawDate || formatRealTripDate(new Date(resolvedTs)));

        const updatedTrip = {
          ...STATE.trips[tripIndex],
          title: document.getElementById('edit-trip-title').value.trim() || 'Ruta',
          category: cat,
          date: formattedDate,
          timestamp: resolvedTs,
          distance: dist,
          avgWh: wh,
          energy: energy,
          duration: document.getElementById('edit-trip-duration').value.trim() || `${Math.round(dist * 1.5)} min`,
          isNew: false
        };

        STATE.trips[tripIndex] = updatedTrip;

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

// --- LIVE TRACTION & GEAR TELEMETRY MONITOR ---
function initTractionMonitor() {
  const btnTest = document.getElementById('btn-test-traction');
  const gearPills = document.querySelectorAll('#tel-gear-cluster .gear-pill');

  // 1. Interactive PRND Cluster selector clicks
  gearPills.forEach(pill => {
    pill.addEventListener('click', () => {
      const g = pill.dataset.gear;
      if (!g) return;
      STATE.vehicle.gear = g;
      if (g === 'P') {
        STATE.vehicle.speed = 0;
        STATE.vehicle.power = 0.2;
        STATE.vehicle.driveStatus = 'Estacionado (P)';
      } else if (g === 'D') {
        if (STATE.vehicle.speed === 0) STATE.vehicle.speed = 22;
        STATE.vehicle.power = 9.4;
        STATE.vehicle.driveStatus = `En Marcha (${STATE.vehicle.speed} km/h · Tracción)`;
      } else if (g === 'R') {
        STATE.vehicle.speed = 7;
        STATE.vehicle.power = 3.6;
        STATE.vehicle.driveStatus = 'Marcha Atrás (R)';
      } else if (g === 'N') {
        STATE.vehicle.speed = 0;
        STATE.vehicle.power = 0.1;
        STATE.vehicle.driveStatus = 'Punto Muerto (N)';
      }
      renderVehicleHUD();
      localStorage.setItem('biguaydi-vehicle', JSON.stringify(STATE.vehicle));
    });
  });

  // 2. Interactive Dynamic Drive Simulation button on the card
  if (btnTest) {
    btnTest.addEventListener('click', () => {
      if (btnTest.disabled) return;
      btnTest.disabled = true;
      btnTest.textContent = '⏳ Simulando aceleración...';

      // Stage 1 (0ms): Gear to D, initial acceleration
      STATE.vehicle.gear = 'D';
      STATE.vehicle.speed = 16;
      STATE.vehicle.power = 9.8;
      STATE.vehicle.driveStatus = 'Iniciando Marcha (D)';
      STATE.vehicle.driveMode = 'ECO Inteligente';
      renderVehicleHUD();

      // Stage 2 (1100ms): Active power & speed climb
      setTimeout(() => {
        btnTest.textContent = '⚡ Tracción en marcha...';
        STATE.vehicle.speed = 52;
        STATE.vehicle.power = 28.4;
        STATE.vehicle.driveStatus = 'En Marcha (52 km/h · Tracción)';
        STATE.vehicle.driveMode = 'SPORT Dinámico';
        renderVehicleHUD();
      }, 1100);

      // Stage 3 (2400ms): High-speed cruise
      setTimeout(() => {
        btnTest.textContent = '🚀 Velocidad de crucero...';
        STATE.vehicle.speed = 78;
        STATE.vehicle.power = 42.1;
        STATE.vehicle.driveStatus = 'En Marcha (78 km/h · Tracción Alta)';
        renderVehicleHUD();
      }, 2400);

      // Stage 4 (3700ms): Regenerative Braking (Green flow)
      setTimeout(() => {
        btnTest.textContent = '🌱 Frenada Regenerativa...';
        STATE.vehicle.speed = 36;
        STATE.vehicle.power = -16.8;
        STATE.vehicle.driveStatus = 'Frenada Regenerativa (-16.8 kW)';
        renderVehicleHUD();
      }, 3700);

      // Stage 5 (5000ms): Smooth stop & restore to Park
      setTimeout(() => {
        STATE.vehicle.speed = 0;
        STATE.vehicle.gear = 'P';
        STATE.vehicle.power = 0.2;
        STATE.vehicle.driveStatus = 'Estacionado (P)';
        STATE.vehicle.driveMode = 'ECO Inteligente';
        renderVehicleHUD();
        localStorage.setItem('biguaydi-vehicle', JSON.stringify(STATE.vehicle));

        btnTest.disabled = false;
        btnTest.textContent = '⚡ Probar Actividad Dinámica';
        showToast('✓ Actividad de tracción, marcha y regeneración probada');
      }, 5000);
    });
  }

  // 3. Live Standby Heartbeat (BMS & 12V auxiliary monitoring pulse every 2.5s)
  setInterval(() => {
    // Only update auxiliary standby load when parked at 0 km/h so we never overwrite driving telemetry
    if (STATE.vehicle.gear === 'P' && STATE.vehicle.speed === 0 && !STATE.vehicle.charging) {
      const baseAux = 0.20;
      const variation = Math.sin(Date.now() / 1800) * 0.06;
      const currentPower = Number(Math.max(0.12, baseAux + variation).toFixed(2));
      STATE.vehicle.power = currentPower;

      const elPowerDisp = document.getElementById('tel-power-display');
      const elPower = document.getElementById('tel-power');
      const fluxBar = document.getElementById('tel-flux-bar');

      if (elPowerDisp) elPowerDisp.textContent = `+${currentPower.toFixed(2)} kW`;
      if (elPower) elPower.textContent = `+${currentPower.toFixed(2)} kW (Auxiliares 12V/BMS)`;
      if (fluxBar) {
        fluxBar.style.left = '50%';
        fluxBar.style.width = '2.5%';
        fluxBar.style.background = 'linear-gradient(90deg, #4ce0d2, #6db6ff)';
      }
    }
  }, 2500);
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
        const autoTs = Date.now();
        const autoTrip = {
          id: autoTs,
          timestamp: autoTs,
          title: `Ruta Detectada (${delta} km)`,
          category: 'trabajo',
          date: formatRealTripDate(new Date(autoTs)),
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
  initTractionMonitor();

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

  // Energy source choices & UI synchronization with saved STATE
  const currentSource = STATE.energySource || 'solar';
  document.querySelectorAll('.energy-chip').forEach(chip => {
    chip.classList.toggle('selected', chip.dataset.energy === currentSource);
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

  // --- SOLAR HOME HIGH-TECH ENGINE & SEASON CONTROL ---
  renderSolarHomeScheme();

  // Season pills listener
  const seasonPills = document.querySelectorAll('#season-pills .season-pill');
  seasonPills.forEach(pill => {
    pill.classList.toggle('active', pill.dataset.season === (STATE.solarSeason || 'auto'));
    pill.addEventListener('click', () => {
      seasonPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const selectedSeason = pill.dataset.season;
      STATE.solarSeason = selectedSeason;
      localStorage.setItem('biguaydi-solar-season', selectedSeason);

      // Update solarPct according to season
      const effectiveSeason = (selectedSeason === 'auto') ? getSeasonFromDate(new Date()) : selectedSeason;
      const seasonalPct = getSeasonalSolarPct(effectiveSeason);
      STATE.prices.solarPct = seasonalPct;
      localStorage.setItem('biguaydi-solar-pct', seasonalPct);
      const inputSolarPct = document.getElementById('cfg-solar-pct');
      if (inputSolarPct) inputSolarPct.value = seasonalPct;

      renderSolarHomeScheme();
      updateCalculations();
      renderTrips();

      const seasonNames = {
        spring: 'Primavera (75% solar)',
        summer: 'Verano (90% solar)',
        autumn: 'Otoño (65% solar)',
        winter: 'Invierno (40% solar)',
        auto: 'Automática según fecha de hoy'
      };
      showToast(`☀️ Estación solar: ${seasonNames[selectedSeason] || selectedSeason}`);
    });
  });

  // GPS Geolocation button for solar daylight calculation
  const btnGeo = document.getElementById('btn-geo-sun');
  if (btnGeo) {
    btnGeo.addEventListener('click', () => {
      if (!navigator.geolocation) {
        showToast('Geolocalización no soportada en este navegador');
        return;
      }
      const textSpan = document.getElementById('btn-geo-text');
      if (textSpan) textSpan.textContent = 'Localizando...';
      btnGeo.disabled = true;

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = Number(pos.coords.latitude.toFixed(4));
          const lon = Number(pos.coords.longitude.toFixed(4));
          STATE.solarLocation = { lat, lon, name: `GPS (${lat}°, ${lon}°)` };
          localStorage.setItem('biguaydi-solar-location', JSON.stringify(STATE.solarLocation));
          if (textSpan) textSpan.textContent = `${lat}°, ${lon}°`;
          btnGeo.disabled = false;
          renderSolarHomeScheme();
          updateCalculations();
          renderTrips();
          showToast(`📍 Ubicación fijada: ${lat}°, ${lon}°. Radiación y horas de sol recalculadas.`);
        },
        (err) => {
          btnGeo.disabled = false;
          if (textSpan) textSpan.textContent = 'Mi Ubicación';
          showToast('No se pudo obtener la ubicación (usando latitud de referencia España)');
        },
        { timeout: 10000, enableHighAccuracy: false }
      );
    });
  }

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
