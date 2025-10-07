/* ========= CONFIG ========= */
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRrw-tt87mw8S_p8hCbedod-pwZMzXgJQ5Ey4-Hb_O_BpRpC9moQUP3CICLwYg9LT-vS825s7MiO6_y/pub?gid=9643623&single=true&output=csv";

const LINES = ["Berry", "Cocoa", "Merlot"];
const JAH_COLLECTIONS = {
  Berry:  "https://jahnisioriginals.com.ar/trascendencia/berry/",
  Cocoa:  "https://jahnisioriginals.com.ar/trascendencia/cocoa/",
  Merlot: "https://jahnisioriginals.com.ar/trascendencia/merlot/",
};
// Si querés forzar talles puntuales por producto, cargalos acá (clave = nombre base):
// const FORCED_SIZES = { "LEG SHORT": ["S","M","L"] };
const FORCED_SIZES = {};

/* ========= UTILS ========= */
const currency = (n) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

const norm = (s) =>
  (s || "").toString().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

function parseCSV(text) {
  const out = [];
  const lines = text.replace(/\r/g, "").split("\n");
  if (!lines[0]) return out;
  const headers = splitLine(lines[0]).map((h) => h.trim().toLowerCase());
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    if (!cells.length || cells.every((x) => !x)) continue;
    const row = {};
    headers.forEach((h, idx) => (row[h] = (cells[idx] ?? "").trim()));
    out.push(row);
  }
  return out;
}
function splitLine(line = "") {
  const res = [];
  let cur = "",
    q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        q = !q;
      }
    } else if (c === "," && !q) {
      res.push(cur);
      cur = "";
    } else cur += c;
  }
  res.push(cur);
  return res;
}

/* ========= STATE ========= */
let products = [];                      // { nombreBase, precio, linea, displayName }
let imagesPool = {};                    // key (NOMBRE+LINEA) -> imageURL
let sizesPool  = {};                    // key (NOMBRE+LINEA) -> [talles]
let activeLine = "Todos";
let cart = JSON.parse(localStorage.getItem("agile.cart") || "[]");
const saveCart = () => localStorage.setItem("agile.cart", JSON.stringify(cart));
const updateCartCount = () =>
  (document.getElementById("cartCount").textContent = cart.reduce((s, i) => s + i.qty, 0));

/* ========= DOM ========= */
const grid = document.getElementById("grid");
const currentLineEl = document.getElementById("currentLine");
const tituloLineaEl = document.getElementById("tituloLinea");
const modal = document.getElementById("modalTalles");

/* ========= SHEET LOAD ========= */
async function loadSheet() {
  const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("No pude leer el CSV publicado");
  const rows = parseCSV(await res.text());

  // columnas esperadas en tu hoja: id_producto, costo, precio reventa, ganancia, %
  const base = rows
    .filter((r) => r["id_producto"] && r["precio reventa"])
    .map((r) => ({
      nombreBase: r["id_producto"].trim(), // p.ej. "LEG SHORT"
      precio: Number(String(r["precio reventa"]).replace(/[^0-9]/g, "")),
    }));

  // Generar variantes por línea (Berry, Cocoa, Merlot)
  const full = [];
  for (const p of base) {
    for (const linea of LINES) {
      full.push({
        ...p,
        linea,
        displayName: `${p.nombreBase} ${linea}`.trim(),
      });
    }
  }
  return full;
}

/* ========= SCRAPING DE FOTOS (auto al cargar) =========
   Usamos un proxy de solo-lectura (r.jina.ai) para evitar CORS
   y extraemos <img> + título aproximado de cada card de producto.
*/
async function scrapeCollection(line) {
  const url = JAH_COLLECTIONS[line];
  if (!url) return { images: {}, sizes: {} };
  const proxy = "https://r.jina.ai/http/" + url.replace(/^https?:\/\//, "");
  const html = await (await fetch(proxy, { cache: "no-store" })).text();

  const blocks = html.split(/<\/article>|<\/div>\s*<\/div>/i);
  const images = {};
  const sizes = {};
  for (const b of blocks) {
    // Imagen (src o data-src)
    const imgMatch = b.match(/<img[^>]+(?:data-src|src)=\"([^\"]+)\"/i);
    let img = imgMatch ? imgMatch[1] : "";
    if (img && img.startsWith("//")) img = "https:" + img;

    // Título aproximado
    let title = "";
    const t1 = b.match(
      /class=\"[^\"]*(product-title|product__title|title)[^\"]*\"[^>]*>([\s\S]*?)<\/[^>]+>/i
    );
    if (t1) title = t1[2].replace(/<[^>]+>/g, "").trim();
    if (!title) {
      const t2 = b.match(/<h\d[^>]*>([^<]+)<\/h\d>/i);
      if (t2) title = t2[1].trim();
    }
    if (!title) continue;

    // Talles detectados (si están en la card)
    const talles = Array.from(
      new Set((b.match(/\b(XXS|XS|S|M|L|XL|XXL)\b/g) || []))
    );

    const key = norm(title); // ej: "LEG SHORT BERRY"
    if (img) images[key] = img;
    if (talles.length) sizes[key] = talles;
  }
  return { images, sizes };
}

function pickImageFor(p, pool) {
  const a = norm(p.displayName);     // "LEG SHORT BERRY"
  const b = norm(p.nombreBase);      // "LEG SHORT"
  if (pool[a]) return pool[a];
  if (pool[b]) return pool[b];
  const k = Object.keys(pool).find((k) => k.includes(a) || a.includes(k));
  return k ? pool[k] : "";
}
function pickSizesFor(p, pool) {
  const a = norm(p.displayName);
  const b = norm(p.nombreBase);
  return pool[a] || pool[b] || FORCED_SIZES[p.nombreBase] || ["XS", "S", "M", "L", "XL"];
}

/* ========= RENDER ========= */
function render() {
  currentLineEl.textContent = activeLine;
  tituloLineaEl.textContent = activeLine;
  grid.innerHTML = "";

  const list = products.filter((p) =>
    activeLine === "Todos" ? true : p.linea.toLowerCase() === activeLine.toLowerCase()
  );

  list.forEach((p) => {
    const key = norm(p.displayName);
    const img = imagesPool[key] || "";
    const talles = pickSizesFor(p, sizesPool);

    const card = document.createElement("div");
    card.className = "card";
    card.dataset.key = key;

    card.innerHTML = `
      ${
        img
          ? `<img src="${img}" alt="${p.displayName}">`
          : `<div class="noimg" style="height:340px;background:#f1f1f1;display:grid;place-items:center;color:#999">foto no disponible</div>`
      }
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">
        <div style="font-size:14px">${p.displayName}</div>
        <div style="font-weight:600">${currency(p.precio)}</div>
        <div class="row">
          <select class="input talle">
            <option value="">Talle</option>
            ${talles.map((s) => `<option>${s}</option>`).join("")}
          </select>
          <input class="input qty" type="number" min="1" value="1" style="width:90px"/>
        </div>
        <button class="btn add">Agregar</button>
      </div>
    `;

    const talleEl = card.querySelector(".talle");
    const qtyEl = card.querySelector(".qty");
    card.querySelector(".add").addEventListener("click", () => {
      const talle = talleEl.value;
      const qty = Number(qtyEl.value || 1);
      if (!talle) {
        alert("Elegí un talle");
        return;
      }
      const ckey = p.displayName + "|" + talle;
      const found = cart.find((i) => i.key === ckey);
      if (found) found.qty += qty;
      else cart.push({ key: ckey, nombre: p.nombreBase, linea: p.linea, talle, qty, precio: p.precio });
      saveCart();
      updateCartCount();
    });

    grid.appendChild(card);
  });
}

/* ========= PROGRESIVO: Cargar fotos automáticamente al iniciar ========= */
async function hydrateImages() {
  // Re-scrapear SIEMPRE para estar actualizado (sin caché local)
  let poolImgs = {};
  let poolSizes = {};
  for (const line of LINES) {
    try {
      const { images, sizes } = await scrapeCollection(line);
      // Fusionar
      poolImgs = { ...poolImgs, ...images };
      poolSizes = { ...poolSizes, ...sizes };
    } catch (e) {
      // ignoramos errores de scraping
    }
  }
  // Asignar imagen/talles por producto y refrescar progresivamente
  products.forEach((p) => {
    const key = norm(p.displayName);
    const img = pickImageFor(p, poolImgs);
    if (img) {
      imagesPool[key] = img;
      // si ya existe la card en DOM, actualizá solo la imagen
      const card = grid.querySelector(`[data-key="${key}"]`);
      if (card) {
        const holder = card.querySelector(".noimg");
        if (holder) {
          holder.outerHTML = `<img src="${img}" alt="${p.displayName}" style="width:100%;height:340px;object-fit:cover;background:#f5f5f5">`;
        }
      }
    }
    const sz = pickSizesFor(p, poolSizes);
    if (sz?.length) sizesPool[p.nombreBase] = sz;
  });
}

/* ========= TABS / MODAL ========= */
document.querySelectorAll(".tab").forEach((btn) => {
  if (btn.dataset.line === "Todos") btn.classList.add("active");
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
    btn.classList.add("active");
    activeLine = btn.dataset.line;
    render();
  });
});
document.getElementById("tallesBtn")?.addEventListener("click", () => modal.classList.add("open"));
document.getElementById("cerrarTalles")?.addEventListener("click", () => modal.classList.remove("open"));

/* ========= INIT ========= */
(async function init() {
  try {
    products = await loadSheet();           // carga nombres/precios
  } catch (e) {
    // fallback mínimo
    products = [
      { nombreBase: "SUPPORT TOP", precio: 24999, linea: "Berry", displayName: "SUPPORT TOP Berry" },
      { nombreBase: "LEGGING",     precio: 39999, linea: "Merlot", displayName: "LEGGING Merlot" },
      { nombreBase: "BIKER",       precio: 32999, linea: "Cocoa",  displayName: "BIKER Cocoa"  },
    ];
  }
  updateCartCount();
  render();               // muestra todo (sin fotos aún)
  hydrateImages();        // trae fotos reales y las va colocando progresivamente
})();
