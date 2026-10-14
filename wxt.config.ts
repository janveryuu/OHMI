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
    permissions: ['storage', 'identity'],
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
    },
  },
  vite: () => ({ plugins: [tailwindcss()] }),
});
