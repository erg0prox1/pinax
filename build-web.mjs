// Copia solo los archivos de la app a ./www (lo que Capacitor mete dentro del APK).
import { cpSync, mkdirSync, rmSync } from 'node:fs';

const FILES = [
  'index.html', 'app.js', 'db.js', 'styles.css', 'sw.js',
  'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png',
];
rmSync('www', { recursive: true, force: true });
mkdirSync('www');
for (const f of FILES) cpSync(f, `www/${f}`);
console.log(`www/ listo (${FILES.length} archivos)`);
