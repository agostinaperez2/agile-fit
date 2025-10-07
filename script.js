const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRrw-tt87mw8S_p8hCbedod-pwZMzXgJQ5Ey4-Hb_O_BpRpC9moQUP3CICLwYg9LT-vS825s7MiO6_y/pub?gid=9643623&single=true&output=csv";

const JAH_COLLECTIONS = {
  Berry: "https://jahnisioriginals.com.ar/trascendencia/berry/",
  Cocoa: "https://jahnisioriginals.com.ar/trascendencia/cocoa/",
  Merlot: "https://jahnisioriginals.com.ar/trascendencia/merlot/",
};

// Normalizador para nombres
const norm = s => (s || "").toString().trim().replace(/\s+/g, " ").toUpperCase();

// Lee y convierte CSV en array de objetos
async function loadSheet() {
  const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
  const text = await res.text();
  const lines = text.trim().split("\n").map(l => l.trim());
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
  const data = lines.slice(1).map(line => {
    const values = line.split(",");
    const row = {};
    headers.forEach((h, i) => (row[h] = values[i]?.trim()));
    return row;
  });
  return data
    .filter(r => r["id_producto"])
    .map(r => ({
      nombre: r["id_producto"],
      precio: Number(r["precio reventa"]?.replace(/[^0-9]/g, "")) || 0,
    }));
}

// Busca fotos de Jah Nisi automáticamente
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

// Renderiza el catálogo
function renderCatalog(products, photos) {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";
  products.forEach(p => {
    const img = photos[norm(p.nombre)] || "logo.png";
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img src="${img}" alt="${p.nombre}">
      <div class="card-info">
        <h3>${p.nombre}</h3>
        <p class="price">$${p.precio.toLocaleString("es-AR")}</p>
      </div>
    `;
    grid.appendChild(card);
  });
}

// Inicializa todo
(async function init() {
  const products = await loadSheet();

  // Junta fotos de las tres líneas
  let photos = {};
  for (const line of Object.keys(JAH_COLLECTIONS)) {
    const ph = await getPhotos(line);
    photos = { ...photos, ...ph };
  }

  renderCatalog(products, photos);
})();
