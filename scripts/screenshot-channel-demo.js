const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1200 });
  await page.goto('http://localhost:3001', { waitUntil: 'networkidle2' });

  // Click Channel tab
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await btn.evaluate(el => el.textContent);
    if (text.includes('Channel')) {
      await btn.click();
      break;
    }
  }

  await new Promise(r => setTimeout(r, 300));

  // Type username
  const input = await page.$('input[placeholder*="username"]');
  if (input) {
    await input.type('natgeo');
  }

  // Click Analyze button
  const analyzeBtn = await page.$('button:last-of-type');
  const buttons2 = await page.$$('button');
  for (const btn of buttons2) {
    const text = await btn.evaluate(el => el.textContent);
    if (text.includes('Analyze')) {
      await btn.click();
      break;
    }
  }

  // Wait for results
  await new Promise(r => setTimeout(r, 2000));

  await page.screenshot({ path: 'D:/Tools MMO/wesuccess-instagram/docs/screenshots/05-channel-demo.png', fullPage: true });
  console.log('Channel demo screenshot saved');

  await browser.close();
})();
