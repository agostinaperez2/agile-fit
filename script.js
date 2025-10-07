// === CONFIGURACIÓN PRINCIPAL ===
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRrw-tt87mw8S_p8hCbedod-pwZMzXgJQ5Ey4-Hb_O_BpRpC9moQUP3CICLwYg9LT-vS825s7MiO6_y/pub?gid=9643623&single=true&output=csv";

const LINES = ["BERRY", "COCOA", "MERLOT"]; // categorías
const container = document.querySelector(".container");
const tituloLinea = document.getElementById("tituloLinea");

// URLs de las páginas de Jah Nisi
const JAH_URLS = {
  BERRY: "https://jahnisioriginals.com.ar/trascendencia/berry/",
  COCOA: "https://jahnisioriginals.com.ar/trascendencia/cocoa/",
  MERLOT: "https://jahnisioriginals.com.ar/trascendencia/merlot/",
};

// === FUNCIONES AUXILIARES ===
const currency = (n) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

const norm = (s) => (s || "").toString().trim().replace(/\s+/g, " ").toUpperCase();

// === FUNCIÓN PARA OBTENER FOTOS DESDE JAH NISI ===
async function obtenerFotos(linea) {
  const url = "https://r.jina.ai/http/" + JAH_URLS[linea].replace(/^https?:\/\//, "");
  try {
    const res = await fetch(url);
    const html = await res.text();
    const matches = [...html.matchAll(/<img[^>]+src="([^"]+)"[^>]*alt="([^"]*)"/gi)];
    const fotos = {};
    matches.forEach((m) => {
      const src = m[1];
      const alt = norm(m[2]);
      if (src && alt) fotos[alt] = src;
    });
    return fotos;
  } catch (e) {
    console.error("Error al obtener fotos de Jah Nisi:", e);
    return {};
  }
}

// === FUNCIÓN PRINCIPAL ===
async function cargarProductos(linea = "TODOS") {
  container.innerHTML = `<p>Cargando productos...</p>`;

  try {
    // 1. Cargar los datos desde Google Sheets
    const res = await fetch(SHEET_URL);
    const data = await res.text();
    const rows = data.split("\n").map((r) => r.split(","));
    const headers = rows.shift().map((h) => norm(h));
    const productos = rows.map((r) => {
      const obj = {};
      headers.forEach((h, i) => (obj[h] = r[i]));
      return obj;
    });

    // 2. Si no hay línea seleccionada, mostrar todos
    const filtrados =
      linea === "TODOS"
        ? productos
        : productos.filter((p) => norm(p.id_producto).includes(linea));

    if (!filtrados.length) {
      container.innerHTML = `<p>No hay productos disponibles en esta categoría.</p>`;
      return;
    }

    // 3. Obtener fotos desde Jah Nisi (solo de la línea seleccionada)
    let fotos = {};
    if (linea !== "TODOS") {
      fotos = await obtenerFotos(linea);
    } else {
      for (const l of LINES) {
        const f = await obtenerFotos(l);
        fotos = { ...fotos, ...f };
      }
    }

    // 4. Renderizar productos
    container.innerHTML = filtrados
      .map((p) => {
        const nombre = norm(p.id_producto);
        const img =
          fotos[nombre] ||
          "https://github.com/agostinaperez2/agile-fit/blob/main/ChatGPT%20Image%207%20oct%202025,%2004_56_26%20p.m..png?raw=true";

        return `
          <div class="card">
            <img src="${img}" alt="${p.id_producto}" />
            <h3>${p.id_producto}</h3>
            <p><b>Precio:</b> ${currency(p["Precio reventa"])}</p>
          </div>`;
      })
      .join("");
  } catch (err) {
    container.innerHTML = `<p>Error al cargar los productos 😢</p>`;
    console.error(err);
  }
}

// === BOTONES ===
document.querySelectorAll(".menu a").forEach((btn) => {
  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    const linea = norm(btn.textContent);
    tituloLinea.textContent = linea;
    await cargarProductos(linea);
  });
});

document.getElementById("btnRefrescar")?.addEventListener("click", () => {
  cargarProductos("TODOS");
});

// === INICIO ===
cargarProductos("TODOS");
