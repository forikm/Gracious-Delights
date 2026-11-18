import { mkdir, copyFile, cp } from 'node:fs/promises';
// Only this allowlist is public. Server code, credentials, tests and personal files stay out.
await mkdir('dist', {recursive:true});
for (const file of ['index.html','styles.css','orders.css','app.js', 'interaction.js','domain.js','menu-catalog.js','product-photos.js','announcements.js','announcements.css','catalog-view.js','orders-ui.js','checkout-map.js','manifest.webmanifest','sw.js']) {
  await copyFile(file, `dist/${file}`);
}
await cp('assets', 'dist/assets', {recursive:true});
await mkdir('dist/vendor/leaflet', {recursive:true});
for (const file of ['leaflet.js','leaflet.css']) await copyFile(`node_modules/leaflet/dist/${file}`, `dist/vendor/leaflet/${file}`);
await cp('node_modules/leaflet/dist/images', 'dist/vendor/leaflet/images', {recursive:true});
await copyFile('node_modules/leaflet/LICENSE', 'dist/vendor/leaflet/LICENSE');
console.log('Built static frontend in dist; Vercel serves api/shop.js separately.');
