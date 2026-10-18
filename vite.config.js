import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Dev-only CJS->ESM interop for scripts/lib (see build.commonjsOptions below
// for why this is needed at all). We deliberately do NOT use the real
// @rollup/plugin-commonjs here: its current (v28+) algorithm calls the
// Rollup-only PluginContext#load() for every require() it transforms
// (analyzeRequiredModule, used to classify cyclic/interop cases), which
// crashes with "Cannot read properties of undefined (reading '_container')"
// under Vite's dev server — that plugin container doesn't implement the
// full-Rollup module graph #load() relies on. It works fine for `vite build`
// because that goes through Vite's own internally-bundled Rollup pipeline
// (build.commonjsOptions), which is untouched by this. This shim instead
// does a narrow, literal require()/module.exports rewrite, matching only
// the shape scripts/lib files actually use, and fails loudly (throws)
// rather than silently emitting broken output if a file's shape changes.
function scriptsLibCjsInterop() {
  const requireRe = /^const\s+(\w+)\s*=\s*require\(\s*(['"])([^'"]+)\2\s*\)\s*;\s*$/gm;
  const exportsRe = /module\.exports\s*=\s*\{\s*([\s\S]*?)\s*\}\s*;?/;

  return {
    name: 'scripts-lib-cjs-interop',
    apply: 'serve',
    enforce: 'pre',
    transform(code, id) {
      if (!/[\\/]scripts[\\/]lib[\\/].*\.js$/.test(id)) return null;
      if (!code.includes('require(') && !code.includes('module.exports')) return null;

      let transformed = code.replace(
        requireRe,
        (_match, name, quote, specifier) => `import ${name} from ${quote}${specifier}${quote};`
      );

      const exportsMatch = exportsRe.exec(transformed);
      if (!exportsMatch) {
        throw new Error(
          `[scripts-lib-cjs-interop] ${id}: expected a "module.exports = { a, b, c };" ` +
            `shorthand block to convert to ESM exports for dev serving.`
        );
      }
      const names = exportsMatch[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (names.some((n) => !/^\w+$/.test(n))) {
        throw new Error(
          `[scripts-lib-cjs-interop] ${id}: module.exports contains a non-shorthand entry; ` +
            `this dev-only interop only supports "module.exports = { a, b, c };".`
        );
      }
      transformed = transformed.replace(exportsRe, `export { ${names.join(', ')} };`);

      // Comment-stripped only for this check — doc comments in this codebase
      // routinely mention `require('x')` in prose (see this file's own
      // header), which isn't a real leftover call.
      const withoutComments = transformed.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      if (/\brequire\(/.test(withoutComments)) {
        throw new Error(
          `[scripts-lib-cjs-interop] ${id}: a require() call remains after conversion ` +
            `(only "const NAME = require('spec');" at the top level is supported for dev serving).`
        );
      }

      return { code: transformed, map: null };
    },
  };
}

// NOTE (Bagnik build note #1, non-negotiable): Vite's dev server refuses to
// serve files outside its configured root (app/) unless explicitly allowed.
// This app imports scripts/lib/rutina-validator.js and data/equipment.json
// from OUTSIDE app/ on purpose (tech-plan.md's "reuse, don't fork" decision),
// so the repo root must be added to server.fs.allow or `npm run dev` 403s.
export default defineConfig({
  root: path.resolve(__dirname, 'app'),
  base: './',
  server: {
    fs: {
      allow: [__dirname],
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    // scripts/lib/rutina-validator.js (imported directly by
    // app/src/lib/validateImport.js, per tech-plan's "reuse, don't fork"
    // decision) is plain CommonJS (require/module.exports). Rollup only
    // auto-interops CJS found in node_modules by default — without this,
    // `require('ajv')` inside that first-party file resolves to nothing in
    // the browser bundle. Not called out in tech-plan's own gotcha note
    // (which only covers the dev-server 403 above); added here as a
    // necessary follow-on fix for the same "reuse the validator" decision.
    commonjsOptions: {
      include: [/node_modules/, /scripts[\\/]lib/],
      transformMixedEsModules: true,
    },
  },
  plugins: [
    // Same CJS-interop reason as build.commonjsOptions above, but for the
    // dev server: Vite's dev server does NOT run source files through
    // Rollup's commonjs plugin by default (that only happens for the
    // production build), so `npm run dev` would otherwise throw
    // "require is not defined" the moment ImportScreen imports
    // validateImport.js. See scriptsLibCjsInterop's own comment above for
    // why this dev-only shim exists instead of the real @rollup/plugin-commonjs.
    scriptsLibCjsInterop(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false, // app/public/manifest.json is hand-authored (relative start_url/scope) and linked from index.html
      includeAssets: ['icons/*.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json}'],
        runtimeCaching: [
          {
            // Equipment images are hosted externally (Matrix CDN) and referenced
            // by URL in the bundled data/equipment.json, not bundled as build
            // assets — cache them on first view so a previously-viewed rutina's
            // equipment images stay available offline (tech-plan.md's PWA decision).
            urlPattern: ({ url }) => url.hostname === 'images.jhtassets.com' || url.hostname === 'assets.jhtbrand.co',
            handler: 'CacheFirst',
            options: {
              cacheName: 'equipment-images',
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
