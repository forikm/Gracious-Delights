import { productPhoto } from './product-photos.js';
import { available, validLocation } from './domain.js';
import { bindCheckoutMap, mapLink, pickupLocation } from './checkout-map.js';

function orderLocationLink(customer) {
  if (customer.fulfillment === 'pickup') return `<br><a class="order-location-link" href="${mapLink(pickupLocation)}" target="_blank" rel="noopener noreferrer">View shop pickup pin</a>`;
  if (validLocation(customer.location)) return `<br><a class="order-location-link" href="${mapLink(customer.location)}" target="_blank" rel="noopener noreferrer">View delivery pin</a>`;
  return '';
}

export function createOrderingUI(ui) {
  const {getState,commit,openModal,bindForm,formFooter,toast,header,money,esc,icon,api}=ui;
  const $=s=>document.querySelector(s);
  const CART_KEY='gracious-basket-v1', REQUEST_KEY='gracious-my-requests-v1';
  let cart=[],myIds=[];
  let checkoutDraft = {};
  try{cart=JSON.parse(sessionStorage.getItem(CART_KEY)||'[]');myIds=JSON.parse(sessionStorage.getItem(REQUEST_KEY)||'[]');}catch{}
  if(!Array.isArray(cart))cart=[];if(!Array.isArray(myIds))myIds=[];
  const save=()=>{try{sessionStorage.setItem(CART_KEY,JSON.stringify(cart));sessionStorage.setItem(REQUEST_KEY,JSON.stringify(myIds));}catch{}};
  const orders=()=>getState().orders || [];
  const count=()=>cart.reduce((sum,row)=>sum+row.quantity,0);
  const pendingCount=()=>orders().filter(o=>o.status==='pending').length;
  const statusLabel=s=>({pending:'Pending approval',accepted:'Accepted',ready:'Ready',completed:'Completed',declined:'Declined',cancelled:'Cancelled'}[s] || s);
  const status=o=>`<span class="order-status status-${o.status}">${esc(statusLabel(o.status))}</span>`;
  const date=o=>new Intl.DateTimeFormat('en-PH',{dateStyle:'medium',timeStyle:'short'}).format(new Date(o.createdAt));
  function rows(){return cart.map(row=>{const p=getState().products.find(p=>p.id===row.productId);return {...row,p,issue:!p?.active?'No longer available':row.quantity>available(getState(),p)?`Only ${available(getState(),p)} available`:row.unitPrice!==p.price?'Price changed — refresh basket prices':''};});}
  const cartTotal=()=>cart.reduce((sum,row)=>sum+Math.round(row.unitPrice*100)*row.quantity,0)/100;
  function add(id,quantity=1){
    const p=getState().products.find(p=>p.id===id && p.active);
    if(!p){toast('This product is no longer available.');return;}
    const row=cart.find(i=>i.productId===id),total=(row?.quantity||0)+quantity;
    if(!Number.isInteger(quantity)||quantity<1||total>available(getState(),p)){toast(`Only ${available(getState(),p)} ${p.name} available. Your basket already has ${row?.quantity||0}.`);return;}
    if(row && row.unitPrice!==p.price){toast('The price changed. Open your basket to review and refresh prices.');return;}
    if(row)row.quantity=total;else cart.push({productId:id,quantity,unitPrice:p.price});
    save();header();toast(`${quantity} × ${p.name} added to your basket.`);
  }
  function showCart(){
    const list=rows();
    openModal('Your basket',list.length?`<div class="basket-list">${list.map(row=>`<article class="basket-item">${row.p?productPhoto(row.p,'basket-photo'):'<img src="assets/placeholder.svg" alt="">'}<div class="basket-item-content"><strong>${esc(row.p?.name||'Unavailable product')}</strong><small>${money(row.unitPrice)} · ${esc(row.p?.portion||'per unit')}</small>${row.issue?`<p class="basket-issue">${esc(row.issue)}</p>`:''}<div class="quantity-control"><button data-action="cart-quantity" data-id="${row.productId}" data-delta="-1" aria-label="Decrease ${esc(row.p?.name)} quantity">−</button><span>${row.quantity}</span><button data-action="cart-quantity" data-id="${row.productId}" data-delta="1" aria-label="Increase ${esc(row.p?.name)} quantity" ${!row.p?.active||row.quantity>=available(getState(),row.p)?'disabled':''}>+</button><button class="remove-cart" data-action="cart-remove" data-id="${row.productId}">Remove</button></div></div><strong class="basket-line-total">${money(row.unitPrice*row.quantity)}</strong></article>`).join('')}</div><div class="basket-total"><span>Product subtotal</span><strong>${money(cartTotal())}</strong></div><p class="help-note">Sending a request reserves your items. The kitchen confirms pickup or delivery.</p>${list.some(row=>row.p?.price!==row.unitPrice)?'<button class="text-button" data-action="refresh-prices">Review current prices</button>':''}<div class="modal-actions"><button class="button secondary" data-action="close">Keep browsing</button><button class="button primary" data-action="checkout" ${list.some(row=>row.issue)?'disabled':''}>Continue to checkout ${icon('arrow')}</button></div>`:`<div class="empty-state">${icon('box')}<h3>Your basket is empty</h3><p>Add a few favorites from the menu.</p><button class="button primary" data-action="close">Back to menu</button></div>`);
  }
  function checkout(){
    const list=rows();if(!list.length||list.some(row=>row.issue)){showCart();return;}
    const fingerprint=JSON.stringify(cart);
    let pending;try{pending=JSON.parse(sessionStorage.getItem('gd-pending-order')||'null');}catch{}
    const requestId=pending?.fingerprint===fingerprint?pending.id:crypto.randomUUID();
    const trackingCode=pending?.id===requestId&&pending.trackingCode?pending.trackingCode:Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
    sessionStorage.setItem('gd-pending-order',JSON.stringify({id:requestId,fingerprint,trackingCode}));
    const submittedItems=cart.map(row=>({...row}));
    // Put contact, fulfillment, and review in the order customers need them.
    openModal('Checkout', `<form class="checkout-form">
      <section class="checkout-step" aria-labelledby="checkout-contact">
        <h3 id="checkout-contact">Contact details</h3>
        <div class="form-grid">
          <label>Your name<input name="name" autocomplete="name" maxlength="120" required></label>
          <label>Phone number<input name="phone" type="tel" autocomplete="tel" maxlength="30" required></label>
        </div>
        <p class="help-note">The kitchen uses these details to contact you about this order.</p>
      </section>
      <section class="checkout-step" aria-labelledby="checkout-fulfillment">
        <h3 id="checkout-fulfillment">Pickup or delivery</h3>
        <label>How will you receive your order?<select name="fulfillment" id="fulfillment"><option value="pickup">Pickup in Binmaley</option><option value="delivery">Request delivery</option></select></label>
        <div id="address-field" hidden>
          <label>Delivery address<textarea name="address" autocomplete="street-address" maxlength="500" rows="2" aria-describedby="address-hint" disabled></textarea></label>
          <p class="help-note" id="address-hint">Include the street, barangay, municipality, and a nearby landmark.</p>
        </div>
        <section class="checkout-location" aria-labelledby="checkout-location-title">
          <h4 id="checkout-location-title">Shop pickup location</h4>
          <p class="help-note location-hint" id="location-hint"></p>
          <div class="checkout-map-frame">
            <div class="checkout-map" role="region" aria-label="Checkout location map" aria-describedby="location-hint" hidden></div>
            <span class="location-pin" aria-hidden="true" hidden>${icon('pin')}</span>
          </div>
          <div class="map-controls" hidden role="group" aria-label="Move the map">
            <button type="button" aria-label="Pan map north" data-pan="0,-80">↑</button>
            <button type="button" aria-label="Pan map west" data-pan="-80,0">←</button>
            <button type="button" aria-label="Pan map east" data-pan="80,0">→</button>
            <button type="button" aria-label="Pan map south" data-pan="0,80">↓</button>
          </div>
          <button class="button secondary" id="confirm-delivery-pin" type="button" hidden>Confirm delivery pin</button>
          <a class="text-button" target="_blank" rel="noopener noreferrer" hidden>Directions in Google Maps</a>
          <p class="help-note location-status" role="status"></p>
        </section>
        <label>Notes for the kitchen (optional)<textarea name="notes" maxlength="1000" rows="2"></textarea></label>
      </section>
      <section class="checkout-step" aria-labelledby="checkout-review">
        <h3 id="checkout-review">Order review</h3>
        <div class="checkout-summary">${list.map(row=>`<div><span>${row.quantity} × ${esc(row.p.name)}</span><strong>${money(row.quantity*row.unitPrice)}</strong></div>`).join('')}<div class="checkout-subtotal"><span>Product subtotal</span><strong>${money(cartTotal())}</strong></div></div>
        <p class="help-note">The kitchen confirms your request and arranges payment. For delivery, they’ll confirm availability and any fee.</p>
      </section>
      ${formFooter('Send order request', '<button class="button secondary" type="button" data-action="checkout-back">Back to basket</button>')}
    </form>`, 'checkout-dialog');
    const form = $('.checkout-form');
    for (const field of ['name', 'phone', 'fulfillment', 'address', 'notes']) {
      if (checkoutDraft[field] !== undefined) form.elements.namedItem(field).value = checkoutDraft[field];
    }
    const deliveryLocation = bindCheckoutMap(form, checkoutDraft.location);
    function saveDraft() {
      const fields = ['name', 'phone', 'fulfillment', 'address', 'notes'];
      checkoutDraft = Object.fromEntries(fields.map(field => [field, form.elements.namedItem(field).value]));
      checkoutDraft.location = deliveryLocation();
    }
    // The draft stays in memory when the customer reviews their basket.
    const lifecycle = new AbortController();
    const dialog = form.closest('dialog');
    const endCheckout = event => {
      if (event.type === 'close' && dialog.open) return;
      saveDraft();
      lifecycle.abort();
    };
    dialog.addEventListener('dialog-content-change', endCheckout, {signal:lifecycle.signal});
    dialog.addEventListener('close', endCheckout, {signal:lifecycle.signal});
    bindForm(async data=>{
      const fulfillment = data.get('fulfillment');
      const location = fulfillment === 'delivery' ? deliveryLocation() : undefined;
      if (fulfillment === 'delivery' && !location) throw new Error('Confirm your delivery pin on the map before submitting.');
      await commit({type:'submitOrder',requestId,trackingCode,items:submittedItems,customer:{name:data.get('name'),phone:data.get('phone'),fulfillment,address:data.get('address'),notes:data.get('notes'),location}},getState().revision);
      sessionStorage.removeItem('gd-pending-order');myIds.unshift(requestId);cart=[];save();header();
      showConfirmation(orders().find(o=>o.id===requestId),trackingCode);
      checkoutDraft = {};
      return false;
    }, 'Sending order request…');
  }
  function itemSummary(o){return `<div class="order-items">${o.items.map(i=>`<div><span>${i.quantity} × ${esc(i.name)}</span><strong>${money(i.lineTotal)}</strong></div>`).join('')}<div class="order-total"><span>Product total</span><strong>${money(o.total)}</strong></div></div>`;}
  function showConfirmation(o,trackingCode){
    openModal('Order request sent',`<div class="order-confirmation"><span class="confirmation-check">${icon('check')}</span><p class="order-reference">${o.reference}</p>${status(o)}<p>Thank you, ${esc(o.customer.name)}. Your items are reserved while the kitchen reviews your request.</p>${itemSummary(o)}<section class="tracking-save"><h3>Keep your tracking code</h3><p>Save this reference and private code to check this request from another browser. Anyone with both can view its status and items.</p><label>Reference<input readonly value="${esc(o.reference)}"></label><label>Private tracking code<textarea readonly rows="3">${esc(trackingCode)}</textarea></label><button class="button secondary" data-action="save-tracking" data-reference="${esc(o.reference)}" data-code="${esc(trackingCode)}">Save tracking details</button></section><p class="help-note">Your request has reached the kitchen. Check “My requests” to follow its status and messages from the kitchen.</p><div class="modal-actions"><button class="button secondary" data-action="close">Back to menu</button><button class="button primary" data-action="my-orders">Track my request</button></div></div>`);
  }
  function trackWithCode(){
    openModal('Track an order request','<form class="tracking-form"><p class="modal-description">Use the reference and private tracking code saved after checkout. This works from another browser without signing in.</p><label>Order reference<input name="reference" placeholder="GD-0001" maxlength="20" autocomplete="off" required></label><label>Private tracking code<textarea name="code" rows="3" maxlength="100" autocomplete="off" spellcheck="false" required></textarea></label><div id="tracking-result" aria-live="polite"></div>'+formFooter('Check request status')+'</form>');
    bindForm(async data=>{
      const o=await api('track',{reference:String(data.get('reference')).trim().toUpperCase(),code:String(data.get('code')).trim().toLowerCase()});
      $('#tracking-result').innerHTML='<div class="tracked-order"><strong>'+esc(o.reference)+'</strong>'+status(o)+itemSummary(o)+(o.adminNote?'<p><strong>From the kitchen:</strong> '+esc(o.adminNote)+'</p>':'')+'<p class="help-note">For changes or cancellation, contact the kitchen with your order reference.</p></div>';
      return false;
    }, 'Checking request status…');
  }
  function showRequests(){
    const mine=orders().filter(o=>getState().myOrderIds.includes(o.id));
    openModal('My order requests',`<p class="help-note">Using another browser? <button class="text-button" data-action="track-code">Track with a saved code</button></p>`+(mine.length?`<div class="my-orders">${mine.map(o=>`<article class="my-order"><div class="order-heading"><div><strong>${o.reference}</strong><small>${date(o)}</small></div>${status(o)}</div>${itemSummary(o)}<p class="help-note">${o.customer.fulfillment==='pickup'?'Pickup in Binmaley':'Delivery requested · fee to be confirmed'}${o.customer.address?`<br>${esc(o.customer.address)}`:''}${orderLocationLink(o.customer)}</p>${o.adminNote?`<p class="admin-order-note"><strong>From the kitchen:</strong> ${esc(o.adminNote)}</p>`:''}${o.status==='pending'?`<button class="text-button danger-text" data-action="cancel-request" data-id="${o.id}">Cancel this request</button>`:''}</article>`).join('')}</div>`:`<div class="empty-state">${icon('book')}<h3>No requests yet</h3><p>Your requests from this browser will appear here. Save your private tracking code after checkout to view a new request from another browser.</p><button class="button primary" data-action="close">Browse delights</button></div>`));
  }
  function updateOrder(id,next,actor='admin'){
    const order=orders().find(o=>o.id===id);if(!order)return;
    if(actor==='customer'&&!getState().myOrderIds.includes(id))return;
    const revision=getState().revision;
    const titles={accepted:'Accept request',declined:'Decline request',ready:'Mark order ready',completed:'Complete order',cancelled:'Cancel order'};
    const reasonRequired=actor==='admin'&&['declined','cancelled'].includes(next);
    openModal(`${titles[next]} · ${order.reference}`,`<form>${itemSummary(order)}<p class="modal-description">${next==='completed'?'This records fulfillment and removes these units from finished stock. Ingredient inventory stays unchanged.':next==='declined'||next==='cancelled'?'This releases the reserved products for other customers.':next==='accepted'?'The customer can see that their request has been accepted. Products stay reserved until fulfillment.':'The customer can see that their order is ready.'}</p>${actor==='admin'?`<label>${reasonRequired?'Reason (visible to customer)':'Message to customer (optional)'}<textarea name="note" maxlength="500" rows="3" ${reasonRequired?'required':''} placeholder="${reasonRequired?'Explain why this order cannot proceed':'e.g. Pickup confirmed for 3 PM'}">${!reasonRequired?esc(order.adminNote):''}</textarea></label>`:''}${formFooter(titles[next])}</form>`);
    bindForm(async data=>{await commit({type:'updateOrder',id,status:next,actor,note:data.get('note')||''},revision);toast(`${order.reference}: ${statusLabel(next)}.`);if(actor==='customer'){showRequests();$('#modal .dialog-status').textContent=`${order.reference} cancelled.`;return false;}});
  }
  function refresh(){
    if(!$('#modal').open)return;

    if($('#modal .my-orders'))showRequests();
    else if($('#modal .basket-list'))showCart();
  }
  async function handleAction(action,id,el){
    if(action==='add-cart')add(id);
    if(action==='detail-add'){
      const quantity = $('#detail-quantity');
      if (quantity.reportValidity()) add(id, Number(quantity.value));
    }
    if(action==='cart'||action==='checkout-back')showCart();
    if(action==='checkout')checkout();
    if(action==='my-orders')showRequests();
    if(action==='track-code')trackWithCode();
    if(action==='save-tracking'){
      const file=new Blob(['Gracious Delights order tracking\nReference: '+el.dataset.reference+'\nPrivate tracking code: '+el.dataset.code+'\nTrack at '+location.origin+' (My requests → Track with a saved code).\nKeep this code private.'],{type:'text/plain'});
      const url=URL.createObjectURL(file),link=document.createElement('a');link.href=url;link.download=el.dataset.reference+'-tracking.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    if(action==='cart-remove'){cart=cart.filter(row=>row.productId!==id);save();header();showCart();}
    if(action==='cart-quantity'){
      const row=cart.find(row=>row.productId===id);if(!row)return;
      const next=row.quantity+Number(el.dataset.delta),p=getState().products.find(p=>p.id===id);
      if(next<1)cart=cart.filter(row=>row.productId!==id);
      else if(next>row.quantity&&(!p?.active||next>available(getState(),p))){toast('There are no more units available.');return;}
      else row.quantity=next;
      save();header();showCart();
    }
    if(action==='refresh-prices'){
      for(const row of cart){const p=getState().products.find(p=>p.id===row.productId);if(p)row.unitPrice=p.price;}
      save();showCart();toast('Basket prices updated. Please review the total.');
    }

    if(action==='cancel-request')updateOrder(id,'cancelled','customer');
  }
  return {count,pendingCount,handleAction,refresh};
}
