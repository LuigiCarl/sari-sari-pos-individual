(function () {
  const cart = new Map(); // productId -> { id, name, price, qty, stock, unit }

  const cartBody = document.getElementById('cartBody');
  const cartCountEl = document.getElementById('cartCount');
  const clearCartBtn = document.getElementById('clearCartBtn');
  const cartTotalEl = document.getElementById('cartTotal');
  const changeLabelEl = document.getElementById('changeLabel');
  const changeEl = document.getElementById('changeAmount');
  const amountPaidInput = document.getElementById('amountPaid');
  const quickCashEl = document.getElementById('quickCash');
  const itemsInput = document.getElementById('itemsInput');
  const checkoutBtn = document.getElementById('checkoutBtn');
  const checkoutForm = document.getElementById('checkoutForm');
  const productGrid = document.getElementById('productGrid');
  const searchInput = document.getElementById('productSearch');

  function peso(n) {
    return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/"/g, '&quot;');
  }

  function getCartTotal() {
    let total = 0;
    cart.forEach((item) => {
      total += item.price * item.qty;
    });
    return total;
  }

  function syncTileBadges() {
    productGrid.querySelectorAll('.product-tile').forEach((tile) => {
      const item = cart.get(tile.dataset.id);
      let badge = tile.querySelector('.tile-qty-badge');
      if (item) {
        tile.classList.add('in-cart');
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'tile-qty-badge';
          tile.appendChild(badge);
        }
        badge.textContent = item.qty;
      } else {
        tile.classList.remove('in-cart');
        if (badge) badge.remove();
      }
    });
  }

  function addToCart(tile) {
    const id = tile.dataset.id;
    const stock = Number(tile.dataset.stock);
    if (stock <= 0) return;
    const existing = cart.get(id);
    if (existing) {
      if (existing.qty < stock) existing.qty += 1;
    } else {
      cart.set(id, {
        id,
        name: tile.dataset.name,
        price: Number(tile.dataset.price),
        unit: tile.dataset.unit,
        stock,
        qty: 1,
      });
    }
    render();
  }

  function changeQty(id, delta) {
    const item = cart.get(id);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
      cart.delete(id);
    } else if (item.qty > item.stock) {
      item.qty = item.stock;
    }
    render();
  }

  function removeItem(id) {
    cart.delete(id);
    render();
  }

  function updatePaymentState(total) {
    const hasItems = cart.size > 0;
    const rawVal = amountPaidInput.value.trim();
    const paid = rawVal === '' ? 0 : Number(rawVal);
    const diff = paid - total;

    // Highlight quick cash chips
    if (quickCashEl) {
      quickCashEl.querySelectorAll('.cash-chip').forEach((chip) => {
        const mode = chip.dataset.cash;
        chip.disabled = !hasItems;
        if (mode === 'exact') {
          chip.classList.toggle('is-active', hasItems && rawVal !== '' && Math.abs(diff) < 0.005);
        } else {
          const val = Number(mode);
          chip.classList.toggle('is-active', hasItems && rawVal !== '' && paid === val);
        }
      });
    }

    if (!hasItems) {
      changeLabelEl.textContent = 'Change';
      changeEl.textContent = peso(0);
      changeEl.classList.remove('text-danger', 'text-success');
      checkoutBtn.disabled = true;
      return;
    }

    if (rawVal === '' || diff < 0) {
      const shortage = total - (Number.isFinite(paid) ? paid : 0);
      changeLabelEl.textContent = rawVal === '' ? 'Amount Due' : 'Short by';
      changeEl.textContent = peso(Math.max(0, shortage));
      changeEl.classList.add('text-danger');
      changeEl.classList.remove('text-success');
      checkoutBtn.disabled = true;
    } else {
      changeLabelEl.textContent = 'Change';
      changeEl.textContent = peso(diff);
      changeEl.classList.remove('text-danger');
      changeEl.classList.add('text-success');
      checkoutBtn.disabled = false;
    }
  }

  function render() {
    cartBody.innerHTML = '';
    let total = 0;
    let totalUnits = 0;

    if (cart.size === 0) {
      cartBody.innerHTML = `
        <div class="cart-empty-state">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
          <span>Tap a product to start an order</span>
        </div>
      `;
    } else {
      cart.forEach((item) => {
        const subtotal = item.price * item.qty;
        total += subtotal;
        totalUnits += item.qty;
        const atMax = item.qty >= item.stock;

        const row = document.createElement('div');
        row.className = 'cart-item';
        row.setAttribute('role', 'listitem');
        row.innerHTML = `
          <div class="cart-item-info">
            <div class="cart-item-name">${escapeHtml(item.name)}</div>
            <div class="cart-item-meta">${peso(item.price)} / ${escapeHtml(item.unit)}${atMax ? ' · <span class="cart-max-tag">Max stock</span>' : ''}</div>
          </div>
          <div class="cart-item-right">
            <div class="stepper">
              <button type="button" data-action="dec" data-id="${item.id}" class="stepper-btn" aria-label="Decrease quantity of ${escapeAttr(item.name)}">−</button>
              <span class="stepper-qty">${item.qty}</span>
              <button type="button" data-action="inc" data-id="${item.id}" class="stepper-btn" ${atMax ? 'disabled' : ''} aria-label="Increase quantity of ${escapeAttr(item.name)}">+</button>
            </div>
            <div class="cart-item-subtotal">${peso(subtotal)}</div>
            <button type="button" data-action="remove" data-id="${item.id}" class="cart-remove-btn" aria-label="Remove ${escapeAttr(item.name)}" title="Remove">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
        `;
        cartBody.appendChild(row);
      });
    }

    if (cartCountEl) {
      cartCountEl.textContent = `${totalUnits} ${totalUnits === 1 ? 'item' : 'items'}`;
    }
    if (clearCartBtn) {
      clearCartBtn.hidden = cart.size === 0;
    }

    cartTotalEl.textContent = peso(total);
    updatePaymentState(total);
    syncTileBadges();
  }

  cartBody.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn || btn.disabled) return;
    const { action, id } = btn.dataset;
    if (action === 'inc') changeQty(id, 1);
    if (action === 'dec') changeQty(id, -1);
    if (action === 'remove') removeItem(id);
  });

  if (clearCartBtn) {
    clearCartBtn.addEventListener('click', () => {
      cart.clear();
      amountPaidInput.value = '';
      render();
    });
  }

  if (quickCashEl) {
    quickCashEl.addEventListener('click', (e) => {
      const chip = e.target.closest('button[data-cash]');
      if (!chip || chip.disabled) return;
      const total = getCartTotal();
      if (chip.dataset.cash === 'exact') {
        amountPaidInput.value = total.toFixed(2);
      } else {
        amountPaidInput.value = Number(chip.dataset.cash).toFixed(2);
      }
      updatePaymentState(total);
    });
  }

  productGrid.addEventListener('click', (e) => {
    const tile = e.target.closest('.product-tile');
    if (tile) addToCart(tile);
  });

  amountPaidInput.addEventListener('input', () => {
    updatePaymentState(getCartTotal());
  });

  checkoutForm.addEventListener('submit', (e) => {
    const total = getCartTotal();
    const paid = Number(amountPaidInput.value) || 0;
    if (cart.size === 0 || paid < total) {
      e.preventDefault();
      updatePaymentState(total);
      return;
    }
    const items = Array.from(cart.values()).map((i) => ({ productId: Number(i.id), quantity: i.qty }));
    itemsInput.value = JSON.stringify(items);
  });

  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      const q = searchInput.value.trim();
      const res = await fetch(`/pos/api/products?q=${encodeURIComponent(q)}`);
      const products = await res.json();
      productGrid.innerHTML = products
        .map(
          (p) => `
        <button type="button" class="product-tile" data-id="${p.id}" data-name="${escapeAttr(p.name)}" data-price="${p.selling_price}" data-stock="${p.stock_quantity}" data-unit="${escapeAttr(p.unit)}">
          <span class="product-name">${escapeHtml(p.name)}</span>
          <span class="product-price">${peso(p.selling_price)}</span>
          <span class="product-stock">${p.stock_quantity} ${escapeHtml(p.unit)} left</span>
        </button>`
        )
        .join('');
      syncTileBadges();
    }, 250);
  });

  render();
})();
