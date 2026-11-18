export const pickupLocation = {lat:16.035889,lng:120.254583};
const directions = location => `https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`;
export const mapLink = location => `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`;

export function bindCheckoutMap(form, savedPin) {
  const {fulfillment, address} = form.elements;
  const dialog = form.closest('dialog');
  const container = form.querySelector('.checkout-map');
  const panel = form.querySelector('.checkout-location');
  const title = panel.querySelector('h4');
  const hint = panel.querySelector('.location-hint');
  const status = panel.querySelector('[role="status"]');
  const pin = panel.querySelector('.location-pin');
  const confirm = panel.querySelector('#confirm-delivery-pin');
  const controls = panel.querySelector('.map-controls');
  const link = panel.querySelector('a');
  const addressField = form.querySelector('#address-field');
  let map, pickupMarker, selected = savedPin, loadedTiles = false;
  const refresh = () => {
    const delivery = fulfillment.value === 'delivery';
    confirm.disabled = !loadedTiles;
    const message = !loadedTiles ? 'Loading map…' : delivery
      ? selected ? 'Delivery pin confirmed.' : 'Delivery pin needs confirmation.'
      : '';
    if (status.textContent !== message) status.textContent = message;
  };

  function showLocation() {
    const delivery = fulfillment.value === 'delivery';
    addressField.hidden = address.disabled = !delivery;
    address.required = delivery;
    title.textContent = delivery ? 'Delivery location' : 'Shop pickup location';
    hint.textContent = delivery ? 'Tap your drop-off spot or move the map with the arrows. Then confirm your pin.' : 'Pick up your order at Gracious Delights in Binmaley, Pangasinan.';
    pin.hidden = confirm.hidden = controls.hidden = !delivery;
    link.hidden = true;
    refresh();

    if (!delivery) {
      link.href = directions(pickupLocation);
      link.hidden = false;
    }
    container.hidden = false;
    if (!window.L) {
      status.textContent = 'The map could not load. Reload checkout to try again.';
      controls.hidden = true;
      return;
    }

    const center = delivery ? selected || pickupLocation : pickupLocation;
    if (!map) {
      map = L.map(container, {scrollWheelZoom:false, maxZoom:19});
      const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom:19,
        attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'
      }).addTo(map);
      map.attributionControl.setPrefix(false);
      pickupMarker = L.marker(pickupLocation,{title:'Gracious Delights pickup',alt:'Gracious Delights pickup'});
      tiles.on('tileload', () => { loadedTiles = true; refresh(); });
      tiles.on('load', () => {
        if (!loadedTiles) status.textContent = 'Map tiles could not load. Check your connection and reopen checkout.';
      });
      map.on('movestart', () => {
        if (fulfillment.value === 'delivery') {
          selected = undefined;
          refresh();
        }
      });
      // Tapping and arrow buttons provide alternatives to dragging the map.
      map.on('click', ({latlng}) => {
        if (fulfillment.value === 'delivery') map.panTo(latlng, {animate:false});
      });
    }
    const previousPin = selected;
    map.invalidateSize({pan:false});
    map.setView(center, delivery && !previousPin ? 14 : 17, {animate:false});
    selected = previousPin;
    pin.hidden = !delivery;
    if (delivery) pickupMarker.remove();
    else pickupMarker.addTo(map);
    refresh();
  }

  confirm.addEventListener('click', () => {
    const {lat,lng} = map.getCenter().wrap();
    selected = {lat:Number(lat.toFixed(6)),lng:Number(lng.toFixed(6))};
    refresh();
  });
  controls.addEventListener('click', event => {
    const button = event.target.closest('[data-pan]');
    if (button && map) map.panBy(button.dataset.pan.split(',').map(Number), {animate:false});
  });
  fulfillment.addEventListener('change', showLocation);
  const lifecycle = new AbortController();
  function removeMap(event) {
    if (event.type === 'close' && dialog.open) return;
    map?.remove();
    lifecycle.abort();
  }
  dialog.addEventListener('close', removeMap, {signal:lifecycle.signal});
  dialog.addEventListener('dialog-content-change', removeMap, {signal:lifecycle.signal});
  showLocation();
  return () => selected;
}
