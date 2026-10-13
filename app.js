import { available } from './domain.js';
import { createOrderingUI } from './orders-ui.js';


const FB = 'https://www.facebook.com/graciousdelightsfoodandbeverage/';
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number = n => new Intl.NumberFormat('en-PH', { maximumFractionDigits: 3 }).format(n);
const money = n => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n);
const paths = {
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  leaf:'<path d="M20 4C9 3 3 7 5 14s13 5 15-10ZM4 20 15 9"/>',
  box:'<path d="m3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v10M7 5l9 4"/>',
  cake:'<path d="M4 12h16v8H4zM4 15c3 4 5-3 8 0s5 0 8 0M8 12V8m8 4V8M8 5v1m8-1v1M2 20h20"/>',
  book:'<path d="M12 5c-4-3-8-2-9-1v15c4-2 6-1 9 1 3-2 5-3 9-1V4c-3-2-6-1-9 1Zm0 0v15"/>',
  history:'<path d="M4 5v5h5M4 10a9 9 0 1 1 1 8M12 7v5l3 2"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  phone:'<path d="m7 3 3 5-3 3c2 3 3 4 6 6l3-3 5 3c0 6-7 5-12 0S0 3 7 3Z"/>',
  pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  check:'<path d="m5 12 4 4 10-10"/>',
  shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6"/>',
  edit:'<path d="m15 4 5 5M4 20l5-1L21 7l-4-4L5 15l-1 5Z"/>',
  heart:'<path d="M12 20S2 14 2 8a5 5 0 0 1 10-1A5 5 0 0 1 22 8c0 6-10 12-10 12Z"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.box}</svg>`;
let state, storageError = '', mode = 'shop', section = 'products', category = 'All delights', query = '', sort = 'featured', availableOnly = false;
let deferredInstall, toastTimer, installDismissed = false;
const standalone = window.matchMedia('(display-mode: standalone)');
const isInstalled = () => standalone.matches || navigator.standalone === true;
function installPromotion() {
  const panel = $('#install-promotion');
  panel.hidden = isInstalled() || installDismissed;
  panel.innerHTML = `<div><strong>Gracious Delights on your phone</strong><span>Keep the menu and your requests one tap away.</span></div><button class="button primary" data-action="install">${icon('download')} ${deferredInstall ? 'Install app' : 'Get the app'}</button><button class="icon-button" data-action="dismiss-install" aria-label="Dismiss installation suggestion">${icon('close')}</button>`;
  document.querySelectorAll('.install-button').forEach(button => { button.hidden = isInstalled(); });
}
state = {version:1,revision:0,products:[],ingredients:[],activity:[],orders:[],admin:false,myOrderIds:[]};
let loading = true, refreshing = false, requestEpoch = 0;
async function api(op, body) {
  let response;
  try { response = await fetch('/api/shop?op='+op, {method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined}); }
  catch { throw new Error('Unable to reach the kitchen. Reconnect and try again. Your request has not been confirmed.'); }
  const data = await response.json().catch(()=>({error:'The server returned an unexpected response.'}));
  if (!response.ok) throw new Error(data.error || 'Unable to complete this request.');
  return data;
}
async function refreshState() {
  if (refreshing || document.hidden) return;
  refreshing=true;
  const epoch=requestEpoch;
  try {
    const next=await api('state');
    if(epoch!==requestEpoch)return;
    const changed=JSON.stringify(next)!==JSON.stringify(state);
    const newOrder=next.admin && next.orders.some(o=>!state.orders.some(old=>old.id===o.id));
    const recovered=!!storageError || loading;
    if(state.admin && !next.admin)$('#modal').close();
    state=next;storageError='';loading=false;
    if(changed || recovered){render();ordering.refresh();if(newOrder)toast('New order request received. Open Orders to review.');}
  } catch(error) {if(epoch===requestEpoch){storageError=error.message;loading=false;render();}}
  finally {refreshing=false;}
}
const ordering=createOrderingUI({getState:()=>state,commit,openModal,bindForm,formFooter,toast,header,money,esc,icon});
function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 5000);
}
async function commit(action, expectedRevision) {
  requestEpoch++;
  try { state=await api('mutate',{action,revision:expectedRevision});storageError='';render(); }
  catch(error) { await refreshState(); throw error; }
}
function stockBadge(p) {
  const qty=available(state,p);
  return `<span class="stock ${qty === 0 ? 'sold-out' : qty <= 3 ? 'low' : ''}"><span class="dot"></span>${qty === 0 ? 'Sold out' : `${qty} available`}</span>`;
}
const categories = () => [...new Set(state.products.filter(p => p.active).map(p => p.category))];
function header() {
  $('#header').innerHTML = `<div class="header-inner"><a class="brand" href="#shop" aria-label="Gracious Delights home"><img src="assets/facebook/a00aff175be206dd.jpg" alt="Gracious Delights logo"><span>Gracious Delights<small>HOMEMADE WITH LOVE</small></span></a><nav aria-label="Main navigation"><a href="#shop" class="${mode === 'shop' ? 'selected' : ''}">Our menu</a><button class="nav-link about-link" data-action="about">Our story</button></nav><div class="header-actions"><button class="my-requests-button" data-action="my-orders" aria-label="My requests">${icon('book')}<span>My requests</span></button><button class="basket-button" data-action="cart" aria-label="Basket, ${ordering.count()} items">${icon('box')}<span>Basket</span><b>${ordering.count()}</b></button><button class="install-button" data-action="install" aria-label="Get the app">${icon('download')}<span>Get the app</span></button></div></div>`;
}
function footer() {
  $('#footer').innerHTML = `<div class="footer-inner"><span>Gracious Delights <span class="subtle">· Homemade in Binmaley</span></span><span class="footer-links"><a href="${FB}" target="_blank" rel="noopener noreferrer">Find us on Facebook ↗</a><span id="connection" class="connection">${navigator.onLine ? 'Online' : 'Offline'}</span></span></div><p class="demo-note">Homemade in Binmaley · Orders are confirmed by our kitchen.</p>`;
}
function render() {
  header(); footer();
  installPromotion();
  $('#main').className = mode === 'admin' ? 'admin-main' : 'shop-main';
  if (loading) $('#main').innerHTML='<div class="empty-state"><h2>Opening the kitchen…</h2></div>'; else renderShop();
  if (storageError) $('#main').insertAdjacentHTML('afterbegin', `<p class="storage-warning" role="alert">${esc(storageError)} <button data-action="retry" class="text-button">Retry</button></p>`);
}
function renderShop() {
  if (category !== 'All delights' && !categories().includes(category)) category = 'All delights';
  $('#main').innerHTML = `
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero-copy"><p class="eyebrow"><span class="tiny-line"></span> FROM OUR KITCHEN, WITH LOVE</p><h1 id="hero-title">Little delights.<br><em>Lovely moments.</em></h1><p>Homemade treats and hearty favorites,<br class="desktop-break"> lovingly prepared for you and the people you love.</p><a class="button primary" href="#menu">Explore the menu ${icon('arrow')}</a><div class="hero-meta"><span>${icon('leaf')} Homemade goodness</span><span>${icon('pin')} Binmaley, Pangasinan</span></div></div>
    <div class="hero-visual"><img class="hero-photo" src="assets/facebook/a354c03220336924.jpg" alt="Gracious Delights banana bread topped with nuts and chocolate"><div class="photo-label"><span class="script">Baked with love</span><span>SHARED WITH JOY</span></div><div class="hero-photo-caption"><span>THE HOMEMADE COLLECTION</span><span>01 / 06</span></div></div>
  </section>
  <section class="menu-section" id="menu" aria-labelledby="menu-title"><div class="section-title"><div><p class="eyebrow">SOMETHING FOR EVERY CRAVING</p><h2 id="menu-title">What sounds good today?</h2></div><span class="batch-note">${icon('heart')} Small batches. Big love.</span></div>
    <div class="categories" role="group" aria-label="Product categories">${['All delights', ...categories()].map((c,i) => `<button class="category ${c === category ? 'active' : ''}" data-category="${esc(c)}" aria-pressed="${c === category}">${icon(['grid','leaf','cake','box','book'][i] || 'box')}${esc(c)}<span>${state.products.filter(p => p.active && (c === 'All delights' || p.category === c)).length}</span></button>`).join('')}</div>
    <div class="catalog-toolbar"><label class="search">${icon('search')}<input id="catalog-search" type="search" placeholder="Find your next favorite…" aria-label="Search products" value="${esc(query)}"></label><div class="catalog-options"><label class="checkbox-label"><input id="available-filter" type="checkbox" ${availableOnly ? 'checked' : ''}> In stock only</label><label class="sort-label">Sort by <select id="catalog-sort" aria-label="Sort products"><option value="featured" ${sort === 'featured' ? 'selected' : ''}>Featured</option><option value="price-asc" ${sort === 'price-asc' ? 'selected' : ''}>Price: low to high</option><option value="price-desc" ${sort === 'price-desc' ? 'selected' : ''}>Price: high to low</option><option value="name" ${sort === 'name' ? 'selected' : ''}>Name: A–Z</option></select></label></div></div>
    <p id="result-count" class="result-count" aria-live="polite"></p><div id="product-grid" class="product-grid"></div>
  </section><section class="story-strip"><div class="story-icon">${icon('heart')}</div><div><h3>Good food brings us together.</h3><p>Cakes for milestones. Snacks for little breaks. Trays for the whole family.</p></div><button class="text-button" data-action="about">Meet Gracious Delights ${icon('arrow')}</button></section>`;
  renderGrid();
  $('#catalog-search').addEventListener('input', e => { query = e.target.value; renderGrid(); });
  $('#available-filter').addEventListener('change', e => { availableOnly = e.target.checked; renderGrid(); });
  $('#catalog-sort').addEventListener('change', e => { sort = e.target.value; renderGrid(); });
}
function renderGrid() {
  let products = state.products.filter(p => p.active && (category === 'All delights' || p.category === category) && (!availableOnly || available(state,p) > 0) && `${p.name} ${p.description} ${p.category}`.toLowerCase().includes(query.toLowerCase().trim()));
  if (sort === 'price-asc') products.sort((a,b) => a.price-b.price);
  if (sort === 'price-desc') products.sort((a,b) => b.price-a.price);
  if (sort === 'name') products.sort((a,b) => a.name.localeCompare(b.name));
  $('#result-count').textContent = `${products.length} ${products.length === 1 ? 'delight' : 'delights'} to discover`;
  $('#product-grid').innerHTML = products.length ? products.map(p => `<article class="product-card ${available(state,p) === 0 ? 'unavailable' : ''}"><button class="product-photo" data-action="detail" data-id="${p.id}" aria-label="View ${esc(p.name)}"><img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">${stockBadge(p)}</button><div class="product-info"><p class="product-category">${esc(p.category)}</p><h3><button data-action="detail" data-id="${p.id}">${esc(p.name)}</button></h3><p class="product-description">${esc(p.description)}</p><div class="card-bottom"><div class="price">${money(p.price)}<span>${esc(p.portion || 'per product')}</span></div><button class="add-to-basket" data-action="add-cart" data-id="${p.id}" aria-label="Add ${esc(p.name)} to basket" ${available(state,p)===0?'disabled':''}>${icon('plus')} Add</button></div></div></article>`).join('') : `<div class="empty-state">${icon('search')}<h3>No delights found</h3><p>Try another search or category.</p><button class="button secondary" data-action="clear-filters">Clear filters</button></div>`;
}
function openModal(title, body, className = '') {
  const modal = $('#modal');
  modal.className = className;
  modal.innerHTML = `<div class="modal-top"><div><p class="eyebrow">GRACIOUS DELIGHTS</p><h2 id="modal-title">${esc(title)}</h2></div><button class="icon-button close-modal" data-action="close" aria-label="Close dialog">${icon('close')}</button></div>${body}`;
  if (!modal.open) modal.showModal();
}
function formFooter(label) {
  return `<p class="form-error" role="alert" id="form-error"></p><div class="modal-actions"><button class="button secondary" type="button" data-action="close">Cancel</button><button class="button primary" type="submit">${esc(label)} ${icon('check')}</button></div>`;
}
function bindForm(handler) {
  $('#modal form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.submitter;
    if (btn) btn.disabled = true;
    $('#form-error').textContent = '';
    try { const close=await handler(new FormData(e.target)); if(close!==false)$('#modal').close(); }
    catch(err) { $('#form-error').textContent = err.message; $('#form-error').scrollIntoView({block:'nearest'}); }
    finally { if (btn) btn.disabled = false; }
  });
}
function productDetail(id) {
  const p = state.products.find(p=>p.id===id);
  openModal(p.name, `<div class="detail-body"><img class="detail-photo" src="${esc(p.image)}" alt="${esc(p.name)}"><div class="detail-copy"><p class="product-category">${esc(p.category)}</p>${stockBadge(p)}<p>${esc(p.description)}</p><div class="detail-price">${money(p.price)}<small>${esc(p.portion || 'per product')}</small></div><div class="detail-order"><label>Quantity<input id="detail-quantity" type="number" min="1" max="${Math.max(1,available(state,p))}" step="1" value="1" ${available(state,p)===0?'disabled':''}></label><button class="button primary" data-action="detail-add" data-id="${p.id}" ${available(state,p)===0?'disabled':''}>${icon('plus')} Add to basket</button></div><p class="help-note">Order on this website. The admin will review your request and confirm arrangements.</p></div></div>`, 'detail-modal');
}
function about(){openModal('Homemade. Heartfelt. Gracious.',`<div class="about-content"><img src="assets/facebook/a00aff175be206dd.jpg" alt="Gracious Delights logo"><p>Gracious Delights is a food and beverage business in Binmaley, Philippines, sharing quality homemade cakes, snacks, and dishes.</p><p>From banana bread wedding souvenirs to food trays for the family, every gathering deserves a little delight.</p><div class="about-contact"><span>${icon('pin')} Binmaley, Philippines</span><a href="tel:+639060552414">${icon('phone')} 0906 055 2414</a></div><a class="button primary" href="${FB}" target="_blank" rel="noopener noreferrer">Explore the Facebook page ${icon('arrow')}</a><p class="help-note">Business information and photos sourced from the public Facebook page. Order directly from our website and follow your request in My requests.</p></div>`);}
async function install(){
  if(isInstalled()){toast('Gracious Delights is already open as an app.');return;}
  if(deferredInstall){
    const prompt = deferredInstall;deferredInstall=null;installPromotion();
    try {await prompt.prompt();await prompt.userChoice;return;} catch { /* Browser declined the prompt; show its manual installation path. */ }
  }
  const apple = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
  const embedded = /FBAN|FBAV|Instagram|Messenger|; wv\)/.test(navigator.userAgent);
  const steps = embedded
    ? '<li>Open the browser menu and choose <strong>Open in browser</strong>, or copy this website address into Chrome or Safari.</li><li>On Android, use the browser menu → <strong>Install app</strong> or <strong>Add to Home screen</strong>. On iPhone, use Share → <strong>Add to Home Screen</strong>.</li>'
    : apple
      ? '<li>Open this website in <strong>Safari</strong>.</li><li>Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.</li><li>Confirm by tapping <strong>Add</strong>.</li>'
      : '<li>Open this website in <strong>Chrome, Edge, or Samsung Internet</strong>.</li><li>Open the browser menu (⋮) and choose <strong>Install app</strong>, <strong>Install and create shortcut</strong>, or <strong>Add to Home screen</strong>.</li><li>Confirm the installation. If no option appears, keep the page open briefly and try again after reloading.</li>';
  openModal('Install Gracious Delights',`<div class="install-content">${icon('download')}<p>Keep Gracious Delights on your home screen. An internet connection is required for current stock, ordering, and kitchen updates.</p><ol>${steps}</ol><p class="help-note">The browser controls whether an automatic install dialog is available. Your order history stays linked to the browser where you ordered; keep its cookies to track your requests.</p><button class="button secondary" data-action="close">Got it</button></div>`);
}
document.addEventListener('click',async e=>{
  const cat=e.target.closest('[data-category]');if(cat){category=cat.dataset.category;document.querySelectorAll('[data-category]').forEach(btn=>{btn.classList.toggle('active',btn===cat);btn.setAttribute('aria-pressed',String(btn===cat));});renderGrid();return;}
  const el=e.target.closest('[data-action]');if(!el)return;
  const action=el.dataset.action,id=el.dataset.id;
  await ordering.handleAction(action,id,el);
  if(action==='close')$('#modal').close();
  if(action==='detail')productDetail(id);
  if(action==='about')about();
  if(action==='install')await install();
  if(action==='dismiss-install'){installDismissed=true;installPromotion();}
  if(action==='clear-filters'){query='';category='All delights';availableOnly=false;renderShop();}
  if(action==='retry')await refreshState();
});
$('#modal').addEventListener('click',e=>{if(e.target===$('#modal')){const r=$('#modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('#modal').close();}});
function route(){
  const hash=location.hash;
  mode='shop';
  if($('#modal').open)$('#modal').close();
  render();
  if(hash==='#menu')requestAnimationFrame(()=>$('#menu')?.scrollIntoView({behavior:'smooth'}));else window.scrollTo(0,0);
}
window.addEventListener('hashchange',route);
setInterval(refreshState,15000);
window.addEventListener('focus',refreshState);
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;installPromotion();});
window.addEventListener('appinstalled',()=>{deferredInstall=null;installDismissed=true;installPromotion();toast('Gracious Delights installed.');});
standalone.addEventListener('change',installPromotion);
for(const event of ['online','offline'])window.addEventListener(event,()=>{if(navigator.onLine)refreshState();footer();toast(navigator.onLine?'You’re back online.':'You are offline. Reconnect to place orders or update the kitchen.');});
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>toast('App installation setup was unavailable. Please reload while online.'));
route();

refreshState();
