const STORE = "bom-studio-v1";
const FIELDS = ["category", "item", "description", "qty", "unit", "material", "labor", "supplier", "lead", "notes"];
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
let state = null;
let seed = null;
let pdfFile = null;
let saveTimer = null;

const blankItem = () => ({
  category: "", item: "", description: "", qty: 1, unit: "pcs",
  material: 0, labor: 0, supplier: "", lead: "", notes: "",
});

const FABRICATION = {
  project: "Metal / wood / glass — planning BOM",
  notes: "Planning estimate. Replace with supplier quotes. Blank fields require input.",
  settings: { overhead: 10, contingency: 5, margin: 25, vat: 20 },
  items: [
    { category: "Metal work", item: "Aluminium frame profile 2020", description: "Frame material", qty: 1, unit: "set", material: 12000, labor: 6000, supplier: "", lead: "", notes: "estimate" },
    { category: "Metal work", item: "Steel brackets and fasteners", description: "Connections", qty: 1, unit: "set", material: 2500, labor: 0, supplier: "", lead: "", notes: "estimate" },
    { category: "Wood work", item: "Plywood base and panels", description: "Base and side panels", qty: 1, unit: "set", material: 4500, labor: 4500, supplier: "", lead: "", notes: "estimate" },
    { category: "Glass work", item: "Tempered glass scan surface", description: "Top surface; edge polished", qty: 1, unit: "pcs", material: 8000, labor: 3500, supplier: "", lead: "", notes: "estimate; dimensions blank" },
    { category: "Finish", item: "Paint and consumables", description: "Surface finishing", qty: 1, unit: "set", material: 2500, labor: 2500, supplier: "", lead: "", notes: "estimate" },
  ],
};

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const num = v => {
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
};
const sym = () => ({ RUB: "₽", USD: "$", EUR: "€", CNY: "¥", KZT: "₸" }[state.currency] || state.currency);
const fmt = v => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(v) || 0) + " " + sym();

function calc() {
  const materials = state.items.reduce((a, i) => a + num(i.qty) * num(i.material), 0);
  const labor = state.items.reduce((a, i) => a + num(i.qty) * num(i.labor), 0);
  const subtotal = materials + labor;
  const overhead = subtotal * num(state.settings.overhead) / 100;
  const contingency = subtotal * num(state.settings.contingency) / 100;
  const cost = subtotal + overhead + contingency;
  const margin = cost * num(state.settings.margin) / 100;
  const preVat = cost + margin;
  const vat = preVat * num(state.settings.vat) / 100;
  const grand = preVat + vat;
  return { materials, labor, subtotal, overhead, contingency, cost, margin, preVat, vat, grand };
}

function setStatus(text) { $("#status").textContent = text; }

function persistSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveLocal, 350);
}
function saveLocal() {
  localStorage.setItem(STORE, JSON.stringify(state));
  setStatus("Saved locally · " + new Date().toLocaleTimeString());
}

function normalize(data) {
  const d = data || {};
  return {
    project: d.project || "Untitled BOM",
    client: d.client || "",
    prepared_by: d.prepared_by || "",
    date: d.date || "",
    revision: d.revision || "",
    currency: d.currency || "RUB",
    notes: d.notes || "",
    settings: { overhead: 10, contingency: 5, margin: 25, vat: 20, ...(d.settings || {}) },
    items: Array.isArray(d.items) && d.items.length ? d.items.map(i => ({ ...blankItem(), ...i })) : [blankItem()],
  };
}

function renderMeta() {
  $$("[data-meta]").forEach(el => {
    const key = el.dataset.meta;
    el.value = state[key] ?? "";
  });
  $$("[data-setting]").forEach(el => {
    el.value = state.settings[el.dataset.setting] ?? 0;
  });
}

function renderTable() {
  $("#bom-body").innerHTML = state.items.map((it, i) => {
    const line = num(it.qty) * (num(it.material) + num(it.labor));
    return `<tr data-i="${i}">
      <td class="idx">${i + 1}</td>
      ${FIELDS.map(f => `<td class="${f === "qty" || f === "material" || f === "labor" || f === "lead" ? "num" : ""}">
        <input data-i="${i}" data-field="${f}" value="${esc(it[f])}" inputmode="${f === "qty" || f === "material" || f === "labor" ? "decimal" : "text"}" />
      </td>`).join("")}
      <td class="total" data-line-total="${i}">${fmt(line)}</td>
      <td><div class="row-actions">
        <button class="icon-btn" data-dup="${i}" title="Duplicate">⧉</button>
        <button class="icon-btn" data-del="${i}" title="Delete">×</button>
      </div></td>
    </tr>`;
  }).join("");
  $("#line-count").textContent = `${state.items.length} lines`;
}

function renderSummary() {
  const c = calc();
  $("#stat-material").textContent = fmt(c.materials);
  $("#stat-labor").textContent = fmt(c.labor);
  $("#stat-cost").textContent = fmt(c.cost);
  $("#stat-grand").textContent = fmt(c.grand);
  const rows = [
    ["Material", c.materials], ["Labour", c.labor], ["Subtotal", c.subtotal],
    [`Overhead ${state.settings.overhead}%`, c.overhead],
    [`Contingency ${state.settings.contingency}%`, c.contingency],
    ["Total cost", c.cost],
    [`Margin ${state.settings.margin}%`, c.margin],
    ["Price before VAT", c.preVat],
    [`VAT ${state.settings.vat}%`, c.vat],
  ];
  $("#summary").innerHTML = rows.map(([l, v]) => `<div class="summary-row"><span>${esc(l)}</span><b>${fmt(v)}</b></div>`).join("")
    + `<div class="summary-row total"><span>Grand total</span><b>${fmt(c.grand)}</b></div>`;

  const target = num($("#target-price").value);
  const diff = c.grand - target;
  const v = $("#variance");
  if (!target) {
    v.textContent = "Enter a target price.";
    v.className = "variance";
  } else if (diff <= 0) {
    v.textContent = `Under target by ${fmt(Math.abs(diff))}.`;
    v.className = "variance good";
  } else {
    v.textContent = `Over target by ${fmt(diff)}.`;
    v.className = "variance bad";
  }
}

function renderHealth() {
  const missing = state.items.filter(i => num(i.material) === 0 && num(i.labor) === 0).length;
  const noSupplier = state.items.filter(i => !String(i.supplier || "").trim()).length;
  const noLead = state.items.filter(i => !String(i.lead || "").trim()).length;
  const estimated = state.items.filter(i => /estimate/i.test(i.notes || "")).length;
  const items = [
    ["Lines", state.items.length, ""],
    ["Missing cost", missing, missing ? "warning" : "ok"],
    ["No supplier", noSupplier, noSupplier ? "warning" : "ok"],
    ["No lead time", noLead, ""],
    ["Estimated prices", estimated, ""],
  ];
  $("#health").innerHTML = items.map(([l, n, cls]) => `<div class="health-item"><span>${l}</span><b class="${cls}">${n}</b></div>`).join("")
    + `<span class="hint">Blank fields are allowed and are excluded from calculations.</span>`;
}

function updateLineTotals() {
  state.items.forEach((it, i) => {
    const cell = $(`[data-line-total="${i}"]`);
    if (cell) cell.textContent = fmt(num(it.qty) * (num(it.material) + num(it.labor)));
  });
}

function renderAll() {
  renderMeta();
  renderTable();
  renderSummary();
  renderHealth();
}

function addItem() {
  state.items.push(blankItem());
  renderTable();
  renderSummary();
  renderHealth();
  persistSoon();
  $(".table-scroll").scrollTop = $(".table-scroll").scrollHeight;
}

function download(name, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function exportJson() {
  download("bom.json", JSON.stringify(state, null, 2), "application/json");
}
function exportCsv() {
  const head = ["category", "item", "description", "qty", "unit", "material", "labor", "line_total", "supplier", "lead", "notes"];
  const lines = [head.join(",")].concat(state.items.map(i =>
    head.map(k => `"${String(k === "line_total" ? num(i.qty) * (num(i.material) + num(i.labor)) : i[k] ?? "").replace(/"/g, '""')}"`).join(",")
  ));
  download("bom.csv", "\uFEFF" + lines.join("\n"), "text/csv;charset=utf-8");
}

function printBom() {
  const c = calc();
  const head = ["#", "Category", "Item", "Description", "Qty", "Unit", "Material", "Labour", "Line total", "Supplier", "Lead", "Notes"];
  const rows = state.items.map((i, n) => [
    n + 1, i.category, i.item, i.description, i.qty, i.unit, i.material, i.labor,
    num(i.qty) * (num(i.material) + num(i.labor)), i.supplier, i.lead, i.notes
  ]);
  const sum = [
    ["Material", c.materials], ["Labour", c.labor], ["Subtotal", c.subtotal],
    ["Overhead", c.overhead], ["Contingency", c.contingency], ["Total cost", c.cost],
    ["Margin", c.margin], ["Price before VAT", c.preVat], ["VAT", c.vat], ["Grand total", c.grand],
  ];
  $("#print-area").innerHTML = `
    <h1>${esc(state.project || "Bill of Materials")}</h1>
    <div class="meta">Client: ${esc(state.client || "________")} · Prepared by: ${esc(state.prepared_by || "________")} · Date: ${esc(state.date || "________")} · Revision: ${esc(state.revision || "________")} · Currency: ${esc(state.currency)}</div>
    <table><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>
    ${rows.map(r => `<tr>${r.map(v => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}
    </tbody></table>
    <div class="sum">${sum.map(([l, v]) => `<div><span>${esc(l)}</span><b>${fmt(v)}</b></div>`).join("")}</div>
    <p style="font-size:8pt;color:#555">${esc(state.notes || "")}</p>`;
  window.print();
}

async function exportDocx() {
  try {
    if (!window.htmlDocx) {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/html-docx-js/dist/html-docx.js";
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    const c = calc();
    const head = ["#", "Category", "Item", "Description", "Qty", "Unit", "Material", "Labour", "Line total", "Supplier", "Lead", "Notes"];
    const rows = state.items.map((i, n) => [
      n + 1, i.category, i.item, i.description, i.qty, i.unit, i.material, i.labor,
      num(i.qty) * (num(i.material) + num(i.labor)), i.supplier, i.lead, i.notes
    ]);
    const html = `<html><body>
      <h1>${esc(state.project || "Bill of Materials")}</h1>
      <p>Client: ${esc(state.client || "")} · Prepared by: ${esc(state.prepared_by || "")} · Date: ${esc(state.date || "")} · Revision: ${esc(state.revision || "")} · Currency: ${esc(state.currency)}</p>
      <table border="1" cellspacing="0" cellpadding="4"><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>
      ${rows.map(r => `<tr>${r.map(v => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table>
      <p><b>Grand total:</b> ${fmt(c.grand)}</p>
      <p>${esc(state.notes || "")}</p></body></html>`;
    const blob = window.htmlDocx.asBlob(html, { orientation: "landscape" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "bom.docx";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  } catch (err) {
    alert("DOCX export is unavailable offline. Use Export PDF, or the bundled sample DOCX.");
  }
}

function parsePdfLines(text) {
  const out = [];
  text.split(/\r?\n/).forEach(raw => {
    const line = raw.trim();
    if (!line) return;
    const parts = line.split(/\s{2,}|\t+/).map(s => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const nums = parts.map(p => p.replace(/[^\d.,-]/g, "")).filter(Boolean);
      const qty = nums.length ? Math.max(1, Math.round(num(nums[0]))) : 1;
      const price = nums.length > 1 ? num(nums[nums.length - 1]) : 0;
      out.push({ ...blankItem(), item: parts[0], description: parts.slice(1).join(" "), qty, material: price, notes: "imported from PDF" });
    }
  });
  return out;
}

async function extractPdf() {
  if (!pdfFile) return;
  try {
    const pdfjs = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
    const pdf = await pdfjs.getDocument({ data: await pdfFile.arrayBuffer() }).promise;
    let text = "";
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      text += content.items.map(i => i.str).join(" ") + "\n";
    }
    $("#pdf-text").value = text;
    $("#pdf-modal").hidden = false;
  } catch (e) {
    alert("Could not extract PDF text. The file can still be kept as an attachment; use JSON/CSV import or manual entry.");
  }
}

function applyTemplate(name) {
  if (name === "blank") {
    state = normalize({ project: "Untitled BOM", items: [blankItem()] });
  } else if (name === "fabrication") {
    state = normalize(FABRICATION);
  } else {
    state = normalize(seed || { project: "Scanner enclosure — planning BOM", items: [blankItem()] });
  }
  renderAll();
  persistSoon();
}

async function boot() {
  try {
    seed = await (await fetch("bom/scanner-bom.json")).json();
  } catch (e) {
    seed = { project: "Scanner enclosure — planning BOM", items: [blankItem()] };
  }
  const saved = localStorage.getItem(STORE);
  state = saved ? normalize(JSON.parse(saved)) : normalize(seed);
  renderAll();
  setStatus("Local draft");

  $$("[data-meta]").forEach(el => el.addEventListener("input", () => {
    state[el.dataset.meta] = el.value;
    if (el.dataset.meta === "currency") renderSummary();
    persistSoon();
  }));
  $$("[data-setting]").forEach(el => el.addEventListener("input", () => {
    state.settings[el.dataset.setting] = num(el.value);
    renderSummary();
    persistSoon();
  }));
  $("#bom-body").addEventListener("input", e => {
    const el = e.target;
    if (!el.dataset.field) return;
    const i = Number(el.dataset.i);
    const f = el.dataset.field;
    state.items[i][f] = ["qty", "material", "labor"].includes(f) ? num(el.value) : el.value;
    updateLineTotals();
    renderSummary();
    renderHealth();
    persistSoon();
  });
  $("#bom-body").addEventListener("click", e => {
    const dup = e.target.closest("[data-dup]");
    const del = e.target.closest("[data-del]");
    if (dup) {
      const i = Number(dup.dataset.dup);
      state.items.splice(i + 1, 0, { ...state.items[i] });
      renderTable(); renderSummary(); renderHealth(); persistSoon();
    }
    if (del) {
      const i = Number(del.dataset.del);
      state.items.splice(i, 1);
      if (!state.items.length) state.items.push(blankItem());
      renderTable(); renderSummary(); renderHealth(); persistSoon();
    }
  });

  $("#add-btn").onclick = addItem;
  $("#add-row-bottom").onclick = addItem;
  $("#apply-template").onclick = () => applyTemplate($("#template-select").value);
  $("#new-btn").onclick = () => {
    if (confirm("Start a new blank BOM? The current draft will be replaced.")) applyTemplate("blank");
  };
  $("#save-btn").onclick = () => { saveLocal(); setStatus("Saved locally · " + new Date().toLocaleTimeString()); };
  $("#print-btn").onclick = printBom;
  $("#docx-btn").onclick = exportDocx;
  $("#json-export").onclick = exportJson;
  $("#csv-export").onclick = exportCsv;
  $("#duplicate-selected").onclick = () => { if (state.items.length) state.items.push({ ...state.items[state.items.length - 1] }); renderAll(); persistSoon(); };
  $("#clear-empty").onclick = () => {
    state.items = state.items.filter(i => i.item || i.description || num(i.material) || num(i.labor));
    if (!state.items.length) state.items.push(blankItem());
    renderAll(); persistSoon();
  };
  $("#target-price").addEventListener("input", renderSummary);

  $("#json-input").addEventListener("change", async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      state = normalize(JSON.parse(await f.text()));
      renderAll(); persistSoon(); setStatus("Imported JSON");
    } catch (err) { alert("Invalid JSON file."); }
  });

  $("#pdf-input").addEventListener("change", e => {
    pdfFile = e.target.files[0] || null;
    $("#pdf-name").textContent = pdfFile ? `${pdfFile.name} · ${Math.round(pdfFile.size / 1024)} KB` : "No PDF uploaded.";
    $("#pdf-extract").disabled = !pdfFile;
    if (pdfFile) setStatus("PDF attached");
  });
  $("#pdf-extract").onclick = extractPdf;
  $("#close-pdf").onclick = () => { $("#pdf-modal").hidden = true; };
  $("#cancel-pdf").onclick = () => { $("#pdf-modal").hidden = true; };
  $("#import-pdf-lines").onclick = () => {
    const rows = parsePdfLines($("#pdf-text").value);
    if (!rows.length) { alert("No parseable lines found. Edit the text and try again."); return; }
    state.items.push(...rows);
    $("#pdf-modal").hidden = true;
    renderAll(); persistSoon(); setStatus(`${rows.length} lines imported from PDF`);
  };
}

boot();
