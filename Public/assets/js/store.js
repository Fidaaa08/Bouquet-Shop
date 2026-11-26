import { getSupabase } from "./supabase.js";

const grid = document.querySelector("#product-grid");
const catalogMessage = document.querySelector("#catalog-message");
const productCount = document.querySelector(".product-count");
const filterButtons = [...document.querySelectorAll(".filter-button")];
const cartToggle = document.querySelector("#cart-toggle");
const cartDialog = document.querySelector("#cart-dialog");
const cartItems = document.querySelector("#cart-items");
const cartTotal = document.querySelector("#cart-total");
const cartClose = document.querySelector("#cart-close");
const checkoutForm = document.querySelector("#checkout-form");
const checkoutMessage = document.querySelector("#checkout-message");
const checkoutSubmit = checkoutForm.querySelector('button[type="submit"]');
const whatsappFollowup = document.querySelector("#whatsapp-followup");
const toast = document.querySelector(".toast");

const categoryLabels = {
  romantis: "Romantis",
  selamat: "Perayaan",
  sederhana: "Untuk diri sendiri",
};
const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

let products = [];
let selectedFilter = "semua";
let cart = readCart();
let supabase;
let appConfig = {};
let toastTimeout;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function getWhatsAppNumber() {
  const digits = String(appConfig.whatsappNumber || "").replace(/\D/g, "");
  return digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
}

function readCart() {
  try {
    const saved = JSON.parse(localStorage.getItem("bouquet-cart") || "[]");
    if (!Array.isArray(saved)) throw new Error("Format keranjang tidak valid.");
    return new Map(
      saved
        .filter((item) => item && typeof item.id === "string" && Number.isInteger(item.quantity))
        .map((item) => [item.id, Math.min(10, Math.max(1, item.quantity))]),
    );
  } catch (error) {
    console.error("Keranjang tersimpan tidak dapat dibaca:", error);
    localStorage.removeItem("bouquet-cart");
    return new Map();
  }
}

function saveCart() {
  localStorage.setItem(
    "bouquet-cart",
    JSON.stringify([...cart].map(([id, quantity]) => ({ id, quantity }))),
  );
}

function setCatalogMessage(message, isError = false) {
  catalogMessage.textContent = message;
  catalogMessage.hidden = !message;
  catalogMessage.classList.toggle("is-error", isError);
}

function createProductCard(product) {
  const card = document.createElement("article");
  card.className = "product-card";
  card.dataset.category = product.category;

  const imageLink = document.createElement("a");
  imageLink.className = "product-image";
  imageLink.href = "#custom";
  imageLink.setAttribute("aria-label", `Konsultasi tentang ${product.name}`);

  const image = document.createElement("img");
  image.src = product.image_url;
  image.alt = product.name;
  image.loading = "lazy";
  const categoryTag = document.createElement("span");
  categoryTag.className = "product-tag";
  categoryTag.textContent = categoryLabels[product.category] || "Rangkaian bunga";
  imageLink.append(image, categoryTag);

  const arrow = document.createElement("span");
  arrow.className = "product-arrow";
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "↗";
  imageLink.append(arrow);

  const info = document.createElement("div");
  info.className = "product-info";
  const summary = document.createElement("div");
  summary.className = "product-summary";
  const name = document.createElement("h3");
  name.textContent = product.name;
  summary.append(name);

  if (typeof product.description === "string" && product.description.trim()) {
    const description = document.createElement("p");
    description.className = "product-description";
    description.textContent = product.description;
    summary.append(description);
  }

  const price = document.createElement("p");
  price.className = "product-price";
  price.textContent = rupiah.format(product.price);
  info.append(summary, price);

  const actions = document.createElement("div");
  actions.className = "product-actions";
  const whatsappNumber = getWhatsAppNumber();
  const quickOrder = document.createElement("a");
  quickOrder.className = "quick-order-button";
  quickOrder.href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    `Halo Our Bouquets, saya ingin pesan ${product.name} seharga ${rupiah.format(product.price)}. Apakah masih tersedia?`,
  )}`;
  quickOrder.target = "_blank";
  quickOrder.rel = "noopener noreferrer";
  quickOrder.setAttribute("aria-label", `Pesan ${product.name} melalui WhatsApp`);
  const quickOrderLabel = document.createElement("span");
  quickOrderLabel.textContent = "Pesan via WhatsApp";
  const quickOrderIcon = document.createElement("span");
  quickOrderIcon.setAttribute("aria-hidden", "true");
  quickOrderIcon.textContent = "↗";
  quickOrder.append(quickOrderLabel, quickOrderIcon);

  const addButton = document.createElement("button");
  addButton.className = "add-button";
  addButton.type = "button";
  addButton.dataset.productId = product.id;
  const addLabel = document.createElement("span");
  addLabel.textContent = "Tambah ke keranjang";
  const addIcon = document.createElement("span");
  addIcon.setAttribute("aria-hidden", "true");
  addIcon.textContent = "+";
  addButton.append(addLabel, addIcon);
  actions.append(quickOrder, addButton);

  card.append(imageLink, info, actions);
  return card;
}

function renderProducts() {
  grid.replaceChildren();
  const visibleProducts = products.filter(
    (product) => selectedFilter === "semua" || product.category === selectedFilter,
  );
  visibleProducts.forEach((product) => grid.append(createProductCard(product)));
  productCount.textContent = String(products.length);

  if (!products.length) {
    setCatalogMessage("Belum ada rangkaian bunga. Produk baru akan segera hadir.");
  } else {
    setCatalogMessage(visibleProducts.length ? "" : "Belum ada produk untuk kategori ini.");
  }
}

function renderCart() {
  cartItems.replaceChildren();
  let total = 0;
  let totalQuantity = 0;

  for (const [id, quantity] of cart) {
    const product = products.find((item) => item.id === id);
    if (!product) continue;

    total += product.price * quantity;
    totalQuantity += quantity;

    const row = document.createElement("div");
    row.className = "cart-item";
    const details = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = product.name;
    const linePrice = document.createElement("span");
    linePrice.textContent = rupiah.format(product.price * quantity);
    details.append(name, linePrice);

    const controls = document.createElement("div");
    controls.className = "quantity-controls";
    const decrease = document.createElement("button");
    decrease.type = "button";
    decrease.dataset.cartAction = "decrease";
    decrease.dataset.productId = id;
    decrease.setAttribute("aria-label", `Kurangi ${product.name}`);
    decrease.textContent = "−";
    const count = document.createElement("span");
    count.textContent = String(quantity);
    const increase = document.createElement("button");
    increase.type = "button";
    increase.dataset.cartAction = "increase";
    increase.dataset.productId = id;
    increase.setAttribute("aria-label", `Tambah ${product.name}`);
    increase.textContent = "+";
    increase.disabled = quantity >= 10;
    controls.append(decrease, count, increase);
    row.append(details, controls);
    cartItems.append(row);
  }

  if (!cartItems.children.length) {
    const empty = document.createElement("p");
    empty.className = "cart-empty";
    empty.textContent = "Keranjangmu masih kosong.";
    cartItems.append(empty);
  }

  cartTotal.textContent = rupiah.format(total);
  cartToggle.querySelector(".cart-count").textContent = String(totalQuantity);
  cartToggle.setAttribute("aria-label", `Keranjang, ${totalQuantity} buket`);
  checkoutSubmit.disabled = totalQuantity === 0;
  saveCart();
}

async function loadProducts() {
  setCatalogMessage("Memuat rangkaian bunga...");
  const { data, error } = await supabase
    .from("products")
    .select("id, name, category, description, price, image_url")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  products = data || [];
  renderProducts();
  renderCart();
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedFilter = button.dataset.filter;
    filterButtons.forEach((item) => {
      const active = item === button;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    renderProducts();
  });
});

grid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-product-id]");
  if (!button) return;
  const product = products.find((item) => item.id === button.dataset.productId);
  if (!product) return;
  if (!cart.has(product.id) && cart.size >= 20) {
    showToast("Keranjang maksimal 20 jenis produk.");
    return;
  }

  cart.set(product.id, Math.min(10, (cart.get(product.id) || 0) + 1));
  renderCart();
  showToast(`${product.name} ditambahkan ke keranjang.`);
});

cartItems.addEventListener("click", (event) => {
  const button = event.target.closest("[data-cart-action]");
  if (!button) return;

  const quantity = cart.get(button.dataset.productId);
  if (!quantity) return;
  if (button.dataset.cartAction === "increase") {
    cart.set(button.dataset.productId, Math.min(10, quantity + 1));
  } else if (quantity === 1) {
    cart.delete(button.dataset.productId);
  } else {
    cart.set(button.dataset.productId, quantity - 1);
  }
  renderCart();
});

cartToggle.addEventListener("click", () => {
  checkoutMessage.textContent = "";
  whatsappFollowup.hidden = true;
  cartDialog.showModal();
});
cartClose.addEventListener("click", () => cartDialog.close());
cartDialog.addEventListener("click", (event) => {
  if (event.target === cartDialog) cartDialog.close();
});

checkoutForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!cart.size) return;

  checkoutSubmit.disabled = true;
  checkoutMessage.textContent = "Menyimpan pesanan...";

  try {
    const formData = new FormData(checkoutForm);
    const { data, error } = await supabase.rpc("place_order", {
      p_customer_name: formData.get("customerName"),
      p_customer_phone: formData.get("customerPhone"),
      p_customer_email: formData.get("customerEmail") || null,
      p_delivery_address: formData.get("deliveryAddress"),
      p_notes: formData.get("notes") || "",
      p_items: [...cart].map(([product_id, quantity]) => ({ product_id, quantity })),
    });

    if (error) throw error;

    cart.clear();
    saveCart();
    checkoutForm.reset();
    renderCart();
    checkoutMessage.textContent = `Pesanan berhasil disimpan. Nomor pesanan: ${data}`;

    const whatsappNumber = getWhatsAppNumber();
    if (whatsappNumber) {
      whatsappFollowup.href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Halo, saya sudah membuat pesanan ${data} di Our Bouquets.`)}`;
      whatsappFollowup.hidden = false;
    }
  } catch (error) {
    checkoutMessage.textContent = `Pesanan belum tersimpan: ${error.message}`;
  } finally {
    if (cart.size) checkoutSubmit.disabled = false;
  }
});

try {
  ({ supabase, appConfig } = await getSupabase());
  await loadProducts();
  const unavailable = [...cart.keys()].filter((id) => !products.some((product) => product.id === id));
  if (unavailable.length) {
    unavailable.forEach((id) => cart.delete(id));
    renderCart();
    showToast("Produk yang sudah tidak tersedia dihapus dari keranjang.");
  }
} catch (error) {
  console.error("Produk tidak dapat dimuat:", error);
  setCatalogMessage(`Katalog belum dapat dimuat: ${error.message}`, true);
}
