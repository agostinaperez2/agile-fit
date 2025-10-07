// === CONFIGURACIÓN PRINCIPAL ===
const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRrw-tt87mw8S_p8hCbedod-pwZMzXgJQ5Ey4-Hb_O_BpRpC9moQUP3CICLwYg9LT-vS825s7MiO6_y/pub?gid=9643623&single=true&output=csv";

const LINES = ["BERRY", "COCOA", "MERLOT"]; // categorías
const container = document.querySelector(".container");
const tituloLinea = document.getElementById("tituloLinea");

// === FUNCIONES AUXILIARES ===
const currency = (n) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const norm = (s) => (s || "").toString().trim().replace(/\s+/g, " ").toUpperCase();

// === FUNCIÓN PRINCIPAL ===
async function cargarProductos(linea = "TODOS") {
  container.innerHTML = `<p>Cargando productos...</p>`;

  try {
    const res = await fetch(SHEET_URL);
    const data = await res.text();
    const rows = data.split("\n").map((r) => r.split(","));
    const headers = rows.shift().map((h) => norm(h));
    const productos = rows.map((r) => {
      const obj = {};
      headers.forEach((h, i) => (obj[h] = r[i]));
      return obj;
    });

    // Filtrar por línea (Berry, Cocoa, Merlot o todos)
    const filtrados =
      linea === "TODOS"
        ? productos
        : productos.filter((p) => norm(p.id_producto).includes(linea));

    if (!filtrados.length) {
      container.innerHTML = `<p>No hay productos disponibles en esta categoría.</p>`;
      return;
    }

    container.innerHTML = filtrados
      .map(
        (p) => `
      <div class="card">
        <img src="https://github.com/agostinaperez2/agile-fit/blob/main/ChatGPT%20Image%207%20oct%202025,%2004_56_26%20p.m..png?raw=true" alt="${p.id_producto}" />
        <h3>${p.id_producto}</h3>
        <p><b>Precio:</b> ${currency(p["Precio reventa"])}</p>
      </div>`
      )
      .join("");
  } catch (err) {
    container.innerHTML = `<p>Error al cargar los productos 😢</p>`;
    console.error(err);
  }
}

// === BOTONES ===
document.querySelectorAll(".menu a").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    const linea = norm(btn.textContent);
    tituloLinea.textContent = linea;
    cargarProductos(linea);
  });
});

document.getElementById("btnRefrescar")?.addEventListener("click", () => {
  cargarProductos("TODOS");
});

document.getElementById("btnAutofotos")?.addEventListener("click", () => {
  alert("Esta función estará disponible pronto 📸");
});

// === INICIO ===
cargarProductos("TODOS");
