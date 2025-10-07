/* ====== CONFIG ====== */
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRrw-tt87mw8S_p8hCbedod-pwZMzXgJQ5Ey4-Hb_O_BpRpC9moQUP3CICLwYg9LT-vS825s7MiO6_y/pub?gid=9643623&single=true&output=csv";

const JAH_COLLECTIONS = {
  Berry: "https://jahnisioriginals.com.ar/trascendencia/berry/",
  Cocoa: "https://jahnisioriginals.com.ar/trascendencia/cocoa/",
  Merlot: "https://jahnisioriginals.com.ar/trascendencia/merlot/",
};

const currency = n =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

const norm = s => (s || "").toString().trim().replace(/\s+/g, " ").toUpperCase();

/* ====== CARGA DE CSV ====== */
async function loadSheet() {
  const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
  const text = await res.text();
  const lines = text.trim().split("\n").map(l => l.trim());
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const vals = line.split(",");
    const row = {};
    headers.forEach((h, i) => (row[h] = vals[i]?.trim()));
    return {
      nombre: row["id_producto"],
      precio: Number(row["precio reventa"]?.replace(/[^0-9]/g, "")) || 0,
    };
  });
}

/* ====== FOTOS AUTOMÁTICAS ====== */
async function getPhotos(line) {
  const url = "https://r.jina.ai/http/" + JAH_COLLECTIONS[line].replace(/^https?:\/\//, "");
  const html = await (await fetch(url)).text();
  const matches = [...html.matchAll(/<img[^>]+src="([^"]+)"[^>]*alt="([^"]*)"/gi)];
  const photos = {};
  matches.forEach(m => {
    const src = m[1];
    const name = norm(m[2]);
    if (src && name) photos[name] = src;
  });
  return photos;
}

/* ====== RENDER ====== */
let products = [];
let photos = {};
let activeLine = "Todos";

function render() {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";

  const list =
    activeLine === "Todos"
      ? products
      : products.filter(p => norm(p.linea) === norm(activeLine));

  list.forEach(p => {
    const img = photos[norm(p.nombre)] || "logo.png";
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img src="${img}" alt="${p.nombre}" style="object-fit:cover;height:340px;width:100%">
      <div class="card-info">
        <h3>${p.nombre}</h3>
        <p class="price">${currency(p.precio)}</p>
        <select class="input talle">
          <option value="">Talle</option>
          <option>XS</option><option>S</option><option>M</option><option>L</option><option>XL</option>
        </select>
        <button class="btn">Agregar al carrito</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

/* ====== NAVEGACIÓN ====== */
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeLine = btn.dataset.line;
    render();
  });
});

/* ====== INICIO ====== */
(async function init() {
  // 1️⃣ Cargar hoja
  const base = await loadSheet();

  // 2️⃣ Duplicar productos por línea (Berry, Cocoa, Merlot)
  products = [];
  ["Berry", "Cocoa", "Merlot"].forEach(line => {
    base.forEach(p => products.push({ ...p, linea: line }));
  });

  // 3️⃣ Traer fotos automáticas
  for (const line of Object.keys(JAH_COLLECTIONS)) {
    const ph = await getPhotos(line);
    photos = { ...photos, ...ph };
  }

  // 4️⃣ Render inicial
  render();
})();
