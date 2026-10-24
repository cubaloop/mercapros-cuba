// ============================================================================
// MERCAPROS CUBA - MOTOR DE DATOS DUAL-LAYER (LOCALSTORAGE + SUPABASE)
// ============================================================================

const MERCAPROS_STORAGE_KEY = 'mercapros_cuba_v24_db';

// Provincias y Municipios de Cuba con Coordenadas GPS Reales para Enrutamiento Haversine
const CUBA_GEO = {
  "La Habana": [
    { name: "Plaza de la RevoluciÃ³n (El Vedado)", lat: 23.1330, lng: -82.3830 },
    { name: "Playa (Miramar / Kohly)", lat: 23.1140, lng: -82.4350 },
    { name: "Habana Vieja", lat: 23.1367, lng: -82.3503 },
    { name: "Centro Habana", lat: 23.1380, lng: -82.3660 },
    { name: "Diez de Octubre (VÃ­bora)", lat: 23.0950, lng: -82.3710 },
    { name: "Boyeros (Fontanar / Alta Habana)", lat: 23.0520, lng: -82.3980 },
    { name: "Marianao", lat: 23.0840, lng: -82.4300 },
    { name: "Habana del Este (Alamar)", lat: 23.1620, lng: -82.2750 },
    { name: "Cerro", lat: 23.1130, lng: -82.3880 }
  ],
  "Artemisa": [
    { name: "ZED Mariel (Terminal Portuaria B2B)", lat: 22.9920, lng: -82.7530 },
    { name: "Bauta", lat: 22.9890, lng: -82.5460 },
    { name: "San Antonio de los BaÃ±os", lat: 22.8910, lng: -82.5010 }
  ],
  "Matanzas": [
    { name: "Matanzas Ciudad", lat: 23.0410, lng: -81.5770 },
    { name: "CÃ¡rdenas / Varadero", lat: 23.1530, lng: -81.2510 }
  ],
  "Villa Clara": [
    { name: "Santa Clara Centro", lat: 22.4060, lng: -79.9640 }
  ],
  "Santiago de Cuba": [
    { name: "Santiago Centro / Puerto GuillermÃ³n", lat: 20.0240, lng: -75.8210 }
  ]
};

// CategorÃ­as Oficiales inspiradas en Supermarket 23 + Nivel Contenedores B2B
const DEFAULT_CATEGORIES = [
  { id: "all", name: "Todo el Mercado", icon: "fa-layer-group", badge: "Super-App", tierAccess: "ALL" },
  { id: "contenedores-b2b", name: "Contenedores 20'/40' (B2B)", icon: "fa-ship", badge: "CIF Mariel", tierAccess: "B2B_ONLY" },
  { id: "carnes-embutidos", name: "Carnes y Embutidos", icon: "fa-drumstick-bite", badge: "Alta Demanda", tierAccess: "ALL" },
  { id: "alimentos-despensa", name: "Alimentos y Despensa", icon: "fa-wheat-awn", badge: "BÃ¡sicos", tierAccess: "ALL" },
  { id: "combos-familiares", name: "Combos y Mercados", icon: "fa-boxes-packing", badge: "Ahorro", tierAccess: "ALL" },
  { id: "aseo-belleza", name: "Aseo y Cuidado Personal", icon: "fa-pump-soap", badge: "Hogar", tierAccess: "ALL" },
  { id: "electro-energia", name: "ElectrodomÃ©sticos y EnergÃ­a", icon: "fa-bolt", badge: "Inversores", tierAccess: "ALL" },
  { id: "bebidas-lacteos", name: "Bebidas, CafÃ© y LÃ¡cteos", icon: "fa-mug-hot", badge: "Fresco", tierAccess: "ALL" }
];

// Negocios Verificados (Con Coordenadas GPS de AlmacÃ©n y Tarifa USD/CUP por Km)
const DEFAULT_VENDORS = [
  {
    id: "v-exp-01",
    name: "Iberia Cargo & Foods S.A.",
    role: "EXPORTADOR_B2B",
    badge: "Exportador Internacional (EspaÃ±a / Brasil)",
    province: "Artemisa",
    municipality: "ZED Mariel (Terminal Portuaria B2B)",
    lat: 22.9920,
    lng: -82.7530,
    baseDeliveryFeeUsd: 45.00,
    pricePerKmUsd: 1.85,
    freeShippingThresholdUsd: 12000,
    rating: 4.9,
    reviewsCount: 142,
    gmapsUrl: "https://www.google.com/maps/search/?api=1&query=Zona+Especial+de+Desarrollo+Mariel+Cuba",
    whatsapp: "971508379080",
    verified: true,
    description: "ExportaciÃ³n directa de contenedores refrigerados 40' HC y carga seca CIF Puerto del Mariel y La Habana."
  },
  {
    id: "v-mip-01",
    name: "Alimentos Del Valle S.U.R.L.",
    role: "MIPYME",
    badge: "Mipyme Mayorista & Minorista",
    province: "La Habana",
    municipality: "Plaza de la RevoluciÃ³n (El Vedado)",
    lat: 23.1285,
    lng: -82.3862,
    baseDeliveryFeeUsd: 2.00,
    pricePerKmUsd: 0.55,
    freeShippingThresholdUsd: 120,
    rating: 4.8,
    reviewsCount: 318,
    gmapsUrl: "https://www.google.com/maps/search/?api=1&query=Vedado+La+Habana+Cuba",
    whatsapp: "971508379080",
    verified: true,
    description: "Importadora y distribuidora frigorÃ­fica en La Habana. Ventas por cajas a TCP/Mipymes y entregas al detalle en menos de 2 horas."
  },
  {
    id: "v-mip-02",
    name: "ElectroHabana Solar S.R.L.",
    role: "MIPYME",
    badge: "Mipyme Mayorista & Minorista",
    province: "La Habana",
    municipality: "Playa (Miramar / Kohly)",
    lat: 23.1165,
    lng: -82.4290,
    baseDeliveryFeeUsd: 3.00,
    pricePerKmUsd: 0.65,
    freeShippingThresholdUsd: 250,
    rating: 4.9,
    reviewsCount: 204,
    gmapsUrl: "https://www.google.com/maps/search/?api=1&query=Miramar+Playa+La+Habana+Cuba",
    whatsapp: "971508379080",
    verified: true,
    description: "Especialistas en estaciones de energÃ­a EcoFlow, plantas elÃ©ctricas, refrigeraciÃ³n e inversores con garantÃ­a local."
  },
  {
    id: "v-tcp-01",
    name: "Mercadito La VÃ­bora Express (TCP)",
    role: "TCP",
    badge: "TCP Venta Minorista RÃ¡pida",
    province: "La Habana",
    municipality: "Diez de Octubre (VÃ­bora)",
    lat: 23.0968,
    lng: -82.3695,
    baseDeliveryFeeUsd: 1.20,
    pricePerKmUsd: 0.35,
    freeShippingThresholdUsd: 55,
    rating: 4.7,
    reviewsCount: 189,
    gmapsUrl: "https://www.google.com/maps/search/?api=1&query=La+Vibora+Diez+de+Octubre+La+Habana+Cuba",
    whatsapp: "971508379080",
    verified: true,
    description: "Abastecimiento diario de carnes frescas, viandas, lÃ¡cteos, combos familiares y aseo al detalle puerta a puerta."
  }
];

// CatÃ¡logo Inicial Rico (B2B Contenedores, Mipyme Mayorista/Minorista, TCP Minorista)
const DEFAULT_PRODUCTS = [
  {
    id: "prod-101",
    sku: "CNT-40HC-POLLO",
    title: "Contenedor 40' Reefer - Cuartos Traseros de Pollo (27 Toneladas)",
    category: "contenedores-b2b",
    vendorId: "v-exp-01",
    vendorName: "Iberia Cargo & Foods S.A.",
    vendorRole: "EXPORTADOR_B2B",
    saleModes: ["CONTAINER_B2B"],
    priceContainerUsd: 34500.00,
    priceWholesaleUsd: 34500.00,
    priceRetailUsd: 34500.00,
    oldPriceUsd: 36800.00,
    discountPct: 6,
    minWholesaleQty: 1,
    unitRetail: "Contenedor 40' HC (2,700 cajas x 10kg)",
    unitWholesale: "Contenedor CIF Mariel",
    stock: 8,
    image: "assets/hero-b2b-port.jpg",
    isFlashOffer: true,
    incoterm: "CIF Puerto del Mariel",
    specs: "27,000 Kg Neto â€¢ Halal & Cert. Sanitario â€¢ Entrega 14 dÃ­as",
    description: "Contenedor refrigerado de 40 pies High Cube con 2,700 cajas de 10kg de cuartos traseros de pollo estadounidense/brasileÃ±o. Incluye flete marÃ­timo, seguro y documentaciÃ³n lista para despacho en ZED Mariel."
  },
  {
    id: "prod-102",
    sku: "CNT-20DC-ACEITE",
    title: "Contenedor 20' Dry - Aceite Vegetal Refinado Girasol (18,500 Lts)",
    category: "contenedores-b2b",
    vendorId: "v-exp-01",
    vendorName: "Iberia Cargo & Foods S.A.",
    vendorRole: "EXPORTADOR_B2B",
    saleModes: ["CONTAINER_B2B"],
    priceContainerUsd: 24900.00,
    priceWholesaleUsd: 24900.00,
    priceRetailUsd: 24900.00,
    oldPriceUsd: 26500.00,
    discountPct: 6,
    minWholesaleQty: 1,
    unitRetail: "Contenedor 20' (1,540 cajas x 12 botellas 1L)",
    unitWholesale: "Contenedor CIF Habana/Mariel",
    stock: 5,
    image: "assets/hero-b2b-port.jpg",
    isFlashOffer: false,
    incoterm: "CIF Mariel / Habana",
    specs: "18,480 Botellas de 1L â€¢ Sellado HermÃ©tico â€¢ Sin Arancel Mipyme",
    description: "Lote industrial directo de fÃ¡brica para Mipymes comercializadoras. Botellas PET de 1 litro en cajas reforzadas de 12 unidades."
  },
  {
    id: "prod-103",
    sku: "CAR-CERDO-LOMO",
    title: "Lomo de Cerdo Deshuesado Importado (Paquete 5 lb / Caja 40 lb)",
    category: "carnes-embutidos",
    vendorId: "v-mip-01",
    vendorName: "Alimentos Del Valle S.U.R.L.",
    vendorRole: "MIPYME",
    saleModes: ["WHOLESALE", "RETAIL"],
    priceContainerUsd: 0,
    priceWholesaleUsd: 92.00,
    priceRetailUsd: 13.50,
    oldPriceUsd: 15.90,
    discountPct: 15,
    minWholesaleQty: 5,
    unitRetail: "Pieza sellada al vacÃ­o (5 lb / 2.27 kg)",
    unitWholesale: "Caja Master (40 lb / 8 piezas)",
    stock: 145,
    image: "assets/combo-proteina.jpg",
    isFlashOffer: true,
    incoterm: "Entrega Inmediata Habana",
    specs: "Corte Magro Premium â€¢ CongelaciÃ³n IQF â€¢ Cadena de FrÃ­o Garantizada",
    description: "Lomo de cerdo sin hueso de primera calidad. Disponible al detalle para familias (paquete de 5 lb) y al por mayor por cajas selladas para TCP, cafeterÃ­as, paladares y bodegas."
  },
  {
    id: "prod-104",
    sku: "CAR-POLLO-CAJA15",
    title: "Pechuga de Pollo Deshuesada (Bolsa 2 kg / Caja Mayorista 15 kg)",
    category: "carnes-embutidos",
    vendorId: "v-mip-01",
    vendorName: "Alimentos Del Valle S.U.R.L.",
    vendorRole: "MIPYME",
    saleModes: ["WHOLESALE", "RETAIL"],
    priceContainerUsd: 0,
    priceWholesaleUsd: 48.00,
    priceRetailUsd: 7.80,
    oldPriceUsd: 8.95,
    discountPct: 13,
    minWholesaleQty: 10,
    unitRetail: "Bolsa familiar 2 kg",
    unitWholesale: "Caja Master 15 kg (7.5 bolsas)",
    stock: 310,
    image: "assets/combo-proteina.jpg",
    isFlashOffer: true,
    incoterm: "AlmacÃ©n El Vedado",
    specs: "100% Pechuga Limpia â€¢ Sin Hielo AÃ±adido â€¢ Registro Sanitario",
    description: "Pechuga de pollo entera sin piel y sin hueso. Precio escalonado especial para negocios gastronÃ³micos y trabajadores por cuenta propia (TCP)."
  },
  {
    id: "prod-105",
    sku: "CMB-HABANA-SUPREMO",
    title: "Gran Combo Familiar 'Despensa Segura' (Carnes + Arroz + Aceite + CafÃ©)",
    category: "combos-familiares",
    vendorId: "v-tcp-01",
    vendorName: "Mercadito La VÃ­bora Express (TCP)",
    vendorRole: "TCP",
    saleModes: ["RETAIL"],
    priceContainerUsd: 0,
    priceWholesaleUsd: 64.00,
    priceRetailUsd: 64.00,
    oldPriceUsd: 78.00,
    discountPct: 18,
    minWholesaleQty: 1,
    unitRetail: "Combo Completo (18.5 kg total)",
    unitWholesale: "Venta exclusiva Minorista (TCP)",
    stock: 42,
    image: "assets/combo-proteina.jpg",
    isFlashOffer: true,
    incoterm: "Domicilio en 90 min",
    specs: "5 lb Cerdo + 10 lb Pollo + 10 lb Arroz + 2L Aceite + 2 Paq. CafÃ© + 30 Huevos",
    description: "El combo mÃ¡s completo para el hogar cubano, preparado y entregado directamente por TCP local verificado. Incluye cartÃ³n de 30 huevos frescos protegidos."
  },
  {
    id: "prod-106",
    sku: "ALM-ARROZ-SACO",
    title: "Arroz Grano Largo Extra (Paquete 5 lb / Saco Mayorista 50 kg)",
    category: "alimentos-despensa",
    vendorId: "v-mip-01",
    vendorName: "Alimentos Del Valle S.U.R.L.",
    vendorRole: "MIPYME",
    saleModes: ["WHOLESALE", "RETAIL"],
    priceContainerUsd: 0,
    priceWholesaleUsd: 49.50,
    priceRetailUsd: 3.10,
    oldPriceUsd: 3.60,
    discountPct: 14,
    minWholesaleQty: 5,
    unitRetail: "Paquete sellado 5 lb (2.27 kg)",
    unitWholesale: "Saco Importado 50 kg",
    stock: 520,
    image: "assets/combo-proteina.jpg",
    isFlashOffer: false,
    incoterm: "AlmacÃ©n El Vedado",
    specs: "96% Grano Entero â€¢ Cosecha Reciente â€¢ CocciÃ³n Suelta",
    description: "Arroz blanco grano largo importado. Ideal tanto para la compra quincenal de la casa como para abastecer negocios minoristas (TCP)."
  },
  {
    id: "prod-107",
    sku: "ELC-ECOFLOW-DELTA2",
    title: "EstaciÃ³n de EnergÃ­a PortÃ¡til 1024Wh LiFePO4 + Panel Solar Plegable",
    category: "electro-energia",
    vendorId: "v-mip-02",
    vendorName: "ElectroHabana Solar S.R.L.",
    vendorRole: "MIPYME",
    saleModes: ["WHOLESALE", "RETAIL"],
    priceContainerUsd: 0,
    priceWholesaleUsd: 690.00,
    priceRetailUsd: 785.00,
    oldPriceUsd: 890.00,
    discountPct: 12,
    minWholesaleQty: 3,
    unitRetail: "Unidad con GarantÃ­a 1 AÃ±o en Cuba",
    unitWholesale: "Lote Mayorista (MÃ­n. 3 uds)",
    stock: 28,
    image: "assets/electro-hogar.jpg",
    isFlashOffer: true,
    incoterm: "Showroom Miramar",
    specs: "1800W Salida AC (110V) â€¢ Soporta Refrigerador, Ventiladores y TV â€¢ Carga en 80 min",
    description: "SoluciÃ³n definitiva contra apagones en Cuba. BaterÃ­a LiFePO4 de 3,000+ ciclos capaz de mantener refrigerador, ventiladores, router Nauta Hogar e iluminaciÃ³n simultÃ¡neamente."
  },
  {
    id: "prod-108",
    sku: "ELC-OLLA-REINA",
    title: "Olla MultipropÃ³sito de PresiÃ³n ElÃ©ctrica 6 Litros Acero Inoxidable",
    category: "electro-energia",
    vendorId: "v-mip-02",
    vendorName: "ElectroHabana Solar S.R.L.",
    vendorRole: "MIPYME",
    saleModes: ["WHOLESALE", "RETAIL"],
    priceContainerUsd: 0,
    priceWholesaleUsd: 48.00,
    priceRetailUsd: 62.00,
    oldPriceUsd: 74.00,
    discountPct: 16,
    minWholesaleQty: 6,
    unitRetail: "Unidad en Caja Sellada (110V)",
    unitWholesale: "Caja Mayorista x 6 Unidades",
    stock: 84,
    image: "assets/electro-hogar.jpg",
    isFlashOffer: false,
    incoterm: "Showroom Miramar",
    specs: "Bajo Consumo EnergÃ©tico 1000W â€¢ 14 Programas (Frijoles, Carnes, Arroz)",
    description: "Olla Reina elÃ©ctrica de alta eficiencia tÃ©rmica con cubeta antiadherente reforzada y vÃ¡lvula de seguridad doble."
  },
  {
    id: "prod-109",
    sku: "ASE-PACK-FAMILIAR",
    title: "Combo Aseo Total Hogar (Detergente 5kg + 6 Jabones + Shampoo + Pasta)",
    category: "aseo-belleza",
    vendorId: "v-tcp-01",
    vendorName: "Mercadito La VÃ­bora Express (TCP)",
    vendorRole: "TCP",
    saleModes: ["RETAIL"],
    priceContainerUsd: 0,
    priceWholesaleUsd: 22.50,
    priceRetailUsd: 22.50,
    oldPriceUsd: 27.00,
    discountPct: 17,
    minWholesaleQty: 1,
    unitRetail: "Pack Ahorro 12 Piezas",
    unitWholesale: "Venta exclusiva Minorista (TCP)",
    stock: 65,
    image: "assets/electro-hogar.jpg",
    isFlashOffer: true,
    incoterm: "Entrega Hoy en La Habana",
    specs: "Saco Detergente 5kg + 6 Jabones Tocador + 2 Pastas Dentales + Shampoo 750ml",
    description: "Todo el aseo mensual de la familia en un solo paquete sellado con entrega rÃ¡pida a domicilio."
  },
  {
    id: "prod-110",
    sku: "BEB-LECHE-CAJA",
    title: "Leche Entera en Polvo InstantÃ¡nea 26% Materia Grasa (Bolsa 1kg / Caja 10kg)",
    category: "bebidas-lacteos",
    vendorId: "v-mip-01",
    vendorName: "Alimentos Del Valle S.U.R.L.",
    vendorRole: "MIPYME",
    saleModes: ["WHOLESALE", "RETAIL"],
    priceContainerUsd: 0,
    priceWholesaleUsd: 54.00,
    priceRetailUsd: 6.20,
    oldPriceUsd: 7.25,
    discountPct: 14,
    minWholesaleQty: 5,
    unitRetail: "Bolsa Aluminizada 1 kg",
    unitWholesale: "Caja Mayorista 10 x 1 kg",
    stock: 190,
    image: "assets/combo-proteina.jpg",
    isFlashOffer: false,
    incoterm: "AlmacÃ©n El Vedado",
    specs: "100% Leche de Vaca â€¢ Vitaminas A y D â€¢ DisoluciÃ³n InstantÃ¡nea",
    description: "Leche entera en polvo de alta cremosidad, ideal para el desayuno familiar o para dulcerÃ­as, heladerÃ­as y cafeterÃ­as TCP."
  }
];

// Promociones y Anuncios Administrables (PestaÃ±a 2 del Dashboard)
const DEFAULT_ANNOUNCEMENTS = [
  {
    id: "ann-1",
    title: "Tarifa Plana en Contenedores Refrigerados 40' HC por ZED Mariel",
    subtitle: "Descuento de $1,200 USD en flete marÃ­timo para Mipymes verificadas hasta el viernes.",
    badge: "B2B MARÃTIMO",
    code: "MARIEL2026",
    active: true
  },
  {
    id: "ann-2",
    title: "EnvÃ­o RÃ¡pido en La Habana con CÃ¡lculo GPS Exacto por KilÃ³metro",
    subtitle: "Marca tu ubicaciÃ³n en el mapa interactivo y conoce al instante la tarifa de cada Mipyme y TCP.",
    badge: "LOGÃSTICA GPS",
    code: "HABANAEXPRESS",
    active: true
  }
];

// Pedidos y Cotizaciones Iniciales (PestaÃ±a 4 del Dashboard)
const DEFAULT_ORDERS = [
  {
    id: "ORD-9841",
    date: "2026-10-24 14:20",
    customerName: "CafeterÃ­a & Paladar El Vedado (TCP)",
    customerRole: "TCP",
    vendorName: "Alimentos Del Valle S.U.R.L.",
    orderType: "MAYORISTA (Mipyme -> TCP)",
    municipality: "Plaza de la RevoluciÃ³n (El Vedado)",
    distanceKm: 1.8,
    deliveryUsd: 2.99,
    subtotalUsd: 288.00,
    totalUsd: 290.99,
    status: "En Ruta GPS",
    itemsSummary: "3x Caja Lomo de Cerdo (40lb), 1x Leche en Polvo Caja 10kg"
  },
  {
    id: "ORD-9840",
    date: "2026-10-24 11:05",
    customerName: "Importadora Del Valle S.U.R.L. (Mipyme)",
    customerRole: "MIPYME",
    vendorName: "Iberia Cargo & Foods S.A.",
    orderType: "IMPORTACIÃ“N CONTENEDOR (B2B)",
    municipality: "ZED Mariel (Terminal Portuaria B2B)",
    distanceKm: 42.4,
    deliveryUsd: 0.00,
    subtotalUsd: 34500.00,
    totalUsd: 34500.00,
    status: "BL Emitido / En Puerto",
    itemsSummary: "1x Contenedor 40' Reefer - Cuartos Traseros de Pollo (27 Ton)"
  },
  {
    id: "ORD-9839",
    date: "2026-10-24 09:45",
    customerName: "Beatriz ValdÃ©s (Compra Familiar)",
    customerRole: "CLIENTE_B2C",
    vendorName: "Mercadito La VÃ­bora Express (TCP)",
    orderType: "MINORISTA DOMICILIO (B2C)",
    municipality: "Diez de Octubre (VÃ­bora)",
    distanceKm: 2.3,
    deliveryUsd: 2.01,
    subtotalUsd: 64.00,
    totalUsd: 66.01,
    status: "Entregado",
    itemsSummary: "1x Gran Combo Familiar 'Despensa Segura' (18.5 kg)"
  }
];

function loadMercaprosState() {
  try {
    const raw = localStorage.getItem(MERCAPROS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.products) && parsed.products.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("[Mercapros] Error cargando localStorage, restaurando estado maestro:", e);
  }
  const initialState = {
    version: "2.4.0",
    currentRole: "ALL_VIEW", // ALL_VIEW | EXPORTADOR_B2B | MIPYME | TCP | CLIENTE_B2C
    currency: "USD",         // USD | CUP | MLC
    rates: { USD: 1, CUP: 320, MLC: 1.15 },
    lowDataMode: false,      // Modo Con Foto vs Sin ImÃ¡genes (Ultra-RÃ¡pido ETECSA)
    theme: "light",          // light (Alabastro #F6F1E7) | dark (#09100D)
    selectedProvince: "La Habana",
    selectedMunicipality: "Plaza de la RevoluciÃ³n (El Vedado)",
    userGps: { lat: 23.1330, lng: -82.3830, address: "Calle 23 esq. L, El Vedado, La Habana" },
    activeVendorId: "v-mip-01",
    categories: DEFAULT_CATEGORIES,
    vendors: DEFAULT_VENDORS,
    products: DEFAULT_PRODUCTS,
    announcements: DEFAULT_ANNOUNCEMENTS,
    orders: DEFAULT_ORDERS,
    supabaseConfig: {
      url: "",
      anonKey: "",
      lastSync: null
    }
  };
  saveMercaprosState(initialState);
  return initialState;
}

function saveMercaprosState(state) {
  try {
    localStorage.setItem(MERCAPROS_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("[Mercapros] Error guardando en localStorage:", e);
  }
}

// SincronizaciÃ³n AsÃ­ncrona en Segundo Plano con Supabase (Dual-Layer)
async function syncFromSupabase(state, onComplete) {
  if (!state.supabaseConfig || !state.supabaseConfig.url || !state.supabaseConfig.anonKey) {
    if (onComplete) onComplete({ synced: false, reason: "Modo Local Instant-Boot Activo" });
    return;
  }
  try {
    const baseUrl = state.supabaseConfig.url.replace(/\/$/, '');
    const headers = {
      'apikey': state.supabaseConfig.anonKey,
      'Authorization': `Bearer ${state.supabaseConfig.anonKey}`,
      'Content-Type': 'application/json'
    };
    const res = await fetch(`${baseUrl}/rest/v1/mercapros_products?select=*`, { headers });
    if (res.ok) {
      const remoteProducts = await res.json();
      if (Array.isArray(remoteProducts) && remoteProducts.length > 0) {
        state.products = remoteProducts.map(p => ({ ...p, id: String(p.id) }));
        state.supabaseConfig.lastSync = new Date().toISOString();
        saveMercaprosState(state);
      }
      if (onComplete) onComplete({ synced: true, count: remoteProducts.length });
    } else {
      if (onComplete) onComplete({ synced: false, reason: `HTTP ${res.status}` });
    }
  } catch (err) {
    if (onComplete) onComplete({ synced: false, reason: err.message });
  }
}

