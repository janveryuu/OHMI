import { chromium } from 'playwright';
import { resolve } from 'node:path';
const browser = await chromium.launch({headless:true});
try {
  const page = await browser.newPage({viewport:{width:1180,height:820},deviceScaleFactor:1,colorScheme:'light',reducedMotion:'reduce'});
  for(const [route,name] of [['ask','ask'],['checker','check'],['guide','build']]) {
    await page.goto(`http://127.0.0.1:3101/${route}`);
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForTimeout(500);
    await page.screenshot({path:resolve(`website/src/assets/${name}-preview.png`)});
  }
} finally {await browser.close();}
