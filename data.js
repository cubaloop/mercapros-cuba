// ============================================================================
// MERCAPROS CUBA - MOTOR DE DATOS DUAL-LAYER (LOCALSTORAGE + SUPABASE)
// ============================================================================

const MERCAPROS_STORAGE_KEY = 'mercapros_cuba_v30_wssnd_db';

// Provincias y Municipios de Cuba con Coordenadas GPS Reales para Enrutamiento Haversine
const CUBA_GEO = {
  "La Habana": [
    { name: "Plaza de la Revolución (El Vedado)", lat: 23.1330, lng: -82.3830 },
    { name: "Playa (Miramar / Kohly)", lat: 23.1140, lng: -82.4350 },
    { name: "Habana Vieja", lat: 23.1367, lng: -82.3503 },
    { name: "Centro Habana", lat: 23.1380, lng: -82.3660 },
    { name: "Diez de Octubre (Víbora)", lat: 23.0950, lng: -82.3710 },
    { name: "Boyeros (Fontanar / Alta Habana)", lat: 23.0520, lng: -82.3980 },
    { name: "Marianao", lat: 23.0840, lng: -82.4300 },
    { name: "Habana del Este (Alamar)", lat: 23.1620, lng: -82.2750 },
    { name: "Cerro", lat: 23.1130, lng: -82.3880 }
  ],
  "Artemisa": [
    { name: "ZED Mariel (Terminal Portuaria B2B)", lat: 22.9920, lng: -82.7530 },
    { name: "Bauta", lat: 22.9890, lng: -82.5460 },
    { name: "San Antonio de los Baños", lat: 22.8910, lng: -82.5010 }
  ],
  "Matanzas": [
    { name: "Matanzas Ciudad", lat: 23.0410, lng: -81.5770 },
    { name: "Cárdenas / Varadero", lat: 23.1530, lng: -81.2510 }
  ],
  "Villa Clara": [
    { name: "Santa Clara Centro", lat: 22.4060, lng: -79.9640 }
  ],
  "Santiago de Cuba": [
    { name: "Santiago Centro / Puerto Guillermón", lat: 20.0240, lng: -75.8210 }
  ]
};

// Categorías Oficiales (Con "Tiendas" destacada + Departamentos estilo Supermarket 23)
const DEFAULT_CATEGORIES = [
  { id: "all", name: "Todo el Catálogo", icon: "fa-layer-group", tierAccess: "ALL" },
  { id: "tiendas", name: "Tiendas", icon: "fa-store", tierAccess: "ALL" },
  { id: "contenedores-b2b", name: "Contenedores CIF Mariel", icon: "fa-ship", tierAccess: "B2B_ONLY" },
  { id: "carnes-embutidos", name: "Carnes y Embutidos", icon: "fa-drumstick-bite", tierAccess: "ALL" },
  { id: "alimentos-despensa", name: "Alimentos y Despensa", icon: "fa-wheat-awn", tierAccess: "ALL" },
  { id: "bebidas-lacteos", name: "Bebidas, Café y Lácteos", icon: "fa-mug-hot", tierAccess: "ALL" },
  { id: "combos-familiares", name: "Combos Familiares", icon: "fa-boxes-packing", tierAccess: "ALL" },
  { id: "aseo-belleza", name: "Aseo y Hogar", icon: "fa-pump-soap", tierAccess: "ALL" },
  { id: "electro-energia", name: "Electrodomésticos y Energía", icon: "fa-bolt", tierAccess: "ALL" }
];

// Empresas y Tiendas Verificadas (WSSND SKYLINK como Primera Tienda Oficial)
const DEFAULT_VENDORS = [
  {
    id: "v-wssnd-01",
    name: "WSSND SKYLINK",
    logo: "assets/wssnd-skylink-logo.jpg",
    role: "EXPORTADOR_B2B",
    badge: "Exportador Internacional",
    province: "Artemisa",
    municipality: "ZED Mariel (Terminal Portuaria B2B)",
    lat: 22.9920,
    lng: -82.7530,
    baseDeliveryFeeUsd: 0.00,
    pricePerKmUsd: 0.00,
    freeShippingThresholdUsd: 1,
    rating: 5.0,
    reviewsCount: 194,
    gmapsUrl: "https://www.google.com/maps/search/?api=1&query=Zona+Especial+de+Desarrollo+Mariel+Cuba",
    whatsapp: "971508379080",
    verified: true,
    isFeaturedStore: true,
    description: "Proveedor internacional líder en exportación de contenedores completos (20'/40' Dry & Reefer) CIF Puerto del Mariel, Cuba. Navieras CMA-CGM, CTM Directo y NIRINT."
  },
  {
    id: "v-mip-01",
    name: "Alimentos Del Valle S.U.R.L.",
    logo: "assets/combo-proteina.jpg",
    role: "MIPYME",
    badge: "Mipyme Mayorista & Minorista",
    province: "La Habana",
    municipality: "Plaza de la Revolución (El Vedado)",
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
    isFeaturedStore: false,
    description: "Distribuidora frigorífica en La Habana. Ventas por cajas a TCP/Mipymes y entregas al detalle a domicilio."
  },
  {
    id: "v-mip-02",
    name: "ElectroHabana Solar S.R.L.",
    logo: "assets/electro-hogar.jpg",
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
    isFeaturedStore: false,
    description: "Estaciones de energía LiFePO4, paneles solares, refrigeración y electrodomésticos con garantía local."
  },
  {
    id: "v-tcp-01",
    name: "Mercadito La Víbora Express (TCP)",
    logo: "assets/combo-proteina.jpg",
    role: "TCP",
    badge: "TCP Venta Minorista",
    province: "La Habana",
    municipality: "Diez de Octubre (Víbora)",
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
    isFeaturedStore: false,
    description: "Abastecimiento diario de carnes frescas, lácteos, combos familiares y aseo al detalle puerta a puerta."
  }
];

// Catálogo Oficial: Las 17 Ofertas de Contenedores de WSSND SKYLINK (+10% aplicado) + Productos Locales Mipyme/TCP
const DEFAULT_PRODUCTS = [
  // ==========================================================================
  // 17 OFERTAS DE IMPORTACIÓN POR CONTENEDOR CIF MARIEL - WSSND SKYLINK (+10%)
  // ==========================================================================
  {
    id: "wssnd-01",
    sku: "WSSND-HAR-25KG",
    title: "Harina de Trigo para Panificación (12.5% Mín. Proteína) - Saco 25 Kg",
    category: "alimentos-despensa",
    isContainerOffer: true,
    vendorId: "v-wssnd-01",
    vendorName: "WSSND SKYLINK",
    vendorRole: "EXPORTADOR_B2B",
    saleModes: ["CONTAINER_B2B"],
    priceContainerUsd: 18975.00, // $17,250 + 10%
    priceWholesaleUsd: 18975.00,
    priceRetailUsd: 0.76,        // $0.69/kg + 10%
    unitPriceLabel: "$0.76 USD / Kg",
    oldPriceUsd: 0,
    discountPct: 0,
    minWholesaleQty: 1,
    unitRetail: "Contenedor 25 TM (Sacos de 25 Kg)",
    unitWholesale: "CIF Mariel • Naviera CMA-CGM",
    stock: 15,
    image: "assets/combo-proteina.jpg",
    isFlashOffer: true,
    incoterm: "CIF Mariel Cuba",
    specs: "Origen: Turquía • Naviera: CMA-CGM • Prod: 7 días • Mín: 25 TM • $0.76/Kg",
    description: "Harina de trigo de fuerza para panificación con 12.5% mínimo de proteína en sacos de 25 kg. Precio total por contenedor CIF Mariel con margen comercial incluido."
  },
  {
    id: "wssnd-02",
    sku: "WSSND-HAR-1KG",
    title: "Harina de Trigo Panificación (10.5% Mín. Proteína) - Paquete 1 Kg",
    category: "alimentos-despensa",
    isContainerOffer: true,
    vendorId: "v-wssnd-01",
    vendorName: "WSSND SKYLINK",
    vendorRole: "EXPORTADOR_B2B",
    saleModes: ["CONTAINER_B2B"],
    priceContainerUsd: 24475.00, // $22,250 + 10%
    priceWholesaleUsd: 24475.00,
    priceRetailUsd: 0.98,        // $0.89/kg + 10%
    unitPriceLabel: "$0.98 USD / Kg",
    oldPriceUsd: 0,
    discountPct: 0,
    minWholesaleQty: 1,
    unitRetail: "Contenedor 25 TM (Paquetes 1 Kg)",
    unitWholesale: "CIF Mariel • Naviera CMA-CGM",
    stock: 12,
    image: "assets/combo-proteina.jpg",
    isFlashOffer: false,
    incoterm: "CIF Mariel Cuba",
    specs: "Origen: Turquía • Naviera: CMA-CGM • Prod: 7 días • Mín: 25 TM • $0.98/Kg",
    description: "Harina de trigo 10.5% proteína en formato comercial de paquetes de 1 kg lista para distribución mayorista o minorista. Total por contenedor CIF Mariel."
  },
  {
    id: "wssnd-03",
    sku: "WSSND-AZU-1KG",
    title: "Azúcar Cristal Refinada - Paquete 1 Kg (Bolsa de 10 Piezas / Opción Saco 50 Kg)",
    category: "alimentos-despensa",
    isContainerOffer: true,
    vendorId: "v-wssnd-01",
    vendorName: "WSSND SKYLINK",
    vendorRole: "EXPORTADOR_B2B",
    saleModes: ["CONTAINER_B2B"],
    priceContainerUsd: 27621.00, // $25,110 + 10%
    priceWholesaleUsd: 27621.00,
    priceRetailUsd: 1.02,        // $0.93/kg + 10%
    unitPriceLabel: "$1.02 USD / Kg ($0.99/Kg en saco 50Kg)",
    oldPriceUsd: 0,
    discountPct: 0,
    minWholesaleQty: 1,
    unitRetail: "Contenedor 27 TM (1 Kg x 10 pzas)",
    unitWholesale: "CIF Mariel • Naviera CMA-CGM",
    stock: 20,
    image: "assets/combo-proteina.jpg",
    isFlashOffer: true,
    incoterm: "CIF Mariel Cuba",
    specs: "Origen: Brasil • Naviera: CMA-CGM • Prod: 7 días • Mín: 27 TM • $1.02/Kg",
    description: "Azúcar cristal brasileña en paquetes de 1 kg (bolsas de 10 unidades) o disponible en sacos de 50 kg ($0.99 USD/kg). Carga de 27 toneladas CIF Mariel."
  },
  {
    id: "wssnd-04",
    sku: "WSSND-ARR-1KG",
    title: "Arroz Grano Largo 15% Partido - Paquete 1 Kg (Bolsa de 30 Piezas)",
    category: "alimentos-despensa",
    isContainerOffer: true,
    vendorId: "v-wssnd-01",
    vendorName: "WSSND SKYLINK",
    vendorRole: "EXPORTADOR_B2B",
    saleModes: ["CONTAINER_B2B"],
    priceContainerUsd: 24310.00, // $22,100 + 10%
    priceWholesaleUsd: 24310.00,
    priceRetailUsd: 0.94,        // $0.85/kg + 10%
    unitPriceLabel: "$0.94 USD / Kg",
    oldPriceUsd: 0,
    discountPct: 0,
    minWholesaleQty: 1,
    unitRetail: "Contenedor 26 TM (1 Kg x 30 pzas)",
    unitWholesale: "CIF Mariel • Naviera CMA-CGM",
    stock: 18,
    image: "assets/combo-proteina.jpg",
    isFlashOffer: true,
    incoterm: "CIF Mariel Cuba",
    specs: "Origen: Guyana / Brasil • Naviera: CMA-CGM • Prod: 7 días • 26 TM • $0.94/Kg",
    description: "Arroz blanco 15% partido empacado en paquetes de 1 kg dentro de bolsas maestras de 30 unidades. Contenedor de 26 toneladas métricas CIF Mariel."
  },
  {
    id: "wssnd-05",
    sku: "WSSND-SPA-500G",
    title: "Spaghetti 100% Trigo Duro - Paquete 500g (Bolsa de 20 Uds • 54,000 Paquetes)",
    category: "alimentos-despensa",
    isContainerOffer: true,
    vendorId: "v-wssnd-01",
    vendorName: "WSSND SKYLINK",
    vendorRole: "EXPORTADOR_B2B",
    saleModes: ["CONTAINER_B2B"],
    priceContainerUsd: 26730.00, // $24,300 + 10%
    priceWholesaleUsd: 26730.00,
    priceRetailUsd: 0.50,        // $0.45/ud + 10%
    unitPriceLabel: "$0.50 USD / Paquete 500g",
    oldPriceUsd: 0,
    discountPct: 0,
    minWholesaleQty: 1,
    unitRetail: "Contenedor 27 TM (54,000 paquetes de 500g)",
    unitWholesale: "CIF Mariel • Naviera CMA-CGM",
    stock: 14,
    image: "assets/combo-proteina.jpg",
    isFlashOffer: false,
    incoterm: "CIF Mariel Cuba",
    specs: "Origen: Turquía • Naviera: CMA-CGM • Prod: 15 días • 54,000 Paq • $0.50/Ud",
    description: "Pasta alimenticia Spaghetti 100% sémola de trigo duro en paquetes de 500 gramos (bolsas de 20 unidades). Total: 54,000 paquetes (27 TM) CIF Mariel."
  },
  {
    id: "wssnd-06",
    sku: "WSSND-ACE-900ML",
    title: "Aceite de Soya Refinado - Botella 900 ml (20 Botellas x Caja • 32,800 Botellas)",
    category: "alimentos-despensa",
    isContainerOffer: true,
    vendorId: "v-wssnd-01",
    vendorName: "WSSND SKYLINK",
    vendorRole: "EXPORTADOR_B2B",
    saleModes: ["CONTAINER_B2B"],
    priceContainerUsd: 60975.20, // $55,432 + 10%
    priceWholesaleUsd: 60975.20,
    priceRetailUsd: 1.86,        // $1.69/ud + 10%
    unitPriceLabel: "$1.86 USD / Botella 900ml",
    oldPriceUsd: 0,
    discountPct: 0,
    minWholesaleQty: 1,
    unitRetail: "Contenedor 32,800 Botellas (1,640 Cajas x 20 uds)",
    unitWholesale: "CIF Mariel • Naviera CMA-CGM",
    stock: 10,
    image: "assets/combo-proteina.jpg",
    isFlashOffer: true,
    incoterm: "CIF Mariel Cuba",
    specs: "Origen: Brasil • Naviera: CMA-CGM • Prod: 15 días • 32,800 Botellas • $1.86/Ud",
    description: "Aceite vegetal de soya brasileño en botellas PET de 900 ml (cajas de 20 botellas). Contenedor completo con 32,800 botellas CIF Mariel."
  },
  {
    id: "wssnd-07",
    sku: "WSSND-FRI-1KG",
    title: "Frijol Negro Premium T1 - Paquete 1 Kg (Bolsa de 30 Uds • 25,000 Kg)",
    category: "alimentos-despensa",
    isContainerOffer: true,
    vendorId: "v-wssnd-01",
    vendorName: "WSSND SKYLINK",
    vendorRole: "EXPORTADOR_B2B",
    saleModes: ["CONTAINER_B2B"],
    priceContainerUsd: 30250.00, // $27,500 + 10%
    priceWholesaleUsd: 30250.00,
    priceRetailUsd: 1.21,        // $1.10/kg + 10%
    unitPriceLabel: "$1.21 USD / Kg",
    oldPriceUsd: 0,
    discountPct: 0,
    minWholesaleQty: 1,
    unitRetail: "Contenedor 25,000 Kg (Bolsas de 30 x 1 Kg)",
    unitWholesale: "CIF Mariel • Naviera CMA-CGM",
    stock: 12,
    image: "assets/combo-proteina.jpg",
    isFlashOffer: false,
    incoterm: "CIF Mariel Cuba",
    specs: "Origen: Brasil • Naviera: CMA-CGM • Prod: 10 días • 25,000 Kg • $1.21/Kg",
    description: "Frijol negro brasileño calibre Premium T1 de rápida cocción en paquetes de 1 kg (bolsas de 30 unidades). Total: 25,000 kg CIF Mariel."
  },
  {
    id: "wssnd-08",
    sku: "WSSND-CER-33CL",
    title: "Cerveza Sublime en Lata 33 cl (58,032 Latas • Permite Contenedor Variado)",
    category: "bebidas-lacteos",
    isContainerOffer: true,
    vendorId: "v-wssnd-01",
    vendorName: "WSSND SKYLINK",
    vendorRole: "EXPORTADOR_B2B",
    saleModes: ["CONTAINER_B2B"],
    priceContainerUsd: 24895.20, // $22,632 + 10%
    priceWholesaleUsd: 24895.20,
    priceRetailUsd: 0.43,        // $0.39/ud + 10%
    unitPriceLabel: "$0.43 USD / Lata 33cl",
    oldPriceUsd: 0,
    discountPct: 0,
    minWholesaleQty: 1,
    unitRetail: "Contenedor 58,032 Latas de 33 cl",
    unitWholesale: "CIF Mariel • Naviera CTM Directo",
    stock: 16,
    image: "assets/hero-b2b-port.jpg",
    isFlashOffer: true,
    incoterm: "CIF Mariel Cuba",
    specs: "Origen: España • Naviera: CTM Directo • Prod: 15 días • 58,032 Latas • $0.43/Ud",
    description: "Cerveza española Sublime en latas de 33 cl (330 ml). Se pueden cargar contenedores variados. Embarque rápido por CTM Directo CIF Mariel."
  },
  {
    id: "wssnd-09",
    sku: "WSSND-REF-33CL",
    title: "Refrescos Sublime Varios Sabores Lata 33 cl (58,032 Latas • Contenedor Variado)",
    category: "bebidas-lacteos",
    isContainerOffer: true,
    vendorId: "v-wssnd-01",
    vendorName: "WSSND SKYLINK",
    vendorRole: "EXPORTADOR_B2B",
    saleModes: ["CONTAINER_B2B"],
    priceContainerUsd: 22342.10, // $20,311 + 10%
    priceWholesaleUsd: 22342.10,
    priceRetailUsd: 0.39,        // $0.35/ud + 10%
    unitPriceLabel: "$0.39 USD / Lata 33cl",
    oldPriceUsd: 0,
    discountPct: 0,
    minWholesaleQty: 1,
    unitRetail: "Contenedor 58,032 Latas de 33 cl",
    unitWholesale: "CIF Mariel • Naviera CTM Directo",
    stock: 18,
    image: "assets/hero-b2b-port.jpg",
    isFlashOffer: false,
    incoterm: "CIF Mariel Cuba",
    specs: "Origen: España • Naviera: CTM Directo • Prod: 15 días • 58,032 Latas • $0.39/Ud",
    description: "Refrescos españoles Sublime en latas de 33 cl (Cola, Naranja, Limón, Manzana). Permite combinar sabores en el contenedor. CIF Mariel."
  },
  {
    id: "wssnd-10",
    sku: "WSSND-GAL-76G",
    title: "Galletas Rellenas con Crema 76g (2,745 Cajas de 36 Paquetes • 4 Sabores)",
    category: "alimentos-despensa",
    isContainerOffer: true,
    vendorId: "v-wssnd-01",
    vendorName: "WSSND SKYLINK",
    vendorRole: "EXPORTADOR_B2B",
    saleModes: ["CONTAINER_B2B"],
    priceContainerUsd: 27175.50, // $24,705 + 10%
    priceWholesaleUsd: 27175.50,
    priceRetailUsd: 9.90,        // $9.00/caja + 10%
    unitPriceLabel: "$9.90 USD / Caja de 36 Paq.",
    oldPriceUsd: 0,
    discountPct: 0,
    minWholesaleQty: 1,
    unitRetail: "Contenedor 2,745 Cajas (98,820 Paquetes de 76g)",
    unitWholesale: "CIF Mariel • Naviera CMA-CGM",
    stock: 10,
    image: "assets/combo-proteina.jpg",
    isFlashOffer: false,
    incoterm: "CIF Mariel Cuba",
    specs: "Origen: Brasil • Naviera: CMA-CGM • Prod: 10 días • 2,745 Cajas • $9.90/Caja",
    description: "Paquetes de 76g con 10 galletas rellenas de crema (Chocolate, Fresa, Vainilla y Dulce de Leche). 36 paquetes por caja master."
  },
  {
    id: "wssnd-11",
    sku: "WSSND-CAF-250G",
    title: "Café Extra Fuerte Tostado y Molido - 250g x 20 Paquetes (13,000 Kg)",
    category: "bebidas-lacteos",
    isContainerOffer: true,
    vendorId: "v-wssnd-01",
    vendorName: "WSSND SKYLINK",
    vendorRole: "EXPORTADOR_B2B",
    saleModes: ["CONTAINER_B2B"],
    priceContainerUsd: 122980.00, // $111,800 + 10%
    priceWholesaleUsd: 122980.00,
    priceRetailUsd: 2.37,         // $2.15/ud + 10%
    unitPriceLabel: "$2.37 USD / Paquete 250g",
    oldPriceUsd: 0,
    discountPct: 0,
    minWholesaleQty: 1,
    unitRetail: "Contenedor 13,000 Kg (52,000 Paquetes de 250g)",
    unitWholesale: "CIF Mariel • Naviera CMA-CGM",
    stock: 6,
    image: "assets/combo-proteina.jpg",
    isFlashOffer: false,
    incoterm: "CIF Mariel Cuba",
    specs: "Origen: Brasil • Naviera: CMA-CGM • Prod: 10 días • 13,000 Kg • $2.37/Ud",
    description: "Café brasileño Extra Fuerte al vacío en paquetes de 250 gramos (fardos de 20 paquetes). Carga completa de 13,000 kg CIF Mariel."
  },
  {
    id: "wssnd-12",
    sku: "WSSND-HUE-30U",
    title: "Huevos Blancos Frescos de Gallina - Cartón 30 Uds (12 Cartones/Caja • 40' Reefer)",
    category: "alimentos-despensa",
    isContainerOffer: true,
    vendorId: "v-wssnd-01",
    vendorName: "WSSND SKYLINK",
    vendorRole: "EXPORTADOR_B2B",
    saleModes: ["CONTAINER_B2B"],
    priceContainerUsd: 48273.50, // $43,885 + 10%
    priceWholesaleUsd: 48273.50,
    priceRetailUsd: 0.15,        // $0.135/ud + 10% = $0.1485
    unitPriceLabel: "$0.149 USD / Unidad ($4.46 / Cartón 30 uds)",
    oldPriceUsd: 0,
    discountPct: 0,
    minWholesaleQty: 1,
    unitRetail: "Contenedor 40' Reefer (325,080 Huevos / 10,836 Cartones)",
    unitWholesale: "CIF Mariel • Naviera CMA-CGM",
    stock: 9,
    image: "assets/combo-proteina.jpg",
    isFlashOffer: true,
    incoterm: "CIF Mariel Cuba",
    specs: "Origen: Rep. Dominicana • Naviera: CMA-CGM • 10 días • 325,080 Uds • $0.149/Ud",
    description: "Huevos blancos frescos en cartones de 30 unidades (12 cartones por caja master). Embarque refrigerado 1x40' Reefer CIF Mariel."
  },
  {
    id: "wssnd-13",
    sku: "WSSND-MDM-20KG",
    title: "MDM de Pollo Calidad Premium Congelado - Caja de 20 Kg Aprox (26,600 Kg)",
    category: "carnes-embutidos",
    isContainerOffer: true,
    vendorId: "v-wssnd-01",
    vendorName: "WSSND SKYLINK",
    vendorRole: "EXPORTADOR_B2B",
    saleModes: ["CONTAINER_B2B"],
    priceContainerUsd: 28967.40, // $26,334 + 10%
    priceWholesaleUsd: 28967.40,
    priceRetailUsd: 1.09,        // $0.99/kg + 10%
    unitPriceLabel: "$1.09 USD / Kg",
    oldPriceUsd: 0,
    discountPct: 0,
    minWholesaleQty: 1,
    unitRetail: "Contenedor Reefer 26,600 Kg (Cajas de 20 Kg)",
    unitWholesale: "CIF Mariel • Naviera CMA-CGM",
    stock: 11,
    image: "assets/combo-proteina.jpg",
    isFlashOffer: false,
    incoterm: "CIF Mariel Cuba",
    specs: "Origen: Polonia • Naviera: CMA-CGM • Prod: 10 días • 26,600 Kg • $1.09/Kg",
    description: "Pasta / MDM de pollo calidad premium para industria cárnica y distribución en bloques congelados de 20 kg. Contenedor Reefer CIF Mariel."
  },
  {
    id: "wssnd-14",
    sku: "WSSND-PIC-500G",
    title: "Picadillo de Pollo Congelado - Tubo 500g (27,000 Kg Aprox / 54,000 Tubos)",
    category: "carnes-embutidos",
    isContainerOffer: true,
    vendorId: "v-wssnd-01",
    vendorName: "WSSND SKYLINK",
    vendorRole: "EXPORTADOR_B2B",
    saleModes: ["CONTAINER_B2B"],
    priceContainerUsd: 44550.00, // $40,500 + 10%
    priceWholesaleUsd: 44550.00,
    priceRetailUsd: 0.72,        // $0.65/pieza + 10% ($1.65/kg)
    unitPriceLabel: "$1.65 USD / Kg ($0.72 USD / Tubo 500g)",
    oldPriceUsd: 0,
    discountPct: 0,
    minWholesaleQty: 1,
    unitRetail: "Contenedor Reefer 27,000 Kg (Tubos de 500g)",
    unitWholesale: "CIF Mariel • Naviera CMA-CGM",
    stock: 14,
    image: "assets/combo-proteina.jpg",
    isFlashOffer: true,
    incoterm: "CIF Mariel Cuba",
    specs: "Origen: Polonia • Naviera: CMA-CGM • Prod: 10 días • 27,000 Kg • $0.72/Pieza",
    description: "Picadillo de pollo condimentado en tubos sellados de 500 gramos de alta rotación comercial. Contenedor refrigerado de 27 TM CIF Mariel."
  },
  {
    id: "wssnd-15",
    sku: "WSSND-SAL-340G",
    title: "Salchichas de Pollo (Paquete 340g • 77,500 Unidades por Contenedor Reefer)",
    category: "carnes-embutidos",
    isContainerOffer: true,
    vendorId: "v-wssnd-01",
    vendorName: "WSSND SKYLINK",
    vendorRole: "EXPORTADOR_B2B",
    saleModes: ["CONTAINER_B2B"],
    priceContainerUsd: 58822.50, // $53,475 + 10%
    priceWholesaleUsd: 58822.50,
    priceRetailUsd: 0.76,        // $0.69/pieza + 10%
    unitPriceLabel: "$0.76 USD / Paquete 340g",
    oldPriceUsd: 0,
    discountPct: 0,
    minWholesaleQty: 1,
    unitRetail: "Contenedor Reefer 77,500 Paquetes de 340g",
    unitWholesale: "CIF Mariel • Naviera CMA-CGM",
    stock: 10,
    image: "assets/combo-proteina.jpg",
    isFlashOffer: true,
    incoterm: "CIF Mariel Cuba",
    specs: "Origen: Polonia • Naviera: CMA-CGM • Prod: 10 días • 77,500 Uds • $0.76/Paq",
    description: "Salchichas de pollo empacadas al vacío en paquetes de 340 gramos. Contenedor refrigerado con 77,500 paquetes aproximadamente CIF Mariel."
  },
  {
    id: "wssnd-16",
    sku: "WSSND-LEC-25KG",
    title: "Leche en Polvo Entera 28% Materia Grasa - Saco 25 Kg (25,000 Kg)",
    category: "bebidas-lacteos",
    isContainerOffer: true,
    vendorId: "v-wssnd-01",
    vendorName: "WSSND SKYLINK",
    vendorRole: "EXPORTADOR_B2B",
    saleModes: ["CONTAINER_B2B"],
    priceContainerUsd: 82500.00, // $75,000 + 10%
    priceWholesaleUsd: 82500.00,
    priceRetailUsd: 3.30,        // $3.00/kg + 10%
    unitPriceLabel: "$3.30 USD / Kg ($82.50 / Saco 25Kg)",
    oldPriceUsd: 0,
    discountPct: 0,
    minWholesaleQty: 1,
    unitRetail: "Contenedor 25,000 Kg (1,000 Sacos de 25 Kg)",
    unitWholesale: "CIF Mariel • Naviera NIRINT",
    stock: 8,
    image: "assets/combo-proteina.jpg",
    isFlashOffer: false,
    incoterm: "CIF Mariel Cuba",
    specs: "Origen: Polonia • Naviera: NIRINT • Prod: 10 días • 25,000 Kg • $3.30/Kg",
    description: "Leche entera en polvo 28% materia grasa de origen europeo en sacos multicapa de 25 kg con bolsa interior de polietileno. CIF Mariel vía NIRINT."
  },
  {
    id: "wssnd-17",
    sku: "WSSND-RES-400G",
    title: "Carne de Res en Lata 400g (1,850 Cajas de 24 Uds • 44,400 Latas)",
    category: "carnes-embutidos",
    isContainerOffer: true,
    vendorId: "v-wssnd-01",
    vendorName: "WSSND SKYLINK",
    vendorRole: "EXPORTADOR_B2B",
    saleModes: ["CONTAINER_B2B"],
    priceContainerUsd: 61050.00, // $55,500 + 10%
    priceWholesaleUsd: 61050.00,
    priceRetailUsd: 1.38,        // $1.25/ud + 10%
    unitPriceLabel: "$1.38 USD / Lata 400g ($33.00 / Caja 24 uds)",
    oldPriceUsd: 0,
    discountPct: 0,
    minWholesaleQty: 1,
    unitRetail: "Contenedor 44,400 Latas de 400g (1,850 Cajas)",
    unitWholesale: "CIF Mariel • Naviera CTM Directo",
    stock: 9,
    image: "assets/combo-proteina.jpg",
    isFlashOffer: true,
    incoterm: "CIF Mariel Cuba",
    specs: "Origen: Italia • Naviera: CTM Directo • Prod: 10 días • 44,400 Latas • $1.38/Ud",
    description: "Conserva de carne de res italiana en latas de 400 gramos (abre fácil), presentada en cajas de cartón de 24 unidades. Contenedor completo CIF Mariel."
  },

  // ==========================================================================
  // OFERTAS LOCALES MIPYMES (MAYORISTA/MINORISTA) Y TCP (SOLO MINORISTA)
  // ==========================================================================
  {
    id: "prod-103",
    sku: "CAR-CERDO-LOMO",
    title: "Lomo de Cerdo Deshuesado Importado (Paquete 5 lb / Caja 40 lb)",
    category: "carnes-embutidos",
    isContainerOffer: false,
    vendorId: "v-mip-01",
    vendorName: "Alimentos Del Valle S.U.R.L.",
    vendorRole: "MIPYME",
    saleModes: ["WHOLESALE", "RETAIL"],
    priceContainerUsd: 0,
    priceWholesaleUsd: 92.00,
    priceRetailUsd: 13.50,
    unitPriceLabel: "$13.50 USD / Paquete 5 lb",
    oldPriceUsd: 15.90,
    discountPct: 15,
    minWholesaleQty: 5,
    unitRetail: "Pieza al vacío (5 lb / 2.27 kg)",
    unitWholesale: "Caja Master (40 lb / 8 piezas)",
    stock: 145,
    image: "assets/combo-proteina.jpg",
    isFlashOffer: true,
    incoterm: "Entrega Hoy en La Habana",
    specs: "Corte Magro • Congelación IQF • Venta Mayorista y Minorista",
    description: "Disponible al detalle para hogares y por cajas selladas para TCP, cafeterías y paladares."
  },
  {
    id: "prod-105",
    sku: "CMB-HABANA-SUPREMO",
    title: "Gran Combo Familiar 'Despensa Segura' (Carnes + Arroz + Aceite + Café)",
    category: "combos-familiares",
    isContainerOffer: false,
    vendorId: "v-tcp-01",
    vendorName: "Mercadito La Víbora Express (TCP)",
    vendorRole: "TCP",
    saleModes: ["RETAIL"],
    priceContainerUsd: 0,
    priceWholesaleUsd: 64.00,
    priceRetailUsd: 64.00,
    unitPriceLabel: "$64.00 USD / Combo 18.5 Kg",
    oldPriceUsd: 78.00,
    discountPct: 18,
    minWholesaleQty: 1,
    unitRetail: "Combo Completo (18.5 kg total)",
    unitWholesale: "TCP: Solo Venta Minorista",
    stock: 42,
    image: "assets/combo-proteina.jpg",
    isFlashOffer: true,
    incoterm: "Domicilio en 90 min",
    specs: "5 lb Cerdo + 10 lb Pollo + 10 lb Arroz + 2L Aceite + Café + 30 Huevos",
    description: "Combo familiar completo entregado directamente puerta a puerta por TCP local verificado."
  },
  {
    id: "prod-107",
    sku: "ELC-ECOFLOW-DELTA2",
    title: "Estación de Energía Portátil 1024Wh LiFePO4 + Panel Solar Plegable",
    category: "electro-energia",
    isContainerOffer: false,
    vendorId: "v-mip-02",
    vendorName: "ElectroHabana Solar S.R.L.",
    vendorRole: "MIPYME",
    saleModes: ["WHOLESALE", "RETAIL"],
    priceContainerUsd: 0,
    priceWholesaleUsd: 690.00,
    priceRetailUsd: 785.00,
    unitPriceLabel: "$785.00 USD / Unidad",
    oldPriceUsd: 890.00,
    discountPct: 12,
    minWholesaleQty: 3,
    unitRetail: "Unidad con Garantía 1 Año en Cuba",
    unitWholesale: "Lote Mayorista (Mín. 3 uds)",
    stock: 28,
    image: "assets/electro-hogar.jpg",
    isFlashOffer: false,
    incoterm: "Showroom Miramar",
    specs: "1800W Salida AC (110V) • Soporta Refrigerador, Ventiladores y TV",
    description: "Respaldo energético LiFePO4 de 3,000+ ciclos con entrega inmediata en La Habana."
  },
  {
    id: "prod-109",
    sku: "ASE-PACK-FAMILIAR",
    title: "Combo Aseo Total Hogar (Detergente 5kg + 6 Jabones + Shampoo + Pasta)",
    category: "aseo-belleza",
    isContainerOffer: false,
    vendorId: "v-tcp-01",
    vendorName: "Mercadito La Víbora Express (TCP)",
    vendorRole: "TCP",
    saleModes: ["RETAIL"],
    priceContainerUsd: 0,
    priceWholesaleUsd: 22.50,
    priceRetailUsd: 22.50,
    unitPriceLabel: "$22.50 USD / Pack 12 Piezas",
    oldPriceUsd: 27.00,
    discountPct: 17,
    minWholesaleQty: 1,
    unitRetail: "Pack Ahorro 12 Piezas",
    unitWholesale: "TCP: Solo Venta Minorista",
    stock: 65,
    image: "assets/electro-hogar.jpg",
    isFlashOffer: false,
    incoterm: "Entrega Hoy en La Habana",
    specs: "Detergente 5kg + 6 Jabones + 2 Pastas Dentales + Shampoo 750ml",
    description: "Aseo mensual familiar con entrega rápida a domicilio calculada por kilómetro."
  }
];

const DEFAULT_ANNOUNCEMENTS = [
  {
    id: "ann-1",
    title: "WSSND SKYLINK: Catálogo Oficial de Contenedores CIF Mariel Disponible",
    subtitle: "17 productos de alta rotación (Harina, Azúcar, Arroz, Aceite, Pollo, Leche, Café y Cerveza) con pedido directo vía Ticket WhatsApp.",
    badge: "NUEVA TIENDA",
    code: "MARIEL-CIF",
    active: true
  }
];

const DEFAULT_ORDERS = [
  {
    id: "TCK-9901",
    date: "2026-10-25 10:15",
    customerName: "Importadora Del Valle S.U.R.L. (Mipyme)",
    customerRole: "MIPYME",
    vendorName: "WSSND SKYLINK",
    orderType: "CONTENEDOR CIF MARIEL (Ticket WhatsApp)",
    municipality: "ZED Mariel (Terminal Portuaria B2B)",
    distanceKm: 0,
    deliveryUsd: 0.00,
    subtotalUsd: 43285.00,
    totalUsd: 43285.00,
    status: "Ticket Enviado a WhatsApp",
    itemsSummary: "1x Contenedor Harina 25Kg ($18,975) + 1x Contenedor Arroz 1Kg ($24,310)"
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
    version: "3.0.0",
    currentRole: "ALL_VIEW", // ALL_VIEW | EXPORTADOR_B2B | MIPYME | TCP | CLIENTE_B2C
    currency: "USD",         // USD | CUP | MLC
    rates: { USD: 1, CUP: 320, MLC: 1.15 },
    lowDataMode: false,      // Modo Con Foto vs Sin Imágenes
    theme: "light",          // light (#F6F1E7) | dark (#09100D)
    selectedProvince: "La Habana",
    selectedMunicipality: "Plaza de la Revolución (El Vedado)",
    userGps: { lat: 23.1330, lng: -82.3830, address: "Calle 23 esq. L, El Vedado, La Habana" },
    activeVendorId: "v-wssnd-01",
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

async function syncFromSupabase(state, onComplete) {
  if (!state.supabaseConfig || !state.supabaseConfig.url || !state.supabaseConfig.anonKey) {
    if (onComplete) onComplete({ synced: false, reason: "Modo Local Activo" });
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
