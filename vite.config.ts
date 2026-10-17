import { defineConfig, type Plugin } from 'vite';

/** Γράφει τη λίστα των αρχείων του build, ώστε ο service worker να τα αποθηκεύσει για χρήση χωρίς ίντερνετ. */
function precacheList(): Plugin {
  return {
    name: 'precache-list',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = ['./', 'manifest.webmanifest', 'icon-256.png', 'icon-512.png', 'favicon.svg', 'logo.svg', 'logo-light.svg', 'odigies.html', ...Object.keys(bundle)];
      this.emitFile({ type: 'asset', fileName: 'precache.json', source: JSON.stringify(files) });
    },
  };
}

export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(new Date().toLocaleDateString('sv')) },
  build: { target: 'es2022' },
  server: { port: 5173, strictPort: true },
  clearScreen: false,
  plugins: [precacheList()],
});
