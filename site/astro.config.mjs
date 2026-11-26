// Static site: every page is rendered to HTML at build time (`npm run build` → dist/).
import { defineConfig, passthroughImageService } from 'astro/config';
import devV86 from './dev-v86.mjs';

export default defineConfig({
  site: 'https://playtermin.al',
  // Same URLs as before: /about/, /game/robots/. Stylesheets stay files (cached across pages).
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'never' },
  // No image optimisation, so sharp is never loaded.
  image: { service: passthroughImageService() },
  integrations: [devV86()],
  devToolbar: { enabled: false },
});
