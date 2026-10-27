// ============================================================================
// MERCAPROS CUBA - CONTROLADOR PRINCIPAL (INTERFAZ LIMPIA + TICKET WHATSAPP)
// ============================================================================

let appState = loadMercaprosState();
let cart = [];
let activeCategory = 'all';
let activeSaleFilter = 'ALL'; // ALL | CONTAINER_B2B | WHOLESALE | RETAIL | FLASH
let activeVendorFilter = 'ALL';
let searchQuery = '';
let currentSort = 'featured';
let isAdminAuthenticated = false;
let activeAdminTab = 'tab-catalog';
let editingProductId = null;

// Instancias de Mapas Leaflet
let deliveryMap = null;
let userMarker = null;
let vendorMarkers = [];
let routePolyline = null;

// Número Oficial de WhatsApp de Recepción de Tickets de Compra
const ADMIN_WHATSAPP_NUMBER = '971508379080';

// Matriz de Permisos por Nivel de Usuario (RBAC)
const ROLE_MATRIX = {
  ALL_VIEW: {
    code: 'ALL_VIEW',
    label: 'Vista General',
    canBuyContainer: true,
    canBuyWholesale: true,
    canBuyRetail: true,
    canSellContainer: true,
    canSellWholesale: true,
    canSellRetail: true
  },
  EXPORTADOR_B2B: {
    code: 'EXPORTADOR_B2B',
    label: 'Exportador (Contenedores)',
    canBuyContainer: true,
    canBuyWholesale: false,
    canBuyRetail: false,
    canSellContainer: true,
    canSellWholesale: false,
    canSellRetail: false
  },
  MIPYME: {
    code: 'MIPYME',
    label: 'Mipyme (Mayor y Menor)',
    canBuyContainer: true,
    canBuyWholesale: true,
    canBuyRetail: true,
    canSellContainer: false,
    canSellWholesale: true,
    canSellRetail: true
  },
  TCP: {
    code: 'TCP',
    label: 'TCP (Vende Minorista)',
    canBuyContainer: false,
    canBuyWholesale: true,
    canBuyRetail: true,
    canSellContainer: false,
    canSellWholesale: false,
    canSellRetail: true
  },
  CLIENTE_B2C: {
    code: 'CLIENTE_B2C',
    label: 'Cliente Hogar',
    canBuyContainer: false,
    canBuyWholesale: false,
    canBuyRetail: true,
    canSellContainer: false,
    canSellWholesale: false,
    canSellRetail: false
  }
};

// Cálculo Geodésico Haversine con factor urbano (1.28x)
function calculateRoadDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
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

function calculateVendorDelivery(vendor) {
  if (!vendor || vendor.role === 'EXPORTADOR_B2B') {
    return { distanceKm: 0, feeUsd: 0, isCifPort: true };
  }
  if (!appState.userGps) {
    return { distanceKm: 2.0, feeUsd: 2.50, isCifPort: false };
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
    feeUsd: Number(rawFee.toFixed(2)),
    isCifPort: false
  };
}

function isWholesaleContext() {
  return (
    activeSaleFilter === 'WHOLESALE' ||
    activeSaleFilter === 'CONTAINER_B2B' ||
    activeCategory === 'contenedores-b2b' ||
    appState.currentRole === 'EXPORTADOR_B2B' ||
    appState.currentRole === 'MIPYME'
  );
}

const CURRENCY_OPTIONS_SUPPLIERS = [
  { value: 'USD', label: 'Moneda: USD (Dólares)' },
  { value: 'EUR', label: 'Moneda: EUR (Euros)' },
  { value: 'USDT', label: 'Moneda: USDT' }
];

const CURRENCY_OPTIONS_GENERAL = [
  { value: 'USD', label: 'Moneda: USD (Dólares)' },
  { value: 'EUR', label: 'Moneda: EUR (Euros)' },
  { value: 'USDT', label: 'Moneda: USDT' },
  { value: 'CUP', label: 'Moneda: CUP' }
];

function syncCurrencySelectorOptions() {
  const wholesaleMode = isWholesaleContext();
  const allowedList = wholesaleMode ? CURRENCY_OPTIONS_SUPPLIERS : CURRENCY_OPTIONS_GENERAL;
  const allowedValues = allowedList.map(o => o.value);

  if (!allowedValues.includes(appState.currency)) {
    appState.currency = 'USD';
    saveMercaprosState(appState);
  }

  const currSelects = document.querySelectorAll('.js-currency-select');
  currSelects.forEach(s => {
    s.innerHTML = allowedList
      .map(opt => `<option value="${opt.value}" ${opt.value === appState.currency ? 'selected' : ''}>${opt.label}</option>`)
      .join('');
    s.value = appState.currency || 'USD';
  });
}

function formatMoney(amountUsd, forceNoCup = false) {
  const val = Number(amountUsd || 0);
  let curr = appState.currency || 'USD';
  if (curr === 'MLC') curr = 'USD';

  // Proveedores / Mayoristas / Contenedores: solo USD, EUR y USDT (nunca CUP)
  if ((forceNoCup || isWholesaleContext()) && curr === 'CUP') {
    curr = 'USD';
  }

  if (curr === 'CUP') {
    const cupRate = (appState.rates && appState.rates.CUP) || 320;
    const cup = Math.round(val * cupRate);
    return `${cup.toLocaleString('es-CU')} CUP`;
  }
  if (curr === 'EUR') {
    const eurRate = (appState.rates && appState.rates.EUR) || 0.92;
    const eur = (val * eurRate).toFixed(2);
    return `€${Number(eur).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
  }
  if (curr === 'USDT') {
    const usdtRate = (appState.rates && appState.rates.USDT) || 1.00;
    const usdt = (val * usdtRate).toFixed(2);
    return `${Number(usdt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;
  }
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
}

let detailModalProductId = null;
let detailModalMode = 'RETAIL';
let detailModalQty = 1;

document.addEventListener('DOMContentLoaded', () => {
  if (appState.currentUser) {
    appState.currentRole = appState.currentUser.role || appState.currentRole;
    if (appState.currentUser.vendorId) {
      appState.activeVendorId = appState.currentUser.vendorId;
      isAdminAuthenticated = true;
    }
  }
  applyThemeAndConnectivity();
  populateProvinceAndMunicipalitySelectors();
  populateRegisterLocationSelectors();
  updateAuthHeaderUI();
  renderRoleBar();
  renderCategoriesBar();
  renderStoresSection();
  renderCatalog();
  updateCartUI();
  updateGpsHeaderBadge();

  syncFromSupabase(appState, () => {});
});

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

  const lowDataBtns = document.querySelectorAll('.js-lowdata-toggle-label');
  lowDataBtns.forEach(el => {
    el.innerHTML = appState.lowDataMode
      ? '<i class="fa-solid fa-bolt text-amber-500 mr-1.5"></i>Modo Sin Fotos'
      : '<i class="fa-regular fa-image mr-1.5"></i>Con Fotos';
  });

  syncCurrencySelectorOptions();
}

function toggleLowDataMode() {
  appState.lowDataMode = !appState.lowDataMode;
  saveMercaprosState(appState);
  applyThemeAndConnectivity();
  renderStoresSection();
  renderCatalog();
  showToast(
    appState.lowDataMode
      ? 'Modo Sin Imágenes activado (carga ultraligera).'
      : 'Modo Con Imágenes activado.'
  );
}

function toggleThemeMode() {
  appState.theme = appState.theme === 'dark' ? 'light' : 'dark';
  saveMercaprosState(appState);
  applyThemeAndConnectivity();
}

function changeCurrency(newCurr) {
  if (isWholesaleContext() && newCurr === 'CUP') {
    appState.currency = 'USD';
    showToast('Para proveedores y mayoristas solo están disponibles USD, EUR y USDT.');
  } else if (!['USD', 'EUR', 'USDT', 'CUP'].includes(newCurr)) {
    appState.currency = 'USD';
  } else {
    appState.currency = newCurr;
  }
  saveMercaprosState(appState);
  syncCurrencySelectorOptions();
  renderStoresSection();
  renderCatalog();
  updateCartUI();
  if (detailModalProductId) {
    renderProductDetailModalContent(detailModalProductId);
  }
}

// ============================================================================
// SELECTOR LIMPIO DE NIVEL DE USUARIO (SIN CARTELES GIGANTES)
// ============================================================================
function setUserRole(roleCode) {
  if (!ROLE_MATRIX[roleCode]) return;
  appState.currentRole = roleCode;

  if (roleCode === 'EXPORTADOR_B2B') appState.activeVendorId = 'v-wssnd-01';
  if (roleCode === 'MIPYME') appState.activeVendorId = 'v-mip-01';
  if (roleCode === 'TCP') appState.activeVendorId = 'v-tcp-01';

  syncCurrencySelectorOptions();
  saveMercaprosState(appState);
  renderRoleBar();
  renderCategoriesBar();
  renderCatalog();
  if (isAdminAuthenticated) {
    renderAdminDashboard();
  }
  showToast(`Modo: ${ROLE_MATRIX[roleCode].label}`);
}

function renderRoleBar() {
  document.querySelectorAll('.js-role-btn').forEach(btn => {
    const code = btn.getAttribute('data-role');
    if (code === appState.currentRole) {
      btn.className = 'js-role-btn shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all bg-[#2A2522] text-[#F7F5F0] dark:bg-[#F2AE79] dark:text-[#171413] shadow-sm flex items-center gap-1.5';
    } else {
      btn.className = 'js-role-btn shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all bg-white/70 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 border border-stone-300/70 dark:border-white/10 flex items-center gap-1.5';
    }
  });
}

// ============================================================================
// CATEGORÍAS Y PANEL DEL ÍCONO DE FILTRO
// ============================================================================
function renderCategoriesBar() {
  const bar = document.getElementById('categories-scroll-bar');
  if (!bar) return;

  bar.innerHTML = appState.categories.map(cat => {
    const isActive = activeCategory === cat.id;
    return `
      <button onclick="selectCategory('${cat.id}')" class="shrink-0 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 border ${
        isActive
          ? 'bg-[#2A2522] text-[#F7F5F0] dark:bg-[#F2AE79] dark:text-[#171413] border-transparent shadow-sm'
          : 'bg-[#FFFFFF] dark:bg-[#211D1B] hover:border-[#7C1D18] border-stone-200 dark:border-white/10'
      }">
        <i class="fa-solid ${cat.icon} ${isActive ? 'text-[#F2AE79] dark:text-[#171413]' : 'text-[#7C1D18] dark:text-[#F2AE79]'}"></i>
        <span>${cat.name}</span>
      </button>
    `;
  }).join('');

  syncFilterPanelUI();
}

function selectCategory(catId) {
  activeCategory = catId;
  if (catId === 'contenedores-b2b') {
    activeSaleFilter = 'ALL';
  }
  syncCurrencySelectorOptions();
  renderCategoriesBar();
  renderStoresSection();
  renderCatalog();
}

function setSaleModeFilter(mode) {
  activeSaleFilter = mode;
  document.querySelectorAll('.js-salemode-pill').forEach(btn => {
    const m = btn.getAttribute('data-mode');
    if (m === mode) {
      btn.className = 'js-salemode-pill px-3 py-1.5 rounded-lg text-xs font-bold bg-[#7C1D18] text-white shadow-sm shrink-0 transition-all';
    } else {
      btn.className = 'js-salemode-pill px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-200/70 dark:bg-white/10 hover:bg-stone-300/70 shrink-0 transition-all';
    }
  });
  syncCurrencySelectorOptions();
  syncFilterPanelUI();
  renderCatalog();
}

function handleSearchInput(val) {
  searchQuery = (val || '').trim().toLowerCase();
  renderCatalog();
}

function handleSortChange(val) {
  currentSort = val;
  syncFilterPanelUI();
  renderCatalog();
}

function toggleCatalogFilterPanel(forceState) {
  const panel = document.getElementById('catalog-filter-panel');
  const btn = document.getElementById('catalog-filter-btn');
  if (!panel) return;
  const shouldOpen = typeof forceState === 'boolean' ? forceState : panel.classList.contains('hidden');
  if (shouldOpen) {
    syncFilterPanelUI();
    panel.classList.remove('hidden');
    if (btn) btn.setAttribute('aria-expanded', 'true');
  } else {
    panel.classList.add('hidden');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }
}

function setVendorFilterFromPanel(vendorId) {
  activeVendorFilter = vendorId || 'ALL';
  syncFilterPanelUI();
  renderStoresSection();
  renderCatalog();
}

function resetAllCatalogFilters() {
  activeCategory = 'all';
  activeSaleFilter = 'ALL';
  activeVendorFilter = 'ALL';
  currentSort = 'featured';
  setSaleModeFilter('ALL');
  renderCategoriesBar();
  renderStoresSection();
  renderCatalog();
  showToast('Filtros restablecidos.');
}

function syncFilterPanelUI() {
  const sortEl = document.getElementById('catalog-sort-select');
  if (sortEl) sortEl.value = currentSort;

  const catSelect = document.getElementById('filter-panel-category-select');
  if (catSelect) {
    catSelect.innerHTML = appState.categories
      .filter(c => c.id !== 'tiendas')
      .map(c => `<option value="${c.id}" ${c.id === activeCategory ? 'selected' : ''}>${c.name}</option>`)
      .join('');
  }

  const vendorSelect = document.getElementById('filter-panel-vendor-select');
  if (vendorSelect) {
    const vOpts = [`<option value="ALL" ${activeVendorFilter === 'ALL' ? 'selected' : ''}>Todas las Tiendas</option>`].concat(
      appState.vendors.map(v => `<option value="${v.id}" ${v.id === activeVendorFilter ? 'selected' : ''}>${v.name}</option>`)
    );
    vendorSelect.innerHTML = vOpts.join('');
  }

  // Contar cuántos filtros activos hay para resaltar el botón del ícono de filtro
  let activeCount = 0;
  if (currentSort !== 'featured') activeCount++;
  if (activeCategory !== 'all' && activeCategory !== 'tiendas') activeCount++;
  if (activeSaleFilter !== 'ALL') activeCount++;
  if (activeVendorFilter !== 'ALL') activeCount++;

  const badge = document.getElementById('catalog-filter-badge');
  const btn = document.getElementById('catalog-filter-btn');
  if (badge) {
    if (activeCount > 0) {
      badge.textContent = String(activeCount);
      badge.classList.remove('hidden');
      badge.classList.add('flex');
    } else {
      badge.classList.add('hidden');
      badge.classList.remove('flex');
    }
  }
  if (btn) {
    if (activeCount > 0) {
      btn.className = 'relative w-9 h-9 rounded-xl bg-[#7C1D18] text-white border border-[#7C1D18] flex items-center justify-center transition-all shadow-sm';
    } else {
      btn.className = 'relative w-9 h-9 rounded-xl bg-[#F7F5F0] dark:bg-[#171413] hover:bg-[#7C1D18] hover:text-white border border-stone-300 dark:border-white/15 flex items-center justify-center transition-all shadow-sm';
    }
  }
}

// ============================================================================
// PANTALLA DE TIENDAS OFICIALES (SOLO SE MUESTRA AL FILTRAR POR "TIENDAS")
// ============================================================================
function renderStoresSection() {
  const storesWrapper = document.getElementById('stores-showcase-section');
  const container = document.getElementById('vendors-showcase-grid');
  if (!container || !storesWrapper) return;

  // Regla del usuario: Las tiendas oficiales NO van de primero; abren solo cuando alguien filtra por la categoría "tiendas"
  if (activeCategory === 'tiendas') {
    storesWrapper.classList.remove('hidden');
  } else {
    storesWrapper.classList.add('hidden');
    return;
  }

  container.innerHTML = appState.vendors.map((v, index) => {
    const deliv = calculateVendorDelivery(v);
    const isSelected = activeVendorFilter === v.id;
    const isWssnd = v.id === 'v-wssnd-01';
    const prodCount = appState.products.filter(p => p.vendorId === v.id).length;

    return `
      <div class="store-card rounded-3xl p-4 bg-[#FFFFFF] dark:bg-[#211D1B] border ${
        isSelected
          ? 'border-[#7C1D18] ring-2 ring-[#7C1D18]/30'
          : isWssnd
          ? 'border-[#7C1D18]/60 dark:border-[#F2AE79]/40'
          : 'border-stone-200/80 dark:border-white/10'
      } shadow-sm flex flex-col justify-between transition-all">
        <div>
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              ${!appState.lowDataMode ? `
                <img src="${v.logo || 'assets/wssnd-skylink-logo.jpg'}" alt="${v.name}" class="w-12 h-12 rounded-2xl object-cover border border-stone-200 dark:border-white/15 bg-white shrink-0" />
              ` : `
                <div class="w-10 h-10 rounded-2xl bg-[#7C1D18]/15 text-[#7C1D18] dark:text-[#F2AE79] flex items-center justify-center font-extrabold text-sm shrink-0">
                  ${index + 1}
                </div>
              `}
              <div class="min-w-0">
                <div class="flex items-center gap-1.5">
                  <h4 class="store-name font-display font-bold text-base">${v.name}</h4>
                  <i class="fa-solid fa-circle-check text-[#7C1D18] dark:text-[#F2AE79] text-xs shrink-0" title="Tienda Verificada"></i>
                </div>
                <span class="text-[11px] font-semibold text-[#7C1D18] dark:text-[#F2AE79] block">${v.badge} • ${prodCount} ofertas</span>
              </div>
            </div>
            <a href="https://wa.me/${v.whatsapp}" target="_blank" rel="noopener" aria-label="WhatsApp" class="w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-sm shrink-0">
              <i class="fa-brands fa-whatsapp text-base"></i>
            </a>
          </div>
          <p class="store-description text-xs opacity-75 mt-2.5">${v.description}</p>
        </div>

        <div class="mt-3 pt-3 border-t border-stone-200/70 dark:border-white/10 flex items-center justify-between gap-2 text-xs">
          <div class="text-[11px]">
            ${deliv.isCifPort ? `
              <span class="font-bold text-emerald-800 dark:text-emerald-300"><i class="fa-solid fa-ship mr-1"></i>CIF Puerto Mariel</span>
            ` : `
              <span class="font-bold">${deliv.distanceKm} km • ${formatMoney(deliv.feeUsd)}</span>
            `}
            <a href="${v.gmapsUrl}" target="_blank" rel="noopener" class="block text-[10px] opacity-70 hover:underline mt-0.5">
              <i class="fa-solid fa-star text-amber-500"></i> ${v.rating} (${v.reviewsCount})
            </a>
          </div>

          <button onclick="filterByVendor('${v.id}')" class="px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            isSelected
              ? 'bg-[#2A2522] text-white dark:bg-[#F2AE79] dark:text-black'
              : 'bg-[#7C1D18] hover:bg-[#5D1713] text-white'
          }">
            ${isSelected ? 'Mostrando Tienda' : 'Ver Productos'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function filterByVendor(vendorId) {
  if (activeVendorFilter === vendorId) {
    activeVendorFilter = 'ALL';
  } else {
    activeVendorFilter = vendorId;
  }
  renderStoresSection();
  renderCatalog();
  const catGrid = document.getElementById('catalog-section-anchor');
  if (catGrid && activeVendorFilter !== 'ALL') {
    catGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ============================================================================
// CATÁLOGO DE PRODUCTOS (CARTELES MINIMALISTAS: FOTO, NOMBRE, PRECIO, UNIDAD Y BOTÓN AÑADIR)
// ============================================================================
function renderCatalog() {
  const grid = document.getElementById('catalog-products-grid');
  const countEl = document.getElementById('catalog-results-count');
  const activeStoreBanner = document.getElementById('active-store-filter-indicator');
  if (!grid) return;

  const role = ROLE_MATRIX[appState.currentRole] || ROLE_MATRIX.ALL_VIEW;
  const effectiveVendorFilter = activeVendorFilter;

  if (activeStoreBanner) {
    if (effectiveVendorFilter !== 'ALL') {
      const vObj = appState.vendors.find(v => v.id === effectiveVendorFilter);
      activeStoreBanner.classList.remove('hidden');
      activeStoreBanner.innerHTML = `
        <div class="flex items-center justify-between gap-2 px-4 py-2.5 rounded-2xl bg-[#FFFFFF] dark:bg-[#211D1B] border border-[#7C1D18]/40 text-xs">
          <div class="flex items-center gap-2">
            <i class="fa-solid fa-store text-[#7C1D18] dark:text-[#F2AE79]"></i>
            <span>Mostrando productos de: <strong>${vObj ? vObj.name : ''}</strong></span>
          </div>
          <button onclick="activeVendorFilter='ALL'; renderStoresSection(); renderCatalog();" class="font-bold text-[#7C1D18] dark:text-[#F2AE79] hover:underline">
            Ver todos los productos
          </button>
        </div>
      `;
    } else {
      activeStoreBanner.classList.add('hidden');
      activeStoreBanner.innerHTML = '';
    }
  }

  let filtered = appState.products.filter(p => {
    if (activeCategory !== 'all' && activeCategory !== 'tiendas') {
      if (activeCategory === 'contenedores-b2b') {
        if (!p.isContainerOffer && !p.saleModes.includes('CONTAINER_B2B')) return false;
      } else if (p.category !== activeCategory) {
        return false;
      }
    }

    if (effectiveVendorFilter !== 'ALL' && p.vendorId !== effectiveVendorFilter) return false;

    if (activeSaleFilter === 'CONTAINER_B2B' && !p.saleModes.includes('CONTAINER_B2B')) return false;
    if (activeSaleFilter === 'WHOLESALE' && !p.saleModes.includes('WHOLESALE')) return false;
    if (activeSaleFilter === 'RETAIL' && !p.saleModes.includes('RETAIL')) return false;
    if ((activeSaleFilter === 'FLASH' || currentSort === 'flash') && !p.isFlashOffer) return false;

    if (searchQuery) {
      const haystack = `${p.title} ${p.sku} ${p.vendorName} ${p.specs} ${p.description}`.toLowerCase();
      if (!haystack.includes(searchQuery)) return false;
    }

    return true;
  });

  if (currentSort === 'price-asc') {
    filtered.sort((a, b) => (a.priceContainerUsd || a.priceRetailUsd) - (b.priceContainerUsd || b.priceRetailUsd));
  } else if (currentSort === 'price-desc') {
    filtered.sort((a, b) => (b.priceContainerUsd || b.priceRetailUsd) - (a.priceContainerUsd || a.priceRetailUsd));
  }

  syncFilterPanelUI();

  if (countEl) {
    countEl.textContent = `${filtered.length} producto${filtered.length === 1 ? '' : 's'}`;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full rounded-3xl p-8 text-center bg-[#FFFFFF] dark:bg-[#211D1B] border border-stone-200 dark:border-white/10">
        <p class="font-display text-base font-bold">No hay productos que coincidan con tu filtro</p>
        <button onclick="resetAllCatalogFilters()" class="mt-3 px-4 py-2 rounded-xl bg-[#2A2522] text-white text-xs font-bold">
          Ver Todo el Catálogo
        </button>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const isContainerItem = p.saleModes.includes('CONTAINER_B2B');
    const hasWholesale = p.saleModes.includes('WHOLESALE');
    const hasRetail = p.saleModes.includes('RETAIL');

    const canBuyThisContainer = isContainerItem && role.canBuyContainer;
    const canBuyThisWholesale = hasWholesale && role.canBuyWholesale;
    const canBuyThisRetail = hasRetail && role.canBuyRetail;

    const showWholesalePrimary = !isContainerItem && activeSaleFilter === 'WHOLESALE' && hasWholesale;
    const primaryPriceUsd = isContainerItem
      ? p.priceContainerUsd
      : showWholesalePrimary
      ? p.priceWholesaleUsd
      : p.priceRetailUsd;
    const isPrimaryWholesaleOrB2B = isContainerItem || showWholesalePrimary;

    const primaryUnitText = isContainerItem
      ? `${p.unitRetail}${p.unitPriceLabel ? ` • ${p.unitPriceLabel}` : ''}`
      : showWholesalePrimary
      ? `${p.unitWholesale} (Mín. ${p.minWholesaleQty || 1}+)`
      : `${p.unitRetail}${hasWholesale ? ` • Mayor: ${formatMoney(p.priceWholesaleUsd, true)} (${p.unitWholesale})` : ''}`;

    // Foto sin botón de WhatsApp; al hacer clic abre la pantalla independiente del producto
    const mediaHtml = appState.lowDataMode
      ? `
        <div onclick="openProductDetailModal('${p.id}')" class="cursor-pointer p-3 rounded-2xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 flex items-center justify-between text-xs hover:border-[#7C1D18] transition-colors">
          <span class="font-mono font-bold text-[#7C1D18] dark:text-[#F2AE79]">${p.sku}</span>
          <span class="font-semibold opacity-75">Ver ficha →</span>
        </div>
      `
      : `
        <div onclick="openProductDetailModal('${p.id}')" class="product-photo cursor-pointer relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-white border border-stone-200/70 p-2 flex items-center justify-center">
          <img src="${p.image}" alt="${p.title}" loading="lazy" class="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" />
        </div>
      `;

    // Bloque minimalista de Precio + Unidad de Medida (Mayorista y Contenedores nunca muestran CUP)
    const pricingBlock = `
      <div onclick="openProductDetailModal('${p.id}')" class="product-price cursor-pointer p-3 rounded-2xl bg-stone-100/90 dark:bg-white/5 border border-stone-200/80 dark:border-white/10">
        <div class="text-lg font-extrabold tracking-tight">${formatMoney(primaryPriceUsd, isPrimaryWholesaleOrB2B).replace(/ (USD|EUR|USDT|CUP)$/, ' <small class="price-currency">$1</small>')}</div>
        <div class="text-[11px] font-semibold opacity-80 mt-0.5" title="${primaryUnitText}">${primaryUnitText}</div>
      </div>
    `;

    // Botón de acción: "Añadir" con ícono del carrito de compras
    let defaultAddMode = isContainerItem ? 'CONTAINER_B2B' : (showWholesalePrimary ? 'WHOLESALE' : (canBuyThisRetail ? 'RETAIL' : 'WHOLESALE'));
    let canAdd = isContainerItem ? canBuyThisContainer : (canBuyThisRetail || canBuyThisWholesale);

    const actionButtons = canAdd
      ? `<button onclick="addToCart('${p.id}', '${defaultAddMode}')" class="w-full py-2.5 px-4 rounded-xl bg-[#2A2522] hover:bg-[#7C1D18] dark:bg-[#F2AE79] dark:text-[#171413] text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5">
          <i class="fa-solid fa-cart-shopping"></i>
          <span>Añadir</span>
        </button>`
      : `<button onclick="openProductDetailModal('${p.id}')" class="w-full py-2.5 px-4 rounded-xl bg-stone-200 dark:bg-white/10 text-stone-700 dark:text-stone-300 font-semibold text-xs flex items-center justify-center gap-1.5">
          <i class="fa-solid fa-circle-info"></i>
          <span>Ver Requisitos</span>
        </button>`;

    return `
      <article class="product-card group rounded-3xl p-4 bg-[#FFFFFF] dark:bg-[#211D1B] border border-stone-200/90 dark:border-white/10 shadow-sm hover:shadow-lg transition-all flex flex-col justify-between gap-3">
        <div class="space-y-2.5">
          ${mediaHtml}
          <h3 onclick="openProductDetailModal('${p.id}')" class="product-name cursor-pointer hover:text-[#7C1D18] dark:hover:text-[#F2AE79] font-display font-bold text-sm sm:text-base leading-snug transition-colors">${p.title}</h3>
        </div>

        <div class="space-y-2 pt-1">
          ${pricingBlock}
          ${actionButtons}
        </div>
      </article>
    `;
  }).join('');
}

// ============================================================================
// PANTALLA INDEPENDIENTE DE DETALLE DEL PRODUCTO (AL HACER CLIC ARRIBA)
// ============================================================================
function openProductDetailModal(productId) {
  const p = appState.products.find(x => String(x.id) === String(productId));
  if (!p) return;

  detailModalProductId = String(p.id);
  detailModalMode = p.saleModes.includes('CONTAINER_B2B')
    ? 'CONTAINER_B2B'
    : p.saleModes.includes('RETAIL')
    ? 'RETAIL'
    : 'WHOLESALE';
  detailModalQty = detailModalMode === 'WHOLESALE' ? Number(p.minWholesaleQty || 1) : 1;

  renderProductDetailModalContent(detailModalProductId);
  const modal = document.getElementById('product-detail-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeProductDetailModal() {
  const modal = document.getElementById('product-detail-modal');
  if (modal) modal.classList.add('hidden');
  detailModalProductId = null;
}

function setDetailModalMode(mode, minQty) {
  detailModalMode = mode;
  detailModalQty = mode === 'WHOLESALE' ? Math.max(detailModalQty, Number(minQty || 1)) : Math.max(1, detailModalQty);
  if (detailModalProductId) {
    renderProductDetailModalContent(detailModalProductId);
  }
}

function changeDetailModalQty(delta, minQty) {
  const minAllowed = detailModalMode === 'WHOLESALE' ? Number(minQty || 1) : 1;
  detailModalQty = Math.max(minAllowed, detailModalQty + delta);
  if (detailModalProductId) {
    renderProductDetailModalContent(detailModalProductId);
  }
}

function renderProductDetailModalContent(productId) {
  const p = appState.products.find(x => String(x.id) === String(productId));
  if (!p) return;

  const vendor = appState.vendors.find(v => v.id === p.vendorId) || appState.vendors[0];
  const deliv = calculateVendorDelivery(vendor);
  const catObj = appState.categories.find(c => c.id === p.category);
  const role = ROLE_MATRIX[appState.currentRole] || ROLE_MATRIX.ALL_VIEW;

  const skuEl = document.getElementById('detail-modal-sku');
  const catEl = document.getElementById('detail-modal-category');
  const bodyEl = document.getElementById('product-detail-body');
  if (!bodyEl) return;

  if (skuEl) skuEl.textContent = p.sku;
  if (catEl) catEl.textContent = catObj ? catObj.name : p.category;

  const isContainerItem = p.saleModes.includes('CONTAINER_B2B');
  const hasWholesale = p.saleModes.includes('WHOLESALE');
  const hasRetail = p.saleModes.includes('RETAIL');

  const activeUnitPriceUsd =
    detailModalMode === 'CONTAINER_B2B'
      ? Number(p.priceContainerUsd)
      : detailModalMode === 'WHOLESALE'
      ? Number(p.priceWholesaleUsd)
      : Number(p.priceRetailUsd);

  const activeUnitLabel =
    detailModalMode === 'WHOLESALE' ? p.unitWholesale : p.unitRetail;

  const canBuyCurrentMode =
    (detailModalMode === 'CONTAINER_B2B' && role.canBuyContainer) ||
    (detailModalMode === 'WHOLESALE' && role.canBuyWholesale) ||
    (detailModalMode === 'RETAIL' && role.canBuyRetail);

  const lineTotalUsd = activeUnitPriceUsd * detailModalQty;
  const isDetailWholesaleOrB2B = detailModalMode === 'WHOLESALE' || detailModalMode === 'CONTAINER_B2B';

  bodyEl.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
      <!-- Columna Izquierda: Imagen en Fondo Blanco + Tarjeta de la Tienda -->
      <div class="md:col-span-5 space-y-4">
        <div class="aspect-square w-full rounded-3xl bg-white border border-stone-200 p-4 flex items-center justify-center shadow-sm">
          <img src="${p.image}" alt="${p.title}" class="w-full h-full object-contain" />
        </div>

        <!-- Información de la Tienda / Proveedor -->
        <div class="p-4 rounded-2xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 space-y-2 text-xs">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2.5">
              <img src="${vendor.logo || 'assets/wssnd-skylink-logo.jpg'}" alt="${vendor.name}" class="w-10 h-10 rounded-xl object-contain bg-white border border-stone-200 p-0.5" />
              <div>
                <span class="text-[10px] font-bold uppercase tracking-wider text-[#7C1D18] dark:text-[#F2AE79] block">${vendor.badge}</span>
                <h4 class="font-display font-bold text-sm">${vendor.name}</h4>
              </div>
            </div>
            <span class="text-xs font-bold text-amber-600"><i class="fa-solid fa-star"></i> ${vendor.rating}</span>
          </div>
          <p class="text-[11px] opacity-80">${vendor.description}</p>
          <button onclick="closeProductDetailModal(); activeVendorFilter='${vendor.id}'; renderCatalog();" class="w-full py-2 rounded-xl bg-white dark:bg-white/10 border border-stone-300 dark:border-white/15 font-bold text-xs hover:border-[#7C1D18] transition-all">
            Ver todos los productos de ${vendor.name}
          </button>
        </div>
      </div>

      <!-- Columna Derecha: Toda la Información Detallada del Producto -->
      <div class="md:col-span-7 space-y-4">
        <div>
          <h2 class="font-display text-xl sm:text-2xl font-extrabold leading-snug">${p.title}</h2>
          <p class="text-xs sm:text-sm opacity-85 mt-2 leading-relaxed">${p.description || 'Producto verificado disponible en el catálogo oficial de Mercapros Cuba.'}</p>
        </div>

        <!-- Desglose de Precios y Unidades de Medida (Mayorista y Contenedores sin CUP) -->
        <div class="p-4 rounded-2xl bg-stone-100/90 dark:bg-white/5 border border-stone-200 dark:border-white/10 space-y-3">
          ${isContainerItem ? `
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <span class="text-xs font-bold uppercase tracking-wider text-[#7C1D18] dark:text-[#F2AE79] block">Precio por Contenedor CIF Mariel</span>
                <span class="text-2xl sm:text-3xl font-extrabold">${formatMoney(p.priceContainerUsd, true)}</span>
              </div>
              <div class="text-right">
                <span class="text-xs font-bold opacity-75 block">Costo Unitario Referencial</span>
                <span class="text-base font-extrabold text-[#7C1D18] dark:text-[#F2AE79]">${p.unitPriceLabel || `$${p.priceRetailUsd} USD`}</span>
              </div>
            </div>
            <div class="pt-2 border-t border-stone-200 dark:border-white/10 text-xs flex flex-wrap items-center justify-between gap-2">
              <span><strong>Unidad de Medida:</strong> ${p.unitRetail}</span>
              <span class="font-bold text-emerald-800 dark:text-emerald-300"><i class="fa-solid fa-ship mr-1"></i>${p.incoterm}</span>
            </div>
          ` : `
            <div class="grid ${hasWholesale ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'} gap-2.5">
              ${hasRetail ? `
                <button type="button" onclick="setDetailModalMode('RETAIL', 1)" class="p-3 rounded-xl border text-left transition-all ${
                  detailModalMode === 'RETAIL'
                    ? 'bg-white dark:bg-[#171413] border-[#7C1D18] ring-2 ring-[#7C1D18]/20'
                    : 'bg-white/60 dark:bg-white/5 border-stone-200 dark:border-white/10'
                }">
                  <span class="text-[10px] font-bold uppercase tracking-wider text-[#7C1D18] dark:text-[#F2AE79] block">Compra Minorista</span>
                  <span class="text-xl font-extrabold block mt-0.5">${formatMoney(p.priceRetailUsd, false)}</span>
                  <span class="text-xs opacity-80 block mt-0.5">Unidad: <strong>${p.unitRetail}</strong></span>
                </button>
              ` : ''}
              ${hasWholesale ? `
                <button type="button" onclick="setDetailModalMode('WHOLESALE', ${p.minWholesaleQty || 3})" class="p-3 rounded-xl border text-left transition-all ${
                  detailModalMode === 'WHOLESALE'
                    ? 'bg-white dark:bg-[#171413] border-[#7C1D18] ring-2 ring-[#7C1D18]/20'
                    : 'bg-white/60 dark:bg-white/5 border-stone-200 dark:border-white/10'
                }">
                  <span class="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 block">Compra Mayorista (Mín. ${p.minWholesaleQty}+)</span>
                  <span class="text-xl font-extrabold block mt-0.5">${formatMoney(p.priceWholesaleUsd, true)}</span>
                  <span class="text-xs opacity-80 block mt-0.5">Unidad: <strong>${p.unitWholesale}</strong></span>
                </button>
              ` : ''}
            </div>
          `}
        </div>

        <!-- Ficha Técnica, Origen, Naviera y Logística de Entrega -->
        <div class="p-4 rounded-2xl bg-white dark:bg-black/20 border border-stone-200 dark:border-white/10 space-y-2.5 text-xs">
          <h4 class="font-display font-bold text-sm">Especificaciones Técnicas y Logística</h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div class="p-2.5 rounded-xl bg-stone-100/80 dark:bg-white/5">
              <span class="text-[10px] font-bold uppercase opacity-60 block">Ficha / Origen / Naviera</span>
              <span class="font-semibold block mt-0.5">${p.specs}</span>
            </div>
            <div class="p-2.5 rounded-xl bg-stone-100/80 dark:bg-white/5">
              <span class="text-[10px] font-bold uppercase opacity-60 block">Condición de Entrega / Domicilio</span>
              <span class="font-semibold block mt-0.5">
                ${deliv.isCifPort
                  ? 'CIF Puerto del Mariel, Cuba (Flete marítimo incluido)'
                  : `${appState.selectedMunicipality} • ${deliv.distanceKm} km (${formatMoney(deliv.feeUsd, isDetailWholesaleOrB2B)})`
                }
              </span>
            </div>
            <div class="p-2.5 rounded-xl bg-stone-100/80 dark:bg-white/5">
              <span class="text-[10px] font-bold uppercase opacity-60 block">Unidad de Medida Seleccionada</span>
              <span class="font-semibold block mt-0.5">${activeUnitLabel}</span>
            </div>
            <div class="p-2.5 rounded-xl bg-stone-100/80 dark:bg-white/5">
              <span class="text-[10px] font-bold uppercase opacity-60 block">Disponibilidad en Stock</span>
              <span class="font-semibold text-emerald-700 dark:text-emerald-400 block mt-0.5">${p.stock} lotes/unidades disponibles</span>
            </div>
          </div>
        </div>

        <!-- Selector de Cantidad + Botón "Añadir" con Ícono del Carrito -->
        <div class="pt-2 flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-2 bg-stone-100 dark:bg-white/10 px-3 py-2 rounded-2xl border border-stone-300 dark:border-white/15">
            <button type="button" onclick="changeDetailModalQty(-1, ${p.minWholesaleQty || 1})" class="w-8 h-8 rounded-xl bg-white dark:bg-black/40 font-extrabold text-sm">-</button>
            <span class="w-10 text-center font-extrabold text-sm">${detailModalQty}</span>
            <button type="button" onclick="changeDetailModalQty(1, ${p.minWholesaleQty || 1})" class="w-8 h-8 rounded-xl bg-white dark:bg-black/40 font-extrabold text-sm">+</button>
          </div>

          ${canBuyCurrentMode ? `
            <button type="button" onclick="addToCartWithQty('${p.id}', '${detailModalMode}', ${detailModalQty}); closeProductDetailModal();" class="flex-1 py-3.5 px-5 rounded-2xl bg-[#2A2522] hover:bg-[#7C1D18] dark:bg-[#F2AE79] dark:text-[#171413] text-white font-extrabold text-xs sm:text-sm shadow-lg transition-all flex items-center justify-center gap-2">
              <i class="fa-solid fa-cart-shopping"></i>
              <span>Añadir (${formatMoney(lineTotalUsd, isDetailWholesaleOrB2B)})</span>
            </button>
          ` : `
            <button type="button" onclick="closeProductDetailModal(); openUserAuthModal();" class="flex-1 py-3.5 px-5 rounded-2xl bg-[#7C1D18] text-white font-extrabold text-xs sm:text-sm shadow-lg transition-all flex items-center justify-center gap-2">
              <i class="fa-solid fa-user-lock"></i>
              <span>Requiere Cuenta Mipyme / Importador</span>
            </button>
          `}
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// CARRITO Y ENVÍO DE TICKET DE COMPRA A WHATSAPP (SIN PASARELA DE PAGO)
// ============================================================================
function addToCart(productId, mode) {
  const product = appState.products.find(p => String(p.id) === String(productId));
  if (!product) return;
  const minQty = mode === 'WHOLESALE' ? Number(product.minWholesaleQty || 1) : 1;
  addToCartWithQty(productId, mode, minQty);
}

function addToCartWithQty(productId, mode, qtyToAdd) {
  const product = appState.products.find(p => String(p.id) === String(productId));
  if (!product) return;

  const unitPriceUsd =
    mode === 'CONTAINER_B2B'
      ? Number(product.priceContainerUsd)
      : mode === 'WHOLESALE'
      ? Number(product.priceWholesaleUsd)
      : Number(product.priceRetailUsd);

  const validQty = Math.max(1, Number(qtyToAdd || 1));
  const cartKey = `${product.id}__${mode}`;

  const existing = cart.find(item => item.cartKey === cartKey);
  if (existing) {
    existing.qty += validQty;
  } else {
    cart.push({
      cartKey,
      productId: String(product.id),
      sku: product.sku,
      title: product.title,
      vendorId: product.vendorId,
      vendorName: product.vendorName,
      mode,
      unitLabel: mode === 'WHOLESALE' ? product.unitWholesale : product.unitRetail,
      unitPriceUsd,
      qty: validQty
    });
  }

  updateCartUI();
  showToast(`Añadido al carrito: ${product.title}`);
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
      <div class="text-center py-10 opacity-70">
        <i class="fa-solid fa-receipt text-2xl mb-2 text-[#7C1D18]"></i>
        <p class="text-xs font-semibold">Tu ticket de pedido está vacío</p>
      </div>
    `;
    summaryEl.innerHTML = '';
    return;
  }

  let subtotalUsd = 0;
  const uniqueVendorIds = new Set();
  const hasAnyWholesaleInCart = cart.some(i => i.mode === 'WHOLESALE' || i.mode === 'CONTAINER_B2B');

  listEl.innerHTML = cart.map(item => {
    const lineUsd = item.unitPriceUsd * item.qty;
    subtotalUsd += lineUsd;
    uniqueVendorIds.add(item.vendorId);
    const isWholesaleLine = item.mode === 'WHOLESALE' || item.mode === 'CONTAINER_B2B';

    return `
      <div class="p-3 rounded-2xl bg-stone-100/80 dark:bg-white/5 border border-stone-200 dark:border-white/10 flex items-center justify-between gap-2">
        <div class="min-w-0 flex-1">
          <span class="text-[10px] font-bold text-[#7C1D18] dark:text-[#F2AE79] block">${item.vendorName}</span>
          <h4 class="font-bold text-xs truncate">${item.title}</h4>
          <p class="text-[11px] opacity-75">${item.unitLabel}</p>
          <p class="text-xs font-extrabold mt-0.5">${formatMoney(lineUsd, isWholesaleLine)}</p>
        </div>
        <div class="flex items-center gap-1.5">
          <button onclick="updateCartItemQty('${item.cartKey}', -1)" class="w-7 h-7 rounded-lg bg-white dark:bg-white/10 border border-stone-300 dark:border-white/10 font-bold text-xs">-</button>
          <span class="w-6 text-center font-bold text-xs">${item.qty}</span>
          <button onclick="updateCartItemQty('${item.cartKey}', 1)" class="w-7 h-7 rounded-lg bg-white dark:bg-white/10 border border-stone-300 dark:border-white/10 font-bold text-xs">+</button>
        </div>
      </div>
    `;
  }).join('');

  let totalDeliveryUsd = 0;
  uniqueVendorIds.forEach(vid => {
    const vendor = appState.vendors.find(v => v.id === vid);
    if (vendor) {
      const d = calculateVendorDelivery(vendor);
      totalDeliveryUsd += d.feeUsd;
    }
  });

  const grandTotalUsd = subtotalUsd + totalDeliveryUsd;

  summaryEl.innerHTML = `
    <div class="space-y-1.5 pt-3 border-t border-stone-200 dark:border-white/10 text-xs">
      <div class="flex justify-between">
        <span class="opacity-75">Destino:</span>
        <span class="font-bold">${appState.selectedMunicipality}</span>
      </div>
      <div class="flex justify-between">
        <span class="opacity-75">Subtotal Catálogo:</span>
        <span class="font-bold">${formatMoney(subtotalUsd, hasAnyWholesaleInCart)}</span>
      </div>
      ${totalDeliveryUsd > 0 ? `
        <div class="flex justify-between text-emerald-800 dark:text-emerald-300">
          <span>Domicilio GPS:</span>
          <span class="font-bold">${formatMoney(totalDeliveryUsd, hasAnyWholesaleInCart)}</span>
        </div>
      ` : `
        <div class="flex justify-between text-emerald-800 dark:text-emerald-300">
          <span>Condición Marítima:</span>
          <span class="font-bold">CIF Puerto del Mariel Incluido</span>
        </div>
      `}
      <div class="flex justify-between text-base font-extrabold pt-2 border-t border-stone-200 dark:border-white/10">
        <span>Total Estimado:</span>
        <span>${formatMoney(grandTotalUsd, hasAnyWholesaleInCart)}</span>
      </div>
    </div>
  `;
}

// Envío directo de Ticket de Compra a WhatsApp desde el Carrito
function submitCheckoutOrder() {
  if (cart.length === 0) {
    showToast('Agrega al menos un producto al carrito.');
    return;
  }
  const customerNameInput = document.getElementById('checkout-customer-name');
  const customerNotesInput = document.getElementById('checkout-customer-notes');
  const customerName = (customerNameInput && customerNameInput.value.trim()) || 'Cliente / Empresa Cuba';
  const customerNotes = (customerNotesInput && customerNotesInput.value.trim()) || '';

  let subtotalUsd = 0;
  let deliveryUsd = 0;
  const vendorSet = new Set();
  cart.forEach(i => {
    subtotalUsd += i.unitPriceUsd * i.qty;
    vendorSet.add(i.vendorId);
  });

  let firstVendor = appState.vendors[0];
  let distKm = 0;
  vendorSet.forEach(vid => {
    const v = appState.vendors.find(x => x.id === vid);
    if (v) {
      firstVendor = v;
      const d = calculateVendorDelivery(v);
      distKm = d.distanceKm;
      deliveryUsd += d.feeUsd;
    }
  });

  const totalUsd = Number((subtotalUsd + deliveryUsd).toFixed(2));
  const ticketId = `TCK-${Math.floor(1000 + Math.random() * 9000)}`;
  const dateStr = new Date().toISOString().slice(0, 16).replace('T', ' ');

  // Guardar en historial del Dashboard
  const newOrder = {
    id: ticketId,
    date: dateStr,
    customerName,
    customerRole: appState.currentRole,
    vendorName: firstVendor.name,
    orderType: cart.some(i => i.mode === 'CONTAINER_B2B')
      ? 'CONTENEDOR CIF MARIEL (Ticket WhatsApp)'
      : 'PEDIDO CATÁLOGO (Ticket WhatsApp)',
    municipality: appState.selectedMunicipality,
    distanceKm: distKm,
    deliveryUsd: Number(deliveryUsd.toFixed(2)),
    subtotalUsd: Number(subtotalUsd.toFixed(2)),
    totalUsd,
    status: 'Ticket Enviado a WhatsApp',
    itemsSummary: cart.map(i => `${i.qty}x ${i.title} ($${(i.unitPriceUsd * i.qty).toLocaleString('en-US')})`).join(' | ')
  };

  appState.orders.unshift(newOrder);
  saveMercaprosState(appState);

  // Construir Ticket estructurado para enviar a WhatsApp
  const lines = [
    `*MERCAPROS CUBA - TICKET DE PEDIDO ${ticketId}*`,
    `Fecha: ${dateStr}`,
    `Cliente / Empresa: ${customerName}`,
    `Ubicación / Destino: ${appState.selectedMunicipality} (${appState.userGps.address})`,
    `--------------------------------`,
    `*DETALLE DEL PEDIDO:*`
  ];

  cart.forEach((item, idx) => {
    const lineTotal = (item.unitPriceUsd * item.qty).toLocaleString('en-US', { minimumFractionDigits: 2 });
    lines.push(`${idx + 1}. *${item.title}*`);
    lines.push(`   Tienda: ${item.vendorName} | Cant: ${item.qty} (${item.unitLabel}) | Subtotal: $${lineTotal} USD`);
  });

  lines.push(`--------------------------------`);
  if (deliveryUsd > 0) {
    lines.push(`Domicilio GPS: $${deliveryUsd.toFixed(2)} USD`);
  } else {
    lines.push(`Condición: CIF Puerto del Mariel Cuba`);
  }
  lines.push(`*TOTAL TICKET: $${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD*`);
  if (customerNotes) {
    lines.push(`Nota: ${customerNotes}`);
  }

  const waUrl = `https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join('\n'))}`;
  window.open(waUrl, '_blank', 'noopener');

  cart = [];
  updateCartUI();
  toggleCartDrawer(false);
  showToast(`Ticket ${ticketId} generado y abierto en WhatsApp.`);
}

function toggleCartDrawer(show) {
  const drawer = document.getElementById('cart-drawer-modal');
  if (!drawer) return;
  if (show) {
    drawer.classList.remove('hidden');
    if (appState.currentUser) {
      const nameInput = document.getElementById('checkout-customer-name');
      const notesInput = document.getElementById('checkout-customer-notes');
      if (nameInput && !nameInput.value.trim()) {
        const orgLabel = appState.currentUser.companyName || appState.currentUser.businessName || '';
        nameInput.value = orgLabel ? `${orgLabel} (${appState.currentUser.fullName})` : appState.currentUser.fullName;
      }
      if (notesInput && !notesInput.value.trim()) {
        const extra = [
          appState.currentUser.phone ? `Tel: ${appState.currentUser.phone}` : '',
          appState.currentUser.ci ? `CI: ${appState.currentUser.ci}` : '',
          appState.currentUser.nit ? `NIT: ${appState.currentUser.nit}` : '',
          appState.currentUser.reference ? `Ref: ${appState.currentUser.reference}` : ''
        ].filter(Boolean).join(' • ');
        notesInput.value = extra;
      }
    }
    updateCartUI();
  } else {
    drawer.classList.add('hidden');
  }
}

// ============================================================================
// SISTEMA DE DOMICILIO Y MAPA INTERACTIVO GPS (LEAFLET)
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
  renderStoresSection();
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
    deliveryMap = L.map('cuba-leaflet-map').setView([appState.userGps.lat, appState.userGps.lng], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap'
    }).addTo(deliveryMap);

    userMarker = L.marker([appState.userGps.lat, appState.userGps.lng], { draggable: true })
      .addTo(deliveryMap)
      .bindPopup('<b>Punto de Entrega</b><br>Arrastra el pin en el mapa.')
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
    deliveryMap.setView([appState.userGps.lat, appState.userGps.lng], 12);
    userMarker.setLatLng([appState.userGps.lat, appState.userGps.lng]);
  }

  vendorMarkers.forEach(m => deliveryMap.removeLayer(m));
  vendorMarkers = [];

  appState.vendors.forEach(v => {
    const m = L.circleMarker([v.lat, v.lng], {
      radius: 9,
      fillColor: v.role === 'EXPORTADOR_B2B' ? '#065f46' : v.role === 'MIPYME' ? '#7C1D18' : '#0f766e',
      color: '#ffffff',
      weight: 2,
      fillOpacity: 0.95
    })
      .addTo(deliveryMap)
      .bindPopup(`<b>${v.name}</b><br>${v.badge}`);
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
      { color: '#7C1D18', weight: 3, dashArray: '6, 8' }
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
  renderStoresSection();
  renderCatalog();
  updateCartUI();
}

function saveCustomUserAddress() {
  const addrInput = document.getElementById('map-user-address-input');
  if (addrInput && addrInput.value.trim()) {
    appState.userGps.address = addrInput.value.trim();
    saveMercaprosState(appState);
    updateCartUI();
    showToast('Dirección GPS actualizada.');
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
        <td class="py-2 pr-2 font-bold">${v.name}</td>
        <td class="py-2 px-1">${d.isCifPort ? 'CIF Mariel' : formatMoney(v.baseDeliveryFeeUsd)}</td>
        <td class="py-2 px-1 font-semibold text-[#7C1D18] dark:text-[#F2AE79]">${d.isCifPort ? '-' : `${formatMoney(v.pricePerKmUsd)}/km`}</td>
        <td class="py-2 px-1">${d.isCifPort ? 'Puerto' : `${d.distanceKm} km`}</td>
        <td class="py-2 pl-2 text-right font-extrabold text-emerald-800 dark:text-emerald-300">${d.isCifPort ? 'Incluido' : formatMoney(d.feeUsd)}</td>
      </tr>
    `;
  }).join('');
}

// ============================================================================
// DASHBOARD ADMINISTRADOR MÓVIL (5 PESTAÑAS + RBAC)
// ============================================================================
function populateAdminVendorSelects() {
  const loginSelect = document.getElementById('admin-role-login-select');
  const dashSelect = document.getElementById('admin-active-vendor-select');
  const optionsHtml = appState.vendors.map(v => {
    const prefix = v.role === 'EXPORTADOR_B2B' ? 'Exportador' : v.role === 'MIPYME' ? 'Mipyme' : 'TCP';
    return `<option value="${v.id}">${prefix}: ${v.name}</option>`;
  }).join('');
  if (loginSelect) loginSelect.innerHTML = optionsHtml;
  if (dashSelect) dashSelect.innerHTML = optionsHtml;
}

function openAdminModal() {
  populateAdminVendorSelects();
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
    showToast('Ingresa el correo del negocio.');
    return;
  }

  isAdminAuthenticated = true;
  appState.activeVendorId = roleSelect;
  const vendor = appState.vendors.find(v => v.id === roleSelect);
  if (vendor) {
    appState.currentRole = vendor.role;
  }
  saveMercaprosState(appState);

  const goldPill = document.getElementById('header-admin-gold-pill');
  if (goldPill) goldPill.classList.remove('hidden');

  document.getElementById('admin-login-modal').classList.add('hidden');
  document.getElementById('admin-dashboard-modal').classList.remove('hidden');
  renderRoleBar();
  renderAdminDashboard();
  showToast(`Panel abierto: ${vendor ? vendor.name : 'Admin'}`);
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
      btn.className = 'js-admin-tab-btn px-4 py-2.5 rounded-xl text-xs font-bold bg-[#2A2522] text-[#F7F5F0] dark:bg-[#F2AE79] dark:text-[#171413] shadow-sm flex items-center gap-2 shrink-0';
    } else {
      btn.className = 'js-admin-tab-btn px-4 py-2.5 rounded-xl text-xs font-semibold bg-stone-200/70 dark:bg-white/10 hover:bg-stone-300/60 flex items-center gap-2 shrink-0';
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
  populateAdminVendorSelects();
  const activeVendor = appState.vendors.find(v => v.id === appState.activeVendorId) || appState.vendors[0];

  const vendorSwitcher = document.getElementById('admin-active-vendor-select');
  if (vendorSwitcher) vendorSwitcher.value = activeVendor.id;

  const wholesaleFieldGroup = document.getElementById('admin-wholesale-field-group');
  const containerFieldGroup = document.getElementById('admin-container-field-group');
  if (wholesaleFieldGroup && containerFieldGroup) {
    if (activeVendor.role === 'TCP') {
      wholesaleFieldGroup.classList.add('opacity-40', 'pointer-events-none');
      containerFieldGroup.classList.add('hidden');
      document.getElementById('prod-wholesale-Note').textContent = 'TCP: Solo Venta Minorista';
    } else if (activeVendor.role === 'MIPYME') {
      wholesaleFieldGroup.classList.remove('opacity-40', 'pointer-events-none');
      containerFieldGroup.classList.add('hidden');
      document.getElementById('prod-wholesale-Note').textContent = 'Mipyme: Mayorista y Minorista';
    } else {
      containerFieldGroup.classList.remove('hidden');
      wholesaleFieldGroup.classList.remove('opacity-40', 'pointer-events-none');
      document.getElementById('prod-wholesale-Note').textContent = 'Exportador: Venta por Contenedor';
    }
  }

  const catSelect = document.getElementById('prod-category-input');
  if (catSelect) {
    catSelect.innerHTML = appState.categories
      .filter(c => c.id !== 'all' && c.id !== 'tiendas')
      .map(c => `<option value="${c.id}">${c.name}</option>`)
      .join('');
  }

  const invList = document.getElementById('admin-inventory-list');
  if (invList) {
    const vendorProducts = appState.products.filter(p => p.vendorId === activeVendor.id);
    invList.innerHTML = vendorProducts.map(p => `
      <div class="p-3 rounded-2xl bg-[#FFFFFF] dark:bg-white/5 border border-stone-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-3 min-w-0">
          <img src="${p.image}" alt="${p.title}" class="w-12 h-12 rounded-xl object-cover border border-stone-200" />
          <div class="min-w-0">
            <span class="text-[10px] font-mono opacity-70">${p.sku}</span>
            <h5 class="font-bold text-xs sm:text-sm truncate">${p.title}</h5>
            <p class="text-xs text-[#7C1D18] dark:text-[#F2AE79] font-bold">
              ${p.saleModes.includes('CONTAINER_B2B')
                ? `Contenedor CIF: ${formatMoney(p.priceContainerUsd, true)} (${p.unitPriceLabel || ''})`
                : `Minorista: ${formatMoney(p.priceRetailUsd, false)}${p.saleModes.includes('WHOLESALE') ? ` • Mayorista: ${formatMoney(p.priceWholesaleUsd, true)}` : ''}`
              }
            </p>
          </div>
        </div>
        <div class="flex items-center gap-1.5">
          <button onclick="loadProductIntoForm('${String(p.id)}')" class="px-2.5 py-1.5 rounded-lg bg-stone-200 dark:bg-white/10 text-xs font-bold hover:bg-[#7C1D18] hover:text-white">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button onclick="deleteProductStrict('${String(p.id)}')" class="px-2.5 py-1.5 rounded-lg bg-red-600/15 text-red-700 text-xs font-bold hover:bg-red-600 hover:text-white">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    `).join('') || `<p class="text-xs opacity-70 py-4">Sin productos en esta tienda.</p>`;
  }

  const annList = document.getElementById('admin-announcements-list');
  if (annList) {
    annList.innerHTML = appState.announcements.map(a => `
      <div class="p-3 rounded-2xl bg-[#FFFFFF] dark:bg-white/5 border border-stone-200 dark:border-white/10 flex items-center justify-between gap-2">
        <div>
          <h5 class="font-bold text-xs">${a.title}</h5>
          <p class="text-[11px] opacity-75">${a.subtitle}</p>
        </div>
        <button onclick="deleteAnnouncement('${String(a.id)}')" class="px-2.5 py-1 rounded-lg bg-red-600/15 text-red-700 text-xs font-bold">
          Quitar
        </button>
      </div>
    `).join('');
  }

  const catList = document.getElementById('admin-categories-list');
  if (catList) {
    catList.innerHTML = appState.categories.filter(c => c.id !== 'all').map(c => `
      <div class="p-3 rounded-2xl bg-[#FFFFFF] dark:bg-white/5 border border-stone-200 dark:border-white/10 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <i class="fa-solid ${c.icon} text-[#7C1D18]"></i>
          <span class="font-bold text-xs">${c.name}</span>
        </div>
        <button onclick="deleteCategoryStrict('${String(c.id)}')" class="text-xs text-red-600 font-bold hover:underline">Quitar</button>
      </div>
    `).join('');
  }

  const ordList = document.getElementById('admin-orders-list');
  if (ordList) {
    ordList.innerHTML = appState.orders.map(o => `
      <div class="p-3.5 rounded-2xl bg-[#FFFFFF] dark:bg-white/5 border border-stone-200 dark:border-white/10 space-y-1">
        <div class="flex items-center justify-between">
          <span class="font-mono font-extrabold text-xs text-[#7C1D18] dark:text-[#F2AE79]">${o.id} • ${o.date}</span>
          <span class="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">${o.status}</span>
        </div>
        <div class="font-bold text-xs">${o.customerName} → ${o.vendorName}</div>
        <p class="text-[11px] opacity-80">${o.itemsSummary}</p>
        <div class="text-xs font-extrabold pt-1">Total: ${formatMoney(o.totalUsd)}</div>
      </div>
    `).join('');
  }

  document.getElementById('vendor-cfg-basefee').value = activeVendor.baseDeliveryFeeUsd;
  document.getElementById('vendor-cfg-kmprice').value = activeVendor.pricePerKmUsd;
  document.getElementById('vendor-cfg-lat').value = activeVendor.lat;
  document.getElementById('vendor-cfg-lng').value = activeVendor.lng;
  document.getElementById('supabase-url-input').value = appState.supabaseConfig.url || '';
  document.getElementById('supabase-key-input').value = appState.supabaseConfig.anonKey || '';
}

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
      showToast(`Foto optimizada (${approxKb} KB).`);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function saveProductFromAdmin(e) {
  if (e) e.preventDefault();
  const activeVendor = appState.vendors.find(v => v.id === appState.activeVendorId) || appState.vendors[0];

  const title = document.getElementById('prod-title-input').value.trim();
  const sku = document.getElementById('prod-sku-input').value.trim() || `SKU-${Date.now().toString().slice(-4)}`;
  const category = document.getElementById('prod-category-input').value;
  const priceRetailUsd = Number(document.getElementById('prod-retail-input').value || 0);
  const priceWholesaleUsd = Number(document.getElementById('prod-wholesale-input').value || 0);
  const priceContainerUsd = Number(document.getElementById('prod-container-input').value || 0);
  const minWholesaleQty = Number(document.getElementById('prod-minqty-input').value || 5);
  const stock = Number(document.getElementById('prod-stock-input').value || 25);
  const unitRetail = document.getElementById('prod-unitretail-input').value.trim() || 'Unidad';
  const unitWholesale = document.getElementById('prod-unitwholesale-input').value.trim() || 'Caja Mayorista';
  const specs = document.getElementById('prod-specs-input').value.trim() || 'Entrega Garantizada';
  const description = document.getElementById('prod-desc-input').value.trim();
  const isFlashOffer = document.getElementById('prod-flash-checkbox').checked;
  const image = document.getElementById('prod-image-dataurl').value || 'assets/combo-proteina.jpg';

  if (!title) return;

  let saleModes = ['RETAIL'];
  if (activeVendor.role === 'EXPORTADOR_B2B') {
    saleModes = ['CONTAINER_B2B'];
  } else if (activeVendor.role === 'MIPYME') {
    saleModes = priceWholesaleUsd > 0 ? ['WHOLESALE', 'RETAIL'] : ['RETAIL'];
  } else if (activeVendor.role === 'TCP') {
    saleModes = ['RETAIL'];
  }

  const productObj = {
    id: editingProductId ? String(editingProductId) : `prod-${Date.now()}`,
    sku,
    title,
    category,
    isContainerOffer: activeVendor.role === 'EXPORTADOR_B2B',
    vendorId: activeVendor.id,
    vendorName: activeVendor.name,
    vendorRole: activeVendor.role,
    saleModes,
    priceContainerUsd: activeVendor.role === 'EXPORTADOR_B2B' ? (priceContainerUsd || priceWholesaleUsd || priceRetailUsd) : 0,
    priceWholesaleUsd: activeVendor.role === 'TCP' ? priceRetailUsd : (priceWholesaleUsd || priceRetailUsd),
    priceRetailUsd,
    unitPriceLabel: `$${priceRetailUsd.toFixed(2)} USD / Ud`,
    oldPriceUsd: 0,
    discountPct: isFlashOffer ? 10 : 0,
    minWholesaleQty,
    unitRetail,
    unitWholesale: activeVendor.role === 'TCP' ? 'TCP: Solo Venta Minorista' : unitWholesale,
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
  showToast('Producto guardado.');
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
  document.getElementById('prod-minqty-input').value = p.minWholesaleQty || 1;
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
  showToast('Producto eliminado.');
}

function addAnnouncementFromAdmin(e) {
  if (e) e.preventDefault();
  const title = document.getElementById('ann-title-input').value.trim();
  const subtitle = document.getElementById('ann-subtitle-input').value.trim();
  const badge = document.getElementById('ann-badge-input').value.trim() || 'PROMO';
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
  renderAdminDashboard();
  e.target.reset();
  showToast('Promoción guardada.');
}

function deleteAnnouncement(id) {
  const strId = String(id);
  appState.announcements = appState.announcements.filter(a => String(a.id) !== strId);
  saveMercaprosState(appState);
  renderAdminDashboard();
}

function addCategoryFromAdmin(e) {
  if (e) e.preventDefault();
  const name = document.getElementById('cat-name-input').value.trim();
  const icon = document.getElementById('cat-icon-input').value.trim() || 'fa-tag';
  if (!name) return;

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  appState.categories.push({
    id: slug,
    name,
    icon,
    tierAccess: 'ALL'
  });
  saveMercaprosState(appState);
  renderCategoriesBar();
  renderAdminDashboard();
  e.target.reset();
  showToast(`Categoría "${name}" agregada.`);
}

function deleteCategoryStrict(catId) {
  const strId = String(catId);
  appState.categories = appState.categories.filter(c => String(c.id) !== strId);
  saveMercaprosState(appState);
  renderCategoriesBar();
  renderAdminDashboard();
}

function saveVendorLogisticsConfig(e) {
  if (e) e.preventDefault();
  const activeVendor = appState.vendors.find(v => v.id === appState.activeVendorId);
  if (!activeVendor) return;

  activeVendor.baseDeliveryFeeUsd = Number(document.getElementById('vendor-cfg-basefee').value || 0);
  activeVendor.pricePerKmUsd = Number(document.getElementById('vendor-cfg-kmprice').value || 0);
  activeVendor.lat = Number(document.getElementById('vendor-cfg-lat').value || activeVendor.lat);
  activeVendor.lng = Number(document.getElementById('vendor-cfg-lng').value || activeVendor.lng);

  saveMercaprosState(appState);
  renderStoresSection();
  renderCatalog();
  updateCartUI();
  showToast(`Tarifa actualizada para ${activeVendor.name}`);
}

function saveSupabaseCredentials(e) {
  if (e) e.preventDefault();
  appState.supabaseConfig.url = document.getElementById('supabase-url-input').value.trim();
  appState.supabaseConfig.anonKey = document.getElementById('supabase-key-input').value.trim();
  saveMercaprosState(appState);
  syncFromSupabase(appState, (res) => {
    showToast(res.synced ? 'Sincronizado con Supabase.' : `Guardado local.`);
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

function showToast(msg) {
  const toast = document.getElementById('mercapros-toast');
  const text = document.getElementById('mercapros-toast-text');
  if (!toast || !text) return;
  text.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

// ============================================================================
// SISTEMA DE AUTENTICACIÓN Y CREACIÓN DE USUARIOS (4 NIVELES DE PLATAFORMA)
// ============================================================================
const REGISTER_ROLE_DESCRIPTIONS = {
  CLIENTE_B2C: {
    title: 'Nivel 4: Usuario Común / Cliente a Domicilio (B2C)',
    desc: 'Permisos: Compra productos al detalle con entrega puerta a puerta en Cuba calculada automáticamente por kilómetro GPS.',
    fullnameLabel: 'Nombre y Apellidos del Comprador / Destinatario:',
    locationHeading: 'Dirección Exacta de Entrega a Domicilio en Cuba',
    addressLabel: 'Dirección de Vivienda (Calle, #, Apto, Entrecalles, Reparto):'
  },
  TCP: {
    title: 'Nivel 3: Trabajador por Cuenta Propia (TCP)',
    desc: 'Permisos: Puede comprar Mayorista y Minorista, y dispone de su propio Dashboard e inventario para VENDER EXCLUSIVAMENTE MINORISTA con tarifa de domicilio por km.',
    fullnameLabel: 'Nombre y Apellidos del Titular TCP:',
    locationHeading: 'Ubicación del Punto de Venta / Negocio TCP en Cuba',
    addressLabel: 'Dirección Exacta del Negocio TCP:'
  },
  MIPYME: {
    title: 'Nivel 2: Mipyme Cubana (S.U.R.L. / S.R.L.)',
    desc: 'Permisos: Puede importar/comprar por Contenedor CIF Mariel, Mayorista y Minorista; y publicar su catálogo para VENDER MAYORISTA Y MINORISTA con tarifa por km.',
    fullnameLabel: 'Nombre y Apellidos del Representante Legal / Socio:',
    locationHeading: 'Ubicación del Almacén / Sede de la Mipyme en Cuba',
    addressLabel: 'Dirección Exacta del Almacén o Sede Social:'
  },
  EXPORTADOR_B2B: {
    title: 'Nivel 1: Proveedor / Empresa Exportadora Extranjera',
    desc: 'Permisos: Publica y comercializa ofertas de exportación por Contenedor Completo (20\'/40\' Dry & Reefer CIF Mariel / Habana) para Mipymes e importadores.',
    fullnameLabel: 'Nombre y Cargo del Representante Comercial:',
    locationHeading: 'Puerto / Terminal de Recepción en Cuba',
    addressLabel: 'Terminal Portuaria Destino Habitual:'
  }
};

function populateRegisterLocationSelectors() {
  const provEl = document.getElementById('reg-province');
  const munEl = document.getElementById('reg-municipality');
  if (!provEl || !munEl) return;

  const provinces = Object.keys(CUBA_GEO);
  provEl.innerHTML = provinces.map(p => `<option value="${p}">${p}</option>`).join('');
  onRegProvinceChange(provinces[0]);
}

function onRegProvinceChange(provName) {
  const munEl = document.getElementById('reg-municipality');
  if (!munEl) return;
  const list = CUBA_GEO[provName] || CUBA_GEO["La Habana"];
  munEl.innerHTML = list.map(m => `<option value="${m.name}">${m.name}</option>`).join('');
}

function openUserAuthModal(defaultTab) {
  const modal = document.getElementById('user-auth-modal');
  if (!modal) return;
  populateRegisterLocationSelectors();
  selectRegisterRole('CLIENTE_B2C');
  renderActiveSessionInsideAuthModal();
  if (defaultTab) {
    switchUserAuthTab(defaultTab);
  } else {
    switchUserAuthTab(appState.currentUser ? 'login' : 'register');
  }
  modal.classList.remove('hidden');
}

function closeUserAuthModal() {
  const modal = document.getElementById('user-auth-modal');
  if (modal) modal.classList.add('hidden');
}

function switchUserAuthTab(tab) {
  const loginBtn = document.getElementById('auth-tab-login-btn');
  const regBtn = document.getElementById('auth-tab-register-btn');
  const loginPanel = document.getElementById('auth-panel-login');
  const regPanel = document.getElementById('auth-panel-register');
  if (!loginBtn || !regBtn || !loginPanel || !regPanel) return;

  if (tab === 'login') {
    loginBtn.className = 'flex-1 py-2.5 px-4 rounded-xl text-xs font-extrabold bg-[#2A2522] text-white dark:bg-[#F2AE79] dark:text-[#171413]';
    regBtn.className = 'flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-stone-200/80 dark:bg-white/10';
    loginPanel.classList.remove('hidden');
    regPanel.classList.add('hidden');
  } else {
    regBtn.className = 'flex-1 py-2.5 px-4 rounded-xl text-xs font-extrabold bg-[#2A2522] text-white dark:bg-[#F2AE79] dark:text-[#171413]';
    loginBtn.className = 'flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-stone-200/80 dark:bg-white/10';
    regPanel.classList.remove('hidden');
    loginPanel.classList.add('hidden');
  }
}

function selectRegisterRole(roleCode) {
  const hiddenInput = document.getElementById('reg-selected-role');
  if (hiddenInput) hiddenInput.value = roleCode;

  document.querySelectorAll('.js-reg-role-card').forEach(btn => {
    const r = btn.getAttribute('data-reg-role');
    if (r === roleCode) {
      btn.className = 'js-reg-role-card p-3 rounded-2xl border-2 border-[#7C1D18] bg-[#7C1D18]/10 dark:bg-[#F2AE79]/15 text-left transition-all shadow-sm';
    } else {
      btn.className = 'js-reg-role-card p-3 rounded-2xl border border-stone-200 dark:border-white/10 bg-stone-100/70 dark:bg-white/5 text-left transition-all hover:border-[#7C1D18]/50';
    }
  });

  const info = REGISTER_ROLE_DESCRIPTIONS[roleCode] || REGISTER_ROLE_DESCRIPTIONS.CLIENTE_B2C;
  const banner = document.getElementById('reg-role-permissions-banner');
  if (banner) {
    banner.innerHTML = `<strong class="text-[#7C1D18] dark:text-[#F2AE79] block">${info.title}</strong><span class="opacity-85">${info.desc}</span>`;
  }

  const fnLabel = document.getElementById('reg-fullname-label');
  const locHeading = document.getElementById('reg-location-heading');
  const addrLabel = document.getElementById('reg-address-label');
  if (fnLabel) fnLabel.textContent = info.fullnameLabel;
  if (locHeading) locHeading.textContent = info.locationHeading;
  if (addrLabel) addrLabel.textContent = info.addressLabel;

  const expBlock = document.getElementById('reg-fields-exportador');
  const mipBlock = document.getElementById('reg-fields-mipyme');
  const tcpBlock = document.getElementById('reg-fields-tcp');
  const cubaLocBlock = document.getElementById('reg-fields-cuba-location');
  const b2cExtra = document.getElementById('reg-b2c-extra');
  const bizDelivCfg = document.getElementById('reg-business-delivery-cfg');

  if (expBlock) expBlock.classList.toggle('hidden', roleCode !== 'EXPORTADOR_B2B');
  if (mipBlock) mipBlock.classList.toggle('hidden', roleCode !== 'MIPYME');
  if (tcpBlock) tcpBlock.classList.toggle('hidden', roleCode !== 'TCP');
  if (cubaLocBlock) cubaLocBlock.classList.toggle('hidden', roleCode === 'EXPORTADOR_B2B');
  if (b2cExtra) b2cExtra.classList.toggle('hidden', roleCode !== 'CLIENTE_B2C');
  if (bizDelivCfg) bizDelivCfg.classList.toggle('hidden', !(roleCode === 'MIPYME' || roleCode === 'TCP'));
}

function handleUserLoginSubmit(e) {
  if (e) e.preventDefault();
  const email = (document.getElementById('login-email-input').value || '').trim().toLowerCase();
  const password = (document.getElementById('login-password-input').value || '').trim();

  const found = (appState.users || []).find(u => u.email.toLowerCase() === email && (!u.password || u.password === password));
  if (!found) {
    showToast('Credenciales no encontradas. Verifica tu correo o crea una cuenta nueva.');
    return;
  }

  activateUserSession(found);
  closeUserAuthModal();
}

function quickDemoLogin(email) {
  const found = (appState.users || []).find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!found) return;
  activateUserSession(found);
  closeUserAuthModal();
}

function handleUserRegisterSubmit(e) {
  if (e) e.preventDefault();
  const roleCode = document.getElementById('reg-selected-role').value || 'CLIENTE_B2C';
  const fullName = (document.getElementById('reg-fullname').value || '').trim();
  const phone = (document.getElementById('reg-phone').value || '').trim();
  const email = (document.getElementById('reg-email').value || '').trim().toLowerCase();
  const password = (document.getElementById('reg-password').value || '').trim();

  if (!fullName || !email || !phone) {
    showToast('Por favor completa nombre, teléfono y correo electrónico.');
    return;
  }

  if (!Array.isArray(appState.users)) appState.users = [];
  if (appState.users.some(u => u.email.toLowerCase() === email)) {
    showToast('Este correo ya está registrado. Puedes iniciar sesión directamente.');
    switchUserAuthTab('login');
    document.getElementById('login-email-input').value = email;
    return;
  }

  const province = document.getElementById('reg-province') ? document.getElementById('reg-province').value : 'La Habana';
  const municipality = document.getElementById('reg-municipality') ? document.getElementById('reg-municipality').value : 'Plaza de la Revolución (El Vedado)';
  const address = (document.getElementById('reg-address') && document.getElementById('reg-address').value.trim()) || `${municipality}, ${province}`;

  const munList = CUBA_GEO[province] || CUBA_GEO["La Habana"];
  const munCoords = munList.find(m => m.name === municipality) || munList[0];

  const newUser = {
    id: `u-${Date.now()}`,
    role: roleCode,
    email,
    password,
    fullName,
    phone,
    province: roleCode === 'EXPORTADOR_B2B' ? 'Artemisa' : province,
    municipality: roleCode === 'EXPORTADOR_B2B' ? 'ZED Mariel (Terminal Portuaria B2B)' : municipality,
    address,
    createdAt: new Date().toISOString().slice(0, 10)
  };

  if (roleCode === 'EXPORTADOR_B2B') {
    newUser.companyName = (document.getElementById('reg-exp-company').value || '').trim() || `${fullName} Export B2B`;
    newUser.country = (document.getElementById('reg-exp-country').value || '').trim() || 'Internacional';
    newUser.taxId = (document.getElementById('reg-exp-taxid').value || '').trim() || 'INT-B2B';
    newUser.shippingLine = (document.getElementById('reg-exp-shipping').value || '').trim() || 'CIF Puerto del Mariel';
  } else if (roleCode === 'MIPYME') {
    newUser.companyName = (document.getElementById('reg-mip-company').value || '').trim() || `${fullName} S.U.R.L.`;
    newUser.nit = (document.getElementById('reg-mip-nit').value || '').trim() || 'NIT-ONAT';
    newUser.reeup = (document.getElementById('reg-mip-reeup').value || '').trim() || 'MIP-CUBA';
    newUser.baseDeliveryFeeUsd = Number(document.getElementById('reg-biz-basefee').value || 2.00);
    newUser.pricePerKmUsd = Number(document.getElementById('reg-biz-kmprice').value || 0.50);
  } else if (roleCode === 'TCP') {
    newUser.businessName = (document.getElementById('reg-tcp-business').value || '').trim() || `Proyecto TCP ${fullName}`;
    newUser.ci = (document.getElementById('reg-tcp-ci').value || '').trim() || 'CI-TCP';
    newUser.nit = newUser.ci;
    newUser.licenseActivity = (document.getElementById('reg-tcp-activity').value || '').trim() || 'Comercialización Minorista';
    newUser.baseDeliveryFeeUsd = Number(document.getElementById('reg-biz-basefee').value || 1.20);
    newUser.pricePerKmUsd = Number(document.getElementById('reg-biz-kmprice').value || 0.35);
  } else {
    newUser.ci = (document.getElementById('reg-b2c-ci').value || '').trim();
    newUser.reference = (document.getElementById('reg-b2c-ref').value || '').trim();
  }

  // Si es Proveedor B2B, Mipyme o TCP, crear su tienda oficial e inventario administrable en Mercapros
  if (roleCode === 'EXPORTADOR_B2B' || roleCode === 'MIPYME' || roleCode === 'TCP') {
    const newVendorId = `v-custom-${Date.now()}`;
    const storeName = newUser.companyName || newUser.businessName || fullName;
    const storeBadge =
      roleCode === 'EXPORTADOR_B2B'
        ? `Exportador (${newUser.country})`
        : roleCode === 'MIPYME'
        ? 'Mipyme Mayorista & Minorista'
        : 'TCP Venta Minorista';

    const storeDesc =
      roleCode === 'EXPORTADOR_B2B'
        ? `Proveedor internacional de contenedores (${newUser.shippingLine}). Registro: ${newUser.taxId}.`
        : roleCode === 'MIPYME'
        ? `Mipyme oficial en ${municipality}, ${province}. NIT: ${newUser.nit}. Ventas mayoristas y minoristas con entrega por km.`
        : `Proyecto TCP autorizado (${newUser.licenseActivity}) en ${municipality}. Entregas minoristas a domicilio.`;

    const newVendorObj = {
      id: newVendorId,
      name: storeName,
      logo: 'assets/mercapros-logo.webp',
      role: roleCode,
      badge: storeBadge,
      province: newUser.province,
      municipality: newUser.municipality,
      lat: roleCode === 'EXPORTADOR_B2B' ? 22.9920 : munCoords.lat,
      lng: roleCode === 'EXPORTADOR_B2B' ? -82.7530 : munCoords.lng,
      baseDeliveryFeeUsd: roleCode === 'EXPORTADOR_B2B' ? 0 : Number(newUser.baseDeliveryFeeUsd || 1.50),
      pricePerKmUsd: roleCode === 'EXPORTADOR_B2B' ? 0 : Number(newUser.pricePerKmUsd || 0.45),
      freeShippingThresholdUsd: 100,
      rating: 5.0,
      reviewsCount: 1,
      gmapsUrl: 'https://www.google.com/maps/search/?api=1&query=La+Habana+Cuba',
      whatsapp: phone.replace(/[^0-9]/g, '') || ADMIN_WHATSAPP_NUMBER,
      verified: true,
      isFeaturedStore: false,
      description: storeDesc
    };

    appState.vendors.push(newVendorObj);
    newUser.vendorId = newVendorId;
  }

  appState.users.unshift(newUser);
  activateUserSession(newUser);
  closeUserAuthModal();
  showToast(`¡Cuenta creada con éxito! Bienvenido, ${newUser.companyName || newUser.businessName || newUser.fullName}`);
}

function activateUserSession(userObj) {
  appState.currentUser = userObj;
  appState.currentRole = userObj.role || 'CLIENTE_B2C';

  if (userObj.province && CUBA_GEO[userObj.province]) {
    appState.selectedProvince = userObj.province;
    const list = CUBA_GEO[userObj.province];
    const foundMun = list.find(m => m.name === userObj.municipality) || list[0];
    if (foundMun) {
      appState.selectedMunicipality = foundMun.name;
      appState.userGps.lat = foundMun.lat;
      appState.userGps.lng = foundMun.lng;
    }
  }
  if (userObj.address) {
    appState.userGps.address = userObj.address;
  }

  if (userObj.vendorId) {
    appState.activeVendorId = userObj.vendorId;
    isAdminAuthenticated = true;
  } else {
    isAdminAuthenticated = false;
  }

  saveMercaprosState(appState);
  populateProvinceAndMunicipalitySelectors();
  updateAuthHeaderUI();
  renderRoleBar();
  renderStoresSection();
  renderCatalog();
  updateCartUI();
  updateGpsHeaderBadge();
  showToast(`Sesión activa: ${userObj.companyName || userObj.businessName || userObj.fullName} (${ROLE_MATRIX[appState.currentRole]?.label || userObj.role})`);
}

function logoutCurrentUser() {
  appState.currentUser = null;
  appState.currentRole = 'ALL_VIEW';
  isAdminAuthenticated = false;
  saveMercaprosState(appState);
  updateAuthHeaderUI();
  renderRoleBar();
  renderCatalog();
  renderActiveSessionInsideAuthModal();
  showToast('Sesión cerrada correctamente.');
}

function updateAuthHeaderUI() {
  const labelEl = document.getElementById('header-user-auth-label');
  const goldPill = document.getElementById('header-admin-gold-pill');

  if (appState.currentUser) {
    const shortName = (appState.currentUser.companyName || appState.currentUser.businessName || appState.currentUser.fullName || 'Mi Cuenta').slice(0, 18);
    if (labelEl) labelEl.textContent = shortName;
    if (goldPill) {
      if (appState.currentUser.vendorId) {
        goldPill.classList.remove('hidden');
      } else {
        goldPill.classList.add('hidden');
      }
    }
  } else {
    if (labelEl) labelEl.textContent = 'Acceder / Registro';
    if (goldPill && !isAdminAuthenticated) {
      goldPill.classList.add('hidden');
    }
  }
}

function renderActiveSessionInsideAuthModal() {
  const box = document.getElementById('auth-active-session-box');
  if (!box) return;

  if (!appState.currentUser) {
    box.classList.add('hidden');
    box.innerHTML = '';
    return;
  }

  const u = appState.currentUser;
  const roleInfo = REGISTER_ROLE_DESCRIPTIONS[u.role] || REGISTER_ROLE_DESCRIPTIONS.CLIENTE_B2C;

  box.classList.remove('hidden');
  box.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <span class="text-[10px] font-extrabold uppercase tracking-wider text-[#7C1D18] dark:text-[#F2AE79] block">${roleInfo.title}</span>
        <h4 class="font-display font-bold text-sm sm:text-base">${u.companyName || u.businessName || u.fullName}</h4>
        <p class="text-[11px] opacity-80">${u.email} • ${u.phone || ''} ${u.municipality ? `• ${u.municipality}` : ''}</p>
      </div>
      <div class="flex items-center gap-2">
        ${u.vendorId ? `
          <button type="button" onclick="closeUserAuthModal(); openAdminModal();" class="px-3 py-2 rounded-xl bg-[#2A2522] text-white dark:bg-[#F2AE79] dark:text-[#171413] font-extrabold text-xs">
            <i class="fa-solid fa-sliders mr-1"></i>Mi Dashboard
          </button>
        ` : ''}
        <button type="button" onclick="logoutCurrentUser()" class="px-3 py-2 rounded-xl bg-red-600/15 text-red-700 dark:text-red-300 font-bold text-xs">
          Cerrar Sesión
        </button>
      </div>
    </div>
  `;
}

