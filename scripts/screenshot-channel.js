const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
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

  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: 'D:/Tools MMO/wesuccess-instagram/docs/screenshots/02-channel-tab.png' });
  console.log('Channel tab screenshot saved');

  // Click Analytics tab
  const buttons2 = await page.$$('button');
  for (const btn of buttons2) {
    const text = await btn.evaluate(el => el.textContent);
    if (text.includes('Analytics')) {
      await btn.click();
      break;
    }
  }

  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: 'D:/Tools MMO/wesuccess-instagram/docs/screenshots/03-analytics-tab.png' });
  console.log('Analytics tab screenshot saved');

  // Click Reports tab
  const buttons3 = await page.$$('button');
  for (const btn of buttons3) {
    const text = await btn.evaluate(el => el.textContent);
    if (text.includes('Reports')) {
      await btn.click();
      break;
    }
  }

  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: 'D:/Tools MMO/wesuccess-instagram/docs/screenshots/04-reports-tab.png' });
  console.log('Reports tab screenshot saved');

  await browser.close();
})();
