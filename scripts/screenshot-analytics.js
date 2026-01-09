const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1400 });
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
    console.log('Typed username');
  }

  // Click Analyze
  buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await btn.evaluate(el => el.textContent);
    if (text.includes('Analyze')) {
      await btn.click();
      console.log('Clicked Analyze');
      break;
    }
  }

  // Wait for channel data - wait for profile card to appear
  console.log('Waiting for channel data...');
  try {
    await page.waitForSelector('text/@natgeo', { timeout: 5000 });
    console.log('Profile loaded');
  } catch (e) {
    console.log('Profile wait timeout, checking anyway...');
  }

  // Extra wait for data to populate
  await new Promise(r => setTimeout(r, 1000));

  // Screenshot channel tab to verify data loaded
  await page.screenshot({
    path: 'D:/Tools MMO/wesuccess-instagram/docs/screenshots/05b-channel-before-analytics.png',
    fullPage: true
  });
  console.log('Channel data screenshot saved');

  // Now click Analytics tab
  buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await btn.evaluate(el => el.textContent);
    if (text.includes('Analytics')) {
      await btn.click();
      console.log('Clicked Analytics');
      break;
    }
  }

  // Wait for AI analysis to complete
  console.log('Waiting for AI analysis...');
  await new Promise(r => setTimeout(r, 3000));

  await page.screenshot({
    path: 'D:/Tools MMO/wesuccess-instagram/docs/screenshots/06-analytics-ai.png',
    fullPage: true
  });
  console.log('Analytics AI screenshot saved');

  await browser.close();
})();
