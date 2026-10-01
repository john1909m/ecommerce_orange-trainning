/* ============================================================
   Fresh Mart — cart page (js/cart.js)
   Depends on js/utilities.js (window.FM)
   Reads / writes localStorage key "fm_cart"
   ============================================================ */

(function () {
  "use strict";

  const {
    formatPrice,
    getCart,
    setCart,
    getWishlist,
    escapeHtml,
  } = window.FM;

  /* ---------- Constants ---------- */
  const FREE_SHIPPING_THRESHOLD = 300;   // EGP
  const SHIPPING_FLAT = 30;              // EGP
  const TAX_RATE = 0.14;                 // 14% VAT (Egypt)
  const KNOWN_PROMOS = {
    FRESH10:  { type: "percent", value: 10 },
    SAVE50:   { type: "flat",    value: 50 },
    FREESHIP: { type: "shipping" },
  };
  const PROMO_KEY = "fm_promo";

  /* ---------- DOM refs ---------- */
  const root        = document.getElementById("cart-root");
  const summaryEl   = document.getElementById("cart-summary");
  const statusEl    = document.getElementById("page-status");
  const cartCountEl = document.getElementById("cart-count");
  const wishlistCountEl = document.getElementById("wishlist-count");
  const navToggle   = document.getElementById("nav-toggle");
  const mobileMenu  = document.getElementById("mobile-menu");
  const yearEl      = document.getElementById("year");

  /* ---------- State ---------- */
  // Group cart lines by product id so adding the same item twice
  // shows a single row with quantity 2.
  let lines = [];        // [{ id, title, imageCover, price, qty }]
  let promo = null;      // { code, type, value } | null

  /* ---------- Helpers ---------- */
  function buildLinesFromCart(cart) {
    const map = new Map();
    for (const item of cart) {
      const key = item.id;
      if (!map.has(key)) {
        map.set(key, {
          id: item.id,
          title: item.title,
          imageCover: item.imageCover,
          price: Number(item.price) || 0,
          qty: 0,
        });
      }
      map.get(key).qty += 1;
    }
    return [...map.values()];
  }

  function flattenLines() {
    // Convert lines back to the flat array format used by localStorage
    const out = [];
    for (const line of lines) {
      for (let i = 0; i < line.qty; i++) {
        out.push({
          id: line.id,
          title: line.title,
          imageCover: line.imageCover,
          price: line.price,
        });
      }
    }
    return out;
  }

  function persist() {
    setCart(flattenLines());
    updateHeaderBadges();
  }

  function updateHeaderBadges() {
    if (cartCountEl) cartCountEl.textContent = String(getCart().length);
    if (wishlistCountEl) wishlistCountEl.textContent = String(getWishlist().length);
  }

  function announce(msg) {
    if (statusEl) statusEl.textContent = msg;
  }

  /* ---------- Totals ---------- */
  function computeTotals() {
    const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
    const totalQty = lines.reduce((s, l) => s + l.qty, 0);

    // Discount from promo
    let discount = 0;
    let freeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;
    if (promo) {
      if (promo.type === "percent")  discount = subtotal * (promo.value / 100);
      if (promo.type === "flat")     discount = Math.min(promo.value, subtotal);
      if (promo.type === "shipping") freeShipping = true;
    }
    discount = Math.round(discount * 100) / 100;

    const taxable = Math.max(0, subtotal - discount);
    const shipping = freeShipping || subtotal === 0 ? 0 : SHIPPING_FLAT;
    const tax = Math.round(taxable * TAX_RATE * 100) / 100;
    const total = Math.round((taxable + shipping + tax) * 100) / 100;

    return { subtotal, totalQty, discount, shipping, tax, total, freeShipping };
  }

  /* ---------- Promo persistence ---------- */
  function loadPromo() {
    try {
      const raw = sessionStorage.getItem(PROMO_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  function savePromo(p) {
    if (p) sessionStorage.setItem(PROMO_KEY, JSON.stringify(p));
    else   sessionStorage.removeItem(PROMO_KEY);
  }

  /* ---------- Render: item row ---------- */
  function itemHtml(line) {
    const lineTotal = line.price * line.qty;
    const href = `product.html?id=${encodeURIComponent(line.id)}`;

    return `
      <li class="cart-item" data-id="${escapeHtml(line.id)}">
        <a class="cart-item__media" href="${href}" aria-label="View ${escapeHtml(line.title)}">
          <img src="${escapeHtml(line.imageCover)}"
               alt="${escapeHtml(line.title)}"
               width="96" height="96" loading="lazy" decoding="async" />
        </a>

        <div class="cart-item__info">
          <h3 class="cart-item__title"><a href="${href}">${escapeHtml(line.title)}</a></h3>
          <p class="cart-item__unit">${formatPrice(line.price)} each</p>
        </div>

        <div class="cart-item__qty" role="group" aria-label="Quantity for ${escapeHtml(line.title)}">
          <button type="button" data-step="-1" aria-label="Decrease quantity of ${escapeHtml(line.title)}">
            <i class="fa-solid fa-minus" aria-hidden="true"></i>
          </button>
          <label class="visually-hidden" for="qty-${escapeHtml(line.id)}">Quantity</label>
          <input id="qty-${escapeHtml(line.id)}" type="number" inputmode="numeric"
                 min="1" max="99" value="${line.qty}"
                 data-action="set-qty" />
          <button type="button" data-step="1" aria-label="Increase quantity of ${escapeHtml(line.title)}">
            <i class="fa-solid fa-plus" aria-hidden="true"></i>
          </button>
        </div>

        <span class="cart-item__price" aria-label="Line total">${formatPrice(lineTotal)}</span>

        <button type="button" class="cart-item__remove" data-action="remove"
                aria-label="Remove ${escapeHtml(line.title)} from cart">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </li>
    `;
  }

  /* ---------- Render: summary ---------- */
  function summaryHtml(t) {
    const promoActive = promo
      ? `<div class="cart-summary__row cart-summary__row--muted">
           <span>Promo <strong>${escapeHtml(promo.code)}</strong></span>
           <span>− ${formatPrice(t.discount)}</span>
         </div>`
      : "";

    const shippingLabel = t.freeShipping && t.subtotal > 0
      ? `<span style="color:#1f7a32;font-weight:700;">FREE</span>`
      : formatPrice(t.shipping);

    const progress = Math.min(100, Math.round((t.subtotal / FREE_SHIPPING_THRESHOLD) * 100));
    const freeShipHint = t.freeShipping || t.subtotal === 0
      ? `<p class="cart-promo__msg is-success">You've unlocked free shipping 🎉</p>`
      : `<p class="cart-promo__msg">Add ${formatPrice(FREE_SHIPPING_THRESHOLD - t.subtotal)} more for free shipping (${progress}%)</p>`;

    return `
      <h2>Order Summary</h2>

      <div class="cart-summary__row">
        <span>Subtotal (${t.totalQty} item${t.totalQty === 1 ? "" : "s"})</span>
        <span>${formatPrice(t.subtotal)}</span>
      </div>

      ${promoActive}

      <div class="cart-summary__row">
        <span>Shipping</span>
        <span>${shippingLabel}</span>
      </div>

      <div class="cart-summary__row cart-summary__row--muted">
        <span>VAT (14%)</span>
        <span>${formatPrice(t.tax)}</span>
      </div>

      ${freeShipHint}

      <hr class="cart-summary__divider" />

      <div class="cart-summary__row cart-summary__row--total">
        <span>Total</span>
        <span>${formatPrice(t.total)}</span>
      </div>

      <div class="cart-promo">
        <label class="visually-hidden" for="promo-input">Promo code</label>
        <input id="promo-input" type="text" placeholder="Promo code (try FRESH10)"
               autocomplete="off" ${promo ? "disabled" : ""}
               value="${promo ? escapeHtml(promo.code) : ""}" />
        <button type="button" id="promo-apply" ${promo ? "disabled" : ""}>
          ${promo ? "Applied" : "Apply"}
        </button>
      </div>
      <p class="cart-promo__msg" id="promo-msg" role="status" aria-live="polite"></p>

      <button type="button" class="btn btn--primary cart-summary__checkout" id="checkout-btn">
        Proceed to Checkout
      </button>
      <p class="cart-summary__continue">
        or <a href="index.html#featured-products">continue shopping</a>
      </p>

      <div class="cart-trust" aria-label="Store guarantees">
        <span><i class="fa-solid fa-shield-halved" aria-hidden="true"></i> Secure checkout</span>
        <span><i class="fa-solid fa-truck-fast" aria-hidden="true"></i> Fast delivery</span>
        <span><i class="fa-solid fa-rotate-left" aria-hidden="true"></i> 14-day returns</span>
      </div>
    `;
  }

  /* ---------- Render: empty state ---------- */
  function emptyHtml() {
    return `
      <div class="cart-empty" role="status">
        <span class="cart-empty__icon" aria-hidden="true">
          <i class="fa-solid fa-cart-shopping"></i>
        </span>
        <h2>Your cart is empty</h2>
        <p>Looks like you haven't added anything yet.</p>
        <a class="btn btn--primary" href="index.html#featured-products">Start Shopping</a>
      </div>
    `;
  }

  /* ---------- Full render ---------- */
  function render() {
    if (!root) return;

    root.setAttribute("aria-busy", "false");

    if (!lines.length) {
      root.innerHTML = emptyHtml();
      if (summaryEl) summaryEl.textContent = "Your cart is empty.";
      updateHeaderBadges();
      return;
    }

    const t = computeTotals();

    root.innerHTML = `
      <div class="cart-layout">
        <ul class="cart-items" aria-label="Cart items">
          ${lines.map(itemHtml).join("")}
        </ul>
        <aside class="cart-summary" aria-label="Order summary">
          ${summaryHtml(t)}
        </aside>
      </div>
    `;

    if (summaryEl) {
      summaryEl.textContent =
        `${t.totalQty} item${t.totalQty === 1 ? "" : "s"} · Subtotal ${formatPrice(t.subtotal)}`;
    }

    wireItemEvents();
    wirePromo();
    wireCheckout();
    updateHeaderBadges();
  }

  /* ---------- Line mutation ---------- */
  function setQty(id, qty) {
    const n = Math.max(1, Math.min(99, Math.floor(Number(qty) || 1)));
    const line = lines.find((l) => l.id === id);
    if (!line) return;
    line.qty = n;
    persist();
    render();
    announce(`Quantity updated to ${n}.`);
  }

  function removeLine(id) {
    const idx = lines.findIndex((l) => l.id === id);
    if (idx < 0) return;

    // Animate out then splice + persist
    const el = root.querySelector(`.cart-item[data-id="${CSS.escape(id)}"]`);
    const removed = lines[idx];
    if (el) el.classList.add("is-removing");

    setTimeout(() => {
      lines.splice(idx, 1);
      persist();
      render();
      showUndoToast(removed);
    }, 180);
  }

  function undoRemove(line) {
    // Re-add at original quantity
    const existing = lines.find((l) => l.id === line.id);
    if (existing) {
      existing.qty += line.qty;
    } else {
      lines.push({ ...line });
    }
    persist();
    render();
    announce("Item restored.");
  }

  /* ---------- Toast ---------- */
  let toastEl = null;
  let toastTimer = null;

  function showUndoToast(line) {
    hideToast();

    toastEl = document.createElement("div");
    toastEl.className = "cart-toast";
    toastEl.setAttribute("role", "status");
    toastEl.innerHTML = `
      <span>Removed <strong>${escapeHtml(line.title)}</strong></span>
      <button type="button" data-undo>Undo</button>
    `;
    document.body.appendChild(toastEl);
    requestAnimationFrame(() => toastEl.classList.add("is-visible"));

    toastEl.querySelector("[data-undo]").addEventListener("click", () => {
      undoRemove(line);
      hideToast();
    });

    toastTimer = setTimeout(hideToast, 5000);
  }

  function hideToast() {
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
    if (toastEl) {
      toastEl.classList.remove("is-visible");
      const t = toastEl;
      toastEl = null;
      setTimeout(() => t.remove(), 200);
    }
  }

  /* ---------- Promo ---------- */
  function applyPromo() {
    const input = document.getElementById("promo-input");
    const msg = document.getElementById("promo-msg");
    if (!input || !msg) return;

    const code = input.value.trim().toUpperCase();
    msg.className = "cart-promo__msg";

    if (!code) {
      msg.textContent = "Enter a promo code.";
      msg.classList.add("is-error");
      return;
    }
    const known = KNOWN_PROMOS[code];
    if (!known) {
      msg.textContent = "That code isn't valid.";
      msg.classList.add("is-error");
      return;
    }
    promo = { code, ...known };
    savePromo(promo);
    msg.textContent = "Promo applied!";
    msg.classList.add("is-success");
    render();
  }

  function wirePromo() {
    const btn = document.getElementById("promo-apply");
    const input = document.getElementById("promo-input");
    if (!btn || !input) return;

    btn.addEventListener("click", applyPromo);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        applyPromo();
      }
    });
  }

  /* ---------- Checkout ---------- */
  function wireCheckout() {
    const btn = document.getElementById("checkout-btn");
    if (!btn) return;
    btn.addEventListener("click", () => {
      // Out of scope for now — placeholder.
      announce("Checkout coming soon. Your cart is saved.");
      btn.disabled = true;
      btn.textContent = "Checkout coming soon";
    });
  }

  /* ---------- Item events ---------- */
  function wireItemEvents() {
    root.querySelectorAll(".cart-item").forEach((itemEl) => {
      const id = itemEl.dataset.id;

      // +/- buttons
      itemEl.querySelectorAll("[data-step]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const line = lines.find((l) => l.id === id);
          if (!line) return;
          const step = Number(btn.dataset.step);
          setQty(id, line.qty + step);
        });
      });

      // Number input
      const input = itemEl.querySelector('input[type="number"]');
      if (input) {
        input.addEventListener("change", () => setQty(id, input.value));
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") { e.preventDefault(); input.blur(); }
        });
      }

      // Remove
      const removeBtn = itemEl.querySelector('[data-action="remove"]');
      if (removeBtn) {
        removeBtn.addEventListener("click", () => removeLine(id));
      }
    });
  }

  /* ---------- Header wiring ---------- */
  function setMenuOpen(open) {
    if (!navToggle || !mobileMenu) return;
    navToggle.setAttribute("aria-expanded", String(open));
    navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    mobileMenu.hidden = !open;
    navToggle.innerHTML = `<i class="fa-solid ${open ? "fa-xmark" : "fa-bars"}" aria-hidden="true"></i>`;
  }

  function wireHeader() {
    navToggle?.addEventListener("click", () => {
      setMenuOpen(navToggle.getAttribute("aria-expanded") !== "true");
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && navToggle?.getAttribute("aria-expanded") === "true") {
        setMenuOpen(false);
        navToggle.focus();
      }
    });

    const searchForm = document.querySelector(".search");
    searchForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = document.getElementById("search-input")?.value?.trim();
      if (q) window.location.href = `index.html?q=${encodeURIComponent(q)}#featured-products`;
    });
  }

  /* ---------- Init ---------- */
  function init() {
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());

    lines = buildLinesFromCart(getCart());
    promo = loadPromo();

    updateHeaderBadges();
    wireHeader();

    window.addEventListener("fm:cart-updated", () => {
      // Another tab may have changed the cart
      lines = buildLinesFromCart(getCart());
      render();
    });

    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();