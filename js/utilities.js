/* ============================================================
   Fresh Mart — shared utilities
   ============================================================ */

const API_BASE = "https://ecommerce.routemisr.com/api/v1";

/**
 * GET helper for the Route API.
 * @param {string} path - e.g. "/products?limit=40"
 * @returns {Promise<any>}
 */
async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/** Format a number as EGP currency. */
function formatPrice(value) {
  const n = Number(value) || 0;
  return `${n.toFixed(0)} EGP`;
}

/** Build star markup from a rating average. */
function starHtml(average, count) {
  const avg = Math.min(5, Math.max(0, Number(average) || 0));
  const full = Math.floor(avg);
  const hasHalf = avg - full >= 0.5;
  const empty = 5 - full - (hasHalf ? 1 : 0);

  let stars = "";
  for (let i = 0; i < full; i++) stars += '<i class="fa-solid fa-star"></i>';
  if (hasHalf) stars += '<i class="fa-solid fa-star-half-stroke"></i>';
  for (let i = 0; i < empty; i++) stars += '<i class="fa-regular fa-star"></i>';

  const label = `${avg.toFixed(1)} out of 5 from ${count} rating${count === 1 ? "" : "s"}`;
  return `<span class="stars" aria-hidden="true">${stars}</span>
          <span class="visually-hidden">${label}</span>
          <span aria-hidden="true">(${count})</span>`;
}

/* ---------- Cart ---------- */
function getCart() {
  try { return JSON.parse(localStorage.getItem("fm_cart") || "[]"); }
  catch { return []; }
}
function setCart(cart) {
  localStorage.setItem("fm_cart", JSON.stringify(cart));
  window.dispatchEvent(new CustomEvent("fm:cart-updated", { detail: cart }));
}

/* ---------- Wishlist ---------- */
function getWishlist() {
  try { return JSON.parse(localStorage.getItem("fm_wishlist") || "[]"); }
  catch { return []; }
}
function setWishlist(list) {
  localStorage.setItem("fm_wishlist", JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("fm:wishlist-updated", { detail: list }));
}
function toggleWishlist(product) {
  const list = getWishlist();
  const idx = list.findIndex((p) => p.id === product.id);
  if (idx >= 0) { list.splice(idx, 1); setWishlist(list); return false; }
  list.push({
    id: product.id,
    title: product.title,
    imageCover: product.imageCover,
    price: product.priceAfterDiscount ?? product.price,
  });
  setWishlist(list);
  return true;
}
function isInWishlist(id) {
  return getWishlist().some((p) => p.id === id);
}

/* ---------- Escape ---------- */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

window.FM = {
  apiGet, formatPrice, starHtml,
  getCart, setCart,
  getWishlist, setWishlist, toggleWishlist, isInWishlist,
  escapeHtml,
};