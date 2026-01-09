const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto('http://localhost:3001', { waitUntil: 'networkidle2' });

  // Click Channel tab first to get data
  let buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await btn.evaluate(el => el.textContent);
    if (text.includes('Channel')) {
      await btn.click();
      break;
    }
  }

  await new Promise(r => setTimeout(r, 500));

  // Type username
  const input = await page.$('input[placeholder*="username"]');
  if (input) {
    await input.type('natgeo');
  }

  // Click Analyze
  buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await btn.evaluate(el => el.textContent);
    if (text.includes('Analyze')) {
      await btn.click();
      break;
    }
  }

  // Wait for data
  await new Promise(r => setTimeout(r, 2000));

  // Click Reports tab
  buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await btn.evaluate(el => el.textContent);
    if (text.includes('Reports')) {
      await btn.click();
      break;
    }
  }

  await new Promise(r => setTimeout(r, 1000));

  await page.screenshot({
    path: 'D:/Tools MMO/wesuccess-instagram/docs/screenshots/07-reports-tab.png',
    fullPage: true
  });
  console.log('Reports tab screenshot saved');

  await browser.close();
})();
