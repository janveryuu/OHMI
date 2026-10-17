import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';

const env = loadEnv('production', '.', 'WXT_');
if (!env.WXT_EXTENSION_PUBLIC_KEY) console.warn('OHMI extension identity depends on its build path. Preserve the registered installation path until its public manifest key is available.');
const backendOrigin = env.WXT_SUPABASE_URL && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(env.WXT_SUPABASE_URL) ? new URL(env.WXT_SUPABASE_URL).origin : undefined;

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'OHMI — Your Circuit Buddy',
    description: 'A friendly learning companion for Tinkercad Circuits.',
    version: '0.3.0',
    minimum_chrome_version: '116',
    permissions: ['storage', 'identity', 'activeTab'],
    action: {
      default_title: 'Capture visible Tinkercad circuit for review',
    },
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
    'build:done': async (wxt) => {
      const { readdir, readFile, writeFile } = await import('node:fs/promises');
      const { join } = await import('node:path');
      const sanitizeDir = async (dir: string) => {
        const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
        for (const entry of entries) {
          const full = join(dir, entry.name);
          if (entry.isDirectory()) await sanitizeDir(full);
          else if (entry.name.endsWith('.js')) {
            let buf = await readFile(full);
            const target = Buffer.from([0xEF, 0xBF, 0xBF]);
            if (buf.includes(target)) {
              const replacement = Buffer.from('\\uFFFF', 'ascii');
              while (buf.includes(target)) {
                const idx = buf.indexOf(target);
                buf = Buffer.concat([buf.slice(0, idx), replacement, buf.slice(idx + 3)]);
              }
              await writeFile(full, buf);
            }
          }
        }
      };
      await sanitizeDir(wxt.config.outDir);
    },
  },
  vite: () => ({
    plugins: [
      tailwindcss(),
      {
        name: 'sanitize-unicode-noncharacters',
        renderChunk(code: string) {
          return code.replaceAll('\uffff', '\\uFFFF');
        },
      },
    ],
  }),
});
