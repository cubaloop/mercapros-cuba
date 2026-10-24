const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3080;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// Healthcheck & Config Endpoints for 24/7 Wake-Lock
app.get('/healthz', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'Mercapros Cuba B2B/B2C Super-App',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/api/config', (req, res) => {
  res.status(200).json({
    app: 'Mercapros',
    version: '2.4.0',
    market: 'Cuba (La Habana & Provincias)',
    tiers: ['EXPORTADOR_B2B', 'MIPYME', 'TCP', 'CLIENTE_B2C'],
    currencies: ['USD', 'CUP', 'MLC'],
    exchangeRate: { USD_CUP: 320, MLC_CUP: 275 },
    wakeLockIntervalMs: 300000
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[Mercapros] Servidor activo en http://localhost:${PORT}`);
  // Auto-Pulso Wake-Lock interno cada 5 minutos (300,000 ms)
  const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://127.0.0.1:${PORT}`;
  setInterval(() => {
    fetch(`${SELF_URL}/healthz`)
      .then(r => r.json())
      .then(d => console.log(`[Wake-Lock] Pulso exitoso: ${d.timestamp}`))
      .catch(err => console.error(`[Wake-Lock] Error en pulso:`, err.message));
  }, 300000);
});
