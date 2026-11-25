import { getSupabase } from "./supabase.js";

const loginSection = document.querySelector("#admin-login");
const dashboard = document.querySelector("#admin-dashboard");
const loginForm = document.querySelector("#login-form");
const productForm = document.querySelector("#product-form");
const productList = document.querySelector("#admin-product-list");
const orderList = document.querySelector("#admin-order-list");
const message = document.querySelector("#admin-message");
const loginMessage = document.querySelector("#login-message");
const logoutButton = document.querySelector("#logout-button");
const cancelEdit = document.querySelector("#cancel-edit");
const formTitle = document.querySelector("#product-form-title");

const categories = {
  romantis: "Romantis",
  selamat: "Perayaan",
  sederhana: "Untuk diri sendiri",
};
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
let supabase;

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
  showMessage("");
}

async function showDashboard(user) {
  const { data: admin, error } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!admin) {
    await supabase.auth.signOut();
    showLogin();
    showMessage("Akun ini belum diberi akses admin.", true);
    return;
  }

  loginSection.hidden = true;
  dashboard.hidden = false;
  showMessage("");
  await Promise.all([loadProducts(), loadOrders()]);
}

function addEmptyMessage(container, text) {
  const empty = document.createElement("p");
  empty.className = "admin-empty";
  empty.textContent = text;
  container.append(empty);
}

function renderProducts() {
  productList.replaceChildren();
  if (!products.length) {
    addEmptyMessage(productList, "Belum ada produk.");
    return;
  }

  products.forEach((product) => {
    const row = document.createElement("article");
    row.className = "admin-product";
    const details = document.createElement("div");
    details.className = "admin-product-details";
    const image = document.createElement("img");
    image.src = product.image_url;
    image.alt = "";
    const text = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = product.name;
    const summary = document.createElement("span");
    summary.textContent = `${categories[product.category] || product.category} · ${rupiah.format(product.price)} · ${product.active ? "Aktif" : "Disembunyikan"}`;
    text.append(name, summary);
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
}

function renderOrders(orders) {
  orderList.replaceChildren();
  if (!orders.length) {
    addEmptyMessage(orderList, "Belum ada pesanan masuk.");
    return;
  }

  orders.forEach((order) => {
    const row = document.createElement("article");
    row.className = "admin-order";
    const main = document.createElement("div");
    main.className = "admin-order-main";
    const reference = document.createElement("strong");
    reference.textContent = `Pesanan ${order.id.slice(0, 8)}`;
    const customer = document.createElement("p");
    customer.textContent = `${order.customer_name} · ${order.customer_phone}${order.customer_email ? ` · ${order.customer_email}` : ""}`;
    const address = document.createElement("p");
    address.textContent = `Alamat: ${order.delivery_address}`;
    const total = document.createElement("p");
    total.textContent = `${rupiah.format(order.total_amount)} · ${new Date(order.created_at).toLocaleString("id-ID")}`;
    main.append(reference, customer, address, total);

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
      notes.textContent = `Catatan: ${order.notes}`;
      main.append(notes);
    }

    const status = document.createElement("select");
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
  renderOrders(data || []);
}

function resetProductForm() {
  productForm.reset();
  productForm.elements.productId.value = "";
  productForm.elements.active.checked = true;
  productForm.elements.image.required = true;
  cancelEdit.hidden = true;
  formTitle.textContent = "Tambah produk";
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

logoutButton.addEventListener("click", async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    showLogin();
  } catch (error) {
    showMessage(`Tidak dapat keluar: ${error.message}`, true);
  }
});

cancelEdit.addEventListener("click", resetProductForm);

productList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const product = products.find((item) => item.id === button.dataset.id);
  if (!product) return;

  if (button.dataset.action === "edit") {
    productForm.elements.productId.value = product.id;
    productForm.elements.name.value = product.name;
    productForm.elements.category.value = product.category;
    productForm.elements.price.value = product.price;
    productForm.elements.description.value = product.description;
    productForm.elements.active.checked = product.active;
    productForm.elements.image.required = false;
    cancelEdit.hidden = false;
    formTitle.textContent = `Edit: ${product.name}`;
    productForm.scrollIntoView({ behavior: "smooth", block: "center" });
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
  select.disabled = true;
  try {
    const { error } = await supabase
      .from("orders")
      .update({ status: select.value })
      .eq("id", select.dataset.orderId);
    if (error) throw error;
    showMessage("Status pesanan diperbarui.");
  } catch (error) {
    showMessage(`Status pesanan tidak dapat diubah: ${error.message}`, true);
    select.disabled = false;
    return;
  }
  select.disabled = false;
});

async function initialize() {
  ({ supabase } = await getSupabase());
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) return;
  await showDashboard(data.session.user);
}

initialize().catch((error) => {
  showLogin();
  showMessage(`Panel admin tidak dapat dimuat: ${error.message}`, true);
  loginForm.querySelectorAll("input, button").forEach((control) => {
    control.disabled = true;
  });
});
