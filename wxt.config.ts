import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'OHMI — Your Circuit Buddy',
    description: 'A friendly learning companion for Tinkercad Circuits.',
    version: '0.2.0',
    permissions: ['storage'],
    web_accessible_resources: [{
      resources: ['assets/mascot/ohmi-pixel-front.png'],
      matches: ['https://www.tinkercad.com/*'],
    }],
  },
  hooks: {
    'build:publicAssets': (wxt, assets) => {
      assets.push({ absoluteSrc: `${wxt.config.root}/assets/mascot/ohmi-pixel-front.png`, relativeDest: 'assets/mascot/ohmi-pixel-front.png' });
    },
  },
  vite: () => ({ plugins: [tailwindcss()] }),
});
