const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRrw-tt87mw8S_p8hCbedod-pwZMzXgJQ5Ey4-Hb_O_BpRpC9moQUP3CICLwYg9LT-vS825s7MiO6_y/pub?gid=9643623&single=true&output=csv";

const JAH_COLLECTIONS = {
  Berry: "https://jahnisioriginals.com.ar/trascendencia/berry/",
  Cocoa: "https://jahnisioriginals.com.ar/trascendencia/cocoa/",
  Merlot: "https://jahnisioriginals.com.ar/trascendencia/merlot/",
};

const norm = s => (s || "").toString().trim().replace(/\s+/g, " ").toUpperCase();

const formatPrice = n =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

async function loadSheet() {
  const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
  const text = await res.text();
  const lines = text.trim().split("\n");
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

async function getPhotos(line) {
  const url = "https://r.jina.ai/http/" + JAH_COLLECTIONS[line].replace(/^https?:\/\//, "");
  const html = await (await fetch(url)).text();
  const matches = [...html.matchAll(/<img[^>]+src="([^"]+)"[^>]*alt="([^"]*)"/gi)];
  const photos = {};
  matches.forEach(m => (photos[norm(m[2])] = m[1]));
  return photos;
}

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
      <img src="${img}" alt="${p.nombre}">
      <div class="card-info">
        <h3>${p.nombre}</h3>
        <p class="price">${formatPrice(p.precio)}</p>
      </div>`;
    grid.appendChild(card);
  });
}

document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeLine = btn.dataset.line;
    render();
  });
});

(async function init() {
  const base = await loadSheet();
  products = [];
  ["Berry", "Cocoa", "Merlot"].forEach(line => {
    base.forEach(p => products.push({ ...p, linea: line }));
  });

  for (const line of Object.keys(JAH_COLLECTIONS)) {
    const ph = await getPhotos(line);
    photos = { ...photos, ...ph };
  }

  render();
})();
