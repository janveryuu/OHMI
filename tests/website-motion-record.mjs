// Records an isolated desktop Chrome profile, never the user's desktop or browser session.
import { chromium } from 'playwright';
import { mkdir, readFile, rename } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, extname, sep } from 'node:path';

const output = resolve('website/.impeccable/review/motion-v2');
const beforeRoot = resolve('.output/motion-v2/before-site/dist');
await mkdir(output,{recursive:true});
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.ttf':'font/ttf'};
const server = createServer(async(req,res)=>{
  const path=resolve(beforeRoot,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));
  if(!path.startsWith(beforeRoot+sep)){res.writeHead(403).end();return;}
  try{const data=await readFile(path);res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream'}).end(data);}
  catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(4175,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'chrome',headless:false});
try{
  for(const [name,url] of [['before','http://127.0.0.1:4175/'],['after',process.env.OHMI_WEBSITE_URL||'http://127.0.0.1:4174/']]){
    const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:output,size:{width:1440,height:1000}}});
    const page=await context.newPage();
    await page.goto(url);await page.evaluate(()=>document.fonts.ready);
    // Recording-only cursor marker makes the same pointer path visible in both clips.
    await page.evaluate(()=>{
      const marker=document.createElement('div');
      marker.style.cssText='position:fixed;left:0;top:0;width:10px;height:10px;border:2px solid white;border-radius:50%;pointer-events:none;z-index:99999;box-shadow:0 1px 3px #000';
      document.body.append(marker);
      document.addEventListener('pointermove',event=>marker.style.transform=`translate(${event.clientX-5}px,${event.clientY-5}px)`);
    });
    await page.waitForTimeout(1200);
    for(const [x,y] of [[100,180],[1380,180],[1380,820],[100,820],[1020,470],[1250,470],[1020,600],[1250,600]]){
      await page.mouse.move(x,y,{steps:30});await page.waitForTimeout(450);
    }
    await page.mouse.move(700,650,{steps:30});
    await page.waitForTimeout(2400);
    await page.screenshot({path:resolve(output,`${name}.png`)});
    const video=page.video();await context.close();
    await rename(await video.path(),resolve(output,`${name}.webm`));
    console.log(`Recorded ${name}: ${url}`);
  }
}finally{await browser.close();server.close();}
