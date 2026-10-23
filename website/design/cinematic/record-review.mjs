import { chromium } from 'playwright';
import { resolve } from 'node:path';
const browser = await chromium.launch({headless:true});
const context = await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1,recordVideo:{dir:resolve('website/.impeccable/review/cinematic/recording'),size:{width:1440,height:900}}});
const page = await context.newPage();
try {
  await page.goto('http://127.0.0.1:4177');
  await page.waitForTimeout(8500);
  await page.locator('#motion-toggle').click();await page.waitForTimeout(900);
  await page.locator('#motion-toggle').click();await page.waitForTimeout(1000);
  await page.locator('#features').scrollIntoViewIfNeeded();
  await page.locator('.feature-card').first().hover();await page.waitForTimeout(1600);
  await page.locator('.feature-card').nth(1).hover();await page.waitForTimeout(1400);
  await page.locator('a[href="#how-it-works"]').first().click();await page.waitForTimeout(1700);
  await page.locator('a[href="#try"]').first().click();await page.waitForTimeout(1400);
  await page.getByRole('button',{name:'What does digitalWrite do?'}).click();await page.waitForTimeout(1600);
  await page.locator('.footer-brand').click();await page.waitForTimeout(2300);
  console.log(await page.video().path());
} finally {await context.close();await browser.close();}
