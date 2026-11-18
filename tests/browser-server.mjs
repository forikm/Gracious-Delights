// Isolated, memory-only UI verification server. Never part of the Vercel build.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHandler } from '../api/shop.js';
import { testDatabase } from './database-helper.mjs';
import { createSeed, transition } from '../domain.js';
import { hashPassword } from '../lib/auth.js';
const db=await testDatabase();
await db.query('UPDATE shop_state SET data=$1::jsonb WHERE id=1',[JSON.stringify(transition(createSeed(),{type:'importSignCatalog'}))]);
const handler=createHandler(()=>db,{APP_ORIGIN:'http://127.0.0.1:4182',ADMIN_EMAIL:'test@example.test',ADMIN_PASSWORD_HASH:await hashPassword('Browser-test-only-123!')});
const allowed=new Set(['index.html','app.js', 'interaction.js','domain.js','menu-catalog.js','product-photos.js','announcements.js','announcements.css','catalog-view.js','orders-ui.js','checkout-map.js','styles.css','orders.css','sw.js','manifest.webmanifest']);
http.createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/api/shop')return handler(req,res);
  const file=path==='/'?'index.html':path.slice(1);
  const leaflet=/^vendor\/leaflet\/(?:leaflet\.(?:js|css)|images\/(?:marker-icon(?:-2x)?|marker-shadow|layers(?:-2x)?)\.png)$/.test(file);
  if((!allowed.has(file)&&!leaflet&&!/^assets\/[a-zA-Z0-9/_.-]+$/.test(file))||file.includes('..')){res.writeHead(404);res.end();return;}
  try{const bytes=await readFile(leaflet?file.replace('vendor/leaflet/','node_modules/leaflet/dist/'):file);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':file.endsWith('.png')?'image/png':file.endsWith('.jpg')?'image/jpeg':file.endsWith('.webmanifest')?'application/manifest+json':'image/svg+xml');res.end(bytes);}catch{res.writeHead(404);res.end();}
}).listen(4182,'127.0.0.1',()=>console.log('Isolated UI test server: http://127.0.0.1:4182'));
