// ============================================================================
// MERCAPROS CUBA - CONTROLADOR INTERACTIVO SUPER-APP (CAREEM + SUPERMARKET 23)
// ============================================================================

let appState = loadMercaprosState();
let cart = [];
let activeCategory = 'all';
let activeSaleFilter = 'ALL'; // ALL | CONTAINER_B2B | WHOLESALE | RETAIL | FLASH
let activeVendorFilter = 'ALL';
let searchQuery = '';
let maxPriceFilter = 40000;
let currentSort = 'featured';
let isAdminAuthenticated = false;
let activeAdminTab = 'tab-catalog';
let editingProductId = null;

// Instancias de Mapas Leaflet (B2C/B2B General + Configurador de Negocio)
let deliveryMap = null;
let userMarker = null;
let vendorMarkers = [];
let routePolyline = null;

// Metadatos y Reglas de Permisos Estrictos por Nivel de Usuario (RBAC)
const ROLE_MATRIX = {
  ALL_VIEW: {
    code: 'ALL_VIEW',
    label: 'Vista General (Todos los Niveles)',
    shortLabel: 'Multinivel',
    icon: 'fa-globe',
    badgeClass: 'bg-amber-900/10 text-amber-900 border-amber-800/30',
    canBuyContainer: true,
    canBuyWholesale: true,
    canBuyRetail: true,
    canSellContainer: true,
    canSellWholesale: true,
    canSellRetail: true,
    description: 'Exploración completa del ecosistema B2B (Contenedores y Mayorista) y B2C (Minorista a Domicilio).'
  },
  EXPORTADOR_B2B: {
    code: 'EXPORTADOR_B2B',
    label: 'Nivel 1 • Exportador Extranjero (Contenedores)',
    shortLabel: 'Exportador B2B',
    icon: 'fa-ship',
    badgeClass: 'bg-emerald-900/15 text-emerald-900 border-emerald-800/30',
    canBuyContainer: true,
    canBuyWholesale: false,
    canBuyRetail: false,
    canSellContainer: true,
    canSellWholesale: false,
    canSellRetail: false,
    description: 'Empresas extranjeras autorizadas a exportar cargas por contenedores (20\' y 40\' Reefer/Dry) CIF Mariel / Habana.'
  },
  MIPYME: {
    code: 'MIPYME',
    label: 'Nivel 2A • Mipyme (Compra Contenedor/Mayor y Vende Mayor/Menor)',
    shortLabel: 'Mipyme B2B/B2C',
    icon: 'fa-building-shield',
    badgeClass: 'bg-amber-800/15 text-amber-900 border-amber-700/30',
    canBuyContainer: true,
    canBuyWholesale: true,
    canBuyRetail: true,
    canSellContainer: false,
    canSellWholesale: true,
    canSellRetail: true,
    description: 'Importa contenedores o compra lotes mayoristas. Habilitada para vender al por mayor (cajas/pallets) y al detalle.'
  },
  TCP: {
    code: 'TCP',
    label: 'Nivel 2B • TCP (Compra Mayor/Menor • Vende SOLO Minorista)',
    shortLabel: 'TCP Cuenta Propia',
    icon: 'fa-store',
    badgeClass: 'bg-teal-900/15 text-teal-900 border-teal-700/30',
    canBuyContainer: false,
    canBuyWholesale: true,
    canBuyRetail: true,
    canSellContainer: false,
    canSellWholesale: false, // REGLA ESTRICTA: TCP solo vende minorista
    canSellRetail: true,
    description: 'Trabajador por Cuenta Propia: Abastece su negocio comprando al por mayor o menor, y vende exclusivamente al detalle (minorista).'
  },
  CLIENTE_B2C: {
    code: 'CLIENTE_B2C',
    label: 'Nivel 3 • Consumidor / Familia (Compra Minorista + Domicilio)',
    shortLabel: 'Cliente Hogar B2C',
    icon: 'fa-house-chimney-user',
    badgeClass: 'bg-stone-800/10 text-stone-900 border-stone-700/25',
    canBuyContainer: false,
    canBuyWholesale: false,
    canBuyRetail: true,
    canSellContainer: false,
    canSellWholesale: false,
    canSellRetail: false,
    description: 'Compras familiares y combos con entrega rápida puerta a puerta en Cuba calculada por kilómetro.'
  }
};

// Cálculo Haversine exacto con factor de tortuosidad vial urbana (1.28x para calles de La Habana/Cuba)
function calculateRoadDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightKm = R * c;
  return Math.max(0.5, Number((straightKm * 1.28).toFixed(1)));
}

// Cálculo del costo de domicilio para un vendedor específico hacia la ubicación GPS del usuario
function calculateVendorDelivery(vendor) {
  if (!vendor || !appState.userGps) {
    return { distanceKm: 2.0, feeUsd: 2.50 };
  }
  const distanceKm = calculateRoadDistanceKm(
    vendor.lat,
    vendor.lng,
    appState.userGps.lat,
    appState.userGps.lng
  );
  const rawFee = Number(vendor.baseDeliveryFeeUsd || 1.5) + (distanceKm * Number(vendor.pricePerKmUsd || 0.5));
  return {
    distanceKm,
    feeUsd: Number(rawFee.toFixed(2))
  };
}

// Formateador de Moneda Multi-Divisa (USD / CUP / MLC)
function formatMoney(amountUsd) {
  const val = Number(amountUsd || 0);
  const curr = appState.currency || 'USD';
  if (curr === 'CUP') {
    const cup = Math.round(val * (appState.rates.CUP || 320));
    return `${cup.toLocaleString('es-CU')} CUP`;
  }
  if (curr === 'MLC') {
    const mlc = (val * (appState.rates.MLC || 1.15)).toFixed(2);
    return `$${Number(mlc).toLocaleString('en-US', { minimumFractionDigits: 2 })} MLC`;
  }
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
}

// Inicialización al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  applyThemeAndConnectivity();
  populateProvinceAndMunicipalitySelectors();
  renderRoleBar();
  renderAnnouncementsBanner();
  renderSuperAppModules();
  renderCategoriesBar();
  renderVendorPills();
  renderCatalog();
  updateCartUI();
  updateGpsHeaderBadge();

  // Sincronización en segundo plano con Supabase
  syncFromSupabase(appState, (status) => {
    const syncEl = document.getElementById('supabase-sync-indicator');
    if (syncEl) {
      syncEl.textContent = status.synced
        ? `Supabase Cloud Activo (${status.count} ítems)`
        : `Dual-Layer Local Instant-Boot (0ms)`;
    }
  });
});

// Aplicar Tema Claro/Oscuro y Modo Con Foto / Sin Imágenes (Especial Conectividad Cuba)
function applyThemeAndConnectivity() {
  const html = document.documentElement;
  if (appState.theme === 'dark') {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }

  if (appState.lowDataMode) {
    document.body.classList.add('low-data-mode');
  } else {
    document.body.classList.remove('low-data-mode');
  }

  // Actualizar botones en barra superior y menú móvil
  const lowDataBtns = document.querySelectorAll('.js-lowdata-toggle-label');
  lowDataBtns.forEach(el => {
    el.innerHTML = appState.lowDataMode
      ? '<i class="fa-solid fa-bolt text-amber-500 mr-1.5"></i>Modo Sin Fotos (Ultra-Rápido)'
      : '<i class="fa-regular fa-image mr-1.5"></i>Versión Con Fotos';
  });

  const lowDataBadges = document.querySelectorAll('.js-lowdata-pill');
  lowDataBadges.forEach(el => {
    if (appState.lowDataMode) {
      el.classList.add('ring-2', 'ring-amber-500', 'bg-amber-500/20');
    } else {
      el.classList.remove('ring-2', 'ring-amber-500', 'bg-amber-500/20');
    }
  });

  const currSelects = document.querySelectorAll('.js-currency-select');
  currSelects.forEach(s => { s.value = appState.currency; });
}

function toggleLowDataMode() {
  appState.lowDataMode = !appState.lowDataMode;
  saveMercaprosState(appState);
  applyThemeAndConnectivity();
  renderCatalog();
  showToast(
    appState.lowDataMode
      ? 'Modo Sin Imágenes activado: Carga instantánea optimizada para datos móviles en Cuba (<18 KB).'
      : 'Modo Con Imágenes activado: Fotografías comprimidas de alta definición.'
  );
}

function toggleThemeMode() {
  appState.theme = appState.theme === 'dark' ? 'light' : 'dark';
  saveMercaprosState(appState);
  applyThemeAndConnectivity();
}

function changeCurrency(newCurr) {
  appState.currency = newCurr;
  saveMercaprosState(appState);
  renderCatalog();
  updateCartUI();
  renderVendorPills();
}

// ============================================================================
// SELECTOR DE NIVEL DE USUARIO (EXPORTADOR / MIPYME / TCP / CLIENTE B2C)
// ============================================================================
function setUserRole(roleCode) {
  if (!ROLE_MATRIX[roleCode]) return;
  appState.currentRole = roleCode;

  // Ajustar negocio activo de demostración cuando cambia el rol para que el Dashboard refleje permisos reales
  if (roleCode === 'EXPORTADOR_B2B') appState.activeVendorId = 'v-exp-01';
  if (roleCode === 'MIPYME') appState.activeVendorId = 'v-mip-01';
  if (roleCode === 'TCP') appState.activeVendorId = 'v-tcp-01';

  saveMercaprosState(appState);
  renderRoleBar();
  renderSuperAppModules();
  renderCategoriesBar();
  renderCatalog();
  if (isAdminAuthenticated) {
    renderAdminDashboard();
  }
  showToast(`Vista cambiada a: ${ROLE_MATRIX[roleCode].label}`);
}

function renderRoleBar() {
  const roleInfo = ROLE_MATRIX[appState.currentRole] || ROLE_MATRIX.ALL_VIEW;
  const bannerEl = document.getElementById('active-role-explainer');
  if (bannerEl) {
    bannerEl.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <span class="w-9 h-9 rounded-xl bg-[#7A5A1E] text-white flex items-center justify-center shadow-sm">
            <i class="fa-solid ${roleInfo.icon}"></i>
          </span>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-bold text-sm tracking-tight">${roleInfo.label}</span>
              <span class="text-[11px] uppercase tracking-wider px-2.5 py-0.5 rounded-full font-semibold border ${roleInfo.badgeClass}">
                Permisos RBAC Activos
              </span>
            </div>
            <p class="text-xs opacity-80 mt-0.5">${roleInfo.description}</p>
          </div>
        </div>
        <div class="flex items-center gap-2 text-xs font-medium">
          <span class="px-2.5 py-1 rounded-lg ${roleInfo.canBuyContainer ? 'bg-emerald-600/15 text-emerald-800 dark:text-emerald-300' : 'bg-stone-500/10 opacity-45 line-through'}">
            <i class="fa-solid fa-ship mr-1"></i>Compra Contenedor
          </span>
          <span class="px-2.5 py-1 rounded-lg ${roleInfo.canBuyWholesale ? 'bg-emerald-600/15 text-emerald-800 dark:text-emerald-300' : 'bg-stone-500/10 opacity-45 line-through'}">
            <i class="fa-solid fa-boxes-stacked mr-1"></i>Compra Mayorista
          </span>
          <span class="px-2.5 py-1 rounded-lg ${roleInfo.canSellWholesale ? 'bg-amber-600/15 text-amber-900 dark:text-amber-300' : 'bg-stone-500/10 opacity-45 line-through'}">
            <i class="fa-solid fa-warehouse mr-1"></i>Vende Mayorista
          </span>
          <span class="px-2.5 py-1 rounded-lg ${roleInfo.canSellRetail ? 'bg-teal-600/15 text-teal-900 dark:text-teal-300' : 'bg-stone-500/10 opacity-45 line-through'}">
            <i class="fa-solid fa-bag-shopping mr-1"></i>Vende Minorista
          </span>
        </div>
      </div>
    `;
  }

  document.querySelectorAll('.js-role-btn').forEach(btn => {
    const code = btn.getAttribute('data-role');
    if (code === appState.currentRole) {
      btn.className = 'js-role-btn px-3.5 py-2 rounded-full text-xs font-bold transition-all bg-[#14201B] text-[#F6F1E7] dark:bg-[#D9B76F] dark:text-[#09100D] shadow-sm flex items-center gap-1.5';
    } else {
      btn.className = 'js-role-btn px-3.5 py-2 rounded-full text-xs font-semibold transition-all bg-white/70 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 border border-stone-300/70 dark:border-white/10 flex items-center gap-1.5';
    }
  });
}

// ============================================================================
// SUPER-APP BENTO MODULES (INSPIRADO EN CAREEM / CREEME + OFERTAS CUBA)
// ============================================================================
function renderSuperAppModules() {
  const container = document.getElementById('superapp-modules-grid');
  if (!container) return;

  const cards = [
    {
      id: 'mod-containers',
      title: 'Puerto & Contenedores',
      subtitle: 'Exportadores -> Mipymes (20\'/40\' CIF Mariel)',
      badge: 'Nivel 1 B2B',
      icon: 'fa-ship',
      accent: 'from-emerald-900 to-teal-950 text-amber-100',
      action: () => { setSaleModeFilter('CONTAINER_B2B'); }
    },
    {
      id: 'mod-wholesale',
      title: 'Abasto Mayorista',
      subtitle: 'Mipymes -> TCP y Negocios (Cajas y Sacos)',
      badge: 'Nivel 2 B2B',
      icon: 'fa-boxes-stacked',
      accent: 'from-amber-900 to-stone-900 text-amber-50',
      action: () => { setSaleModeFilter('WHOLESALE'); }
    },
    {
      id: 'mod-retail',
      title: 'Súper & Combos Hogar',
      subtitle: 'Mipymes y TCP -> Familias en Cuba (Al Detalle)',
      badge: 'B2C Domicilio',
      icon: 'fa-basket-shopping',
      accent: 'from-stone-800 to-stone-950 text-stone-100',
      action: () => { setSaleModeFilter('RETAIL'); }
    },
    {
      id: 'mod-gps',
      title: 'Rastreo & Tarifa x Km',
      subtitle: `Entrega en ${appState.selectedMunicipality.split('(')[0]}`,
      badge: 'Mapa En Vivo',
      icon: 'fa-map-location-dot',
      accent: 'from-[#7A5A1E] to-[#4A3510] text-white',
      action: () => { openDeliveryMapModal(); }
    }
  ];

  container.innerHTML = cards.map((c, idx) => `
    <button onclick="triggerSuperAppModule(${idx})" class="text-left group relative overflow-hidden rounded-3xl p-5 bg-gradient-to-br ${c.accent} shadow-md hover:shadow-xl transition-all border border-white/15 flex flex-col justify-between min-h-[138px]">
      <div class="flex items-center justify-between w-full">
        <span class="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm">
          ${c.badge}
        </span>
        <span class="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">
          <i class="fa-solid ${c.icon}"></i>
        </span>
      </div>
      <div class="mt-4">
        <h3 class="font-display text-lg font-bold leading-snug">${c.title}</h3>
        <p class="text-xs opacity-85 mt-0.5 flex items-center justify-between">
          <span>${c.subtitle}</span>
          <i class="fa-solid fa-arrow-right text-[11px] group-hover:translate-x-1 transition-transform"></i>
        </p>
      </div>
    </button>
  `).join('');
}

function triggerSuperAppModule(index) {
  if (index === 0) setSaleModeFilter('CONTAINER_B2B');
  if (index === 1) setSaleModeFilter('WHOLESALE');
  if (index === 2) setSaleModeFilter('RETAIL');
  if (index === 3) openDeliveryMapModal();
}

// ============================================================================
// ANUNCIOS Y MARQUESINA DE OFERTAS
// ============================================================================
function renderAnnouncementsBanner() {
  const bar = document.getElementById('top-announcements-bar');
  if (!bar) return;
  const activeAnns = (appState.announcements || []).filter(a => a.active);
  if (activeAnns.length === 0) {
    bar.innerHTML = '';
    return;
  }
  bar.innerHTML = activeAnns.map(a => `
    <div class="flex items-center gap-2 text-xs">
      <span class="px-2 py-0.5 rounded-full bg-[#D9B76F] text-[#14201B] font-extrabold text-[10px] tracking-wider uppercase">${a.badge}</span>
      <span class="font-semibold">${a.title}:</span>
      <span class="opacity-85 hidden md:inline">${a.subtitle}</span>
      ${a.code ? `<span class="px-2 py-0.5 rounded bg-white/15 font-mono text-[11px] border border-white/20">${a.code}</span>` : ''}
    </div>
  `).join('<span class="mx-4 opacity-40">•</span>');
}

// ============================================================================
// CATEGORÍAS (INSPIRADAS EN SUPERMARKET 23) + FILTROS DE OFERTAS
// ============================================================================
function renderCategoriesBar() {
  const bar = document.getElementById('categories-scroll-bar');
  if (!bar) return;

  bar.innerHTML = appState.categories.map(cat => {
    const isActive = activeCategory === cat.id;
    return `
      <button onclick="selectCategory('${cat.id}')" class="shrink-0 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2.5 border ${
        isActive
          ? 'bg-[#14201B] text-[#F6F1E7] dark:bg-[#D9B76F] dark:text-[#09100D] border-transparent shadow-md'
          : 'bg-[#FFFDF8] dark:bg-[#121D18] hover:border-[#7A5A1E] border-stone-200 dark:border-white/10'
      }">
        <i class="fa-solid ${cat.icon} ${isActive ? 'text-[#D9B76F] dark:text-[#09100D]' : 'text-[#7A5A1E] dark:text-[#D9B76F]'}"></i>
        <span>${cat.name}</span>
        <span class="text-[10px] px-2 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white dark:bg-black/20 dark:text-black' : 'bg-stone-200/70 dark:bg-white/10 opacity-75'}">${cat.badge}</span>
      </button>
    `;
  }).join('');
}

function selectCategory(catId) {
  activeCategory = catId;
  renderCategoriesBar();
  renderCatalog();
}

function setSaleModeFilter(mode) {
  activeSaleFilter = mode;
  document.querySelectorAll('.js-salemode-pill').forEach(btn => {
    const m = btn.getAttribute('data-mode');
    if (m === mode) {
      btn.className = 'js-salemode-pill px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#7A5A1E] text-white shadow-sm transition-all';
    } else {
      btn.className = 'js-salemode-pill px-3.5 py-1.5 rounded-full text-xs font-semibold bg-stone-200/70 dark:bg-white/10 hover:bg-stone-300/70 transition-all';
    }
  });
  renderCatalog();
}

function handleSearchInput(val) {
  searchQuery = (val || '').trim().toLowerCase();
  renderCatalog();
}

function handleSortChange(val) {
  currentSort = val;
  renderCatalog();
}

// ============================================================================
// TARJETAS DE NEGOCIOS VERIFICADOS (MIPYMES / TCP / EXPORTADORES) + TARIFA KM
// ============================================================================
function renderVendorPills() {
  const container = document.getElementById('vendors-showcase-grid');
  if (!container) return;

  container.innerHTML = appState.vendors.map(v => {
    const deliv = calculateVendorDelivery(v);
    const isSelected = activeVendorFilter === v.id;
    const roleBadgeColor =
      v.role === 'EXPORTADOR_B2B'
        ? 'bg-emerald-900/15 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200'
        : v.role === 'MIPYME'
        ? 'bg-amber-900/15 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200'
        : 'bg-teal-900/15 text-teal-900 dark:bg-teal-500/20 dark:text-teal-200';

    return `
      <div class="rounded-3xl p-4 bg-[#FFFDF8] dark:bg-[#121D18] border ${isSelected ? 'border-[#7A5A1E] ring-2 ring-[#7A5A1E]/30' : 'border-stone-200/80 dark:border-white/10'} shadow-sm flex flex-col justify-between transition-all">
        <div>
          <div class="flex items-start justify-between gap-2">
            <span class="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${roleBadgeColor}">
              ${v.badge}
            </span>
            <a href="https://wa.me/${v.whatsapp}" target="_blank" rel="noopener" aria-label="WhatsApp" class="w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-sm transition-transform hover:scale-105">
              <i class="fa-brands fa-whatsapp text-base"></i>
            </a>
          </div>
          <h4 class="font-display font-bold text-base mt-2 flex items-center gap-1.5">
            <span>${v.name}</span>
            <i class="fa-solid fa-circle-check text-[#7A5A1E] dark:text-[#D9B76F] text-xs" title="Negocio Verificado"></i>
          </h4>
          <p class="text-xs opacity-75 mt-1 line-clamp-2">${v.description}</p>
        </div>

        <div class="mt-3 pt-3 border-t border-stone-200/70 dark:border-white/10 flex flex-col gap-2 text-xs">
          <div class="flex items-center justify-between">
            <span class="opacity-75"><i class="fa-solid fa-route mr-1 text-[#7A5A1E] dark:text-[#D9B76F]"></i>Distancia a ti:</span>
            <span class="font-bold">${deliv.distanceKm} km</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="opacity-75"><i class="fa-solid fa-truck-fast mr-1 text-[#7A5A1E] dark:text-[#D9B76F]"></i>Tarifa Domicilio:</span>
            <span class="font-bold text-emerald-800 dark:text-emerald-300">${formatMoney(deliv.feeUsd)} <span class="text-[10px] opacity-75">(${formatMoney(v.pricePerKmUsd)}/km)</span></span>
          </div>
          <div class="flex items-center justify-between pt-1">
            <a href="${v.gmapsUrl}" target="_blank" rel="noopener" class="text-[11px] font-semibold underline hover:text-[#7A5A1E] flex items-center gap-1">
              <i class="fa-solid fa-star text-amber-500"></i> ${v.rating} (${v.reviewsCount} reseñas Google Maps)
            </a>
            <button onclick="filterByVendor('${v.id}')" class="text-[11px] font-bold px-2.5 py-1 rounded-lg ${isSelected ? 'bg-[#14201B] text-white dark:bg-[#D9B76F] dark:text-black' : 'bg-stone-200/70 dark:bg-white/10'}">
              ${isSelected ? 'Viendo Todo' : 'Ver Inventario'}
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function filterByVendor(vendorId) {
  activeVendorFilter = activeVendorFilter === vendorId ? 'ALL' : vendorId;
  renderVendorPills();
  renderCatalog();
}

// ============================================================================
// RENDERIZADO DEL CATÁLOGO CON PERMISOS RBAC + MODO CON/SIN IMÁGENES
// ============================================================================
function renderCatalog() {
  const grid = document.getElementById('catalog-products-grid');
  const countEl = document.getElementById('catalog-results-count');
  if (!grid) return;

  const role = ROLE_MATRIX[appState.currentRole] || ROLE_MATRIX.ALL_VIEW;

  let filtered = appState.products.filter(p => {
    // Filtro por Categoría
    if (activeCategory !== 'all' && p.category !== activeCategory) return false;

    // Filtro por Vendedor
    if (activeVendorFilter !== 'ALL' && p.vendorId !== activeVendorFilter) return false;

    // Filtro por Modo de Venta / Oferta Relámpago
    if (activeSaleFilter === 'CONTAINER_B2B' && !p.saleModes.includes('CONTAINER_B2B')) return false;
    if (activeSaleFilter === 'WHOLESALE' && !p.saleModes.includes('WHOLESALE')) return false;
    if (activeSaleFilter === 'RETAIL' && !p.saleModes.includes('RETAIL')) return false;
    if (activeSaleFilter === 'FLASH' && !p.isFlashOffer) return false;

    // Filtro por Búsqueda
    if (searchQuery) {
      const haystack = `${p.title} ${p.sku} ${p.vendorName} ${p.specs} ${p.description}`.toLowerCase();
      if (!haystack.includes(searchQuery)) return false;
    }

    return true;
  });

  // Ordenamiento
  if (currentSort === 'price-asc') {
    filtered.sort((a, b) => (a.priceRetailUsd || a.priceWholesaleUsd) - (b.priceRetailUsd || b.priceWholesaleUsd));
  } else if (currentSort === 'price-desc') {
    filtered.sort((a, b) => (b.priceRetailUsd || b.priceWholesaleUsd) - (a.priceRetailUsd || a.priceWholesaleUsd));
  } else if (currentSort === 'discount') {
    filtered.sort((a, b) => (b.discountPct || 0) - (a.discountPct || 0));
  }

  if (countEl) {
    countEl.textContent = `${filtered.length} producto${filtered.length === 1 ? '' : 's'} disponible${filtered.length === 1 ? '' : 's'}`;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full rounded-3xl p-10 text-center bg-[#FFFDF8] dark:bg-[#121D18] border border-stone-200 dark:border-white/10">
        <i class="fa-solid fa-box-open text-3xl text-[#7A5A1E] mb-3"></i>
        <h3 class="font-display text-xl font-bold">No se encontraron productos con estos filtros</h3>
        <p class="text-xs opacity-75 mt-1">Prueba cambiando la categoría o seleccionando "Todos los Productos".</p>
        <button onclick="selectCategory('all'); setSaleModeFilter('ALL'); activeVendorFilter='ALL'; renderVendorPills(); renderCatalog();" class="mt-4 px-5 py-2.5 rounded-full bg-[#14201B] text-white text-xs font-bold">
          Restablecer Filtros
        </button>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const vendor = appState.vendors.find(v => v.id === p.vendorId) || appState.vendors[0];
    const deliv = calculateVendorDelivery(vendor);

    const isContainerItem = p.saleModes.includes('CONTAINER_B2B');
    const hasWholesale = p.saleModes.includes('WHOLESALE');
    const hasRetail = p.saleModes.includes('RETAIL');

    // Validar permisos de compra según el nivel activo del usuario
    const canBuyThisContainer = isContainerItem && role.canBuyContainer;
    const canBuyThisWholesale = hasWholesale && role.canBuyWholesale;
    const canBuyThisRetail = hasRetail && role.canBuyRetail;

    // Bloque visual o de texto ultraligero (según Modo Con Foto o Sin Imágenes)
    const mediaHtml = appState.lowDataMode
      ? `
        <div class="p-3.5 rounded-2xl bg-stone-100 dark:bg-white/5 border border-dashed border-stone-300 dark:border-white/15 flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <span class="w-9 h-9 rounded-xl bg-[#7A5A1E]/15 text-[#7A5A1E] dark:text-[#D9B76F] flex items-center justify-center font-bold text-sm">
              <i class="fa-solid ${isContainerItem ? 'fa-ship' : 'fa-box-archive'}"></i>
            </span>
            <div>
              <span class="text-[11px] font-mono font-bold uppercase opacity-75">SKU: ${p.sku}</span>
              <p class="text-xs font-semibold text-emerald-800 dark:text-emerald-300">${p.incoterm} • Stock: ${p.stock}</p>
            </div>
          </div>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-900 dark:text-amber-200">
            0 KB Foto
          </span>
        </div>
      `
      : `
        <div class="relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-stone-200 dark:bg-stone-900">
          <img src="${p.image}" alt="${p.title}" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          <div class="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
            ${p.isFlashOffer ? `<span class="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-red-600 text-white shadow">-${p.discountPct}% Oferta</span>` : ''}
            <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#14201B]/85 text-[#F6F1E7] backdrop-blur-sm">
              ${isContainerItem ? 'Contenedor B2B' : p.vendorRole === 'TCP' ? 'TCP Solo Minorista' : 'Mipyme Mayor/Menor'}
            </span>
          </div>
          <a href="https://wa.me/${vendor.whatsapp}" target="_blank" rel="noopener" aria-label="WhatsApp" class="absolute bottom-2.5 right-2.5 w-9 h-9 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg">
            <i class="fa-brands fa-whatsapp text-lg"></i>
          </a>
        </div>
      `;

    // Precios desglosados según modalidad
    let pricingBlock = '';
    if (isContainerItem) {
      pricingBlock = `
        <div class="p-3 rounded-2xl bg-emerald-950/5 dark:bg-emerald-500/10 border border-emerald-800/20">
          <div class="flex items-baseline justify-between">
            <span class="text-[11px] font-bold uppercase text-emerald-900 dark:text-emerald-300">Precio Contenedor CIF</span>
            <span class="text-xs line-through opacity-60">${formatMoney(p.oldPriceUsd)}</span>
          </div>
          <div class="text-xl font-extrabold tracking-tight mt-0.5">${formatMoney(p.priceContainerUsd)}</div>
          <div class="text-[11px] opacity-75 mt-0.5">${p.unitRetail}</div>
        </div>
      `;
    } else {
      pricingBlock = `
        <div class="grid ${hasWholesale ? 'grid-cols-2' : 'grid-cols-1'} gap-2">
          ${hasRetail ? `
            <div class="p-2.5 rounded-2xl bg-stone-100/90 dark:bg-white/5 border border-stone-200/80 dark:border-white/10">
              <span class="text-[10px] font-bold uppercase opacity-70 block">Minorista (Detalle)</span>
              <span class="text-base font-extrabold text-[#14201B] dark:text-[#F2EDE0]">${formatMoney(p.priceRetailUsd)}</span>
              <span class="text-[10px] opacity-75 block truncate" title="${p.unitRetail}">${p.unitRetail}</span>
            </div>
          ` : ''}
          ${hasWholesale ? `
            <div class="p-2.5 rounded-2xl bg-amber-900/10 dark:bg-amber-500/10 border border-amber-800/25">
              <span class="text-[10px] font-bold uppercase text-amber-900 dark:text-amber-300 block">Mayorista (Mín. ${p.minWholesaleQty})</span>
              <span class="text-base font-extrabold text-amber-950 dark:text-amber-200">${formatMoney(p.priceWholesaleUsd)}</span>
              <span class="text-[10px] opacity-80 block truncate" title="${p.unitWholesale}">${p.unitWholesale}</span>
            </div>
          ` : `
            <div class="px-2.5 py-1.5 rounded-xl bg-teal-900/10 text-teal-900 dark:text-teal-300 text-[11px] font-semibold flex items-center gap-1.5">
              <i class="fa-solid fa-shield-halved"></i> TCP: Autorizado exclusivamente para venta minorista al detalle
            </div>
          `}
        </div>
      `;
    }

    // Botones de Acción Sobrios ("Comprar" respetando la regla y el modo de compra permitido por nivel)
    let actionButtons = '';
    if (isContainerItem) {
      actionButtons = canBuyThisContainer
        ? `<button onclick="addToCart('${p.id}', 'CONTAINER_B2B')" class="w-full py-2.5 px-4 rounded-xl bg-[#14201B] hover:bg-[#7A5A1E] dark:bg-[#D9B76F] dark:text-[#09100D] text-white font-bold text-xs transition-all shadow-sm">
            Comprar
          </button>`
        : `<button disabled class="w-full py-2.5 px-4 rounded-xl bg-stone-300 dark:bg-white/10 text-stone-600 dark:text-stone-400 font-semibold text-xs cursor-not-allowed">
            Requiere Nivel Mipyme / Importador
          </button>`;
    } else {
      const retailBtn = canBuyThisRetail
        ? `<button onclick="addToCart('${p.id}', 'RETAIL')" class="flex-1 py-2.5 px-3 rounded-xl bg-[#14201B] hover:bg-[#7A5A1E] dark:bg-[#D9B76F] dark:text-[#09100D] text-white font-bold text-xs transition-all">
            Comprar
          </button>`
        : '';
      const wholesaleBtn = (hasWholesale && canBuyThisWholesale)
        ? `<button onclick="addToCart('${p.id}', 'WHOLESALE')" class="flex-1 py-2.5 px-3 rounded-xl bg-[#7A5A1E] hover:bg-amber-800 text-white font-bold text-xs transition-all" title="Compra Mayorista (${p.unitWholesale})">
            Comprar (${p.minWholesaleQty}+)
          </button>`
        : '';
      actionButtons = `<div class="flex items-center gap-2">${retailBtn}${wholesaleBtn}</div>`;
    }

    return `
      <article class="group rounded-3xl p-4 bg-[#FFFDF8] dark:bg-[#121D18] border border-stone-200/90 dark:border-white/10 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between gap-3">
        <div class="space-y-3">
          ${mediaHtml}
          <div>
            <div class="flex items-center justify-between text-[11px] opacity-75">
              <span class="font-semibold truncate">${p.vendorName}</span>
              <span class="shrink-0 font-bold text-emerald-800 dark:text-emerald-300">
                <i class="fa-solid fa-location-arrow mr-0.5"></i>${deliv.distanceKm} km • ${formatMoney(deliv.feeUsd)}
              </span>
            </div>
            <h3 class="font-display font-bold text-base leading-snug mt-1 line-clamp-2">${p.title}</h3>
            <p class="text-[11px] font-medium text-[#7A5A1E] dark:text-[#D9B76F] mt-1">${p.specs}</p>
            <p class="text-xs opacity-75 mt-1 line-clamp-2">${p.description}</p>
          </div>
        </div>

        <div class="space-y-2.5 pt-2 border-t border-stone-200/60 dark:border-white/10">
          ${pricingBlock}
          ${actionButtons}
        </div>
      </article>
    `;
  }).join('');
}

// ============================================================================
// CARRITO MULTINIVEL + CÁLCULO DE DOMICILIO GPS POR KILÓMETRO
// ============================================================================
function addToCart(productId, mode) {
  const product = appState.products.find(p => String(p.id) === String(productId));
  if (!product) return;

  const unitPriceUsd =
    mode === 'CONTAINER_B2B'
      ? Number(product.priceContainerUsd)
      : mode === 'WHOLESALE'
      ? Number(product.priceWholesaleUsd)
      : Number(product.priceRetailUsd);

  const minQty = mode === 'WHOLESALE' ? Number(product.minWholesaleQty || 1) : 1;
  const cartKey = `${product.id}__${mode}`;

  const existing = cart.find(item => item.cartKey === cartKey);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      cartKey,
      productId: String(product.id),
      title: product.title,
      vendorId: product.vendorId,
      vendorName: product.vendorName,
      mode,
      unitLabel: mode === 'WHOLESALE' ? product.unitWholesale : product.unitRetail,
      unitPriceUsd,
      qty: minQty
    });
  }

  updateCartUI();
  showToast(`Añadido al pedido: ${product.title} (${mode === 'WHOLESALE' ? 'Mayorista' : mode === 'CONTAINER_B2B' ? 'Contenedor B2B' : 'Minorista'})`);
}

function updateCartItemQty(cartKey, delta) {
  const idx = cart.findIndex(i => i.cartKey === cartKey);
  if (idx === -1) return;
  cart[idx].qty += delta;
  if (cart[idx].qty <= 0) {
    cart.splice(idx, 1);
  }
  updateCartUI();
}

function updateCartUI() {
  const countBadges = document.querySelectorAll('.js-cart-count');
  const totalItems = cart.reduce((acc, item) => acc + item.qty, 0);
  countBadges.forEach(b => { b.textContent = totalItems; });

  const listEl = document.getElementById('cart-items-list');
  const summaryEl = document.getElementById('cart-totals-summary');
  if (!listEl || !summaryEl) return;

  if (cart.length === 0) {
    listEl.innerHTML = `
      <div class="text-center py-12 opacity-70">
        <i class="fa-solid fa-cart-flatbed-suitcase text-3xl mb-2 text-[#7A5A1E]"></i>
        <p class="text-sm font-semibold">Tu carrito B2B / B2C está vacío</p>
        <p class="text-xs mt-1">Agrega combos familiares, cajas mayoristas o contenedores.</p>
      </div>
    `;
    summaryEl.innerHTML = '';
    return;
  }

  let subtotalUsd = 0;
  const uniqueVendorIds = new Set();

  listEl.innerHTML = cart.map(item => {
    const lineUsd = item.unitPriceUsd * item.qty;
    subtotalUsd += lineUsd;
    uniqueVendorIds.add(item.vendorId);

    return `
      <div class="p-3.5 rounded-2xl bg-stone-100/80 dark:bg-white/5 border border-stone-200 dark:border-white/10 flex items-center justify-between gap-3">
        <div class="min-w-0 flex-1">
          <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#7A5A1E]/15 text-[#7A5A1E] dark:text-[#D9B76F]">
            ${item.mode === 'WHOLESALE' ? 'Mayorista' : item.mode === 'CONTAINER_B2B' ? 'Contenedor CIF' : 'Minorista'}
          </span>
          <h4 class="font-bold text-xs mt-1 truncate">${item.title}</h4>
          <p class="text-[11px] opacity-75">${item.vendorName} • ${item.unitLabel}</p>
          <p class="text-xs font-extrabold mt-1">${formatMoney(lineUsd)}</p>
        </div>
        <div class="flex items-center gap-1.5">
          <button onclick="updateCartItemQty('${item.cartKey}', -1)" class="w-7 h-7 rounded-lg bg-white dark:bg-white/10 border border-stone-300 dark:border-white/10 font-bold text-xs">-</button>
          <span class="w-7 text-center font-bold text-xs">${item.qty}</span>
          <button onclick="updateCartItemQty('${item.cartKey}', 1)" class="w-7 h-7 rounded-lg bg-white dark:bg-white/10 border border-stone-300 dark:border-white/10 font-bold text-xs">+</button>
        </div>
      </div>
    `;
  }).join('');

  // Calcular envío sumando la ruta GPS real de cada negocio involucrado
  let totalDeliveryUsd = 0;
  let routeDetailsHtml = '';
  uniqueVendorIds.forEach(vid => {
    const vendor = appState.vendors.find(v => v.id === vid);
    if (vendor) {
      const d = calculateVendorDelivery(vendor);
      totalDeliveryUsd += d.feeUsd;
      routeDetailsHtml += `
        <div class="flex justify-between text-[11px] opacity-80">
          <span>Ruta ${vendor.name} (${d.distanceKm} km @ ${formatMoney(vendor.pricePerKmUsd)}/km):</span>
          <span class="font-semibold">${formatMoney(d.feeUsd)}</span>
        </div>
      `;
    }
  });

  const grandTotalUsd = subtotalUsd + totalDeliveryUsd;

  summaryEl.innerHTML = `
    <div class="space-y-2 pt-3 border-t border-stone-200 dark:border-white/10 text-xs">
      <div class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-600/20">
        <div class="font-bold flex items-center justify-between">
          <span><i class="fa-solid fa-location-dot mr-1 text-[#7A5A1E]"></i>Destino: ${appState.selectedMunicipality}</span>
          <button onclick="openDeliveryMapModal()" class="underline text-[#7A5A1E] dark:text-[#D9B76F]">Ajustar en Mapa</button>
        </div>
        <p class="text-[11px] opacity-80 mt-0.5">${appState.userGps.address}</p>
      </div>
      ${routeDetailsHtml}
      <div class="flex justify-between font-semibold pt-1">
        <span>Subtotal Productos:</span>
        <span>${formatMoney(subtotalUsd)}</span>
      </div>
      <div class="flex justify-between font-semibold text-emerald-800 dark:text-emerald-300">
        <span>Domicilio GPS Total:</span>
        <span>${formatMoney(totalDeliveryUsd)}</span>
      </div>
      <div class="flex justify-between text-base font-extrabold pt-2 border-t border-stone-200 dark:border-white/10">
        <span>Total a Pagar:</span>
        <span>${formatMoney(grandTotalUsd)}</span>
      </div>
    </div>
  `;
}

function submitCheckoutOrder() {
  if (cart.length === 0) {
    showToast('Agrega al menos un producto antes de confirmar el pedido.');
    return;
  }
  const customerNameInput = document.getElementById('checkout-customer-name');
  const customerNotesInput = document.getElementById('checkout-customer-notes');
  const customerName = (customerNameInput && customerNameInput.value.trim()) || 'Cliente Verificado Cuba';

  let subtotalUsd = 0;
  let deliveryUsd = 0;
  const vendorSet = new Set();
  cart.forEach(i => {
    subtotalUsd += i.unitPriceUsd * i.qty;
    vendorSet.add(i.vendorId);
  });
  let firstVendor = appState.vendors[0];
  let distKm = 2.1;
  vendorSet.forEach(vid => {
    const v = appState.vendors.find(x => x.id === vid);
    if (v) {
      firstVendor = v;
      const d = calculateVendorDelivery(v);
      distKm = d.distanceKm;
      deliveryUsd += d.feeUsd;
    }
  });

  const newOrder = {
    id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
    date: new Date().toISOString().slice(0, 16).replace('T', ' '),
    customerName,
    customerRole: appState.currentRole,
    vendorName: firstVendor.name,
    orderType: cart.some(i => i.mode === 'CONTAINER_B2B')
      ? 'IMPORTACIÓN CONTENEDOR (B2B)'
      : cart.some(i => i.mode === 'WHOLESALE')
      ? 'MAYORISTA B2B'
      : 'MINORISTA DOMICILIO (B2C)',
    municipality: appState.selectedMunicipality,
    distanceKm: distKm,
    deliveryUsd: Number(deliveryUsd.toFixed(2)),
    subtotalUsd: Number(subtotalUsd.toFixed(2)),
    totalUsd: Number((subtotalUsd + deliveryUsd).toFixed(2)),
    status: 'Confirmado • En Despacho GPS',
    itemsSummary: cart.map(i => `${i.qty}x ${i.title}`).join(', ') + (customerNotesInput && customerNotesInput.value ? ` | Nota: ${customerNotesInput.value}` : '')
  };

  appState.orders.unshift(newOrder);
  saveMercaprosState(appState);
  cart = [];
  updateCartUI();
  toggleCartDrawer(false);
  showToast(`Pedido ${newOrder.id} registrado con éxito. Rastreo GPS activo hacia ${appState.selectedMunicipality}.`);
}

function toggleCartDrawer(show) {
  const drawer = document.getElementById('cart-drawer-modal');
  if (!drawer) return;
  if (show) {
    drawer.classList.remove('hidden');
    updateCartUI();
  } else {
    drawer.classList.add('hidden');
  }
}

// ============================================================================
// SISTEMA DE DOMICILIO Y MAPA INTERACTIVO GPS (LEAFLET + PRECIO POR KM)
// ============================================================================
function populateProvinceAndMunicipalitySelectors() {
  const provSelect = document.getElementById('header-province-select');
  const munSelect = document.getElementById('header-municipality-select');
  if (!provSelect || !munSelect) return;

  const provinces = Object.keys(CUBA_GEO);
  provSelect.innerHTML = provinces.map(p => `<option value="${p}" ${p === appState.selectedProvince ? 'selected' : ''}>${p}</option>`).join('');

  updateMunicipalityDropdown(appState.selectedProvince, appState.selectedMunicipality);
}

function updateMunicipalityDropdown(provinceName, selectedMunName) {
  const munSelect = document.getElementById('header-municipality-select');
  if (!munSelect) return;
  const list = CUBA_GEO[provinceName] || CUBA_GEO["La Habana"];
  munSelect.innerHTML = list.map(m => `<option value="${m.name}" ${m.name === selectedMunName ? 'selected' : ''}>${m.name}</option>`).join('');
}

function onProvinceChange(newProv) {
  appState.selectedProvince = newProv;
  const firstMun = (CUBA_GEO[newProv] && CUBA_GEO[newProv][0]) || CUBA_GEO["La Habana"][0];
  appState.selectedMunicipality = firstMun.name;
  appState.userGps.lat = firstMun.lat;
  appState.userGps.lng = firstMun.lng;
  appState.userGps.address = `${firstMun.name}, ${newProv}, Cuba`;
  saveMercaprosState(appState);
  updateMunicipalityDropdown(newProv, firstMun.name);
  refreshAllLocationDependentViews();
}

function onMunicipalityChange(newMun) {
  const list = CUBA_GEO[appState.selectedProvince] || CUBA_GEO["La Habana"];
  const found = list.find(m => m.name === newMun) || list[0];
  if (found) {
    appState.selectedMunicipality = found.name;
    appState.userGps.lat = found.lat;
    appState.userGps.lng = found.lng;
    appState.userGps.address = `${found.name}, ${appState.selectedProvince}, Cuba`;
    saveMercaprosState(appState);
    refreshAllLocationDependentViews();
  }
}

function refreshAllLocationDependentViews() {
  updateGpsHeaderBadge();
  renderSuperAppModules();
  renderVendorPills();
  renderCatalog();
  updateCartUI();
  if (deliveryMap && userMarker) {
    userMarker.setLatLng([appState.userGps.lat, appState.userGps.lng]);
    deliveryMap.setView([appState.userGps.lat, appState.userGps.lng], 13);
    renderMapVendorDistancesTable();
  }
}

function updateGpsHeaderBadge() {
  const addrInput = document.getElementById('map-user-address-input');
  if (addrInput) addrInput.value = appState.userGps.address;
  const coordsBadge = document.getElementById('map-user-coords-badge');
  if (coordsBadge) {
    coordsBadge.textContent = `GPS: ${appState.userGps.lat.toFixed(4)}, ${appState.userGps.lng.toFixed(4)}`;
  }
}

function openDeliveryMapModal() {
  const modal = document.getElementById('delivery-map-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  updateGpsHeaderBadge();

  setTimeout(() => {
    initOrRefreshLeafletMap();
    renderMapVendorDistancesTable();
  }, 120);
}

function closeDeliveryMapModal() {
  const modal = document.getElementById('delivery-map-modal');
  if (modal) modal.classList.add('hidden');
}

function initOrRefreshLeafletMap() {
  const mapContainer = document.getElementById('cuba-leaflet-map');
  if (!mapContainer || typeof L === 'undefined') return;

  if (!deliveryMap) {
    deliveryMap = L.map('cuba-leaflet-map').setView([appState.userGps.lat, appState.userGps.lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap • Mercapros Logística Cuba'
    }).addTo(deliveryMap);

    // Pin arrastrable del cliente
    userMarker = L.marker([appState.userGps.lat, appState.userGps.lng], { draggable: true })
      .addTo(deliveryMap)
      .bindPopup('<b>Tu Punto de Entrega en Cuba</b><br>Arrastra el pin o haz clic en el mapa.')
      .openPopup();

    userMarker.on('dragend', (e) => {
      const pos = e.target.getLatLng();
      updateUserCoordinatesFromMap(pos.lat, pos.lng);
    });

    deliveryMap.on('click', (e) => {
      updateUserCoordinatesFromMap(e.latlng.lat, e.latlng.lng);
    });
  } else {
    deliveryMap.invalidateSize();
    deliveryMap.setView([appState.userGps.lat, appState.userGps.lng], 13);
    userMarker.setLatLng([appState.userGps.lat, appState.userGps.lng]);
  }

  // Dibujar almacenes de Mipymes, TCP y Puerto Mariel
  vendorMarkers.forEach(m => deliveryMap.removeLayer(m));
  vendorMarkers = [];

  appState.vendors.forEach(v => {
    const m = L.circleMarker([v.lat, v.lng], {
      radius: 9,
      fillColor: v.role === 'EXPORTADOR_B2B' ? '#065f46' : v.role === 'MIPYME' ? '#7A5A1E' : '#0f766e',
      color: '#ffffff',
      weight: 2,
      fillOpacity: 0.95
    })
      .addTo(deliveryMap)
      .bindPopup(`<b>${v.name}</b><br>${v.badge}<br>Tarifa: $${v.pricePerKmUsd}/km + base $${v.baseDeliveryFeeUsd}`);
    vendorMarkers.push(m);
  });

  drawRouteLineToActiveVendor();
}

function drawRouteLineToActiveVendor() {
  if (!deliveryMap) return;
  if (routePolyline) {
    deliveryMap.removeLayer(routePolyline);
  }
  const activeVendor = appState.vendors.find(v => v.id === appState.activeVendorId) || appState.vendors[1];
  if (activeVendor) {
    routePolyline = L.polyline(
      [
        [activeVendor.lat, activeVendor.lng],
        [appState.userGps.lat, appState.userGps.lng]
      ],
      { color: '#7A5A1E', weight: 3, dashArray: '6, 8' }
    ).addTo(deliveryMap);
  }
}

function updateUserCoordinatesFromMap(lat, lng) {
  appState.userGps.lat = Number(lat.toFixed(5));
  appState.userGps.lng = Number(lng.toFixed(5));
  userMarker.setLatLng([appState.userGps.lat, appState.userGps.lng]);
  drawRouteLineToActiveVendor();
  saveMercaprosState(appState);
  updateGpsHeaderBadge();
  renderMapVendorDistancesTable();
  renderVendorPills();
  renderCatalog();
  updateCartUI();
}

function saveCustomUserAddress() {
  const addrInput = document.getElementById('map-user-address-input');
  if (addrInput && addrInput.value.trim()) {
    appState.userGps.address = addrInput.value.trim();
    saveMercaprosState(appState);
    updateCartUI();
    showToast('Dirección exacta y coordenadas GPS guardadas para tus envíos.');
    closeDeliveryMapModal();
  }
}

function renderMapVendorDistancesTable() {
  const tbody = document.getElementById('map-vendor-tariffs-tbody');
  if (!tbody) return;

  tbody.innerHTML = appState.vendors.map(v => {
    const d = calculateVendorDelivery(v);
    return `
      <tr class="border-b border-stone-200/70 dark:border-white/10">
        <td class="py-2.5 pr-2 font-bold">${v.name} <span class="block text-[10px] font-normal opacity-75">${v.municipality}</span></td>
        <td class="py-2.5 px-2">${formatMoney(v.baseDeliveryFeeUsd)}</td>
        <td class="py-2.5 px-2 font-semibold text-[#7A5A1E] dark:text-[#D9B76F]">${formatMoney(v.pricePerKmUsd)} / km</td>
        <td class="py-2.5 px-2 font-bold">${d.distanceKm} km</td>
        <td class="py-2.5 pl-2 text-right font-extrabold text-emerald-800 dark:text-emerald-300">${formatMoney(d.feeUsd)}</td>
      </tr>
    `;
  }).join('');
}

// ============================================================================
// DASHBOARD ADMINISTRADOR MÓVIL ("TIERRA QUERIDA" 5 PESTAÑAS + RBAC MIPYME/TCP)
// ============================================================================
function openAdminModal() {
  if (!isAdminAuthenticated) {
    document.getElementById('admin-login-modal').classList.remove('hidden');
  } else {
    document.getElementById('admin-dashboard-modal').classList.remove('hidden');
    renderAdminDashboard();
  }
}

function closeAdminModals() {
  document.getElementById('admin-login-modal').classList.add('hidden');
  document.getElementById('admin-dashboard-modal').classList.add('hidden');
}

function handleAdminLogin(e) {
  if (e) e.preventDefault();
  const email = document.getElementById('admin-email-input').value.trim();
  const roleSelect = document.getElementById('admin-role-login-select').value;

  if (!email) {
    showToast('Ingresa el correo del negocio (ej. admin@mercapros.com)');
    return;
  }

  isAdminAuthenticated = true;
  appState.activeVendorId = roleSelect;
  const vendor = appState.vendors.find(v => v.id === roleSelect);
  if (vendor) {
    appState.currentRole = vendor.role;
  }
  saveMercaprosState(appState);

  // Mostrar píldora dorada de administración en cabecera
  const goldPill = document.getElementById('header-admin-gold-pill');
  if (goldPill) {
    goldPill.classList.remove('hidden');
  }

  document.getElementById('admin-login-modal').classList.add('hidden');
  document.getElementById('admin-dashboard-modal').classList.remove('hidden');
  renderRoleBar();
  renderAdminDashboard();
  showToast(`Panel de Control activado para: ${vendor ? vendor.name : 'Administrador'}`);
}

function switchAdminVendorProfile(vendorId) {
  appState.activeVendorId = vendorId;
  const vendor = appState.vendors.find(v => v.id === vendorId);
  if (vendor) {
    appState.currentRole = vendor.role;
  }
  saveMercaprosState(appState);
  renderRoleBar();
  renderAdminDashboard();
  renderCatalog();
}

function switchAdminTab(tabId) {
  activeAdminTab = tabId;
  document.querySelectorAll('.js-admin-tab-btn').forEach(btn => {
    if (btn.getAttribute('data-tab') === tabId) {
      btn.className = 'js-admin-tab-btn px-4 py-2.5 rounded-xl text-xs font-bold bg-[#14201B] text-[#F6F1E7] dark:bg-[#D9B76F] dark:text-[#09100D] shadow-sm flex items-center gap-2';
    } else {
      btn.className = 'js-admin-tab-btn px-4 py-2.5 rounded-xl text-xs font-semibold bg-stone-200/70 dark:bg-white/10 hover:bg-stone-300/60 flex items-center gap-2';
    }
  });

  document.querySelectorAll('.js-admin-tab-panel').forEach(panel => {
    if (panel.id === tabId) {
      panel.classList.remove('hidden');
    } else {
      panel.classList.add('hidden');
    }
  });
}

function renderAdminDashboard() {
  const activeVendor = appState.vendors.find(v => v.id === appState.activeVendorId) || appState.vendors[1];
  const roleRules = ROLE_MATRIX[activeVendor.role] || ROLE_MATRIX.MIPYME;

  // Selector superior de negocio activo
  const vendorSwitcher = document.getElementById('admin-active-vendor-select');
  if (vendorSwitcher) {
    vendorSwitcher.value = activeVendor.id;
  }

  // Banner de permisos RBAC del negocio dentro del Dashboard
  const rbacBanner = document.getElementById('admin-rbac-status-banner');
  if (rbacBanner) {
    rbacBanner.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span class="text-xs font-extrabold uppercase tracking-wider text-[#7A5A1E] dark:text-[#D9B76F]">${activeVendor.badge}</span>
          <h4 class="font-display text-lg font-bold">${activeVendor.name}</h4>
        </div>
        <div class="flex flex-wrap gap-2 text-xs">
          ${activeVendor.role === 'TCP' ? `
            <span class="px-3 py-1 rounded-full bg-amber-500/20 text-amber-900 dark:text-amber-200 font-bold border border-amber-600/30">
              <i class="fa-solid fa-lock mr-1"></i>Regla TCP: Compra Mayor/Menor • Vende SOLO Minorista
            </span>
          ` : activeVendor.role === 'MIPYME' ? `
            <span class="px-3 py-1 rounded-full bg-emerald-600/20 text-emerald-900 dark:text-emerald-200 font-bold border border-emerald-600/30">
              <i class="fa-solid fa-check-double mr-1"></i>Regla Mipyme: Habilitada Venta Mayorista y Minorista
            </span>
          ` : `
            <span class="px-3 py-1 rounded-full bg-teal-600/20 text-teal-900 dark:text-teal-200 font-bold border border-teal-600/30">
              <i class="fa-solid fa-ship mr-1"></i>Regla Exportador: Venta por Contenedores 20'/40' CIF Cuba
            </span>
          `}
        </div>
      </div>
    `;
  }

  // Ajustar campos de precios en el formulario según permisos de venta del rol (TCP no puede activar precio Mayorista)
  const wholesaleFieldGroup = document.getElementById('admin-wholesale-field-group');
  const containerFieldGroup = document.getElementById('admin-container-field-group');
  if (wholesaleFieldGroup && containerFieldGroup) {
    if (activeVendor.role === 'TCP') {
      wholesaleFieldGroup.classList.add('opacity-40', 'pointer-events-none');
      containerFieldGroup.classList.add('hidden');
      document.getElementById('prod-wholesale-Note').textContent = 'Bloqueado para TCP (Solo Venta Minorista)';
    } else if (activeVendor.role === 'MIPYME') {
      wholesaleFieldGroup.classList.remove('opacity-40', 'pointer-events-none');
      containerFieldGroup.classList.add('hidden');
      document.getElementById('prod-wholesale-Note').textContent = 'Habilitado para Mipyme';
    } else {
      containerFieldGroup.classList.remove('hidden');
      wholesaleFieldGroup.classList.remove('opacity-40', 'pointer-events-none');
    }
  }

  // Poblar selector de categorías en el formulario de productos
  const catSelect = document.getElementById('prod-category-input');
  if (catSelect) {
    catSelect.innerHTML = appState.categories
      .filter(c => c.id !== 'all')
      .map(c => `<option value="${c.id}">${c.name}</option>`)
      .join('');
  }

  // Renderizar lista de inventario en Pestaña 1
  const invList = document.getElementById('admin-inventory-list');
  if (invList) {
    const vendorProducts = appState.products.filter(p => p.vendorId === activeVendor.id);
    invList.innerHTML = vendorProducts.map(p => `
      <div class="p-3.5 rounded-2xl bg-[#FFFDF8] dark:bg-white/5 border border-stone-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <img src="${p.image}" alt="${p.title}" class="w-14 h-14 rounded-xl object-cover border border-stone-200" />
          <div class="min-w-0">
            <span class="text-[10px] font-mono font-bold opacity-70">${p.sku} • Stock: ${p.stock}</span>
            <h5 class="font-bold text-sm truncate">${p.title}</h5>
            <p class="text-xs text-[#7A5A1E] dark:text-[#D9B76F] font-semibold">
              Detalle: ${formatMoney(p.priceRetailUsd)}
              ${p.saleModes.includes('WHOLESALE') ? ` | Mayorista: ${formatMoney(p.priceWholesaleUsd)}` : ''}
              ${p.saleModes.includes('CONTAINER_B2B') ? ` | Contenedor: ${formatMoney(p.priceContainerUsd)}` : ''}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="loadProductIntoForm('${String(p.id)}')" class="px-3 py-1.5 rounded-lg bg-stone-200 dark:bg-white/10 text-xs font-bold hover:bg-[#7A5A1E] hover:text-white transition-all">
            <i class="fa-solid fa-pen mr-1"></i>Editar
          </button>
          <button onclick="deleteProductStrict('${String(p.id)}')" class="px-3 py-1.5 rounded-lg bg-red-600/15 text-red-700 dark:text-red-300 text-xs font-bold hover:bg-red-600 hover:text-white transition-all">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    `).join('') || `<p class="text-xs opacity-70 py-4">Este negocio aún no tiene productos en su inventario.</p>`;
  }

  // Renderizar Pestaña 2: Anuncios y Ofertas
  const annList = document.getElementById('admin-announcements-list');
  if (annList) {
    annList.innerHTML = appState.announcements.map(a => `
      <div class="p-3.5 rounded-2xl bg-[#FFFDF8] dark:bg-white/5 border border-stone-200 dark:border-white/10 flex items-center justify-between gap-3">
        <div>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-900 dark:text-amber-200">${a.badge}</span>
          <h5 class="font-bold text-sm mt-1">${a.title}</h5>
          <p class="text-xs opacity-75">${a.subtitle}</p>
        </div>
        <button onclick="deleteAnnouncement('${String(a.id)}')" class="px-3 py-1.5 rounded-lg bg-red-600/15 text-red-700 text-xs font-bold">
          Eliminar
        </button>
      </div>
    `).join('');
  }

  // Renderizar Pestaña 3: Categorías Dinámicas
  const catList = document.getElementById('admin-categories-list');
  if (catList) {
    catList.innerHTML = appState.categories.filter(c => c.id !== 'all').map(c => `
      <div class="p-3 rounded-2xl bg-[#FFFDF8] dark:bg-white/5 border border-stone-200 dark:border-white/10 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <i class="fa-solid ${c.icon} text-[#7A5A1E]"></i>
          <span class="font-bold text-xs">${c.name}</span>
          <span class="text-[10px] px-2 py-0.5 rounded-full bg-stone-200 dark:bg-white/10">${c.badge}</span>
        </div>
        <button onclick="deleteCategoryStrict('${String(c.id)}')" class="text-xs text-red-600 font-bold hover:underline">Quitar</button>
      </div>
    `).join('');
  }

  // Renderizar Pestaña 4: Historial de Pedidos
  const ordList = document.getElementById('admin-orders-list');
  if (ordList) {
    ordList.innerHTML = appState.orders.map(o => `
      <div class="p-4 rounded-2xl bg-[#FFFDF8] dark:bg-white/5 border border-stone-200 dark:border-white/10 space-y-1.5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="font-mono font-extrabold text-xs text-[#7A5A1E] dark:text-[#D9B76F]">${o.id} • ${o.date}</span>
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600/15 text-emerald-800 dark:text-emerald-300">${o.status}</span>
        </div>
        <div class="font-bold text-sm">${o.customerName} <span class="text-xs font-normal opacity-75">→ ${o.vendorName}</span></div>
        <p class="text-xs opacity-80">${o.itemsSummary}</p>
        <div class="flex flex-wrap items-center justify-between pt-2 border-t border-stone-200/60 dark:border-white/10 text-xs">
          <span><i class="fa-solid fa-route mr-1"></i>${o.municipality} (${o.distanceKm} km • Domicilio: ${formatMoney(o.deliveryUsd)})</span>
          <span class="font-extrabold text-sm">Total: ${formatMoney(o.totalUsd)}</span>
        </div>
      </div>
    `).join('');
  }

  // Renderizar Pestaña 5: Configuración de Tarifa por Km del Negocio (Mipyme/TCP) & Supabase
  document.getElementById('vendor-cfg-basefee').value = activeVendor.baseDeliveryFeeUsd;
  document.getElementById('vendor-cfg-kmprice').value = activeVendor.pricePerKmUsd;
  document.getElementById('vendor-cfg-lat').value = activeVendor.lat;
  document.getElementById('vendor-cfg-lng').value = activeVendor.lng;
  document.getElementById('supabase-url-input').value = appState.supabaseConfig.url || '';
  document.getElementById('supabase-key-input').value = appState.supabaseConfig.anonKey || '';
}

// ============================================================================
// MOTOR HTML5 CANVAS PARA COMPRESIÓN DE FOTOS MÓVILES (MÁX 800x800px, ~45KB)
// ============================================================================
function handleProductPhotoUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const MAX_DIM = 800;
      let width = img.width;
      let height = img.height;

      if (width > height && width > MAX_DIM) {
        height = Math.round((height * MAX_DIM) / width);
        width = MAX_DIM;
      } else if (height > MAX_DIM) {
        width = Math.round((width * MAX_DIM) / height);
        height = MAX_DIM;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Exportar comprimido a WebP/JPEG (~40-60KB ideal para redes móviles de Cuba)
      let compressedDataUrl = canvas.toDataURL('image/webp', 0.72);
      if (compressedDataUrl.indexOf('data:image/webp') !== 0) {
        compressedDataUrl = canvas.toDataURL('image/jpeg', 0.72);
      }

      const hiddenInput = document.getElementById('prod-image-dataurl');
      if (hiddenInput) hiddenInput.value = compressedDataUrl;

      const previewImg = document.getElementById('prod-image-preview');
      if (previewImg) {
        previewImg.src = compressedDataUrl;
        previewImg.classList.remove('hidden');
      }

      const approxKb = Math.round((compressedDataUrl.length * 3) / 4 / 1024);
      const statusBadge = document.getElementById('canvas-compression-badge');
      if (statusBadge) {
        statusBadge.textContent = `Comprimida con HTML5 Canvas: ${width}x${height}px (~${approxKb} KB)`;
      }
      showToast(`Foto optimizada a ${approxKb} KB para carga rápida en Cuba.`);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// CRUD de Productos (Pestaña 1) con Strict String ID y validación RBAC
function saveProductFromAdmin(e) {
  if (e) e.preventDefault();
  const activeVendor = appState.vendors.find(v => v.id === appState.activeVendorId) || appState.vendors[1];

  const title = document.getElementById('prod-title-input').value.trim();
  const sku = document.getElementById('prod-sku-input').value.trim() || `SKU-${Date.now().toString().slice(-4)}`;
  const category = document.getElementById('prod-category-input').value;
  const priceRetailUsd = Number(document.getElementById('prod-retail-input').value || 0);
  const priceWholesaleUsd = Number(document.getElementById('prod-wholesale-input').value || 0);
  const priceContainerUsd = Number(document.getElementById('prod-container-input').value || 0);
  const minWholesaleQty = Number(document.getElementById('prod-minqty-input').value || 5);
  const stock = Number(document.getElementById('prod-stock-input').value || 25);
  const unitRetail = document.getElementById('prod-unitretail-input').value.trim() || 'Unidad al detalle';
  const unitWholesale = document.getElementById('prod-unitwholesale-input').value.trim() || 'Caja Mayorista';
  const specs = document.getElementById('prod-specs-input').value.trim() || 'Entrega Garantizada en Cuba';
  const description = document.getElementById('prod-desc-input').value.trim();
  const isFlashOffer = document.getElementById('prod-flash-checkbox').checked;
  const image = document.getElementById('prod-image-dataurl').value || 'assets/combo-proteina.jpg';

  if (!title) {
    showToast('Ingresa el nombre del producto o combo.');
    return;
  }

  // Determinar modalidades de venta respetando estrictamente la jerarquía Exportador / Mipyme / TCP
  let saleModes = ['RETAIL'];
  if (activeVendor.role === 'EXPORTADOR_B2B') {
    saleModes = ['CONTAINER_B2B'];
  } else if (activeVendor.role === 'MIPYME') {
    saleModes = priceWholesaleUsd > 0 ? ['WHOLESALE', 'RETAIL'] : ['RETAIL'];
  } else if (activeVendor.role === 'TCP') {
    // TCP jamás puede publicar venta mayorista
    saleModes = ['RETAIL'];
  }

  const productObj = {
    id: editingProductId ? String(editingProductId) : `prod-${Date.now()}`,
    sku,
    title,
    category,
    vendorId: activeVendor.id,
    vendorName: activeVendor.name,
    vendorRole: activeVendor.role,
    saleModes,
    priceContainerUsd: activeVendor.role === 'EXPORTADOR_B2B' ? (priceContainerUsd || priceRetailUsd) : 0,
    priceWholesaleUsd: activeVendor.role === 'TCP' ? priceRetailUsd : (priceWholesaleUsd || priceRetailUsd),
    priceRetailUsd,
    oldPriceUsd: Number((priceRetailUsd * 1.15).toFixed(2)),
    discountPct: isFlashOffer ? 15 : 0,
    minWholesaleQty,
    unitRetail,
    unitWholesale: activeVendor.role === 'TCP' ? 'Venta exclusiva Minorista (TCP)' : unitWholesale,
    stock,
    image,
    isFlashOffer,
    incoterm: activeVendor.municipality,
    specs,
    description
  };

  if (editingProductId) {
    appState.products = appState.products.map(p => String(p.id) === String(editingProductId) ? productObj : p);
    editingProductId = null;
  } else {
    appState.products.unshift(productObj);
  }

  saveMercaprosState(appState);
  resetProductForm();
  renderAdminDashboard();
  renderCatalog();
  showToast('Producto guardado en el inventario del negocio.');
}

function loadProductIntoForm(productId) {
  const p = appState.products.find(x => String(x.id) === String(productId));
  if (!p) return;
  editingProductId = String(p.id);
  document.getElementById('prod-title-input').value = p.title;
  document.getElementById('prod-sku-input').value = p.sku;
  document.getElementById('prod-category-input').value = p.category;
  document.getElementById('prod-retail-input').value = p.priceRetailUsd;
  document.getElementById('prod-wholesale-input').value = p.priceWholesaleUsd;
  document.getElementById('prod-container-input').value = p.priceContainerUsd || 0;
  document.getElementById('prod-minqty-input').value = p.minWholesaleQty || 5;
  document.getElementById('prod-stock-input').value = p.stock || 20;
  document.getElementById('prod-unitretail-input').value = p.unitRetail || '';
  document.getElementById('prod-unitwholesale-input').value = p.unitWholesale || '';
  document.getElementById('prod-specs-input').value = p.specs || '';
  document.getElementById('prod-desc-input').value = p.description || '';
  document.getElementById('prod-flash-checkbox').checked = Boolean(p.isFlashOffer);
  document.getElementById('prod-image-dataurl').value = p.image || '';
  showToast(`Editando: ${p.title}`);
}

function resetProductForm() {
  editingProductId = null;
  const form = document.getElementById('admin-product-form');
  if (form) form.reset();
}

function deleteProductStrict(productId) {
  const strId = String(productId);
  appState.products = appState.products.filter(p => String(p.id) !== strId);
  saveMercaprosState(appState);
  renderAdminDashboard();
  renderCatalog();
  showToast('Producto eliminado del catálogo.');
}

// Pestaña 2: Crear / Eliminar Anuncios y Ofertas
function addAnnouncementFromAdmin(e) {
  if (e) e.preventDefault();
  const title = document.getElementById('ann-title-input').value.trim();
  const subtitle = document.getElementById('ann-subtitle-input').value.trim();
  const badge = document.getElementById('ann-badge-input').value.trim() || 'PROMO CUBA';
  const code = document.getElementById('ann-code-input').value.trim();
  if (!title) return;

  appState.announcements.unshift({
    id: `ann-${Date.now()}`,
    title,
    subtitle,
    badge,
    code,
    active: true
  });
  saveMercaprosState(appState);
  renderAnnouncementsBanner();
  renderAdminDashboard();
  e.target.reset();
  showToast('Promoción publicada en vivo.');
}

function deleteAnnouncement(id) {
  const strId = String(id);
  appState.announcements = appState.announcements.filter(a => String(a.id) !== strId);
  saveMercaprosState(appState);
  renderAnnouncementsBanner();
  renderAdminDashboard();
}

// Pestaña 3: Motor Dinámico de Categorías
function addCategoryFromAdmin(e) {
  if (e) e.preventDefault();
  const name = document.getElementById('cat-name-input').value.trim();
  const badge = document.getElementById('cat-badge-input').value.trim() || 'Nuevo';
  const icon = document.getElementById('cat-icon-input').value.trim() || 'fa-tag';
  if (!name) return;

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  appState.categories.push({
    id: slug,
    name,
    icon,
    badge,
    tierAccess: 'ALL'
  });
  saveMercaprosState(appState);
  renderCategoriesBar();
  renderAdminDashboard();
  e.target.reset();
  showToast(`Categoría "${name}" agregada al menú en vivo.`);
}

function deleteCategoryStrict(catId) {
  const strId = String(catId);
  appState.categories = appState.categories.filter(c => String(c.id) !== strId);
  saveMercaprosState(appState);
  renderCategoriesBar();
  renderAdminDashboard();
}

// Pestaña 5: Guardar Tarifa por Km del Negocio (Mipyme / TCP), Coordenadas y Backup JSON 1-Clic
function saveVendorLogisticsConfig(e) {
  if (e) e.preventDefault();
  const activeVendor = appState.vendors.find(v => v.id === appState.activeVendorId);
  if (!activeVendor) return;

  activeVendor.baseDeliveryFeeUsd = Number(document.getElementById('vendor-cfg-basefee').value || 1.5);
  activeVendor.pricePerKmUsd = Number(document.getElementById('vendor-cfg-kmprice').value || 0.5);
  activeVendor.lat = Number(document.getElementById('vendor-cfg-lat').value || activeVendor.lat);
  activeVendor.lng = Number(document.getElementById('vendor-cfg-lng').value || activeVendor.lng);

  saveMercaprosState(appState);
  renderVendorPills();
  renderCatalog();
  updateCartUI();
  showToast(`Tarifa de domicilio actualizada: $${activeVendor.pricePerKmUsd} USD/km para ${activeVendor.name}`);
}

function saveSupabaseCredentials(e) {
  if (e) e.preventDefault();
  appState.supabaseConfig.url = document.getElementById('supabase-url-input').value.trim();
  appState.supabaseConfig.anonKey = document.getElementById('supabase-key-input').value.trim();
  saveMercaprosState(appState);
  syncFromSupabase(appState, (res) => {
    showToast(res.synced ? 'Conectado y sincronizado con Supabase Cloud.' : `Guardado local (${res.reason})`);
  });
}

function exportBackupJson() {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(appState, null, 2));
  const a = document.createElement('a');
  a.setAttribute('href', dataStr);
  a.setAttribute('download', `mercapros-cuba-backup-${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(a);
  a.click();
  a.remove();
  showToast('Copia de seguridad JSON descargada.');
}

function importBackupJson(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const parsed = JSON.parse(e.target.result);
      if (parsed && Array.isArray(parsed.products)) {
        appState = parsed;
        saveMercaprosState(appState);
        location.reload();
      }
    } catch (err) {
      showToast('Archivo JSON inválido.');
    }
  };
  reader.readAsText(file);
}

// Notificación Flotante (Toast)
function showToast(msg) {
  const toast = document.getElementById('mercapros-toast');
  const text = document.getElementById('mercapros-toast-text');
  if (!toast || !text) return;
  text.textContent = msg;
  toast.classList.remove('hidden', 'translate-y-10', 'opacity-0');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 3800);
}
