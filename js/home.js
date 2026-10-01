/* ============================================================
   Fresh Mart — homepage logic
   Depends on js/utilities.js (window.FM)
   ============================================================ */

(function () {
  "use strict";

  const {
    apiGet,
    formatPrice,
    starHtml,
    getCart,
    setCart,
    toggleWishlist,
    isInWishlist,
    escapeHtml,
  } = window.FM;

  /* ---------- DOM refs ---------- */
  const grid            = document.getElementById("product-grid");
  const statusEl        = document.getElementById("featured-status");
  const cartCountEl     = document.getElementById("cart-count");
  const wishlistCountEl = document.getElementById("wishlist-count");
  const searchInput     = document.getElementById("search-input");
  const navToggle       = document.getElementById("nav-toggle");
  const mobileMenu      = document.getElementById("mobile-menu");
  const newsletterForm  = document.getElementById("newsletter-form");
  const newsletterMsg   = document.getElementById("newsletter-msg");
  const yearEl          = document.getElementById("year");

  /* ---------- State ---------- */
  let allProducts = [];

  /* ---------- Badges ---------- */
  function updateCartBadge() {
    if (cartCountEl) cartCountEl.textContent = String(getCart().length);
  }

  function updateWishlistBadge() {
    if (wishlistCountEl) {
      wishlistCountEl.textContent = String(window.FM.getWishlist().length);
    }
  }

  /* ---------- Normalize API product -> internal shape ---------- */
  function normalize(p) {
    return {
      id:           p._id || p.id,
      title:        p.title || "Untitled",
      imageCover:   p.imageCover || "",
      price:        Number(p.price) || 0,
      priceAfterDiscount:
        p.priceAfterDiscount != null ? Number(p.priceAfterDiscount) : null,
      ratingsAverage:  Number(p.ratingsAverage) || 0,
      ratingsQuantity: Number(p.ratingsQuantity) || 0,
    };
  }

  /* ---------- Product card ---------- */
  function productCard(product) {
    const hasDiscount =
      product.priceAfterDiscount != null &&
      product.priceAfterDiscount < product.price;

    const nowPrice = hasDiscount ? product.priceAfterDiscount : product.price;
    const wasPrice = product.price;

    const inWishlist = isInWishlist(product.id);
    const href = `product.html?id=${encodeURIComponent(product.id)}`;

    const priceBlock = hasDiscount
      ? `<span class="price__now">${formatPrice(nowPrice)}</span>
         <span class="price__was" aria-hidden="true">${formatPrice(wasPrice)}</span>
         <span class="visually-hidden">Now ${formatPrice(nowPrice)}, was ${formatPrice(wasPrice)}</span>`
      : `<span class="price__now">${formatPrice(nowPrice)}</span>`;

    const saleBadge = hasDiscount
      ? `<span class="badge-sale">SALE</span>`
      : "";

    return `
      <article class="product-card" data-id="${escapeHtml(product.id)}">
        <a class="product-card__link" href="${href}"
           aria-label="View details for ${escapeHtml(product.title)}">
          <div class="product-card__media">
            <div class="product-card__badges">${saleBadge}</div>
            <img
              src="${escapeHtml(product.imageCover)}"
              alt="${escapeHtml(product.title)}"
              loading="lazy"
              decoding="async"
              width="300"
              height="300"
            />
          </div>

          <h3 class="product-card__title">${escapeHtml(product.title)}</h3>

          <div class="product-card__rating">
            ${starHtml(product.ratingsAverage, product.ratingsQuantity)}
          </div>
        </a>

        <div class="product-card__foot">
          <div class="price">${priceBlock}</div>
          <button
            type="button"
            class="add-btn"
            data-action="add"
            aria-label="Add to cart: ${escapeHtml(product.title)}"
          >
            <i class="fa-solid fa-plus" aria-hidden="true"></i>
          </button>
        </div>

        <button
          type="button"
          class="product-card__wish ${inWishlist ? "is-active" : ""}"
          data-action="wishlist"
          aria-label="${inWishlist ? "Remove from wishlist" : "Add to wishlist"}: ${escapeHtml(product.title)}"
          aria-pressed="${inWishlist}"
        >
          <i class="fa-${inWishlist ? "solid" : "regular"} fa-heart" aria-hidden="true"></i>
        </button>
      </article>
    `;
  }

  /* ---------- Render ---------- */
  function renderProducts(list) {
    if (!grid) return;

    if (!list.length) {
      grid.innerHTML = `
        <div class="state">
          <p>No products match your search.</p>
        </div>`;
      return;
    }

    grid.innerHTML = list.map(productCard).join("");
  }

  /* ---------- Loading / error ---------- */
  function setLoading(isLoading) {
    if (!grid) return;
    grid.setAttribute("aria-busy", String(isLoading));
    if (isLoading) {
      grid.innerHTML = Array.from({ length: 4 })
        .map(() => `<div class="skeleton-card" aria-hidden="true"></div>`)
        .join("");
      if (statusEl) statusEl.textContent = "Loading featured products…";
    }
  }

  function showError(message) {
    if (!grid) return;
    grid.setAttribute("aria-busy", "false");
    grid.innerHTML = `
      <div class="state" role="alert">
        <p>${escapeHtml(message)}</p>
        <button type="button" class="btn btn--primary" id="retry-btn">Try again</button>
      </div>`;
    const retry = document.getElementById("retry-btn");
    if (retry) retry.addEventListener("click", loadProducts);
    if (statusEl) statusEl.textContent = message;
  }

  /* ---------- API ---------- */
  async function loadProducts() {
    setLoading(true);
    try {
      const res = await apiGet("/products?limit=40");
      const raw = Array.isArray(res?.data) ? res.data : [];
      allProducts = raw.map(normalize);

      renderProducts(allProducts);

      if (statusEl) {
        statusEl.textContent = `${allProducts.length} products loaded.`;
      }

      const q = new URLSearchParams(location.search).get("q");
      if (q && searchInput) {
        searchInput.value = q;
        onSearchInput();
      }
    } catch (err) {
      console.error("[Fresh Mart] Failed to load products:", err);
      showError("We couldn't load products right now. Please try again.");
    } finally {
      if (grid) grid.setAttribute("aria-busy", "false");
    }
  }

  /* ---------- Events: product grid (delegation) ---------- */
  function onGridClick(e) {
    const btn = e.target.closest("button[data-action]");
    if (!btn || !grid.contains(btn)) return;

    const card = btn.closest(".product-card");
    if (!card) return;

    const id = card.dataset.id;
    const product = allProducts.find((p) => p.id === id);
    if (!product) return;

    const action = btn.dataset.action;

    if (action === "add") {
      const cart = getCart();
      cart.push({
        id: product.id,
        title: product.title,
        imageCover: product.imageCover,
        price: product.priceAfterDiscount ?? product.price,
      });
      setCart(cart);
      updateCartBadge();
      if (statusEl) statusEl.textContent = `${product.title} added to cart.`;
    }

    if (action === "wishlist") {
      const nowIn = toggleWishlist(product);
      btn.classList.toggle("is-active", nowIn);
      btn.setAttribute("aria-pressed", String(nowIn));
      btn.setAttribute(
        "aria-label",
        `${nowIn ? "Remove from wishlist" : "Add to wishlist"}: ${product.title}`
      );
      btn.innerHTML = `<i class="fa-${nowIn ? "solid" : "regular"} fa-heart" aria-hidden="true"></i>`;
      updateWishlistBadge();
    }
  }

  /* ---------- Search filter ---------- */
  function onSearchInput() {
    const q = (searchInput?.value || "").trim().toLowerCase();
    if (!q) {
      renderProducts(allProducts);
      return;
    }
    const filtered = allProducts.filter((p) =>
      p.title.toLowerCase().includes(q)
    );
    renderProducts(filtered);
  }

  /* ---------- Mobile nav ---------- */
  function setMenuOpen(open) {
    if (!navToggle || !mobileMenu) return;
    navToggle.setAttribute("aria-expanded", String(open));
    navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    mobileMenu.hidden = !open;
    navToggle.innerHTML = `<i class="fa-solid ${open ? "fa-xmark" : "fa-bars"}" aria-hidden="true"></i>`;
  }

  function onNavToggle() {
    const open = navToggle.getAttribute("aria-expanded") === "true";
    setMenuOpen(!open);
  }

  function onKeydown(e) {
    if (e.key === "Escape") {
      const open = navToggle?.getAttribute("aria-expanded") === "true";
      if (open) {
        setMenuOpen(false);
        navToggle.focus();
      }
    }
  }

  /* ---------- Newsletter ---------- */
  function onNewsletterSubmit(e) {
    e.preventDefault();
    if (!newsletterMsg) return;

    const email = newsletterForm?.email?.value?.trim() || "";
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!valid) {
      newsletterMsg.textContent = "Please enter a valid email address.";
      newsletterMsg.className = "newsletter__msg is-error";
      return;
    }

    newsletterMsg.textContent = "Thanks! You're subscribed. 🎉";
    newsletterMsg.className = "newsletter__msg is-success";
    newsletterForm.reset();
  }

  /* ---------- Init ---------- */
  function init() {
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());

    updateCartBadge();
    updateWishlistBadge();

    window.addEventListener("fm:cart-updated", updateCartBadge);
    window.addEventListener("fm:wishlist-updated", updateWishlistBadge);

    if (grid) grid.addEventListener("click", onGridClick);
    if (searchInput) searchInput.addEventListener("input", onSearchInput);
    if (navToggle) navToggle.addEventListener("click", onNavToggle);
    document.addEventListener("keydown", onKeydown);
    if (newsletterForm) newsletterForm.addEventListener("submit", onNewsletterSubmit);

    loadProducts();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();