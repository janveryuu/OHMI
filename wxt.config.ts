import {readdirSync} from 'node:fs';
import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';

const env = loadEnv('production', '.', 'WXT_');
const backendOrigin = env.WXT_SUPABASE_URL && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(env.WXT_SUPABASE_URL) ? new URL(env.WXT_SUPABASE_URL).origin : undefined;

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'OHMI — Your Circuit Buddy',
    description: 'A friendly learning companion for Tinkercad Circuits.',
    version: '0.4.0',
    minimum_chrome_version: '116',
    permissions: ['storage', 'identity', 'offscreen'],
    host_permissions: ['https://www.tinkercad.com/*', ...(backendOrigin ? [`${backendOrigin}/*`] : [])],
    ...(env.WXT_EXTENSION_PUBLIC_KEY ? { key: env.WXT_EXTENSION_PUBLIC_KEY } : {}),
    web_accessible_resources: [{
      resources: ['assets/mascot/ohmi-pixel-front.png'],
      matches: ['https://www.tinkercad.com/*'],
    }],
  },
  hooks: {
    'build:publicAssets': (wxt, assets) => {
      assets.push({ absoluteSrc: `${wxt.config.root}/assets/mascot/ohmi-pixel-front.png`, relativeDest: 'assets/mascot/ohmi-pixel-front.png' });
      assets.push({ absoluteSrc: `${wxt.config.root}/node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs`, relativeDest: 'assets/pdf/pdf.worker.min.mjs' });
      for(const directory of ['cmaps','standard_fonts'])for(const file of readdirSync(`${wxt.config.root}/node_modules/pdfjs-dist/${directory}`))assets.push({absoluteSrc:`${wxt.config.root}/node_modules/pdfjs-dist/${directory}/${file}`,relativeDest:`assets/pdf/${directory}/${file}`});
      assets.push({absoluteSrc:`${wxt.config.root}/node_modules/pdfjs-dist/LICENSE`,relativeDest:'assets/pdf/LICENSE'});
    },
  },
  vite: () => ({ plugins: [tailwindcss()] }),
});
