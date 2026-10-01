/* ============================================================
   Fresh Mart — product detail page
   Reads ?id=<productId> from the URL and fetches
   GET /products/{id}
   ============================================================ */

(function () {
  "use strict";

  const {
    apiGet, formatPrice, starHtml,
    getCart, setCart,
    toggleWishlist, isInWishlist,
    escapeHtml,
  } = window.FM;

  /* ---------- DOM refs ---------- */
  const root          = document.getElementById("product-root");
  const detailSection = document.getElementById("product-detail");
  const statusEl      = document.getElementById("page-status");
  const crumbCurrent  = document.getElementById("crumb-current");
  const cartCountEl   = document.getElementById("cart-count");
  const wishlistCountEl = document.getElementById("wishlist-count");
  const navToggle     = document.getElementById("nav-toggle");
  const mobileMenu    = document.getElementById("mobile-menu");
  const yearEl        = document.getElementById("year");
  const relatedSection = document.getElementById("related-section");
  const relatedGrid    = document.getElementById("related-grid");

  /* ---------- Badges ---------- */
  function updateCartBadge() {
    if (cartCountEl) cartCountEl.textContent = String(getCart().length);
  }
  function updateWishlistBadge() {
    if (wishlistCountEl) wishlistCountEl.textContent = String(window.FM.getWishlist().length);
  }

  /* ---------- Normalize ---------- */
  function normalize(p) {
    return {
      id:           p._id || p.id,
      title:        p.title || "Untitled",
      description:  p.description || "",
      imageCover:   p.imageCover || "",
      images:       Array.isArray(p.images) ? p.images : [],
      price:        Number(p.price) || 0,
      priceAfterDiscount: p.priceAfterDiscount != null ? Number(p.priceAfterDiscount) : null,
      ratingsAverage:  Number(p.ratingsAverage) || 0,
      ratingsQuantity: Number(p.ratingsQuantity) || 0,
      quantity:     Number(p.quantity) || 0,
      sold:         Number(p.sold) || 0,
      category:     p.category?.name || "",
      brand:        p.brand?.name || "",
    };
  }

  /* ---------- URL helpers ---------- */
  function getIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id");
  }

  /* ---------- Gallery markup ---------- */
  function galleryHtml(product) {
    const all = [product.imageCover, ...product.images].filter(Boolean);
    const unique = [...new Set(all)];
    const main = unique[0] || "";

    const thumbs = unique.map((src, i) => `
      <button type="button"
              class="pd-thumb ${i === 0 ? "is-active" : ""}"
              data-src="${escapeHtml(src)}"
              aria-label="View image ${i + 1} of ${unique.length}">
        <img src="${escapeHtml(src)}" alt="" width="80" height="80" loading="lazy" decoding="async" />
      </button>
    `).join("");

    return `
      <div class="pd-gallery">
        <div class="pd-gallery__main">
          <img id="pd-main-image"
               src="${escapeHtml(main)}"
               alt="${escapeHtml(product.title)}"
               width="600" height="600"
               fetchpriority="high" decoding="async" />
        </div>
        ${unique.length > 1 ? `<div class="pd-gallery__thumbs" role="group" aria-label="Product images">${thumbs}</div>` : ""}
      </div>
    `;
  }

  /* ---------- Info markup ---------- */
  function infoHtml(product) {
    const hasDiscount =
      product.priceAfterDiscount != null &&
      product.priceAfterDiscount < product.price;

    const nowPrice = hasDiscount ? product.priceAfterDiscount : product.price;
    const wasPrice = product.price;

    const inWishlist = isInWishlist(product.id);
    const inStock = product.quantity > 0;

    const priceBlock = hasDiscount
      ? `<span class="pd-price__now">${formatPrice(nowPrice)}</span>
         <span class="pd-price__was" aria-hidden="true">${formatPrice(wasPrice)}</span>
         <span class="visually-hidden">Now ${formatPrice(nowPrice)}, was ${formatPrice(wasPrice)}</span>
         <span class="badge-sale">SALE</span>`
      : `<span class="pd-price__now">${formatPrice(nowPrice)}</span>`;

    return `
      <div class="pd-info">
        <p class="pd-meta">
          ${product.category ? `<span class="pd-meta__chip">${escapeHtml(product.category)}</span>` : ""}
          ${product.brand ? `<span class="pd-meta__chip pd-meta__chip--brand">${escapeHtml(product.brand)}</span>` : ""}
        </p>

        <h1 id="pd-title" class="pd-title">${escapeHtml(product.title)}</h1>

        <div class="pd-rating">
          ${starHtml(product.ratingsAverage, product.ratingsQuantity)}
        </div>

        <div class="pd-price">${priceBlock}</div>

        ${product.description ? `<p class="pd-desc">${escapeHtml(product.description)}</p>` : ""}

        <ul class="pd-facts">
          <li>
            <i class="fa-solid fa-box" aria-hidden="true"></i>
            <span>${inStock ? `${product.quantity} in stock` : "Out of stock"}</span>
          </li>
          ${product.sold ? `<li><i class="fa-solid fa-fire" aria-hidden="true"></i> <span>${product.sold} sold</span></li>` : ""}
          <li><i class="fa-solid fa-truck-fast" aria-hidden="true"></i> <span>Free delivery over 300 EGP</span></li>
          <li><i class="fa-solid fa-rotate-left" aria-hidden="true"></i> <span>14-day returns</span></li>
        </ul>

        <form class="pd-buy" id="pd-buy-form">
          <div class="pd-qty" role="group" aria-label="Quantity">
            <button type="button" class="pd-qty__btn" data-step="-1" aria-label="Decrease quantity">
              <i class="fa-solid fa-minus" aria-hidden="true"></i>
            </button>
            <label for="pd-qty" class="visually-hidden">Quantity</label>
            <input id="pd-qty" type="number" inputmode="numeric" min="1" max="${Math.max(1, product.quantity || 99)}" value="1" />
            <button type="button" class="pd-qty__btn" data-step="1" aria-label="Increase quantity">
              <i class="fa-solid fa-plus" aria-hidden="true"></i>
            </button>
          </div>

          <button type="submit" class="btn btn--primary pd-add" ${inStock ? "" : "disabled"}>
            <i class="fa-solid fa-cart-shopping" aria-hidden="true"></i>
            <span>${inStock ? "Add to Cart" : "Out of Stock"}</span>
          </button>

          <button type="button"
                  class="pd-wish ${inWishlist ? "is-active" : ""}"
                  id="pd-wish"
                  aria-pressed="${inWishlist}"
                  aria-label="${inWishlist ? "Remove from wishlist" : "Add to wishlist"}">
            <i class="fa-${inWishlist ? "solid" : "regular"} fa-heart" aria-hidden="true"></i>
            <span>${inWishlist ? "In Wishlist" : "Add to Wishlist"}</span>
          </button>
        </form>
      </div>
    `;
  }

  /* ---------- Render full product ---------- */
  function renderProduct(product) {
    root.innerHTML = `
      <div class="pd-layout">
        ${galleryHtml(product)}
        ${infoHtml(product)}
      </div>
    `;
    detailSection.setAttribute("aria-busy", "false");

    if (crumbCurrent) crumbCurrent.textContent = product.title;
    document.title = `${product.title} | Fresh Mart`;

    // Update meta description for this page
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        "content",
        `${product.title} — ${formatPrice(product.priceAfterDiscount ?? product.price)} at Fresh Mart.`
      );
    }

    wireGallery();
    wireBuyForm(product);
    wireWishlist(product);
  }

  /* ---------- Gallery interactions ---------- */
  function wireGallery() {
    const main = document.getElementById("pd-main-image");
    const thumbs = root.querySelectorAll(".pd-thumb");
    thumbs.forEach((btn) => {
      btn.addEventListener("click", () => {
        const src = btn.dataset.src;
        if (main && src) main.src = src;
        thumbs.forEach((t) => t.classList.toggle("is-active", t === btn));
      });
    });
  }

  /* ---------- Quantity + add to cart ---------- */
  function wireBuyForm(product) {
    const form = document.getElementById("pd-buy-form");
    const qtyInput = document.getElementById("pd-qty");

    root.querySelectorAll(".pd-qty__btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const step = Number(btn.dataset.step);
        const min = Number(qtyInput.min) || 1;
        const max = Number(qtyInput.max) || 99;
        const next = Math.min(max, Math.max(min, (Number(qtyInput.value) || 1) + step));
        qtyInput.value = String(next);
      });
    });

    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      const qty = Math.max(1, Number(qtyInput?.value) || 1);

      const cart = getCart();
      for (let i = 0; i < qty; i++) {
        cart.push({
          id: product.id,
          title: product.title,
          imageCover: product.imageCover,
          price: product.priceAfterDiscount ?? product.price,
        });
      }
      setCart(cart);
      updateCartBadge();
      if (statusEl) statusEl.textContent = `${qty} × ${product.title} added to cart.`;
    });
  }

  /* ---------- Wishlist toggle ---------- */
  function wireWishlist(product) {
    const btn = document.getElementById("pd-wish");
    if (!btn) return;

    btn.addEventListener("click", () => {
      const nowIn = toggleWishlist(product);
      btn.classList.toggle("is-active", nowIn);
      btn.setAttribute("aria-pressed", String(nowIn));
      btn.setAttribute("aria-label", nowIn ? "Remove from wishlist" : "Add to wishlist");
      btn.innerHTML = `
        <i class="fa-${nowIn ? "solid" : "regular"} fa-heart" aria-hidden="true"></i>
        <span>${nowIn ? "In Wishlist" : "Add to Wishlist"}</span>
      `;
      updateWishlistBadge();
      if (statusEl) statusEl.textContent = nowIn ? "Added to wishlist." : "Removed from wishlist.";
    });
  }

  /* ---------- Related products ---------- */
  async function loadRelated(product) {
    if (!relatedSection || !relatedGrid) return;
    try {
      const res = await apiGet("/products?limit=8");
      const list = (Array.isArray(res?.data) ? res.data : [])
        .map(normalize)
        .filter((p) => p.id !== product.id)
        .slice(0, 4);

      if (!list.length) return;

      relatedGrid.innerHTML = list.map((p) => `
        <article class="product-card">
          <a class="product-card__link" href="product.html?id=${encodeURIComponent(p.id)}" aria-label="${escapeHtml(p.title)}">
            <div class="product-card__media">
              <img src="${escapeHtml(p.imageCover)}" alt="${escapeHtml(p.title)}" loading="lazy" decoding="async" width="300" height="300" />
            </div>
            <h3 class="product-card__title">${escapeHtml(p.title)}</h3>
            <div class="product-card__rating">${starHtml(p.ratingsAverage, p.ratingsQuantity)}</div>
            <div class="product-card__foot">
              <div class="price"><span class="price__now">${formatPrice(p.priceAfterDiscount ?? p.price)}</span></div>
            </div>
          </a>
        </article>
      `).join("");

      relatedSection.hidden = false;
    } catch (err) {
      console.warn("[Fresh Mart] Related products failed:", err);
    }
  }

  /* ---------- Error state ---------- */
  function showError(message) {
    detailSection.setAttribute("aria-busy", "false");
    root.innerHTML = `
      <div class="state" role="alert">
        <p>${escapeHtml(message)}</p>
        <a class="btn btn--primary" href="index.html#featured-products">Back to products</a>
      </div>
    `;
    if (statusEl) statusEl.textContent = message;
  }

  /* ---------- Header: search, nav, badges ---------- */
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

    // Redirect search to homepage with a query param the homepage can honor later
    const searchForm = document.querySelector(".search");
    searchForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = document.getElementById("search-input")?.value?.trim();
      if (q) {
        window.location.href = `index.html?q=${encodeURIComponent(q)}#featured-products`;
      }
    });
  }

  /* ---------- Init ---------- */
  async function init() {
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());
    updateCartBadge();
    updateWishlistBadge();
    wireHeader();

    window.addEventListener("fm:cart-updated", updateCartBadge);
    window.addEventListener("fm:wishlist-updated", updateWishlistBadge);

    const id = getIdFromUrl();
    if (!id) {
      showError("No product was specified.");
      return;
    }

    try {
      const res = await apiGet(`/products/${encodeURIComponent(id)}`);
      const raw = res?.data;
      if (!raw) throw new Error("Product not found");
      const product = normalize(raw);
      renderProduct(product);
      if (statusEl) statusEl.textContent = `${product.title} loaded.`;
      loadRelated(product);
    } catch (err) {
      console.error("[Fresh Mart] Failed to load product:", err);
      showError("We couldn't load this product. Please try again.");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();