import { getSupabase } from "./supabase.js";

const loginSection = document.querySelector("#admin-login");
const dashboard = document.querySelector("#admin-dashboard");
const loginForm = document.querySelector("#login-form");
const forgotPasswordButton = document.querySelector("#forgot-password-button");
const passwordResetForm = document.querySelector("#password-reset-form");
const productForm = document.querySelector("#product-form");
const productList = document.querySelector("#admin-product-list");
const orderList = document.querySelector("#admin-order-list");
const message = document.querySelector("#admin-message");
const loginMessage = document.querySelector("#login-message");
const logoutButton = document.querySelector("#logout-button");
const cancelEdit = document.querySelector("#cancel-edit");
const formTitle = document.querySelector("#product-form-title");
const productEditor = document.querySelector("#product-editor");
const productSearch = document.querySelector("#product-search");
const productFilter = document.querySelector("#product-filter");
const orderSearch = document.querySelector("#order-search");
const orderFilter = document.querySelector("#order-filter");
const refreshButton = document.querySelector("#refresh-button");

const categories = {
  satin: "Satin",
  money: "Money",
  artificial: "Artificial Flowers",
  romantis: "Romantis",
  selamat: "Perayaan",
  sederhana: "Untuk diri sendiri",
};
const currentCategoryValues = new Set(["satin", "money", "artificial"]);
const statuses = {
  pending: "Menunggu konfirmasi",
  confirmed: "Dikonfirmasi",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};
const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});
let products = [];
let orders = [];
let supabase;

function setLoginEnabled(enabled) {
  loginForm.querySelectorAll("input, button").forEach((control) => {
    control.disabled = !enabled;
  });
  forgotPasswordButton.disabled = !enabled;
}

function showMessage(text, isError = false) {
  const target = dashboard.hidden ? loginMessage : message;
  target.textContent = text;
  target.classList.toggle("is-error", isError);
  if (target !== message) message.textContent = "";
  if (target !== loginMessage) loginMessage.textContent = "";
}

function showLogin() {
  dashboard.hidden = true;
  loginSection.hidden = false;
  loginForm.hidden = false;
  forgotPasswordButton.hidden = false;
  passwordResetForm.hidden = true;
  setLoginEnabled(Boolean(supabase));
  showMessage("");
}

function showPasswordReset() {
  dashboard.hidden = true;
  loginSection.hidden = false;
  loginForm.hidden = true;
  forgotPasswordButton.hidden = true;
  passwordResetForm.hidden = false;
  showMessage("");
}

function updateOverview() {
  const pending = orders.filter((order) => order.status === "pending").length;
  document.querySelector("#stat-orders").textContent = String(orders.length);
  document.querySelector("#stat-pending").textContent = String(pending);
  document.querySelector("#stat-products").textContent = String(
    products.filter((product) => product.active).length,
  );
  document.querySelector("#pending-count").textContent = String(pending);
}

async function showDashboard(user) {
  const { data: admin, error } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!admin) {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) throw signOutError;
    showLogin();
    showMessage("Akun ini belum diberi akses admin.", true);
    return;
  }

  await Promise.all([loadProducts(), loadOrders()]);
  loginSection.hidden = true;
  dashboard.hidden = false;
  showMessage("");
}

function addEmptyMessage(container, text) {
  const empty = document.createElement("p");
  empty.className = "admin-empty";
  empty.textContent = text;
  container.append(empty);
}

function renderProducts() {
  productList.replaceChildren();
  const query = productSearch.value.trim().toLocaleLowerCase("id");
  const filter = productFilter.value;
  const visibleProducts = products.filter((product) => {
    const matchesSearch = `${product.name} ${categories[product.category] || product.category}`
      .toLocaleLowerCase("id")
      .includes(query);
    const matchesFilter = filter === "all" || (filter === "active" ? product.active : !product.active);
    return matchesSearch && matchesFilter;
  });

  document.querySelector("#product-list-caption").textContent =
    `${visibleProducts.length} dari ${products.length} produk`;

  if (!visibleProducts.length) {
    addEmptyMessage(
      productList,
      products.length ? "Produk tidak ditemukan untuk pencarian atau filter ini." : "Belum ada produk. Tambahkan produk pertama untuk mulai mengisi etalase.",
    );
    return;
  }

  visibleProducts.forEach((product) => {
    const row = document.createElement("article");
    row.className = "admin-product";
    const details = document.createElement("div");
    details.className = "admin-product-details";
    const image = document.createElement("img");
    image.src = product.image_url;
    image.alt = "";
    image.loading = "lazy";
    image.addEventListener("error", () => {
      image.classList.add("image-unavailable");
      image.removeAttribute("src");
    }, { once: true });

    const text = document.createElement("div");
    text.className = "product-copy";
    const name = document.createElement("strong");
    name.textContent = product.name;
    const summary = document.createElement("span");
    summary.textContent = `${categories[product.category] || product.category} · ${rupiah.format(product.price)}`;
    const visibility = document.createElement("span");
    visibility.className = `product-visibility ${product.active ? "is-active" : "is-hidden"}`;
    visibility.textContent = product.active ? "Tampil di toko" : "Disembunyikan";
    text.append(name, summary, visibility);
    details.append(image, text);

    const actions = document.createElement("div");
    actions.className = "admin-actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.dataset.action = "edit";
    edit.dataset.id = product.id;
    edit.textContent = "Edit";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.dataset.action = "delete";
    remove.dataset.id = product.id;
    remove.textContent = "Hapus";
    actions.append(edit, remove);
    row.append(details, actions);
    productList.append(row);
  });
}

async function loadProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, category, description, price, image_url, active")
    .order("created_at", { ascending: false });
  if (error) throw error;
  products = data || [];
  renderProducts();
  updateOverview();
}

function renderOrders() {
  orderList.replaceChildren();
  const query = orderSearch.value.trim().toLocaleLowerCase("id");
  const filter = orderFilter.value;
  const visibleOrders = orders.filter((order) => {
    const matchesSearch = [
      order.id,
      order.customer_name,
      order.customer_phone,
      order.customer_email || "",
    ].some((value) => value.toLocaleLowerCase("id").includes(query));
    return matchesSearch && (filter === "all" || order.status === filter);
  });

  if (!visibleOrders.length) {
    addEmptyMessage(
      orderList,
      orders.length ? "Pesanan tidak ditemukan untuk pencarian atau filter ini." : "Belum ada pesanan masuk.",
    );
    return;
  }

  visibleOrders.forEach((order) => {
    const row = document.createElement("article");
    row.className = "admin-order";
    const main = document.createElement("div");
    main.className = "admin-order-main";
    const topLine = document.createElement("div");
    topLine.className = "order-topline";
    const reference = document.createElement("strong");
    reference.textContent = `Pesanan #${order.id.slice(0, 8).toUpperCase()}`;
    const date = document.createElement("time");
    date.dateTime = order.created_at;
    date.textContent = new Date(order.created_at).toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    topLine.append(reference, date);

    const customer = document.createElement("p");
    customer.className = "order-customer";
    customer.textContent = `${order.customer_name} · ${order.customer_phone}${order.customer_email ? ` · ${order.customer_email}` : ""}`;
    const address = document.createElement("p");
    address.textContent = `Alamat: ${order.delivery_address}`;
    const total = document.createElement("p");
    total.className = "order-total";
    total.textContent = `Total ${rupiah.format(order.total_amount)}`;
    main.append(topLine, customer, address, total);

    const items = document.createElement("ul");
    items.className = "admin-order-items";
    (order.order_items || []).forEach((item) => {
      const line = document.createElement("li");
      line.textContent = `${item.name_snapshot} × ${item.quantity} (${rupiah.format(item.unit_price)})`;
      items.append(line);
    });
    main.append(items);

    if (order.notes) {
      const notes = document.createElement("p");
      notes.className = "order-notes";
      notes.textContent = `Catatan: ${order.notes}`;
      main.append(notes);
    }

    const status = document.createElement("select");
    status.className = `order-status status-${order.status}`;
    status.setAttribute("aria-label", `Status pesanan ${order.id.slice(0, 8)}`);
    Object.entries(statuses).forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      option.selected = value === order.status;
      status.append(option);
    });
    status.dataset.orderId = order.id;
    row.append(main, status);
    orderList.append(row);
  });
}

async function loadOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select("id, customer_name, customer_phone, customer_email, delivery_address, notes, total_amount, status, created_at, order_items(name_snapshot, unit_price, quantity)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  orders = data || [];
  renderOrders();
  updateOverview();
}

function resetProductForm() {
  productForm.elements.category.querySelectorAll("[data-legacy-category]").forEach((option) => option.remove());
  productForm.reset();
  productForm.elements.productId.value = "";
  productForm.elements.active.checked = true;
  productForm.elements.image.required = true;
  cancelEdit.hidden = true;
  formTitle.textContent = "Tambah produk baru";
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = loginForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  showMessage("Memeriksa akun...");

  try {
    const formData = new FormData(loginForm);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: formData.get("email"),
      password: formData.get("password"),
    });
    if (error) throw error;
    await showDashboard(data.user);
  } catch (error) {
    showMessage(`Tidak dapat masuk: ${error.message}`, true);
  } finally {
    submit.disabled = false;
  }
});

forgotPasswordButton.addEventListener("click", async () => {
  const emailInput = loginForm.elements.email;
  if (!emailInput.reportValidity()) return;

  forgotPasswordButton.disabled = true;
  showMessage("Mengirim tautan reset...");
  try {
    const redirectTo = new URL(`${window.location.pathname}?password-reset=1`, window.location.origin).href;
    const { error } = await supabase.auth.resetPasswordForEmail(emailInput.value.trim(), {
      redirectTo,
    });
    if (error) throw error;
    showMessage("Jika email terdaftar, tautan reset akan segera dikirim. Periksa juga folder spam.");
  } catch (error) {
    showMessage(`Tautan reset tidak dapat dikirim: ${error.message}`, true);
  } finally {
    forgotPasswordButton.disabled = false;
  }
});

passwordResetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = passwordResetForm.querySelector('button[type="submit"]');
  const formData = new FormData(passwordResetForm);
  const password = formData.get("password");
  if (password !== formData.get("passwordConfirmation")) {
    showMessage("Kata sandi dan konfirmasi belum sama.", true);
    return;
  }

  submit.disabled = true;
  showMessage("Menyimpan kata sandi baru...");
  try {
    const { data, error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    window.history.replaceState(null, "", window.location.pathname);
    passwordResetForm.reset();
    showMessage("Kata sandi berhasil diperbarui. Membuka dashboard...");
    await showDashboard(data.user);
  } catch (error) {
    showMessage(`Kata sandi tidak dapat diperbarui: ${error.message}`, true);
  } finally {
    submit.disabled = false;
  }
});

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    showLogin();
  } catch (error) {
    showMessage(`Tidak dapat keluar: ${error.message}`, true);
  } finally {
    logoutButton.disabled = false;
  }
});

cancelEdit.addEventListener("click", resetProductForm);
document.querySelector("#add-product-button").addEventListener("click", () => {
  resetProductForm();
  productEditor.scrollIntoView({ behavior: "smooth", block: "center" });
  productForm.elements.name.focus({ preventScroll: true });
});
productSearch.addEventListener("input", renderProducts);
productFilter.addEventListener("change", renderProducts);
orderSearch.addEventListener("input", renderOrders);
orderFilter.addEventListener("change", renderOrders);

document.querySelectorAll(".admin-nav a").forEach((link) => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".admin-nav a").forEach((item) => {
      item.classList.toggle("is-current", item === link);
    });
  });
});

refreshButton.addEventListener("click", async () => {
  refreshButton.disabled = true;
  showMessage("Memperbarui data...");
  try {
    await Promise.all([loadProducts(), loadOrders()]);
    showMessage("Data dashboard berhasil diperbarui.");
  } catch (error) {
    showMessage(`Data gagal diperbarui: ${error.message}`, true);
  } finally {
    refreshButton.disabled = false;
  }
});

productList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const product = products.find((item) => item.id === button.dataset.id);
  if (!product) return;

  if (button.dataset.action === "edit") {
    productForm.elements.productId.value = product.id;
    productForm.elements.name.value = product.name;
    const categorySelect = productForm.elements.category;
    if (currentCategoryValues.has(product.category)) {
      categorySelect.value = product.category;
    } else {
      const legacyOption = document.createElement("option");
      legacyOption.value = "";
      legacyOption.textContent = `Kategori lama: ${categories[product.category] || product.category} · pilih kategori baru`;
      legacyOption.disabled = true;
      legacyOption.selected = true;
      legacyOption.dataset.legacyCategory = "true";
      categorySelect.prepend(legacyOption);
      categorySelect.value = "";
    }
    productForm.elements.price.value = product.price;
    productForm.elements.description.value = product.description;
    productForm.elements.active.checked = product.active;
    productForm.elements.image.required = false;
    cancelEdit.hidden = false;
    formTitle.textContent = `Edit: ${product.name}`;
    productEditor.scrollIntoView({ behavior: "smooth", block: "center" });
    productForm.elements.name.focus({ preventScroll: true });
    return;
  }

  if (!window.confirm(`Hapus produk "${product.name}"?`)) return;
  button.disabled = true;
  try {
    const { error } = await supabase.from("products").delete().eq("id", product.id);
    if (error) throw error;
    showMessage("Produk berhasil dihapus.");
    await loadProducts();
  } catch (error) {
    showMessage(`Produk tidak dapat dihapus atau daftar gagal diperbarui: ${error.message}`, true);
    button.disabled = false;
  }
});

productForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = productForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  showMessage("Menyimpan produk...");

  const formData = new FormData(productForm);
  const productId = formData.get("productId");
  const selectedFile = formData.get("image");
  const existing = products.find((item) => item.id === productId);
  let uploadedPath = "";
  let productSaved = false;

  try {
    let imageUrl = existing ? existing.image_url : "";
    if (selectedFile.size > 0) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(selectedFile.type)) {
        throw new Error("Pilih foto berformat JPG, PNG, atau WebP.");
      }
      if (selectedFile.size > 5 * 1024 * 1024) {
        throw new Error("Ukuran foto maksimal 5 MB.");
      }

      const extension = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
      }[selectedFile.type];
      const path = `${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(path, selectedFile, { contentType: selectedFile.type, upsert: false });
      if (uploadError) throw uploadError;
      uploadedPath = path;
      imageUrl = supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
    }

    const productData = {
      name: String(formData.get("name")).trim(),
      category: formData.get("category"),
      description: String(formData.get("description") || "").trim(),
      price: Number(formData.get("price")),
      image_url: imageUrl,
      active: formData.get("active") === "on",
    };
    const result = productId
      ? await supabase.from("products").update(productData).eq("id", productId)
      : await supabase.from("products").insert(productData);
    if (result.error) throw result.error;
    productSaved = true;

    resetProductForm();
    try {
      await loadProducts();
      showMessage("Produk berhasil disimpan.");
    } catch (error) {
      showMessage(`Produk tersimpan, tetapi daftar gagal dimuat ulang: ${error.message}`, true);
    }
  } catch (error) {
    if (uploadedPath && !productSaved) {
      const { error: cleanupError } = await supabase.storage
        .from("product-images")
        .remove([uploadedPath]);
      if (cleanupError) {
        showMessage(`Produk tidak dapat disimpan: ${error.message}. Foto sementara juga gagal dihapus: ${cleanupError.message}`, true);
        return;
      }
    }
    showMessage(`Produk tidak dapat disimpan: ${error.message}`, true);
  } finally {
    submit.disabled = false;
  }
});

orderList.addEventListener("change", async (event) => {
  const select = event.target.closest("[data-order-id]");
  if (!select) return;
  const previousStatus = orders.find((order) => order.id === select.dataset.orderId)?.status;
  select.disabled = true;
  try {
    const { error } = await supabase
      .from("orders")
      .update({ status: select.value })
      .eq("id", select.dataset.orderId);
    if (error) throw error;
    const order = orders.find((item) => item.id === select.dataset.orderId);
    if (order) order.status = select.value;
    renderOrders();
    updateOverview();
    showMessage("Status pesanan diperbarui.");
  } catch (error) {
    select.value = previousStatus;
    showMessage(`Status pesanan tidak dapat diubah: ${error.message}`, true);
    select.disabled = false;
  }
});

async function initialize() {
  setLoginEnabled(false);
  showMessage("Menghubungkan ke Supabase...");
  ({ supabase } = await getSupabase());
  const authError = new URLSearchParams(window.location.hash.slice(1));
  if (authError.has("error")) {
    const expired = authError.get("error_code") === "otp_expired";
    window.history.replaceState(null, "", window.location.pathname);
    showLogin();
    showMessage(
      expired
        ? "Tautan reset sudah kedaluwarsa atau pernah digunakan. Minta tautan baru lewat Lupa kata sandi?"
        : "Tautan autentikasi tidak valid. Minta tautan baru dan buka segera setelah diterima.",
      true,
    );
    return;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (new URLSearchParams(window.location.search).get("password-reset") === "1") {
    if (!data.session) {
      showLogin();
      showMessage("Sesi reset tidak ditemukan atau sudah kedaluwarsa. Minta tautan baru lewat Lupa kata sandi?", true);
      return;
    }
    showPasswordReset();
    return;
  }
  if (!data.session) {
    setLoginEnabled(true);
    showMessage("");
    return;
  }
  await showDashboard(data.session.user);
}

initialize().catch((error) => {
  showLogin();
  showMessage(`Panel admin tidak dapat dimuat: ${error.message}`, true);
});
