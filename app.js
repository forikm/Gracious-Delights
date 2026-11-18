import { SHOP_CATEGORIES } from './menu-catalog.js';
import { dialogControls, focusHeading, rememberFocus } from './interaction.js';
import { renderAnnouncements, sortedAnnouncements } from './announcements.js';
import { catalogGroups, variantLabels } from './catalog-view.js';
import { mapLink, pickupLocation } from './checkout-map.js';
import { productPhoto } from './product-photos.js';
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
  panel.hidden = true;
  panel.innerHTML = `<div><strong>Gracious Delights on your phone</strong><span>Open the menu and track orders from your home screen.</span></div><button class="button primary" data-action="install">${icon('download')} ${deferredInstall ? 'Install app' : 'Get the app'}</button><button class="icon-button" data-action="dismiss-install" aria-label="Dismiss installation suggestion">${icon('close')}</button>`;
  document.querySelectorAll('.install-button').forEach(button => { button.hidden = isInstalled(); });
}
state = {version:1,revision:0,products:[],ingredients:[],activity:[],orders:[],admin:false,myOrderIds:[]};
let loading = true, refreshing = false, requestEpoch = 0;
async function api(op, body) {
  let response;
  try { response = await fetch('/api/shop?op='+op, {method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout?.(30000)}); }
  catch (error) {
    if (error.name === 'TimeoutError') throw new Error('The kitchen did not respond in time. Check the request status or try again.');
    throw new Error('Unable to reach the kitchen. Check your connection and try again.');
  }
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
    if(changed || recovered){render();if (recovered && location.hash === '#menu' && window.scrollY === 0) showMenu(false);ordering.refresh();if(newOrder)toast('New order request received. Open Orders to review.');}
  } catch(error) {if(epoch===requestEpoch){storageError=error.message;loading=false;render();}}
  finally {refreshing=false;}
}
const dialogs = dialogControls($('#modal'), {
  escape: esc, checkIcon: icon('check'), closeIcon: icon('close'),
  fallback: () => $('[data-action="cart"]') || $('#main')
});
const {openModal, bindForm, formFooter} = dialogs;
const ordering=createOrderingUI({getState:()=>state,commit,openModal,bindForm,formFooter,toast,header,money,esc,icon,api});
function toast(message) {
  if ($('#modal').open && !dialogs.isBusy()) {
    $('#modal .dialog-status').textContent = message;
    return;
  }
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
function header() {
  const restoreFocus = rememberFocus($('#header'));
  $('#header').innerHTML = `<div class="header-inner"><a class="brand" href="#shop" aria-label="Gracious Delights home"><img src="assets/facebook/a00aff175be206dd.jpg" alt="Gracious Delights logo"><span>Gracious Delights<small>HOMEMADE WITH LOVE</small></span></a><nav aria-label="Main navigation"><a href="#menu" class="${mode === 'shop' ? 'selected' : ''}" ${mode==='shop'?'aria-current="page"':''}>Our menu</a><a href="#announcements" class="${mode==='announcements'?'selected':''}" ${mode==='announcements'?'aria-current="page"':''}>Announcements</a><button class="nav-link about-link" data-action="about">Our story</button></nav><div class="header-actions"><button class="my-requests-button" data-action="my-orders" aria-label="My requests">${icon('book')}<span>My requests</span></button><button class="basket-button" data-action="cart" aria-label="Basket, ${ordering.count()} items">${icon('box')}<span>Basket</span><b>${ordering.count()}</b></button><button class="install-button" data-action="install" aria-label="Get the app">${icon('download')}<span>Get the app</span></button></div></div><nav class="mobile-shop-nav" aria-label="Shop pages"><a href="#menu" ${mode==='shop'?'aria-current="page"':''}>Menu</a><a href="#announcements" ${mode==='announcements'?'aria-current="page"':''}>Announcements</a></nav>`;
  restoreFocus();
}
function footer() {
  $('#footer').innerHTML = `<div class="footer-inner"><span>Gracious Delights <span class="subtle">· Homemade in Binmaley</span></span><span class="footer-links"><a href="${FB}" target="_blank" rel="noopener noreferrer">Find us on Facebook ↗</a><span id="connection" class="connection">${navigator.onLine ? 'Online' : 'Offline'}</span></span></div><p class="demo-note">Homemade in Binmaley · Orders are confirmed by our kitchen. <a href="#announcements">Announcements</a> · <button class="text-button shop-policy" data-action="how-to-order">Pickup & delivery</button> · <button class="text-button shop-policy" data-action="policy">Terms and privacy</button></p>`;
}
function render() {
  const restoreFocus = rememberFocus(document);
  header(); footer();
  installPromotion();
  $('#main').className = mode === 'admin' ? 'admin-main' : 'shop-main';
  if (loading) $('#main').innerHTML='<div class="empty-state"><h2>Opening the kitchen…</h2></div>'; else if(mode==='announcements')renderAnnouncements($('#main'),state.announcements);else renderShop();
  if (storageError) $('#main').insertAdjacentHTML('afterbegin', `<p class="storage-warning" role="alert">${esc(storageError)} <button data-action="retry" class="text-button">Retry</button></p>`);
  restoreFocus();
}
function renderShop() {
  if (category !== 'All delights' && !SHOP_CATEGORIES.includes(category)) category = 'All delights';
  $('#main').innerHTML = `
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero-copy"><h1 id="hero-title">Homemade treats.<br><em>Made in Binmaley.</em></h1><p>Ensaymada, cinnamon rolls, cakes, and banana bread.</p><a class="button primary" href="#menu">Shop the menu ${icon('arrow')}</a><div class="hero-meta"><span>${icon('pin')} Binmaley, Pangasinan</span></div></div>
    <div class="hero-visual"><img class="hero-photo" src="assets/facebook/a354c03220336924.jpg" alt="Gracious Delights banana bread topped with nuts and chocolate"></div>
  </section>
  ${sortedAnnouncements((state.announcements||[]).filter(item=>item.published)).slice(0,1).map(item=>`<aside class="latest-announcement" aria-label="Latest announcement"><span>From the kitchen</span><a href="#announcements">${esc(item.title)} →</a></aside>`).join('')}<section class="menu-section" id="menu" aria-labelledby="menu-title"><div class="section-title"><h2 id="menu-title">Our menu</h2></div>
    <label class="mobile-category">Browse by category<select id="mobile-category" aria-label="Product category">${['All delights',...SHOP_CATEGORIES].map(c=>`<option value="${esc(c)}" ${c===category?'selected':''}>${esc(c)}</option>`).join('')}</select></label><div class="categories" role="group" aria-label="Product categories">${['All delights', ...SHOP_CATEGORIES].map((c,i) => `<button class="category ${c === category ? 'active' : ''}" data-category="${esc(c)}" aria-pressed="${c === category}">${icon(['grid','leaf','cake','box','book'][i] || 'box')}${esc(c)}<span>${catalogGroups(state,{category:c}).length}</span></button>`).join('')}</div>
    <div class="catalog-toolbar"><label class="search">${icon('search')}<input id="catalog-search" type="search" placeholder="Search the menu" aria-label="Search the menu" value="${esc(query)}"></label><div class="catalog-options"><label class="checkbox-label"><input id="available-filter" type="checkbox" ${availableOnly ? 'checked' : ''}> In stock only</label><label class="sort-label">Sort by <select id="catalog-sort" aria-label="Sort products"><option value="featured" ${sort === 'featured' ? 'selected' : ''}>Featured</option><option value="price-asc" ${sort === 'price-asc' ? 'selected' : ''}>Price: low to high</option><option value="price-desc" ${sort === 'price-desc' ? 'selected' : ''}>Price: high to low</option><option value="name" ${sort === 'name' ? 'selected' : ''}>Name: A–Z</option></select></label></div></div>
    <div class="availability-note"><span>${catalogGroups(state,{inStock:true}).length} products available to order now</span><button class="text-button" data-action="how-to-order">Pickup & delivery information ${icon('arrow')}</button></div><p id="result-count" class="result-count" aria-live="polite"></p><div id="product-grid" class="product-grid"></div>
  </section><section class="story-strip"><div class="story-icon">${icon('heart')}</div><div><h3>Good food brings us together.</h3><p>Cakes for milestones. Snacks for little breaks. Trays for the whole family.</p></div><button class="text-button" data-action="about">Meet Gracious Delights ${icon('arrow')}</button></section>`;
  renderGrid();
  $('#mobile-category').addEventListener('change',e=>{category=e.target.value;renderGrid();document.querySelectorAll('[data-category]').forEach(btn=>{btn.classList.toggle('active',btn.dataset.category===category);btn.setAttribute('aria-pressed',String(btn.dataset.category===category));});});
  $('#catalog-search').addEventListener('input', e => { query = e.target.value; renderGrid(); });
  $('#available-filter').addEventListener('change', e => { availableOnly = e.target.checked; renderGrid(); });
  $('#catalog-sort').addEventListener('change', e => { sort = e.target.value; renderGrid(); });
}
function renderGrid() {
  const groups=catalogGroups(state,{category,query,inStock:availableOnly,sort});
  $('#result-count').textContent=`${groups.length} ${groups.length===1?'product':'products'}`;
  $('#product-grid').innerHTML=groups.length?groups.map(g=>{
    const multiple=g.variants.length>1;
    return `<article class="product-card ${g.stock?'':'unavailable'}"><button class="product-photo" data-action="detail" data-id="${esc(g.id)}" data-variant="${esc(g.photo.id)}" aria-label="View ${esc(g.name)}">${productPhoto(g.photo,'',true)}<span class="stock ${g.stock?'':'sold-out'}"><span class="dot"></span>${g.stock?'Available now':'Currently unavailable'}</span></button><div class="product-info"><p class="product-category">${esc(g.category)}</p><h3><button data-action="detail" data-id="${esc(g.id)}" data-variant="${esc(g.photo.id)}">${esc(g.name)}</button></h3><p class="product-description">${esc(g.description)}</p><div class="card-bottom"><div class="price">${g.minPrice!==g.maxPrice?'<small>From </small>':''}${money(g.minPrice)}<span>${multiple?g.variants.length+' options':esc(g.photo.portion||'per product')}</span></div><button class="add-to-basket" data-action="${multiple||!g.stock?'detail':'add-cart'}" data-id="${esc(multiple||!g.stock?g.id:g.photo.id)}" data-variant="${esc(g.photo.id)}" aria-label="${multiple?'Choose options for ':g.stock?'Add ':'View '}${esc(g.name)}">${multiple?'Choose options':g.stock?'Add':'View'}</button></div></div></article>`;
  }).join(''):'<div class="empty-state"><h3>No matching products</h3><p>Try another search or view the complete menu.</p><button class="button primary" data-action="clear-filters">View all products</button></div>';
}
function productDetail(id, selectedId) {
  const group = catalogGroups(state).find(g => g.id === id || g.variants.some(p => p.id === id));
  if (!group) return;
  let selected = group.variants.find(p => p.id === (selectedId || id))
    || group.variants.find(p => available(state, p) > 0) || group.variants[0];
  const flavors = [...new Set(group.variants.map(p => variantLabels(p).flavor))];
  const fields = group.variants.length > 1 ? `<div class="variant-fields">
    <label>${group.optionLabel}
      <select id="product-flavor">${flavors.map(flavor => `<option>${esc(flavor)}</option>`).join('')}</select>
    </label>
    <label>Size or pack<select id="product-size"></select></label>
  </div>` : '';
  openModal(group.name, `<div class="detail-body">
    <p class="product-category">${esc(group.category)}</p>
    <div class="detail-selection-photo"></div>
    <div class="detail-selection-copy">
      ${fields}
      <h3 id="variant-name"></h3>
      <div id="variant-summary" class="variant-summary" role="status" aria-atomic="true"></div>
      <p id="variant-description"></p>
      <div id="variant-actions"></div>
    </div>
  </div>`, 'detail-modal');

  const flavorControl = $('#product-flavor');
  const sizeControl = $('#product-size');
  const optionsFor = flavor => group.variants.filter(p => variantLabels(p).flavor === flavor);
  function updateSizes() {
    const {flavor} = variantLabels(selected);
    flavorControl.value = flavor;
    sizeControl.innerHTML = optionsFor(flavor).map(p =>
      `<option value="${esc(p.id)}">${esc(variantLabels(p).size)} · ${money(p.price)}${available(state, p) ? '' : ' · Unavailable'}</option>`
    ).join('');
    sizeControl.value = selected.id;
  }
  function updateSelection() {
    const stock = available(state, selected);
    $('.detail-selection-photo').innerHTML = productPhoto(selected, 'detail-photo');
    $('#variant-name').textContent = selected.name;
    $('#variant-description').textContent = selected.description;
    $('#variant-summary').innerHTML = `${stockBadge(selected)}<div class="detail-price">${money(selected.price)}<small>${esc(selected.portion || 'per product')}</small></div>`;
    $('#variant-actions').innerHTML = stock
      ? `<div class="detail-order"><label>Quantity<input id="detail-quantity" type="number" min="1" max="${stock}" step="1" value="1" required></label><button class="button primary" data-action="detail-add" data-id="${esc(selected.id)}">Add to basket</button></div>`
      : `<p class="availability-message">${fields ? 'Choose another option or ask the kitchen about availability.' : 'Ask the kitchen about availability.'}</p><a class="button secondary" href="${FB}" target="_blank" rel="noopener noreferrer">Contact the kitchen ↗</a>`;
  }
  // Keep the native selects mounted so changing an option preserves keyboard focus.
  if (flavorControl) {
    updateSizes();
    flavorControl.addEventListener('change', () => {
      const options = optionsFor(flavorControl.value);
      const {size} = variantLabels(selected);
      selected = options.find(p => variantLabels(p).size === size)
        || options.find(p => available(state, p) > 0) || options[0];
      updateSizes();
      updateSelection();
    });
    sizeControl.addEventListener('change', () => {
      selected = group.variants.find(p => p.id === sizeControl.value);
      updateSelection();
    });
  }
  updateSelection();
}
function howToOrder(){openModal('Pickup & delivery',`<div class="ordering-guide"><ol><li><strong>Choose your treats.</strong> Select a flavor and pack size, then add available products to your basket.</li><li><strong>Choose pickup or request delivery.</strong> Pickup uses the shop location. For delivery, enter your address and confirm your map pin.</li><li><strong>Send your request.</strong> The kitchen confirms your order and arrangements. Delivery availability and any fee are confirmed before fulfillment.</li></ol><a class="button secondary" href="${mapLink(pickupLocation)}" target="_blank" rel="noopener noreferrer">Directions to the pickup location ↗</a><p>Need to check an item or delivery area? <a href="${FB}" target="_blank" rel="noopener noreferrer">Contact Gracious Delights on Facebook ↗</a></p><p class="help-note">Submitting a request does not take a payment. Payment is arranged with the kitchen.</p></div>`);}
function about(){openModal('Homemade. Heartfelt. Gracious.',`<div class="about-content"><img src="assets/facebook/a00aff175be206dd.jpg" alt="Gracious Delights logo"><p>Gracious Delights is a food and beverage business in Binmaley, Philippines, sharing quality homemade cakes, snacks, and dishes.</p><p>From banana bread wedding souvenirs to food trays for the family, every gathering deserves a little delight.</p><div class="about-contact"><span>${icon('pin')} Binmaley, Philippines</span><a href="tel:+639060552414">${icon('phone')} 0906 055 2414</a></div><a class="button primary" href="${FB}" target="_blank" rel="noopener noreferrer">Explore the Facebook page ${icon('arrow')}</a><p class="help-note">Business information and photos sourced from the public Facebook page. Order directly from our website and follow your request in My requests.</p></div>`);}
function showPolicy(){
  openModal('Terms and privacy',`<div class="about-content shop-policy">
    <h3>Terms of use</h3>
    <p>Checkout submits an order request. The kitchen confirms the order, payment, and any delivery fee.</p>
    <h3>Privacy policy</h3>
    <p>Gracious Delights uses the contact details, address, and map pin you submit to arrange and fulfill your order. A browser cookie links your requests to this device. The checkout map displays tiles from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>.</p>
  </div>`);
}
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
  openModal('Install Gracious Delights',`<div class="install-content">${icon('download')}<p>Open the menu and track orders from your home screen.</p><ol>${steps}</ol><p class="help-note">Go online to check stock and place orders. Save your tracking code to follow an order from another browser.</p><button class="button secondary" data-action="close">Got it</button></div>`);
}
document.addEventListener('click',async e=>{
  const cat=e.target.closest('[data-category]');if(cat){category=cat.dataset.category;$('#mobile-category').value=category;document.querySelectorAll('[data-category]').forEach(btn=>{btn.classList.toggle('active',btn===cat);btn.setAttribute('aria-pressed',String(btn===cat));});renderGrid();return;}
  const el=e.target.closest('[data-action]');if(!el)return;
  if (el.getAttribute('aria-disabled') === 'true') return;
  const action=el.dataset.action,id=el.dataset.id;
  await ordering.handleAction(action,id,el);
  if(action==='close')dialogs.close();
  if(action==='detail')productDetail(id,el.dataset.variant);
  if(action==='about')about();
  if(action==='how-to-order')howToOrder();
  if(action==='policy')showPolicy();
  if(action==='install')await install();
  if(action==='dismiss-install'){installDismissed=true;installPromotion();}
  if(action==='clear-filters'){query='';category='All delights';availableOnly=false;renderShop();$('#catalog-search').focus();}
  if(action==='retry')await refreshState();
});
function showMenu(moveFocus) {
  $('#menu')?.scrollIntoView({block:'start', behavior:'instant'});
  if (moveFocus) focusHeading($('#menu-title'), true);
}
document.addEventListener('click', event => {
  if (!event.defaultPrevented && !event.ctrlKey && !event.metaKey && !event.shiftKey &&
      !event.altKey && location.hash === '#menu' && event.target.closest('a[href="#menu"]')) {
    event.preventDefault();
    showMenu(true);
  }
});
function route(moveFocus = false){
  const hash=location.hash;
  mode=hash==='#announcements'?'announcements':'shop';
  document.title=mode==='announcements'?'Announcements · Gracious Delights':'Gracious Delights · Homemade treats in Binmaley';
  if($('#modal').open)$('#modal').close();
  render();
  if (hash === '#menu') {
    showMenu(moveFocus);
  } else {
    window.scrollTo(0, 0);
    if (moveFocus) focusHeading($('#main h1'), true);
  }
}
$('.skip-link').addEventListener('click', event => {
  event.preventDefault();
  $('#main').focus();
});
window.addEventListener('hashchange', () => route(true));
setInterval(refreshState,15000);
window.addEventListener('focus',refreshState);
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;installPromotion();});
window.addEventListener('appinstalled',()=>{deferredInstall=null;installDismissed=true;installPromotion();toast('Gracious Delights installed.');});
standalone.addEventListener('change',installPromotion);
for(const event of ['online','offline'])window.addEventListener(event,()=>{if(navigator.onLine)refreshState();footer();toast(navigator.onLine?'You’re back online.':'You are offline. Reconnect to place orders or update the kitchen.');});
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>toast('App installation setup was unavailable. Please reload while online.'));
route();

refreshState();
