const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_TOKEN = process.env.RENDER_TOKEN || '';

// Allow requests from any origin (CORS)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-render-token');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: '50mb' }));

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'ABZ Render Server' });
});

// Render endpoint
app.post('/render', async (req, res) => {
  // Token check
  const token = req.headers['x-render-token'];
  if (SECRET_TOKEN && token !== SECRET_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { html, width = 1080, height = 1350 } = req.body;
  if (!html) return res.status(400).json({ error: 'Missing html' });

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=none',
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    // Extra wait for fonts to fully render
    await page.evaluate(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, 500));

    const png = await page.screenshot({
      type: 'png',
      encoding: 'base64',
      clip: { x: 0, y: 0, width, height },
    });

    res.json({ png });

  } catch (err) {
    console.error('Render error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

app.listen(PORT, () => {
  console.log(`ABZ Render Server running on port ${PORT}`);
});
