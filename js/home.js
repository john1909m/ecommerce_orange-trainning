/* ============================================================
   Fresh Mart — homepage logic (with sorting + filtering)
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

  /* ---------- DOM ---------- */
  const grid            = document.getElementById("product-grid");
  const statusEl        = document.getElementById("featured-status");
  const countEl         = document.getElementById("products-count");
  const cartCountEl     = document.getElementById("cart-count");
  const wishlistCountEl = document.getElementById("wishlist-count");
  const searchInput     = document.getElementById("search-input");
  const navToggle       = document.getElementById("nav-toggle");
  const mobileMenu      = document.getElementById("mobile-menu");
  const newsletterForm  = document.getElementById("newsletter-form");
  const newsletterMsg   = document.getElementById("newsletter-msg");
  const yearEl          = document.getElementById("year");

  const filterToggle  = document.getElementById("filter-toggle");
  const filterPanel   = document.getElementById("filter-panel");
  const filterClose   = document.getElementById("filter-close");
  const filterOverlay = document.getElementById("filter-overlay");
  const filterBadge   = document.getElementById("filter-badge");
  const categoryChips = document.getElementById("category-chips");
  const ratingChips   = document.getElementById("rating-chips");
  const priceMin      = document.getElementById("price-min");
  const priceMax      = document.getElementById("price-max");
  const inStockOnly   = document.getElementById("in-stock-only");
  const clearBtn      = document.getElementById("clear-filters");
  const applyBtn      = document.getElementById("apply-filters");
  const sortSelect    = document.getElementById("sort-select");

  /* ---------- State ---------- */
  let allProducts = [];
  const filters = {
    category: "all",
    minPrice: null,
    maxPrice: null,
    minRating: 0,
    inStockOnly: false,
    sort: "featured",
    query: "",
  };

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
      imageCover:   p.imageCover || "",
      price:        Number(p.price) || 0,
      priceAfterDiscount:
        p.priceAfterDiscount != null ? Number(p.priceAfterDiscount) : null,
      ratingsAverage:  Number(p.ratingsAverage) || 0,
      ratingsQuantity: Number(p.ratingsQuantity) || 0,
      quantity:        Number(p.quantity) || 0,
      category:        p.category?.name || "Uncategorized",
      createdAt:       p.createdAt || null,
    };
  }

  function effectivePrice(p) {
    return p.priceAfterDiscount != null && p.priceAfterDiscount < p.price
      ? p.priceAfterDiscount
      : p.price;
  }

  /* ---------- Filter + sort ---------- */
  function getVisibleProducts() {
    let list = allProducts.slice();

    if (filters.query) {
      const q = filters.query.toLowerCase();
      list = list.filter((p) => p.title.toLowerCase().includes(q));
    }
    if (filters.category !== "all") {
      list = list.filter((p) => p.category === filters.category);
    }
    if (filters.minPrice != null) {
      list = list.filter((p) => effectivePrice(p) >= filters.minPrice);
    }
    if (filters.maxPrice != null) {
      list = list.filter((p) => effectivePrice(p) <= filters.maxPrice);
    }
    if (filters.minRating > 0) {
      list = list.filter((p) => p.ratingsAverage >= filters.minRating);
    }
    if (filters.inStockOnly) {
      list = list.filter((p) => p.quantity > 0);
    }

    switch (filters.sort) {
      case "price-asc":  list.sort((a, b) => effectivePrice(a) - effectivePrice(b)); break;
      case "price-desc": list.sort((a, b) => effectivePrice(b) - effectivePrice(a)); break;
      case "rating":     list.sort((a, b) => b.ratingsAverage - a.ratingsAverage);   break;
      case "name-asc":   list.sort((a, b) => a.title.localeCompare(b.title));        break;
      case "name-desc":  list.sort((a, b) => b.title.localeCompare(a.title));        break;
      default: break;
    }
    return list;
  }

  /* ---------- Count + badge ---------- */
  function updateCountAndBadge(visibleCount) {
    if (countEl) {
      countEl.textContent =
        allProducts.length === 0
          ? "Loading…"
          : `${visibleCount} of ${allProducts.length} product${allProducts.length === 1 ? "" : "s"}`;
    }

    const activeCount = [
      filters.category !== "all",
      filters.minPrice != null,
      filters.maxPrice != null,
      filters.minRating > 0,
      filters.inStockOnly,
    ].filter(Boolean).length;

    if (filterBadge) {
      filterBadge.hidden = activeCount === 0;
      filterBadge.textContent = String(activeCount);
    }
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

    const saleBadge = hasDiscount ? `<span class="badge-sale">SALE</span>` : "";

    return `
      <article class="product-card" data-id="${escapeHtml(product.id)}">
        <a class="product-card__link" href="${href}" aria-label="View details for ${escapeHtml(product.title)}">
          <div class="product-card__media">
            <div class="product-card__badges">${saleBadge}</div>
            <img src="${escapeHtml(product.imageCover)}" alt="${escapeHtml(product.title)}" loading="lazy" decoding="async" width="300" height="300" />
          </div>
          <h3 class="product-card__title">${escapeHtml(product.title)}</h3>
          <div class="product-card__rating">${starHtml(product.ratingsAverage, product.ratingsQuantity)}</div>
        </a>

        <div class="product-card__foot">
          <div class="price">${priceBlock}</div>
          <button type="button" class="add-btn" data-action="add" aria-label="Add to cart: ${escapeHtml(product.title)}">
            <i class="fa-solid fa-plus" aria-hidden="true"></i>
          </button>
        </div>

        <button type="button"
                class="product-card__wish ${inWishlist ? "is-active" : ""}"
                data-action="wishlist"
                aria-label="${inWishlist ? "Remove from wishlist" : "Add to wishlist"}: ${escapeHtml(product.title)}"
                aria-pressed="${inWishlist}">
          <i class="fa-${inWishlist ? "solid" : "regular"} fa-heart" aria-hidden="true"></i>
        </button>
      </article>
    `;
  }

  /* ---------- Render ---------- */
  function render() {
    if (!grid) return;
    const visible = getVisibleProducts();

    if (!visible.length) {
      grid.innerHTML = `
        <div class="state">
          <p>No products match your filters.</p>
          <button type="button" class="btn btn--primary" id="reset-inline">Clear filters</button>
        </div>`;
      const resetBtn = document.getElementById("reset-inline");
      if (resetBtn) resetBtn.addEventListener("click", clearAllFilters);
    } else {
      grid.innerHTML = visible.map(productCard).join("");
    }

    updateCountAndBadge(visible.length);
  }

  /* ---------- Loading / error ---------- */
  function setLoading(isLoading) {
    if (!grid) return;
    grid.setAttribute("aria-busy", String(isLoading));
    if (isLoading) {
      grid.innerHTML = Array.from({ length: 4 })
        .map(() => `<div class="skeleton-card" aria-hidden="true"></div>`).join("");
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

  /* ---------- Build category chips ---------- */
  function buildCategoryChips() {
    if (!categoryChips) return;
    const cats = [...new Set(allProducts.map((p) => p.category).filter(Boolean))].sort();
    const html = [`<button type="button" class="chip ${filters.category === "all" ? "is-active" : ""}" data-cat="all">All</button>`];
    for (const c of cats) {
      html.push(`<button type="button" class="chip ${filters.category === c ? "is-active" : ""}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`);
    }
    categoryChips.innerHTML = html.join("");
  }

  /* ---------- API ---------- */
  async function loadProducts() {
    setLoading(true);
    try {
      const res = await apiGet("/products?limit=40");
      const raw = Array.isArray(res?.data) ? res.data : [];
      allProducts = raw.map(normalize);

      buildCategoryChips();
      render();

      if (statusEl) statusEl.textContent = `${allProducts.length} products loaded.`;

      const q = new URLSearchParams(location.search).get("q");
      if (q && searchInput) {
        searchInput.value = q;
        filters.query = q;
        render();
      }
    } catch (err) {
      console.error("[Fresh Mart] Failed to load products:", err);
      showError("We couldn't load products right now. Please try again.");
    } finally {
      if (grid) grid.setAttribute("aria-busy", "false");
    }
  }

  /* ---------- Grid clicks ---------- */
  function onGridClick(e) {
    const btn = e.target.closest("button[data-action]");
    if (!btn || !grid.contains(btn)) return;

    const card = btn.closest(".product-card");
    if (!card) return;
    const id = card.dataset.id;
    const product = allProducts.find((p) => p.id === id);
    if (!product) return;

    if (btn.dataset.action === "add") {
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

    if (btn.dataset.action === "wishlist") {
      const nowIn = toggleWishlist(product);
      btn.classList.toggle("is-active", nowIn);
      btn.setAttribute("aria-pressed", String(nowIn));
      btn.setAttribute("aria-label", `${nowIn ? "Remove from wishlist" : "Add to wishlist"}: ${product.title}`);
      btn.innerHTML = `<i class="fa-${nowIn ? "solid" : "regular"} fa-heart" aria-hidden="true"></i>`;
      updateWishlistBadge();
    }
  }

  /* ---------- Search ---------- */
  function onSearchInput() {
    filters.query = (searchInput?.value || "").trim();
    render();
  }

  /* ---------- Filter panel open/close ---------- */
  function isDesktop() {
    return window.matchMedia("(min-width: 768px)").matches;
  }

  function openFilters() {
    if (!filterPanel) return;
    filterPanel.hidden = false;
    if (!isDesktop()) {
      filterPanel.classList.add("is-open");
      if (filterOverlay) filterOverlay.hidden = false;
    }
    filterToggle?.setAttribute("aria-expanded", "true");
  }

  function closeFilters() {
    if (!filterPanel) return;
    if (!isDesktop()) {
      filterPanel.classList.remove("is-open");
      if (filterOverlay) filterOverlay.hidden = true;
    }
    filterToggle?.setAttribute("aria-expanded", "false");
  }

  function toggleFilters() {
    if (!filterPanel) return;
    const isOpen = filterToggle?.getAttribute("aria-expanded") === "true";
    if (isOpen) closeFilters(); else openFilters();
  }

  /* ---------- Category chips ---------- */
  function onCategoryClick(e) {
    const btn = e.target.closest(".chip[data-cat]");
    if (!btn) return;
    filters.category = btn.dataset.cat;
    categoryChips.querySelectorAll(".chip").forEach((c) => c.classList.toggle("is-active", c === btn));
    render();
  }

  /* ---------- Rating chips ---------- */
  function onRatingClick(e) {
    const btn = e.target.closest(".chip[data-rating]");
    if (!btn) return;
    filters.minRating = Number(btn.dataset.rating) || 0;
    ratingChips.querySelectorAll(".chip").forEach((c) => c.classList.toggle("is-active", c === btn));
    render();
  }

  /* ---------- Price inputs ---------- */
  function onPriceChange() {
    const mn = priceMin?.value !== "" ? Number(priceMin.value) : null;
    const mx = priceMax?.value !== "" ? Number(priceMax.value) : null;
    filters.minPrice = Number.isFinite(mn) ? mn : null;
    filters.maxPrice = Number.isFinite(mx) ? mx : null;
    render();
  }

  /* ---------- In stock ---------- */
  function onStockChange() {
    filters.inStockOnly = !!inStockOnly?.checked;
    render();
  }

  /* ---------- Sort ---------- */
  function onSortChange() {
    filters.sort = sortSelect?.value || "featured";
    render();
  }

  /* ---------- Clear ---------- */
  function clearAllFilters() {
    filters.category = "all";
    filters.minPrice = null;
    filters.maxPrice = null;
    filters.minRating = 0;
    filters.inStockOnly = false;
    filters.sort = "featured";
    // Note: keep filters.query intact so search text persists

    if (priceMin) priceMin.value = "";
    if (priceMax) priceMax.value = "";
    if (inStockOnly) inStockOnly.checked = false;
    if (sortSelect) sortSelect.value = "featured";

    categoryChips?.querySelectorAll(".chip").forEach((c) =>
      c.classList.toggle("is-active", c.dataset.cat === "all"));
    ratingChips?.querySelectorAll(".chip").forEach((c) =>
      c.classList.toggle("is-active", c.dataset.rating === "0"));

    render();
    if (statusEl) statusEl.textContent = "Filters cleared.";
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
    setMenuOpen(navToggle.getAttribute("aria-expanded") !== "true");
  }

  /* ---------- Global key ---------- */
  function onKeydown(e) {
    if (e.key !== "Escape") return;
    if (navToggle?.getAttribute("aria-expanded") === "true") {
      setMenuOpen(false);
      navToggle.focus();
    } else if (filterToggle?.getAttribute("aria-expanded") === "true" && !isDesktop()) {
      closeFilters();
      filterToggle.focus();
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

  /* ---------- Sync panel visibility on resize ---------- */
  function syncPanelOnResize() {
    if (!filterPanel) return;
    if (isDesktop()) {
      filterPanel.hidden = false;
      filterPanel.classList.remove("is-open");
      if (filterOverlay) filterOverlay.hidden = true;
    } else {
      // On mobile, only show when toggle says open
      const open = filterToggle?.getAttribute("aria-expanded") === "true";
      filterPanel.hidden = !open;
    }
  }

  /* ---------- Init ---------- */
  function init() {
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());

    updateCartBadge();
    updateWishlistBadge();

    window.addEventListener("fm:cart-updated", updateCartBadge);
    window.addEventListener("fm:wishlist-updated", updateWishlistBadge);

    // Grid + search
    if (grid) grid.addEventListener("click", onGridClick);
    if (searchInput) searchInput.addEventListener("input", onSearchInput);

    // Nav
    if (navToggle) navToggle.addEventListener("click", onNavToggle);
    document.addEventListener("keydown", onKeydown);

    // Filters
    filterToggle?.addEventListener("click", toggleFilters);
    filterClose?.addEventListener("click", closeFilters);
    filterOverlay?.addEventListener("click", closeFilters);
    applyBtn?.addEventListener("click", () => { render(); closeFilters(); });
    clearBtn?.addEventListener("click", clearAllFilters);
    categoryChips?.addEventListener("click", onCategoryClick);
    ratingChips?.addEventListener("click", onRatingClick);
    priceMin?.addEventListener("input", onPriceChange);
    priceMax?.addEventListener("input", onPriceChange);
    inStockOnly?.addEventListener("change", onStockChange);
    sortSelect?.addEventListener("change", onSortChange);

    // Newsletter
    if (newsletterForm) newsletterForm.addEventListener("submit", onNewsletterSubmit);

    // Resize handling
    window.addEventListener("resize", syncPanelOnResize);
    syncPanelOnResize();

    // Load data
    loadProducts();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();