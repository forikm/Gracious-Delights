import { available } from './domain.js';

export function createOrderingUI(ui) {
  const {getState,commit,openModal,bindForm,formFooter,toast,header,money,esc,icon}=ui;
  const $=s=>document.querySelector(s);
  const CART_KEY='gracious-basket-v1', REQUEST_KEY='gracious-my-requests-v1';
  let cart=[],myIds=[],filter='pending';
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
    openModal('Your little delights',list.length?`<div class="basket-list">${list.map(row=>`<article class="basket-item"><img src="${esc(row.p?.image||'assets/placeholder.svg')}" alt=""><div class="basket-item-content"><strong>${esc(row.p?.name||'Unavailable product')}</strong><small>${money(row.unitPrice)} · ${esc(row.p?.portion||'per unit')}</small>${row.issue?`<p class="basket-issue">${esc(row.issue)}</p>`:''}<div class="quantity-control"><button data-action="cart-quantity" data-id="${row.productId}" data-delta="-1" aria-label="Decrease ${esc(row.p?.name)} quantity">−</button><span>${row.quantity}</span><button data-action="cart-quantity" data-id="${row.productId}" data-delta="1" aria-label="Increase ${esc(row.p?.name)} quantity" ${!row.p?.active||row.quantity>=available(getState(),row.p)?'disabled':''}>+</button><button class="remove-cart" data-action="cart-remove" data-id="${row.productId}">Remove</button></div></div><strong class="basket-line-total">${money(row.unitPrice*row.quantity)}</strong></article>`).join('')}</div><div class="basket-total"><span>Product subtotal</span><strong>${money(cartTotal())}</strong></div><p class="help-note">Items are reserved when you submit a request. The admin confirms your order and pickup or delivery arrangements.</p>${list.some(row=>row.p?.price!==row.unitPrice)?'<button class="text-button" data-action="refresh-prices">Review current prices</button>':''}<div class="modal-actions"><button class="button secondary" data-action="close">Keep browsing</button><button class="button primary" data-action="checkout" ${list.some(row=>row.issue)?'disabled':''}>Continue to checkout ${icon('arrow')}</button></div>`:`<div class="empty-state">${icon('box')}<h3>Your basket is waiting</h3><p>Add a few favorites from the menu.</p><button class="button primary" data-action="close">Explore the menu</button></div>`);
  }
  function checkout(){
    const list=rows();if(!list.length||list.some(row=>row.issue)){showCart();return;}
    const fingerprint=JSON.stringify(cart);
    let pending;try{pending=JSON.parse(sessionStorage.getItem('gd-pending-order')||'null');}catch{}
    const requestId=pending?.fingerprint===fingerprint?pending.id:crypto.randomUUID();
    sessionStorage.setItem('gd-pending-order',JSON.stringify({id:requestId,fingerprint}));
    const submittedItems=cart.map(row=>({...row}));
    openModal('A few details, then a little delight',`<form class="checkout-form"><div class="checkout-summary">${list.map(row=>`<div><span>${row.quantity} × ${esc(row.p.name)}</span><strong>${money(row.quantity*row.unitPrice)}</strong></div>`).join('')}<div class="checkout-subtotal"><span>Product subtotal</span><strong>${money(cartTotal())}</strong></div></div><div class="form-grid"><label class="full">Your name<input name="name" autocomplete="name" maxlength="120" required placeholder="Full name"></label><label class="full">Phone number<input name="phone" type="tel" autocomplete="tel" maxlength="30" required placeholder="e.g. 0906 123 4567"></label><label class="full">Receive your order<select name="fulfillment" id="fulfillment"><option value="pickup">Pickup in Binmaley</option><option value="delivery">Request delivery</option></select></label><label class="full" id="address-field" hidden>Delivery address<textarea name="address" autocomplete="street-address" maxlength="500" rows="2" placeholder="Street, barangay, city, and delivery landmark"></textarea></label><label class="full">Notes / preferred pickup time (optional)<textarea name="notes" maxlength="1000" rows="2" placeholder="Special instructions or preferred pickup time"></textarea></label></div><div class="info-banner order-checkout-note"><span><strong>Payment arranged with the admin.</strong> This submits a request for approval. For delivery, the admin will confirm availability and any fee before fulfillment.</span></div><p class="help-note local-order-note">Your request is sent to the kitchen for approval. We use your name, phone number and delivery address to arrange and fulfill your order.</p>${formFooter('Submit order request')}</form>`);
    $('#fulfillment').addEventListener('change',e=>{const delivery=e.target.value==='delivery';$('#address-field').hidden=!delivery;$('#address-field textarea').required=delivery;});
    bindForm(async data=>{
      await commit({type:'submitOrder',requestId,items:submittedItems,customer:{name:data.get('name'),phone:data.get('phone'),fulfillment:data.get('fulfillment'),address:data.get('address'),notes:data.get('notes')}},getState().revision);
      sessionStorage.removeItem('gd-pending-order');myIds.unshift(requestId);cart=[];save();header();
      showConfirmation(orders().find(o=>o.id===requestId));
      return false;
    });
  }
  function itemSummary(o){return `<div class="order-items">${o.items.map(i=>`<div><span>${i.quantity} × ${esc(i.name)}</span><strong>${money(i.lineTotal)}</strong></div>`).join('')}<div class="order-total"><span>Product total</span><strong>${money(o.total)}</strong></div></div>`;}
  function showConfirmation(o){
    openModal('Your request is in the kitchen',`<div class="order-confirmation"><span class="confirmation-check">${icon('check')}</span><p class="order-reference">${o.reference}</p>${status(o)}<p>Thank you, ${esc(o.customer.name)}. Your items are reserved while the admin reviews your request.</p>${itemSummary(o)}<p class="help-note">Your request has reached the kitchen. Check “My requests” to follow its status and messages from the admin.</p><div class="modal-actions"><button class="button secondary" data-action="close">Back to menu</button><button class="button primary" data-action="my-orders">Track my request</button></div></div>`);
  }
  function showRequests(){
    const mine=orders().filter(o=>getState().myOrderIds.includes(o.id));
    openModal('My order requests',mine.length?`<div class="my-orders">${mine.map(o=>`<article class="my-order"><div class="order-heading"><div><strong>${o.reference}</strong><small>${date(o)}</small></div>${status(o)}</div>${itemSummary(o)}<p class="help-note">${o.customer.fulfillment==='pickup'?'Pickup in Binmaley':'Delivery requested · fee to be confirmed'}${o.customer.address?`<br>${esc(o.customer.address)}`:''}</p>${o.adminNote?`<p class="admin-order-note"><strong>From the admin:</strong> ${esc(o.adminNote)}</p>`:''}${o.status==='pending'?`<button class="text-button danger-text" data-action="cancel-request" data-id="${o.id}">Cancel this request</button>`:''}</article>`).join('')}</div>`:`<div class="empty-state">${icon('book')}<h3>No requests yet</h3><p>Your requests from this browser will appear here. Keep your browser cookies to retain access.</p><button class="button primary" data-action="close">Browse delights</button></div>`);
  }
  function adminOrders(){
    const all=orders(),active=all.filter(o=>['accepted','ready'].includes(o.status));
    const shown=all.filter(o=>filter==='all'||(filter==='active'?['accepted','ready'].includes(o.status):o.status===filter));
    return `<div class="stats-grid"><div class="stat"><span>Waiting for your reply</span><strong>${pendingCount()}<small>new order requests</small></strong>${icon('history')}</div><div class="stat"><span>In the kitchen</span><strong>${active.length}<small>accepted or ready orders</small></strong>${icon('cake')}</div><div class="stat"><span>Order history</span><strong>${all.length}<small>requests received</small></strong>${icon('book')}</div></div><div class="info-banner">${icon('box')}<span><strong>Stock is reserved for open requests.</strong> Accepting keeps the reservation; completion deducts finished stock once. Declining or cancelling releases it. Ingredients are already accounted for during production.</span></div><div class="orders-toolbar"><h2>Order inbox</h2><label>Show <select id="order-filter"><option value="pending" ${filter==='pending'?'selected':''}>Pending approval</option><option value="active" ${filter==='active'?'selected':''}>Accepted & ready</option><option value="completed" ${filter==='completed'?'selected':''}>Completed</option><option value="all" ${filter==='all'?'selected':''}>All requests</option></select></label></div><div id="orders-list">${shown.length?shown.map(o=>`<article class="admin-order-card" data-order-id="${o.id}"><div class="order-heading"><div><strong>${o.reference}</strong><small>${date(o)}</small></div>${status(o)}</div><div class="admin-order-columns"><div class="order-customer"><h3>${esc(o.customer.name)}</h3><a href="tel:${esc(o.customer.phone.replace(/[^+\d]/g,''))}">${icon('phone')}${esc(o.customer.phone)}</a><p><strong>${o.customer.fulfillment==='pickup'?'Pickup':'Delivery requested'}</strong>${o.customer.address?`<br>${esc(o.customer.address)}`:''}</p>${o.customer.notes?`<p class="customer-notes">${esc(o.customer.notes)}</p>`:''}</div>${itemSummary(o)}</div>${o.adminNote?`<p class="admin-order-note"><strong>Admin note:</strong> ${esc(o.adminNote)}</p>`:''}<div class="order-actions">${o.status==='pending'?`<button class="button primary" data-action="order-status" data-id="${o.id}" data-status="accepted">Accept request ${icon('check')}</button><button class="button secondary" data-action="order-status" data-id="${o.id}" data-status="declined">Decline</button>`:o.status==='accepted'?`<button class="button primary" data-action="order-status" data-id="${o.id}" data-status="ready">Mark ready</button>`:o.status==='ready'?`<button class="button primary" data-action="order-status" data-id="${o.id}" data-status="completed">Complete order ${icon('check')}</button>`:''}${['accepted','ready'].includes(o.status)?`<button class="text-button danger-text" data-action="order-status" data-id="${o.id}" data-status="cancelled">Cancel order</button>`:''}</div></article>`).join(''):`<div class="empty-state">${icon('book')}<h3>${filter==='pending'?'The kitchen is all caught up':'No orders in this view'}</h3><p>${filter==='pending'?'New customer requests will appear here.':'Choose another filter to view the order history.'}</p></div>`}</div><p class="help-note">The inbox updates automatically every 15 seconds while open.</p>`;
  }
  function wireAdmin(){ $('#order-filter')?.addEventListener('change',e=>{filter=e.target.value;$('#admin-body').innerHTML=adminOrders();wireAdmin();}); }
  function updateOrder(id,next,actor='admin'){
    const order=orders().find(o=>o.id===id);if(!order)return;
    if(actor==='customer'&&!getState().myOrderIds.includes(id))return;
    const revision=getState().revision;
    const titles={accepted:'Accept request',declined:'Decline request',ready:'Mark order ready',completed:'Complete order',cancelled:'Cancel order'};
    const reasonRequired=actor==='admin'&&['declined','cancelled'].includes(next);
    openModal(`${titles[next]} · ${order.reference}`,`<form>${itemSummary(order)}<p class="modal-description">${next==='completed'?'This records fulfillment and removes these units from finished stock. Ingredient inventory stays unchanged.':next==='declined'||next==='cancelled'?'This releases the reserved products for other customers.':next==='accepted'?'The customer can see that their request has been accepted. Products stay reserved until fulfillment.':'The customer can see that their order is ready.'}</p>${actor==='admin'?`<label>${reasonRequired?'Reason (visible to customer)':'Message to customer (optional)'}<textarea name="note" maxlength="500" rows="3" ${reasonRequired?'required':''} placeholder="${reasonRequired?'Explain why this order cannot proceed':'e.g. Pickup confirmed for 3 PM'}">${!reasonRequired?esc(order.adminNote):''}</textarea></label>`:''}${formFooter(titles[next])}</form>`);
    bindForm(async data=>{await commit({type:'updateOrder',id,status:next,actor,note:data.get('note')||''},revision);toast(`${order.reference}: ${statusLabel(next)}.`);if(actor==='customer'){showRequests();return false;}});
  }
  function refresh(){
    if(!$('#modal').open)return;
    if($('#order-filter'))wireAdmin();
    if($('#modal .my-orders'))showRequests();
    else if($('#modal .basket-list'))showCart();
  }
  async function handleAction(action,id,el){
    if(action==='add-cart')add(id);
    if(action==='detail-add')add(id,Number($('#detail-quantity').value));
    if(action==='cart')showCart();
    if(action==='checkout')checkout();
    if(action==='my-orders')showRequests();
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
    if(action==='order-status')updateOrder(id,el.dataset.status);
    if(action==='cancel-request')updateOrder(id,'cancelled','customer');
  }
  return {count,pendingCount,adminOrders,wireAdmin,handleAction,refresh};
}
