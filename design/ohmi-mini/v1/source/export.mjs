// Standalone vector artwork and Chromium SVG renderer. No app imports or changes.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const palettes = {
  light: { shell:'#347F78', face:'#F5F4E7', ink:'#203E3A', gold:'#C8A45D', background:'#E4F0E9' },
  dark: { shell:'#80BDB0', face:'#F5F4E7', ink:'#203E3A', gold:'#C8A45D', background:'#152E2B' },
};
function artwork(theme, micro=false) {
  const c=palettes[theme];
  return `<g id="ohmi-mini">
    <path d="M158 81L166 55" fill="none" stroke="${c.shell}" stroke-width="10" stroke-linecap="round"/>
    <circle cx="168" cy="48" r="9" fill="${c.gold}"/>
    <rect x="40" y="73" width="176" height="144" rx="44" fill="${c.shell}"/>
    <rect x="54" y="87" width="148" height="116" rx="31" fill="${c.face}"/>
    <ellipse cx="94" cy="137" rx="${micro?10:9}" ry="14" fill="${c.ink}"/>
    <ellipse cx="162" cy="137" rx="${micro?10:9}" ry="14" fill="${c.ink}"/>
    ${micro?'':`<circle cx="96.5" cy="131" r="2.5" fill="${c.face}"/><circle cx="164.5" cy="131" r="2.5" fill="${c.face}"/>`}
    <path d="M114 161C120 172 136 172 142 161" fill="none" stroke="${c.ink}" stroke-width="${micro?9:6}" stroke-linecap="round"/>
  </g>`;
}
function svg(theme,{bg=false,mask=false,micro=false}={}) {
  const raw=artwork(theme,micro);
  const body=micro?`<g transform="translate(128 128) scale(1.18) translate(-128 -128)">${raw}</g>`:raw;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-label="OHMI Mini robot face"><title>OHMI Mini — ${theme}</title>${bg?`<path fill="${palettes[theme].background}" d="M0 0H256V256H0Z"/>`:''}${mask?`<g transform="translate(128 128) scale(.88) translate(-128 -128)">${body}</g>`:body}</svg>`;
}
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();
const exports=[];
async function saveSvg(name,content) {await fs.writeFile(path.join(root,name),content.split('\n').map(line=>line.trimEnd()).join('\n')+'\n');}
async function render(name,content,size,alpha=true) {
  const data=await page.evaluate(async ({content,size,alpha})=>{
    const img=new Image();
    img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(content);
    await img.decode();
    const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
    const ctx=canvas.getContext('2d',{alpha});ctx.drawImage(img,0,0,size,size);
    return canvas.toDataURL('image/png').split(',')[1];
  },{content,size,alpha});
  await fs.writeFile(path.join(root,name),Buffer.from(data,'base64'));
  exports.push({file:name,size,transparent:alpha});
}
try {
  for (const theme of ['light','dark']) {
    await saveSvg(`logo/ohmi-mini-${theme}.svg`,svg(theme));
    await saveSvg(`source/app-${theme}.svg`,svg(theme,{bg:true}));
    await saveSvg(`source/maskable-${theme}.svg`,svg(theme,{bg:true,mask:true}));
    await saveSvg(`source/micro-${theme}.svg`,svg(theme,{micro:true}));
    await render(`logo/ohmi-mini-${theme}-1024.png`,svg(theme),1024);
    await render(`app/ohmi-mini-${theme}-1024.png`,svg(theme,{bg:true}),1024,false);
    await render(`app/google-play-${theme}-512.png`,svg(theme,{bg:true}),512,false);
    await render(`app/apple-touch-${theme}-180.png`,svg(theme,{bg:true}),180,false);
    for(const size of [16,32,48]) await render(`favicon/favicon-${theme}-${size}.png`,svg(theme,{micro:size<=32}),size);
    for(const size of [192,512]) {
      await render(`pwa/icon-${theme}-${size}.png`,svg(theme,{bg:true}),size,false);
      await render(`pwa/maskable-${theme}-${size}.png`,svg(theme,{bg:true,mask:true}),size,false);
    }
  }
  await fs.writeFile(path.join(root,'source/palette.json'),JSON.stringify(palettes,null,2)+'\n');
  await fs.writeFile(path.join(root,'source/exports.json'),JSON.stringify(exports,null,2)+'\n');
} finally {await browser.close();}
console.log(`Rendered ${exports.length} PNG files from SVG masters.`);
