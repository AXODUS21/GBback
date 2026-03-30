const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page1 = await browser.newPage();
  
  console.log('--- TESTING GBBACKEND (3005) ---');
  page1.on('console', msg => console.log('BACKEND LOG:', msg.text()));
  page1.on('pageerror', error => console.log('BACKEND ERROR:', error.message));

  try {
    await page1.goto('http://localhost:3005', { waitUntil: 'networkidle2' });
    console.log('Backend loaded successfully.');
  } catch(e) {
    console.log('Backend load error:', e.message);
  }

  const page2 = await browser.newPage();
  console.log('\n--- TESTING GBFRONTEND (3000) ---');
  page2.on('console', msg => console.log('FRONTEND LOG:', msg.text()));
  page2.on('pageerror', error => console.log('FRONTEND ERROR:', error.message));

  try {
    await page2.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    console.log('Frontend loaded successfully.');
  } catch(e) {
    console.log('Frontend load error:', e.message);
  }

  await browser.close();
})();
