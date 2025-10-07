/* ====== CONFIG ====== */
/* CSV público de tu hoja “catalogo” (exactamente el que me pasaste) */
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRrw-tt87mw8S_p8hCbedod-pwZMzXgJQ5Ey4-Hb_O_BpRpC9moQUP3CICLwYg9LT-vS825s7MiO6_y/pub?gid=9643623&single=true&output=csv";

/* Rutas de colecciones (para autofotos/talles) */
const JAH_COLLECTIONS = {
  Berry: "https://jahnisioriginals.com.ar/trascendencia/berry/",
  Cocoa: "https://jahnisioriginals.com.ar/trascendencia/cocoa/",
  Merlot:"https://jahnisioriginals.com.ar/trascendencia/merlot/",
};

/* Si querés forzar talles de un producto específico, setealo acá:
   FORCED_SIZES["SUPPORT TOP BERRY"] = ["S","M","L"]; */
const FORCED_SIZES = {};

/* ====== UTIL ====== */
const currency = n => new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(Number(n||0));
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const norm = s => (s||"").toString().trim().replace(/\s+/g," ").toUpperCase();
function parseCSV(text){
  // Parser con comillas
  const out=[], lines = text.replace(/\r/g,"").split("\n");
  if(!lines[0]) return [];
  const headers = splitLine(lines[0]).map(h=>h.trim().toLowerCase());
  for(let i=1;i<lines.length;i++){
    const cells = splitLine(lines[i]);
    if(!cells.length || cells.every(x=>!x)) continue;
    const row={}; headers.forEach((h,idx)=> row[h] = (cells[idx]??"").trim());
    out.push(row);
  }
  return out;
}
function splitLine(line=""){
  const res=[]; let cur="", q=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c==='\"'){ if(q && line[i+1]==='\"'){ cur+='\"'; i++; } else { q=!q; } }
    else if(c===',' && !q){ res.push(cur); cur=""; }
    else cur+=c;
  }
  res.push(cur); return res;
}

/* ====== ESTADO ====== */
let products = [];                 // {nombre, precio, linea}
let imagesMap = {};                // nombre -> url imagen
let sizesMap  = {};                // nombre -> ["XS","S",...]
let activeLine = "Todos";
let cart = JSON.parse(localStorage.getItem("agile.cart")||"[]");
const saveCart = () => localStorage.setItem("agile.cart", JSON.stringify(cart));
const updateCartCount = () =>
  document.getElementById("cartCount")?.textContent = cart.reduce((s,i)=>s+i.qty,0);

/* ====== CARGA SHEET ====== */
async function loadSheet(){
  const res = await fetch(SHEET_CSV_URL);
  if(!res.ok) throw new Error("No pude leer el CSV publicado");
  const rows = parseCSV(await res.text());
  // Se esperan columnas con estos nombres exactos en la hoja: nombre, precio, linea
  return rows
    .map(r => ({ nombre:r.nombre, precio:r.precio, linea:r.linea }))
    .filter(p => p.nombre && p.precio && p.linea);
}

/* ====== SCRAPEO JAH NISI (solo lectura vía proxy para evitar CORS) ====== */
async function scrapeCollection(line){
  const url = JAH_COLLECTIONS[line];
  if(!url) return { images:{}, sizes:{} };
  const proxy = "https://r.jina.ai/http/" + url.replace(/^https?:\/\//,"");
  const html = await (await fetch(proxy)).text();

  const blocks = html.split(/<\/article>|<\/div>\s*<\/div>/i);
  const images = {}, sizes = {};
  for(const b of blocks){
    // Imagen (src o data-src)
    const imgMatch = b.match(/<img[^>]+(?:data-src|src)=\"([^\"]+)\"/i);
    let img = imgMatch ? imgMatch[1] : "";
    if(img && img.startsWith("//")) img = "https:" + img;

    // Título (div/h3/span con clases típicas)
    let title = "";
    const t1 = b.match(/class=\"[^\"]*(product-title|product__title|title)[^\"]*\"[^>]*>([\s\S]*?)<\/[^>]+>/i);
    if(t1) title = t1[2].replace(/<[^>]+>/g,"").trim();
    if(!title){
      const t2 = b.match(/<h\d[^>]*>([^<]+)<\/h\d>/i);
      if(t2) title = t2[1].trim();
    }
    if(!title) continue;

    // Talles detectados (si los listan)
    const talles = Array.from(new Set((b.match(/\b(XXS|XS|S|M|L|XL|XXL)\b/g)||[])));

    const key = norm(title); // p.ej. "SUPPORT TOP BERRY"
    if(img) images[key] = img;
    if(talles.length) sizes[key] = talles;
  }
  return { images, sizes };
}

/* “Fuzzy” por nombre+linea, o contiene */
function findBestImage(p, pool){
  const a = norm(p.nombre + " " + p.linea);
  if(pool[a]) return pool[a];
  const b = norm(p.nombre);
  if(pool[b]) return pool[b];
  // buscar por contiene
  const k = Object.keys(pool).find(k => k.includes(a) || a.includes(k));
  return k ? pool[k] : "";
}
function findSizes(p, pool){
  const a = norm(p.nombre + " " + p.linea);
  const b = norm(p.nombre);
  return pool[a] || pool[b] || ["XS","S","M","L","XL"];
}

/* ====== RENDER ====== */
function render(){
  document.getElementById("currentLine").textContent = activeLine;
  document.getElementById("tituloLinea").textContent = activeLine;
  const grid = document.getElementById("grid");
  grid.innerHTML = "";

  const list = products.filter(p =>
    activeLine==="Todos" ? true : norm(p.linea)===norm(activeLine)
  );

  list.forEach(p=>{
    const img = imagesMap[p.nombre] || "";
    const talles = (FORCED_SIZES[p.nombre] || sizesMap[p.nombre] || ["XS","S","M","L","XL"]).map(s=>`<option>${s}</option>`).join("");
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      ${img ? `<img src="${img}" alt="${p.nombre}">`
            : `<div style="height:260px;background:#f1f1f1;display:grid;place-items:center;color:#999">foto no disponible</div>`}
      <div style="display:flex;flex-direction:column;gap:6;margin-top:8px">
        <div style="font-size:14px">${p.nombre}</div>
        <div style="font-weight:600">${currency(p.precio)}</div>
        <div class="row">
          <select class="input talle">
            <option value="">Talle</option>
            ${talles}
          </select>
          <input class="input qty" type="number" min="1" value="1" style="width:90px"/>
        </div>
        <button class="btn add">Agregar</button>
      </div>
    `;
    const talleEl = card.querySelector(".talle");
    const qtyEl = card.querySelector(".qty");
    card.querySelector(".add").addEventListener("click", ()=>{
      const talle = talleEl.value;
      const qty = Number(qtyEl.value||1);
      if(!talle){ alert("Elegí un talle"); return; }
      const key = p.nombre + "|" + talle;
      const found = cart.find(i=> i.key===key);
      if(found) found.qty += qty;
      else cart.push({ key, nombre:p.nombre, talle, qty, precio:Number(p.precio||0) });
      saveCart(); updateCartCount();
    });
    grid.appendChild(card);
  });
}

/* ====== NAV/TABS ====== */
document.querySelectorAll(".tab")?.forEach(btn=>{
  if(btn.dataset.line==="Todos") btn.classList.add("active");
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
    activeLine = btn.dataset.line;
    render();
  });
});

/* ====== Talles modal ====== */
const modal = document.getElementById("modalTalles");
document.getElementById("tallesBtn")?.addEventListener("click", ()=> modal.classList.add("open"));
document.getElementById("cerrarTalles")?.addEventListener("click", ()=> modal.classList.remove("open"));

/* ====== Botones ====== */
document.getElementById("refrescar")?.addEventListener("click", render);
document.getElementById("autoFotos")?.addEventListener("click", async ()=>{
  // Scrapea cada colección y arma pools
  let poolImgs = {}, poolSizes = {};
  for(const line of ["Berry","Cocoa","Merlot"]){
    try{
      const { images, sizes } = await scrapeCollection(line);
      poolImgs = { ...poolImgs, ...images };
      poolSizes= { ...poolSizes, ...sizes  };
      await sleep(250);
    }catch(e){ /* ignorar */ }
  }
  // Asignar a cada producto por (nombre + línea)
  products.forEach(p=>{
    const img = findBestImage(p, poolImgs);
    if(img) imagesMap[p.nombre] = img;
    const sz = findSizes(p, poolSizes);
    if(sz?.length) sizesMap[p.nombre] = sz;
  });
  render();
});

/* ====== INIT ====== */
(async function init(){
  try{
    products = await loadSheet();   // nombres y precios EXACTOS desde tu hoja
  }catch(e){
    // Fallback mínimo
    products = [
      { nombre:"SUPPORT TOP BERRY", precio:24999, linea:"Berry" },
      { nombre:"LEGGING MERLOT",    precio:39999, linea:"Merlot" },
      { nombre:"BIKER COCOA",       precio:32999, linea:"Cocoa" },
    ];
  }
  updateCartCount();
  render();
})();
