// ============================================================
// UI — depends on generator.js being loaded first
// ============================================================

const controlsEl = document.getElementById("controls");
const statsEl    = document.getElementById("stats");
const statusEl   = document.getElementById("status");
const seedInput  = document.getElementById("seedInput");
const tabsEl     = document.getElementById("tabs");
const canvas     = document.getElementById("preview");
const ctx        = canvas.getContext("2d");

let currentMap    = null;
let generateTimer = null;

const TAB_DEFINITIONS = [
  {id: "players", label: "Players", keys: ["player_count","start_gold_per_player","neutral_gold_per_player","start_gold_resources","neutral_gold_resources"]},
  {id: "shape",   label: "Shape",   keys: ["width","height","blob_count","blob_radius_min","blob_radius_max","basin_count","ridge_count","ridge_width_min","ridge_width_max","land_threshold","land_smooth_passes"]},
  {id: "water",   label: "Water",   keys: ["lake_count","lake_radius_min","lake_radius_max","lake_threshold"]},
  {id: "heights", label: "Heights", keys: ["max_terrain_height","tier2_threshold","tier3_threshold","stair_chance"]},
  {id: "forest",  label: "Forest",  keys: ["forest_patch_count","forest_patch_radius_min","forest_patch_radius_max","forest_base_density","forest_cluster_strength","forest_extra_tree_chance","cliff_tree_penalty"]},
  {id: "detail",  label: "Detail",  keys: ["rock_shore_chance","rock_cliff_chance","bush_chance"]},
];

const PLAYER_COLORS = ["#e63030","#3060e6","#30b030","#e09020","#a030c0"];

const TILE_COLORS = ["#6e8f58","#8aa261","#a3916c","#9b7555","#d0c8b8"];

// ------------------------------------------------------------
// Controls
// ------------------------------------------------------------
function _specTab(spec) {
  for (const tab of TAB_DEFINITIONS) if (tab.keys.includes(spec.key)) return tab.id;
  return "detail";
}

function activateTab(tabId) {
  for (const btn of tabsEl.querySelectorAll(".tab"))
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  for (const pnl of controlsEl.querySelectorAll(".tab-panel"))
    pnl.classList.toggle("active", pnl.dataset.tab === tabId);
}

function fmtVal(v, spec) {
  return spec.type === "int"
    ? String(Math.round(v))
    : Number(v).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function buildControls() {
  controlsEl.innerHTML = "";
  tabsEl.innerHTML = "";
  const panels = new Map();

  for (const tab of TAB_DEFINITIONS) {
    const btn = document.createElement("button");
    btn.className = "tab"; btn.type = "button"; btn.dataset.tab = tab.id; btn.textContent = tab.label;
    btn.addEventListener("click", () => activateTab(tab.id));
    tabsEl.appendChild(btn);

    const panel = document.createElement("div");
    panel.className = "tab-panel"; panel.dataset.tab = tab.id;
    controlsEl.appendChild(panel);
    panels.set(tab.id, panel);
  }

  for (const spec of PARAMETER_SPECS) {
    const value = DEFAULT_CONFIG[spec.key];
    const wrap  = document.createElement("div");
    wrap.className = "control";
    wrap.innerHTML = `
      <div class="control-head">
        <strong>${spec.label}</strong>
        <span id="value-${spec.key}">${fmtVal(value, spec)}</span>
      </div>
      <div class="range-row">
        <input id="range-${spec.key}"  type="range"  min="${spec.min}" max="${spec.max}" step="${spec.step}" value="${value}">
        <input id="number-${spec.key}" type="number" min="${spec.min}" max="${spec.max}" step="${spec.step}" value="${value}">
      </div>`;

    const range  = wrap.querySelector(`#range-${spec.key}`);
    const number = wrap.querySelector(`#number-${spec.key}`);
    const label  = wrap.querySelector(`#value-${spec.key}`);
    const sync = raw => {
      const parsed = spec.type === "int" ? parseInt(raw, 10) : parseFloat(raw);
      range.value = number.value = parsed;
      label.textContent = fmtVal(parsed, spec);
    };
    range.addEventListener("input",  () => { sync(range.value);  scheduleGenerate(); });
    number.addEventListener("input", () => { sync(number.value); scheduleGenerate(); });
    panels.get(_specTab(spec)).appendChild(wrap);
  }
  activateTab(TAB_DEFINITIONS[0].id);
}

function collectParams() {
  const params = {};
  for (const spec of PARAMETER_SPECS) {
    const v = document.getElementById(`number-${spec.key}`).value;
    params[spec.key] = spec.type === "int" ? parseInt(v, 10) : parseFloat(v);
  }
  return params;
}

// ------------------------------------------------------------
// Rendering
// ------------------------------------------------------------
function renderStats(mapData) {
  statsEl.innerHTML = "";
  const s = mapData.summary || {};
  for (const [label, value] of [
    ["Seed", mapData.seed], ["Playable Tiles", s.playable_tiles], ["Water Edge Tiles", s.shore_water_tiles],
    ["East Stairs", s.stairs_east], ["West Stairs", s.stairs_west],
    ["Trees", s.tree_count], ["Rocks", s.rock_count], ["Max Height", s.max_height],
  ]) {
    const el = document.createElement("div");
    el.className = "stat";
    el.innerHTML = `<span class="label">${label}</span><strong>${value ?? "-"}</strong>`;
    statsEl.appendChild(el);
  }
}

function renderMap(mapData) {
  currentMap = mapData;
  const w = mapData.tilesX, h = mapData.tilesY;
  const scale = 6;
  canvas.width = w * scale; canvas.height = h * scale;

  // Terrain tiles
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const idx  = r * w + c;
      const ht   = mapData.heightmap[idx];
      const tile = mapData.tileType[idx];

      if (tile === 0) {
        ctx.fillStyle = "#7db0c5";
        ctx.fillRect(c*scale, r*scale, scale, scale);
      } else if (tile === 2 || tile === 3) {
        ctx.fillStyle = "#d8c68f";
        ctx.fillRect(c*scale, r*scale, scale, scale);
        ctx.strokeStyle = "#836944";
        ctx.lineWidth = Math.max(1, scale * 0.18);
        ctx.beginPath();
        if (tile === 2) {
          ctx.moveTo(c*scale+scale*0.2, r*scale+scale*0.1);
          ctx.lineTo(c*scale+scale*0.8, r*scale+scale*0.5);
          ctx.lineTo(c*scale+scale*0.2, r*scale+scale*0.9);
        } else {
          ctx.moveTo(c*scale+scale*0.8, r*scale+scale*0.1);
          ctx.lineTo(c*scale+scale*0.2, r*scale+scale*0.5);
          ctx.lineTo(c*scale+scale*0.8, r*scale+scale*0.9);
        }
        ctx.stroke();
      } else {
        ctx.fillStyle = TILE_COLORS[Math.min(ht, TILE_COLORS.length - 1)];
        ctx.fillRect(c*scale, r*scale, scale, scale);
      }
    }
  }

  // Decorations
  for (const deco of mapData.decorations) {
    const x = Math.floor((deco.x / TILE_SIZE) * scale);
    const y = Math.floor((deco.y / TILE_SIZE) * scale);

    switch (deco.type) {
      case "spruce":
        ctx.fillStyle = "#1d4a2e";
        ctx.fillRect(x, y, Math.max(2, scale*0.45), Math.max(2, scale*0.45));
        break;
      case "birch":
        ctx.fillStyle = "#8dc96b";
        ctx.fillRect(x, y, Math.max(2, scale*0.45), Math.max(2, scale*0.45));
        break;
      case "rock":
        ctx.fillStyle = "#555247";
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1.5, scale*0.22), 0, Math.PI*2);
        ctx.fill();
        break;
      case "bush":
        ctx.fillStyle = "#4a7a35";
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1.5, scale*0.28), 0, Math.PI*2);
        ctx.fill();
        break;
      case "gold": {
        const gs = Math.max(4, scale*0.6) | 0;
        ctx.fillStyle = "#f0d040";
        ctx.fillRect(x - (gs>>1), y - (gs>>1), gs, gs);
        break;
      }
      case "duck":
        ctx.fillStyle = "#e8a020";
        ctx.beginPath();
        ctx.arc(x, y, Math.max(2, scale*0.35), 0, Math.PI*2);
        ctx.fill();
        break;
      case "cloud": {
        const cr = Math.max(3, scale*0.6) | 0;
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.beginPath();
        ctx.ellipse(x, y, cr*2.5, cr, 0, 0, Math.PI*2);
        ctx.fill();
        break;
      }
    }
  }

  // Town centers: coloured square + player number on top
  for (const bld of mapData.buildings) {
    if (bld.type !== "townCenter") continue;
    const bx = Math.floor((bld.x / TILE_SIZE) * scale);
    const by = Math.floor((bld.y / TILE_SIZE) * scale);
    const sz = Math.max(6, scale * 1.4) | 0;
    ctx.fillStyle = PLAYER_COLORS[(bld.playerId - 1) % PLAYER_COLORS.length];
    ctx.fillRect(bx - (sz>>1), by - (sz>>1), sz, sz);
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.max(7, scale)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(bld.playerId), bx, by);
  }

  renderStats(mapData);
}

// ------------------------------------------------------------
// Generate / download
// ------------------------------------------------------------
function scheduleGenerate(delay = 180) {
  if (generateTimer) clearTimeout(generateTimer);
  generateTimer = setTimeout(() => { generateTimer = null; generate(); }, delay);
}

function generate() {
  statusEl.textContent = "Generating map…";
  const seedValue = seedInput.value.trim();
  const seed = seedValue === "" ? null : Number(seedValue);
  setTimeout(() => {
    try {
      const data = generateMap(collectParams(), seed);
      seedInput.value = data.seed;
      statusEl.textContent = `Generated seed ${data.seed}`;
      renderMap(data);
    } catch (err) {
      statusEl.textContent = `Error: ${err.message}`;
      console.error(err);
    }
  }, 0);
}

function downloadCurrentMap() {
  if (!currentMap) return;
  const blob = new Blob([JSON.stringify(currentMap, null, 2)], {type: "application/json"});
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = `generated-map-${currentMap.seed}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

// ------------------------------------------------------------
// Boot
// ------------------------------------------------------------
document.getElementById("generateBtn").addEventListener("click", generate);
document.getElementById("downloadBtn").addEventListener("click", downloadCurrentMap);
document.getElementById("randomSeed").addEventListener("click", () => { seedInput.value = ""; generate(); });
seedInput.addEventListener("input", () => scheduleGenerate());

buildControls();
generate();
