import { configDefaults, defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  test: { exclude: [...configDefaults.exclude, 'web-app/**', '.worktrees/**'] },
  plugins: [WxtVitest()],
  resolve: {
    alias: {
      'npm:@supabase/supabase-js@2': '@supabase/supabase-js',
      'npm:unpdf@1.8.1': 'unpdf',
    },
  },
});
