const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_TOKEN = process.env.RENDER_TOKEN || '';

// CORS
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

// Resolve CSS variables to hard values in the HTML
function resolveCssVars(html) {
  const vars = {
    '--g':    '#6CB52F',
    '--gd':   '#4A8A1F',
    '--gs':   '#E8F5DA',
    '--cr':   '#FAF7F2',
    '--sa':   '#F0E9DC',
    '--ink':  '#1A1A1A',
    '--night':'#0F1A0A',
    '--w':    '#FFFFFF',
    '--pill-momo':  '#6CB52F',
    '--pill-wiss':  '#2196A8',
    '--pill-frei':  '#E07A20',
    '--pill-throw': '#1565C0',
    '--pill-akt':   '#7B5EA7',
    '--pill-aktu':  '#C0392B',
  };
  // Replace var(--name) with hard value
  let result = html;
  for (const [name, value] of Object.entries(vars)) {
    const escaped = name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    const regex = new RegExp(`var\\(\\s*${escaped}\\s*\\)`, 'g');
    result = result.replace(regex, value);
  }
  return result;
}

// Render endpoint
app.post('/render', async (req, res) => {
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
        '--force-color-profile=srgb',
        '--disable-lcd-text',
        '--disable-font-subpixel-positioning',
      ],
    });

    const page = await browser.newPage();

    await page.setViewport({
      width: width,
      height: height,
      deviceScaleFactor: 1,
    });

    // Resolve CSS variables before sending to Puppeteer
    const resolvedHtml = resolveCssVars(html);

    await page.setContent(resolvedHtml, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    // Wait for fonts
    await page.evaluate(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, 1000));

    const png = await page.screenshot({
      type: 'png',
      encoding: 'base64',
      clip: { x: 0, y: 0, width: width, height: height },
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
