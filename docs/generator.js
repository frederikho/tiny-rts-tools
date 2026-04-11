// ============================================================
// Map Generator — ported from generate_map.py
// No DOM dependencies; can be loaded in Node.js as well.
// ============================================================

const TILE_SIZE = 64;

const PARAMETER_SPECS = [
  {key: "width",                    label: "Width",                type: "int",   min: 40,    max: 160,  step: 4},
  {key: "height",                   label: "Height",               type: "int",   min: 40,    max: 160,  step: 4},
  {key: "blob_count",               label: "Land Blobs",           type: "int",   min: 4,     max: 18,   step: 1},
  {key: "blob_radius_min",          label: "Blob Radius Min",      type: "float", min: 0.04,  max: 0.20, step: 0.005},
  {key: "blob_radius_max",          label: "Blob Radius Max",      type: "float", min: 0.06,  max: 0.30, step: 0.005},
  {key: "basin_count",              label: "Basins",               type: "int",   min: 0,     max: 10,   step: 1},
  {key: "ridge_count",              label: "Ridges",               type: "int",   min: 0,     max: 12,   step: 1},
  {key: "ridge_width_min",          label: "Ridge Width Min",      type: "float", min: 0.01,  max: 0.10, step: 0.002},
  {key: "ridge_width_max",          label: "Ridge Width Max",      type: "float", min: 0.02,  max: 0.14, step: 0.002},
  {key: "lake_count",               label: "Lakes",                type: "int",   min: 0,     max: 8,    step: 1},
  {key: "lake_radius_min",          label: "Lake Radius Min",      type: "float", min: 0.02,  max: 0.12, step: 0.002},
  {key: "lake_radius_max",          label: "Lake Radius Max",      type: "float", min: 0.03,  max: 0.16, step: 0.002},
  {key: "land_threshold",           label: "Land Threshold",       type: "float", min: -0.8,  max: 0.4,  step: 0.01},
  {key: "land_smooth_passes",       label: "Land Smooth",          type: "int",   min: 0,     max: 5,    step: 1},
  {key: "lake_threshold",           label: "Lake Threshold",       type: "float", min: 0.20,  max: 1.40, step: 0.01},
  {key: "max_terrain_height",       label: "Max Terrain Height",   type: "int",   min: 1,     max: 5,    step: 1},
  {key: "tier2_threshold",          label: "Tier 2 Threshold",     type: "float", min: 0.20,  max: 1.80, step: 0.01},
  {key: "tier3_threshold",          label: "Tier 3 Threshold",     type: "float", min: 0.40,  max: 2.20, step: 0.01},
  {key: "forest_patch_count",       label: "Forest Patches",       type: "int",   min: 0,     max: 40,   step: 1},
  {key: "forest_patch_radius_min",  label: "Forest Radius Min",    type: "float", min: 0.01,  max: 0.12, step: 0.002},
  {key: "forest_patch_radius_max",  label: "Forest Radius Max",    type: "float", min: 0.02,  max: 0.18, step: 0.002},
  {key: "forest_base_density",      label: "Tree Base Density",    type: "float", min: 0.00,  max: 0.50, step: 0.01},
  {key: "forest_cluster_strength",  label: "Tree Cluster Strength",type: "float", min: 0.00,  max: 1.50, step: 0.01},
  {key: "forest_extra_tree_chance", label: "Extra Cluster Trees",  type: "float", min: 0.00,  max: 0.70, step: 0.01},
  {key: "cliff_tree_penalty",       label: "Cliff Tree Penalty",   type: "float", min: 0.00,  max: 1.00, step: 0.01},
  {key: "rock_shore_chance",        label: "Shore Rock Chance",    type: "float", min: 0.00,  max: 0.50, step: 0.01},
  {key: "rock_cliff_chance",        label: "Cliff Rock Chance",    type: "float", min: 0.00,  max: 0.50, step: 0.01},
  {key: "bush_chance",              label: "Bush Chance",          type: "float", min: 0.00,  max: 0.20, step: 0.005},
  {key: "stair_chance",             label: "Stair Chance",         type: "float", min: 0.00,  max: 1.00, step: 0.01},
  {key: "player_count",             label: "Players",              type: "int",   min: 2,     max: 8,    step: 1},
  {key: "bear_count",               label: "Bears",                type: "int",   min: 0,     max: 20,   step: 1},
  {key: "start_gold_per_player",    label: "Base Gold Patches",    type: "int",   min: 0,     max: 6,    step: 1},
];

const DEFAULT_CONFIG = {
  width: 128, height: 128,
  blob_count: 14,
  blob_radius_min: 0.11,  blob_radius_max: 0.20,
  basin_count: 4,
  basin_radius_min: 0.06, basin_radius_max: 0.14,
  ridge_count: 10,
  ridge_width_min: 0.028, ridge_width_max: 0.07,
  lake_count: 3,
  lake_radius_min: 0.035, lake_radius_max: 0.08,
  land_threshold: -0.20,
  land_smooth_passes: 2,
  min_land_component: 6,
  lake_threshold: 0.52,
  min_lake_component: 12,
  max_terrain_height: 3,
  tier2_threshold: 0.94,
  tier3_threshold: 1.12,
  tier4_threshold: 1.34,
  tier5_threshold: 1.56,
  tier2_min_component: 14,
  tier3_min_component: 5,
  tier4_min_component: 4,
  tier5_min_component: 3,
  forest_patch_count: 9,
  forest_patch_radius_min: 0.030, forest_patch_radius_max: 0.038,
  forest_base_density: 0.07,
  forest_cluster_strength: 1.19,
  forest_noise_strength: 0.16,
  forest_extra_tree_chance: 0.20,
  cliff_tree_penalty: 0.45,
  rock_shore_chance: 0.20,
  rock_cliff_chance: 0.16,
  bush_chance: 0.025,
  stair_chance: 0.55,
  edge_void_margin: 2,
  player_count: 2,
  bear_count: 4,
  start_gold_per_player: 1,
  neutral_gold_per_player: 3,
  start_gold_resources: 1,
  neutral_gold_resources: 1,
  seed: null,
};

// ------------------------------------------------------------
// Seeded PRNG (mulberry32). Not cross-compatible with Python's
// random.Random, but fully deterministic within JS.
// ------------------------------------------------------------
class SeededRandom {
  constructor(seed) {
    this._s = ((seed ^ 0xDEADBEEF) >>> 0) || 1;
  }
  _next() {
    this._s = (this._s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(this._s ^ (this._s >>> 15), 1 | this._s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  random()         { return this._next(); }
  uniform(a, b)    { return a + this._next() * (b - a); }
  randint(a, b)    { return a + Math.floor(this._next() * (b - a + 1)); }
}

// ------------------------------------------------------------
// Deterministic value noise (32-bit integer hashing)
// ------------------------------------------------------------
class NoiseField {
  constructor(seed) { this._seed = seed | 0; }
  _rand_at(ix, iy) {
    let n = (Math.imul(ix | 0, 374761393) + Math.imul(iy | 0, 668265263) + Math.imul(this._seed, 982451653)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    n ^= n >>> 16;
    return (n >>> 0) / 4294967295;
  }
  value(x, y, scale) {
    x /= scale; y /= scale;
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const tx = _smoothstep(x - x0), ty = _smoothstep(y - y0);
    const v00 = this._rand_at(x0,     y0);
    const v10 = this._rand_at(x0 + 1, y0);
    const v01 = this._rand_at(x0,     y0 + 1);
    const v11 = this._rand_at(x0 + 1, y0 + 1);
    return _lerp(_lerp(v00, v10, tx), _lerp(v01, v11, tx), ty) * 2.0 - 1.0;
  }
  fbm(x, y, base_scale, octaves = 4, lacunarity = 2.0, gain = 0.5) {
    let amplitude = 1.0, frequency = 1.0, total = 0.0, max_amp = 0.0;
    for (let i = 0; i < octaves; i++) {
      total   += amplitude * this.value(x * frequency, y * frequency, base_scale);
      max_amp += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }
    return max_amp ? total / max_amp : 0.0;
  }
}

// ------------------------------------------------------------
// Math helpers
// ------------------------------------------------------------
function _smoothstep(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}
function _lerp(a, b, t) { return a + (b - a) * t; }

function _distToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax, aby = by - ay;
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / len2));
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}

function _gaussian(px, py, cx, cy, radius) {
  return Math.exp(-((Math.hypot(px - cx, py - cy) / radius) ** 2));
}

// ------------------------------------------------------------
// Mask / grid operations
// ------------------------------------------------------------
function _bfsComponents(mask, width, height) {
  const seen = new Uint8Array(width * height);
  const components = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    const queue = [start];
    seen[start] = 1;
    let head = 0;
    const component = [];
    while (head < queue.length) {
      const cur = queue[head++];
      component.push(cur);
      const r = (cur / width) | 0, c = cur % width;
      if (r > 0          && mask[cur - width] && !seen[cur - width]) { seen[cur - width] = 1; queue.push(cur - width); }
      if (r < height - 1 && mask[cur + width] && !seen[cur + width]) { seen[cur + width] = 1; queue.push(cur + width); }
      if (c > 0          && mask[cur - 1]     && !seen[cur - 1])     { seen[cur - 1] = 1;     queue.push(cur - 1); }
      if (c < width - 1  && mask[cur + 1]     && !seen[cur + 1])     { seen[cur + 1] = 1;     queue.push(cur + 1); }
    }
    components.push(component);
  }
  return components;
}

function _smoothScalar(field, width, height, passes = 1) {
  let cur = field.slice();
  for (let p = 0; p < passes; p++) {
    const upd = cur.slice();
    for (let r = 1; r < height - 1; r++) {
      for (let c = 1; c < width - 1; c++) {
        let total = 0, weight = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const w = (dr === 0 && dc === 0) ? 2 : 1;
            total  += cur[(r + dr) * width + (c + dc)] * w;
            weight += w;
          }
        }
        upd[r * width + c] = total / weight;
      }
    }
    cur = upd;
  }
  return cur;
}

function _smoothLand(mask, width, height, passes) {
  let cur = mask.slice();
  for (let p = 0; p < passes; p++) {
    const upd = cur.slice();
    for (let r = 1; r < height - 1; r++) {
      for (let c = 1; c < width - 1; c++) {
        const idx = r * width + c;
        let n = cur[idx - width - 1] + cur[idx - width] + cur[idx - width + 1]
              + cur[idx - 1]                             + cur[idx + 1]
              + cur[idx + width - 1] + cur[idx + width] + cur[idx + width + 1];
        upd[idx] = cur[idx] ? (n >= 3 ? 1 : 0) : (n >= 5 ? 1 : 0);
      }
    }
    cur = upd;
  }
  return cur;
}

function _erodeMask(mask, width, height, minNeighbors) {
  const upd = mask.slice();
  for (let r = 1; r < height - 1; r++) {
    for (let c = 1; c < width - 1; c++) {
      const idx = r * width + c;
      if (!mask[idx]) continue;
      const n = mask[idx - width - 1] + mask[idx - width] + mask[idx - width + 1]
              + mask[idx - 1]                              + mask[idx + 1]
              + mask[idx + width - 1] + mask[idx + width] + mask[idx + width + 1];
      if (n < minNeighbors) upd[idx] = 0;
    }
  }
  return upd;
}

function _dilateMask(mask, width, height, minNeighbors) {
  const upd = mask.slice();
  for (let r = 1; r < height - 1; r++) {
    for (let c = 1; c < width - 1; c++) {
      const idx = r * width + c;
      if (mask[idx]) continue;
      const n = mask[idx - width - 1] + mask[idx - width] + mask[idx - width + 1]
              + mask[idx - 1]                              + mask[idx + 1]
              + mask[idx + width - 1] + mask[idx + width] + mask[idx + width + 1];
      if (n >= minNeighbors) upd[idx] = 1;
    }
  }
  return upd;
}

function _removeSmall(mask, width, height, minSize) {
  const cur = mask.slice();
  for (const comp of _bfsComponents(cur, width, height)) {
    if (comp.length < minSize) for (const idx of comp) cur[idx] = 0;
  }
  return cur;
}

function _buildTierMask(base, width, height, minSize) {
  let cur = _erodeMask(base, width, height, 3);
  cur = _smoothLand(cur, width, height, 1);
  return _removeSmall(cur, width, height, minSize);
}

// ------------------------------------------------------------
// Terrain generation
// ------------------------------------------------------------
function _chooseLandFeatures(rng, width, height, cfg) {
  const blobs = [];
  for (let i = 0; i < cfg.blob_count; i++)
    blobs.push([rng.uniform(width*0.12, width*0.88), rng.uniform(height*0.12, height*0.88), rng.uniform(width*cfg.blob_radius_min, width*cfg.blob_radius_max)]);

  const basins = [];
  for (let i = 0; i < cfg.basin_count; i++)
    basins.push([rng.uniform(width*0.15, width*0.85), rng.uniform(height*0.15, height*0.85), rng.uniform(width*cfg.basin_radius_min, width*cfg.basin_radius_max)]);

  const ridges = [];
  for (let i = 0; i < cfg.ridge_count; i++) {
    const ax = rng.uniform(width*0.05, width*0.95), ay = rng.uniform(height*0.05, height*0.95);
    ridges.push([ax, ay, ax + rng.uniform(-width*0.35, width*0.35), ay + rng.uniform(-height*0.35, height*0.35), rng.uniform(width*cfg.ridge_width_min, width*cfg.ridge_width_max)]);
  }

  const lakes = [];
  for (let i = 0; i < cfg.lake_count; i++)
    lakes.push([rng.uniform(width*0.22, width*0.78), rng.uniform(height*0.22, height*0.78), rng.uniform(width*cfg.lake_radius_min, width*cfg.lake_radius_max)]);

  return {blobs, basins, ridges, lakes, borderMargin: rng.uniform(1.5, 3.0)};
}

function _classifyStairs(heightmap, tileType, width, height, rng, cfg) {
  for (let level = 0; level <= 4; level++) {
    for (let c = 1; c < width - 1; c++) {
      let r = 1;
      while (r < height - 1) {
        const idx = r * width + c;
        if (heightmap[idx] === level && heightmap[idx+1] >= level+1 && heightmap[idx-1] <= level && tileType[idx] === 1) {
          let run = 0;
          while (r+run < height-1 && heightmap[(r+run)*width+c] === level && heightmap[(r+run)*width+c+1] >= level+1 && tileType[(r+run)*width+c] === 1) run++;
          if (run >= 2 && rng.random() < cfg.stair_chance) {
            const len = Math.min(run, rng.randint(2, 4));
            const start = r + Math.max(0, (run - len) >> 1);
            for (let o = 0; o < len; o++) tileType[(start+o)*width+c] = 2;
            r += run; continue;
          }
        }
        if (heightmap[idx] === level && heightmap[idx-1] >= level+1 && heightmap[idx+1] <= level && tileType[idx] === 1) {
          let run = 0;
          while (r+run < height-1 && heightmap[(r+run)*width+c] === level && heightmap[(r+run)*width+c-1] >= level+1 && tileType[(r+run)*width+c] === 1) run++;
          if (run >= 2 && rng.random() < cfg.stair_chance) {
            const len = Math.min(run, rng.randint(2, 4));
            const start = r + Math.max(0, (run - len) >> 1);
            for (let o = 0; o < len; o++) tileType[(start+o)*width+c] = 3;
            r += run; continue;
          }
        }
        r++;
      }
    }
  }
}

function _buildHeightmap(cfg, seed) {
  const {width, height} = cfg;
  const rng   = new SeededRandom(seed);
  const noise = new NoiseField(seed);
  const {blobs, basins, ridges, lakes, borderMargin} = _chooseLandFeatures(rng, width, height, cfg);

  const landScores = new Float64Array(width * height);
  const hillScores = new Float64Array(width * height);
  const lakeScores = new Float64Array(width * height);

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const idx = r * width + c;
      const x = c + 0.5, y = r + 0.5;
      const wx = x + noise.fbm(x+211.3, y-93.7,  18.0, 3) * 4.0;
      const wy = y + noise.fbm(x-57.1,  y+174.2, 18.0, 3) * 4.0;

      let blobScore = 0;  for (const [cx,cy,rad] of blobs)  blobScore  += _gaussian(wx, wy, cx, cy, rad);
      let basinScore = 0; for (const [cx,cy,rad] of basins) basinScore += _gaussian(wx, wy, cx, cy, rad);
      let lakeScore = 0;  for (const [cx,cy,rad] of lakes)  lakeScore  += _gaussian(wx, wy, cx, cy, rad);
      let ridgeScore = 0; for (const [ax,ay,bx,by,rw] of ridges) ridgeScore += Math.exp(-((_distToSegment(wx,wy,ax,ay,bx,by)/rw)**2));

      const macroNoise  = noise.fbm(wx,      wy,      20.0, 4);
      const detailNoise = noise.fbm(wx+91.0, wy-47.0,  9.0, 3);
      const edge        = Math.min(c, width-1-c, r, height-1-r);
      const edgePenalty = Math.max(0, (borderMargin - edge) / borderMargin);

      landScores[idx] = blobScore*0.95 + ridgeScore*0.82 + macroNoise*0.55 + detailNoise*0.18 - basinScore*0.82 - edgePenalty*2.20 - 1.05;
      hillScores[idx] = ridgeScore*0.75 + blobScore*0.25 + detailNoise*0.35 + macroNoise*0.15;
      lakeScores[idx] = lakeScore*1.15 - ridgeScore*0.25 - detailNoise*0.10;
    }
  }

  let mask = Array.from(landScores, s => s > cfg.land_threshold ? 1 : 0);
  mask = _smoothLand(mask, width, height, cfg.land_smooth_passes);
  mask = _removeSmall(mask, width, height, cfg.min_land_component);

  let lakeMask = new Array(width * height).fill(0);
  for (let r = 2; r < height-2; r++) {
    for (let c = 2; c < width-2; c++) {
      const idx = r*width+c;
      if (!mask[idx]) continue;
      if (Math.min(c, width-1-c, r, height-1-r) < 8) continue;
      if (lakeScores[idx] > cfg.lake_threshold && landScores[idx] > -0.05 && hillScores[idx] < cfg.tier3_threshold)
        lakeMask[idx] = 1;
    }
  }
  lakeMask = _erodeMask(lakeMask, width, height, 3);
  lakeMask = _smoothLand(lakeMask, width, height, 1);
  lakeMask = _dilateMask(lakeMask, width, height, 3);
  lakeMask = _removeSmall(lakeMask, width, height, cfg.min_lake_component);

  const landMask = mask.slice();
  for (let i = 0; i < lakeMask.length; i++) if (lakeMask[i]) landMask[i] = 0;

  const smoothedHills = _smoothScalar(Array.from(hillScores), width, height, 2);
  const maxH = Math.max(1, Math.min(5, cfg.max_terrain_height));
  const tierThresholds = [null, null, cfg.tier2_threshold, cfg.tier3_threshold, cfg.tier4_threshold, cfg.tier5_threshold];
  const tierMinComps   = [null, null, cfg.tier2_min_component, cfg.tier3_min_component, cfg.tier4_min_component, cfg.tier5_min_component];

  const tierMasks = [null, landMask];
  for (let t = 2; t <= maxH; t++) {
    const tierSeed = tierMasks[t-1].map((v,i) => (v && smoothedHills[i] > tierThresholds[t]) ? 1 : 0);
    let m = _buildTierMask(tierSeed, width, height, tierMinComps[t]);
    m = m.map((v,i) => (v && tierMasks[t-1][i]) ? 1 : 0);
    tierMasks[t] = m;
  }

  const heightmap = new Array(width*height).fill(0);
  const tileType  = new Array(width*height).fill(1);

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const idx = r*width+c;
      const edge = Math.min(c, width-1-c, r, height-1-r);
      if (edge < cfg.edge_void_margin || lakeMask[idx] || !landMask[idx]) {
        tileType[idx] = 0; continue;
      }
      let h = 0;
      for (let t = 2; t <= maxH; t++) if (tierMasks[t][idx]) h = t - 1;
      heightmap[idx] = h;
    }
  }

  _classifyStairs(heightmap, tileType, width, height, rng, cfg);
  return {heightmap, tileType};
}

// ------------------------------------------------------------
// Decorations (trees, rocks, bushes)
// ------------------------------------------------------------
function _worldXY(col, row, rng, spread = 0.9) {
  return [(col + rng.uniform(0.15, spread)) * TILE_SIZE, (row + rng.uniform(0.15, spread)) * TILE_SIZE];
}

function _generateDecorations(heightmap, tileType, width, height, seed, cfg) {
  const rng   = new SeededRandom(seed + 1007);
  const noise = new NoiseField(seed + 17);
  const decorations = [];

  const forestCenters = [];
  for (let i = 0; i < cfg.forest_patch_count; i++)
    forestCenters.push([rng.uniform(width*0.08, width*0.92), rng.uniform(height*0.08, height*0.92), rng.uniform(width*cfg.forest_patch_radius_min, width*cfg.forest_patch_radius_max), rng.random()]);

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const idx = r*width+c;
      if (!tileType[idx]) continue;

      const x = c+0.5, y = r+0.5;
      const broadForest  = noise.fbm(x+13.0,  y-41.0,  13.0, 3);
      const speciesNoise = noise.fbm(x-77.0,  y+121.0,  6.0, 2);

      let clusterScore = 0, speciesScore = 0;
      for (const [cx,cy,rad,sb] of forestCenters) {
        const inf = _gaussian(x, y, cx, cy, rad);
        if (inf > clusterScore) clusterScore = inf;
        speciesScore += inf * (sb - 0.5);
      }

      let nearSlope = false, nearWater = false;
      const h = heightmap[idx];
      if (r > 0)        { const ni=idx-width; if (!tileType[ni]) nearWater=true; else if (Math.abs(h-heightmap[ni])>=1) nearSlope=true; }
      if (r < height-1) { const ni=idx+width; if (!tileType[ni]) nearWater=true; else if (Math.abs(h-heightmap[ni])>=1) nearSlope=true; }
      if (c > 0)        { const ni=idx-1;     if (!tileType[ni]) nearWater=true; else if (Math.abs(h-heightmap[ni])>=1) nearSlope=true; }
      if (c < width-1)  { const ni=idx+1;     if (!tileType[ni]) nearWater=true; else if (Math.abs(h-heightmap[ni])>=1) nearSlope=true; }

      let density = cfg.forest_base_density + Math.max(0, broadForest)*cfg.forest_noise_strength + clusterScore*cfg.forest_cluster_strength;
      if (nearSlope) density *= cfg.cliff_tree_penalty;
      if (tileType[idx] === 2 || tileType[idx] === 3) density = 0;

      if (rng.random() < density) {
        const [px,py] = _worldXY(c, r, rng);
        decorations.push({type: speciesScore + speciesNoise*0.45 > 0 ? "spruce" : "birch", x: px, y: py});
      }
      if (clusterScore > 0.62 && rng.random() < cfg.forest_extra_tree_chance && !nearSlope && tileType[idx] === 1) {
        const [px,py] = _worldXY(c, r, rng, 0.98);
        decorations.push({type: speciesScore > -0.05 ? "spruce" : "birch", x: px, y: py});
      }
      if (nearWater && rng.random() < cfg.rock_shore_chance) {
        const [px,py] = _worldXY(c, r, rng, 0.95);
        decorations.push({type: "rock", x: px, y: py});
      } else if (nearSlope && rng.random() < cfg.rock_cliff_chance) {
        const [px,py] = _worldXY(c, r, rng, 0.95);
        decorations.push({type: "rock", x: px, y: py});
      } else if (!nearSlope && !nearWater && h === 0 && tileType[idx] === 1 && rng.random() < cfg.bush_chance) {
        const [px,py] = _worldXY(c, r, rng, 0.92);
        decorations.push({type: "bush", x: px, y: py});
      }
    }
  }
  return decorations;
}

// ------------------------------------------------------------
// Player placement
// ------------------------------------------------------------

// Snap pixel coords to a nearby land tile if the target tile is water.
function _snapWorkerToLand(px, py, tileType, width, height, rng) {
  const col = Math.floor(px / TILE_SIZE);
  const row = Math.floor(py / TILE_SIZE);
  if (row >= 0 && row < height && col >= 0 && col < width && tileType[row * width + col] !== 0) {
    return [px, py]; // already on land
  }
  // Expand outward in rings until we find a valid land tile
  for (let dist = 1; dist <= 5; dist++) {
    for (let dr = -dist; dr <= dist; dr++) {
      for (let dc = -dist; dc <= dist; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== dist) continue;
        const nr = row + dr, nc = col + dc;
        if (nr < 0 || nr >= height || nc < 0 || nc >= width) continue;
        if (tileType[nr * width + nc] !== 0) {
          return [(nc + rng.uniform(0.2, 0.8)) * TILE_SIZE, (nr + rng.uniform(0.2, 0.8)) * TILE_SIZE];
        }
      }
    }
  }
  return [px, py]; // fallback: leave as-is
}

// Returns [row, col] spawn tiles spread across flat land via farthest-point sampling.
// Requires a 3-tile water buffer so castles are never placed at the water's edge.
function _chooseSpawnTiles(heightmap, tileType, width, height, playerCount, rng) {
  const margin = Math.max(6, Math.floor(Math.min(width, height) * 0.08));
  const candidates = [];

  for (let r = margin; r < height - margin; r++) {
    for (let c = margin; c < width - margin; c++) {
      const idx = r * width + c;
      if (heightmap[idx] !== 0 || tileType[idx] !== 1) continue;

      // 3-tile water buffer: all tiles within Chebyshev-3 must be land
      let tooCloseToWater = false;
      outerW: for (let dr = -3; dr <= 3; dr++) {
        for (let dc = -3; dc <= 3; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= height || nc < 0 || nc >= width) continue;
          if (tileType[nr * width + nc] === 0) { tooCloseToWater = true; break outerW; }
        }
      }
      if (tooCloseToWater) continue;

      // Require at least 36 flat land cells in the 7×7 neighbourhood
      let flat = 0;
      for (let dr = -3; dr <= 3; dr++) {
        for (let dc = -3; dc <= 3; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= height || nc < 0 || nc >= width) continue;
          const ni = nr * width + nc;
          if (heightmap[ni] === 0 && tileType[ni] === 1) flat++;
        }
      }
      if (flat >= 36) candidates.push([r, c]);
    }
  }

  // Relax if not enough candidates
  if (candidates.length < playerCount) {
    for (let r = margin; r < height - margin; r++)
      for (let c = margin; c < width - margin; c++) {
        const idx = r * width + c;
        if (heightmap[idx] === 0 && tileType[idx] === 1) candidates.push([r, c]);
      }
  }
  if (candidates.length === 0) return null;

  // Farthest-point sampling
  const chosen = [candidates[Math.floor(rng.random() * candidates.length)]];
  for (let p = 1; p < playerCount; p++) {
    let bestDist = -1, best = null;
    for (const [cr, cc] of candidates) {
      let minD = Infinity;
      for (const [pr, pc] of chosen) {
        const d = (cr - pr) ** 2 + (cc - pc) ** 2;
        if (d < minD) minD = d;
      }
      if (minD > bestDist) { bestDist = minD; best = [cr, cc]; }
    }
    chosen.push(best);
  }
  return chosen;
}

function _placePlayers(heightmap, tileType, width, height, playerCount, seed) {
  const rng = new SeededRandom(seed + 3001);
  const spawnTiles = _chooseSpawnTiles(heightmap, tileType, width, height, playerCount, rng);
  if (!spawnTiles) return {buildings: [], spawns: [], workers: []};

  const buildings = [], spawns = [], workers = [];

  for (let i = 0; i < spawnTiles.length; i++) {
    const [row, col] = spawnTiles[i];
    const playerId = i + 1;
    const cx = (col + 0.5) * TILE_SIZE;
    const cy = (row + 0.5) * TILE_SIZE;

    buildings.push({type: "townCenter", playerId, x: cx, y: cy});
    spawns.push({playerId, x: cx, y: cy});

    // 3 workers in a loose horizontal cluster just below the castle.
    // Each worker is snapped to land in case the tile below is water.
    for (let w = 0; w < 3; w++) {
      const wx = cx + (w - 1) * rng.uniform(44, 56) + rng.uniform(-10, 10);
      const wy = cy + rng.uniform(80, 130);
      const [sx, sy] = _snapWorkerToLand(wx, wy, tileType, width, height, rng);
      workers.push({playerId, x: sx, y: sy, placedAt: 0});
    }
  }

  return {buildings, spawns, workers};
}

// ------------------------------------------------------------
// Start gold — one or more patches near each castle.
// Looks for flat land 4–14 tiles (Chebyshev) from the spawn.
// ------------------------------------------------------------
function _placeStartGold(spawnTiles, heightmap, tileType, width, height, patchesPerPlayer, resourcesPerPatch, seed) {
  if (patchesPerPlayer <= 0) return [];
  const rng = new SeededRandom(seed + 4001);
  const MIN_DIST = 2, MAX_DIST = 6;
  const decorations = [];

  for (const [sr, sc] of spawnTiles) {
    const candidates = [];
    for (let r = Math.max(0, sr - MAX_DIST); r <= Math.min(height - 1, sr + MAX_DIST); r++) {
      for (let c = Math.max(0, sc - MAX_DIST); c <= Math.min(width - 1, sc + MAX_DIST); c++) {
        const idx = r * width + c;
        if (heightmap[idx] !== 0 || tileType[idx] !== 1) continue;
        const dist = Math.max(Math.abs(r - sr), Math.abs(c - sc));
        if (dist < MIN_DIST || dist > MAX_DIST) continue;
        let nearWater = false;
        outerW: for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < height && nc >= 0 && nc < width && tileType[nr * width + nc] === 0) {
              nearWater = true; break outerW;
            }
          }
        }
        if (!nearWater) candidates.push([r, c]);
      }
    }
    if (candidates.length === 0) continue;

    // Shuffle so multiple patches are spread around, not all in one direction
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(rng.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    const placed = [];
    const MIN_SPREAD_SQ = 4 * 4;
    for (const [gr, gc] of candidates) {
      if (placed.length >= patchesPerPlayer) break;
      if (placed.some(([pr, pc]) => (gr - pr) ** 2 + (gc - pc) ** 2 < MIN_SPREAD_SQ)) continue;
      placed.push([gr, gc]);
      for (let k = 0; k < resourcesPerPatch; k++) {
        decorations.push({
          type: "gold",
          x: (gc + rng.uniform(0.15, 0.85)) * TILE_SIZE,
          y: (gr + rng.uniform(0.15, 0.85)) * TILE_SIZE,
        });
      }
    }
  }
  return decorations;
}

// ------------------------------------------------------------
// Gold deposits — farthest-point sampling across flat land,
// with a minimum distance from any castle position.
// ------------------------------------------------------------
function _placeGoldDeposits(heightmap, tileType, width, height, totalCount, spawnTiles, resourcesPerPatch, seed) {
  const rng = new SeededRandom(seed + 5001);
  const margin = Math.max(4, Math.floor(Math.min(width, height) * 0.05));
  // Gold must be at least 12 tiles from any castle (roughly 2× the old min of ~5-6 tiles)
  const MIN_CASTLE_DIST_SQ = 12 * 12;

  const candidates = [];
  for (let r = margin; r < height - margin; r++) {
    for (let c = margin; c < width - margin; c++) {
      const idx = r * width + c;
      if (heightmap[idx] !== 0 || tileType[idx] !== 1) continue;

      // 2-tile water buffer
      let nearWater = false;
      outerW: for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < height && nc >= 0 && nc < width && tileType[nr * width + nc] === 0) {
            nearWater = true; break outerW;
          }
        }
      }
      if (nearWater) continue;

      // Minimum distance from any castle
      if (spawnTiles.some(([sr, sc]) => (r - sr) ** 2 + (c - sc) ** 2 < MIN_CASTLE_DIST_SQ)) continue;

      candidates.push([r, c]);
    }
  }

  // Relax castle-distance constraint if not enough candidates
  if (candidates.length < totalCount) {
    for (let r = margin; r < height - margin; r++)
      for (let c = margin; c < width - margin; c++) {
        const idx = r * width + c;
        if (heightmap[idx] === 0 && tileType[idx] === 1) candidates.push([r, c]);
      }
  }
  if (candidates.length === 0) return [];

  // Farthest-point sampling
  const chosen = [candidates[Math.floor(rng.random() * candidates.length)]];
  for (let i = 1; i < totalCount; i++) {
    let bestDist = -1, best = null;
    for (const [cr, cc] of candidates) {
      let minD = Infinity;
      for (const [pr, pc] of chosen) {
        const d = (cr - pr) ** 2 + (cc - pc) ** 2;
        if (d < minD) minD = d;
      }
      if (minD > bestDist) { bestDist = minD; best = [cr, cc]; }
    }
    if (best) chosen.push(best);
  }

  return chosen.flatMap(([r, c]) => {
    const result = [];
    for (let k = 0; k < resourcesPerPatch; k++) {
      result.push({
        type: "gold",
        x: (c + rng.uniform(0.2, 0.8)) * TILE_SIZE,
        y: (r + rng.uniform(0.2, 0.8)) * TILE_SIZE,
      });
    }
    return result;
  });
}

// ------------------------------------------------------------
// Water decorations — one duck, spaced clouds over wide water
// ------------------------------------------------------------
function _placeWaterDecorations(tileType, width, height, seed) {
  const rng = new SeededRandom(seed + 7001);
  const decorations = [];
  const margin = 3;

  const waterTiles = [];
  for (let r = margin; r < height - margin; r++)
    for (let c = margin; c < width - margin; c++)
      if (tileType[r * width + c] === 0) waterTiles.push([r, c]);

  if (waterTiles.length === 0) return decorations;

  // Exactly one duck
  const [dr, dc] = waterTiles[Math.floor(rng.random() * waterTiles.length)];
  decorations.push({type: "duck", x: (dc + rng.uniform(0.2, 0.8)) * TILE_SIZE, y: (dr + rng.uniform(0.2, 0.8)) * TILE_SIZE});

  // Clouds: only over horizontal water runs ≥ 8 tiles wide, at least 3 tiles from each run edge
  const MIN_CLOUD_RUN = 8, EDGE_BUF = 3;
  const cloudCandidates = [];
  for (let r = margin; r < height - margin; r++) {
    let runStart = -1;
    for (let c = margin; c <= width - margin; c++) {
      const water = c < width && tileType[r * width + c] === 0;
      if (water && runStart < 0) runStart = c;
      if (!water && runStart >= 0) {
        const len = c - runStart;
        if (len >= MIN_CLOUD_RUN)
          for (let cc = runStart + EDGE_BUF; cc < c - EDGE_BUF; cc++) cloudCandidates.push([r, cc]);
        runStart = -1;
      }
    }
  }

  // Shuffle, then place with minimum spacing
  for (let i = cloudCandidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng.random() * (i + 1));
    [cloudCandidates[i], cloudCandidates[j]] = [cloudCandidates[j], cloudCandidates[i]];
  }

  const cloudCount = Math.min(7, Math.max(3, Math.floor(waterTiles.length / 120)));
  const MIN_SPACING_SQ = 10 * 10;
  const placed = [];
  for (const [cr, cc] of cloudCandidates) {
    if (placed.length >= cloudCount) break;
    if (placed.some(([pr, pc]) => (cr-pr)**2 + (cc-pc)**2 < MIN_SPACING_SQ)) continue;
    placed.push([cr, cc]);
    decorations.push({type: "cloud", x: (cc + rng.uniform(0.1, 0.9)) * TILE_SIZE, y: (cr + rng.uniform(0.1, 0.9)) * TILE_SIZE});
  }

  return decorations;
}

// ------------------------------------------------------------
// Bears — farthest-point sampling at a safe distance from spawns
// ------------------------------------------------------------
function _placeBears(heightmap, tileType, width, height, totalCount, spawnTiles, seed) {
  if (totalCount <= 0) return [];
  const rng = new SeededRandom(seed + 8001);
  const margin = 4;
  const MIN_SPAWN_DIST_SQ = 15 * 15;

  const candidates = [];
  for (let r = margin; r < height - margin; r++) {
    for (let c = margin; c < width - margin; c++) {
      const idx = r * width + c;
      if (heightmap[idx] !== 0 || tileType[idx] !== 1) continue;

      // Distance from spawns
      if (spawnTiles.some(([sr, sc]) => (r - sr) ** 2 + (c - sc) ** 2 < MIN_SPAWN_DIST_SQ)) continue;

      candidates.push([r, c]);
    }
  }

  if (candidates.length === 0) return [];

  const chosen = [candidates[Math.floor(rng.random() * candidates.length)]];
  for (let i = 1; i < totalCount; i++) {
    let bestDist = -1, best = null;
    for (const [cr, cc] of candidates) {
      let minD = Infinity;
      for (const [pr, pc] of chosen) {
        const d = (cr - pr) ** 2 + (cc - pc) ** 2;
        if (d < minD) minD = d;
      }
      if (minD > bestDist) { bestDist = minD; best = [cr, cc]; }
    }
    if (best) chosen.push(best);
  }

  return chosen.map(([r, c]) => ({
    type: "bear",
    x: (c + rng.uniform(0.2, 0.8)) * TILE_SIZE,
    y: (r + rng.uniform(0.2, 0.8)) * TILE_SIZE,
    placedAt: 0
  }));
}

// ------------------------------------------------------------
// Summary & top-level API
// ------------------------------------------------------------
function _summarizeMap(mapData) {
  const {tilesX: w, tilesY: h, heightmap, tileType, decorations, neutralUnits} = mapData;
  let shoreWater = 0;
  for (let r = 1; r < h-1; r++)
    for (let c = 1; c < w-1; c++) {
      const i = r*w+c;
      if (tileType[i] !== 0) continue;
      if (tileType[i-w] || tileType[i+w] || tileType[i-1] || tileType[i+1]) shoreWater++;
    }
  return {
    playable_tiles:    tileType.reduce((s,v) => s + (v ? 1 : 0), 0),
    shore_water_tiles: shoreWater,
    stairs_east:       tileType.reduce((s,v) => s + (v===2?1:0), 0),
    stairs_west:       tileType.reduce((s,v) => s + (v===3?1:0), 0),
    tree_count:        decorations.reduce((s,d) => s + (d.type==="spruce"||d.type==="birch"?1:0), 0),
    rock_count:        decorations.reduce((s,d) => s + (d.type==="rock"?1:0), 0),
    bear_count:        (neutralUnits || []).reduce((s,u) => s + (u.type==="bear"?1:0), 0),
    max_height:        heightmap.reduce((m,v) => Math.max(m,v), 0),
  };
}

function mergeConfig(overrides) {
  const cfg = {...DEFAULT_CONFIG};
  if (overrides) for (const [k,v] of Object.entries(overrides)) if (k in cfg) cfg[k] = v;
  if (cfg.blob_radius_min         > cfg.blob_radius_max)         [cfg.blob_radius_min,        cfg.blob_radius_max]         = [cfg.blob_radius_max,        cfg.blob_radius_min];
  if (cfg.basin_radius_min        > cfg.basin_radius_max)        [cfg.basin_radius_min,       cfg.basin_radius_max]        = [cfg.basin_radius_max,       cfg.basin_radius_min];
  if (cfg.ridge_width_min         > cfg.ridge_width_max)         [cfg.ridge_width_min,        cfg.ridge_width_max]         = [cfg.ridge_width_max,        cfg.ridge_width_min];
  if (cfg.lake_radius_min         > cfg.lake_radius_max)         [cfg.lake_radius_min,        cfg.lake_radius_max]         = [cfg.lake_radius_max,        cfg.lake_radius_min];
  if (cfg.forest_patch_radius_min > cfg.forest_patch_radius_max) [cfg.forest_patch_radius_min,cfg.forest_patch_radius_max] = [cfg.forest_patch_radius_max,cfg.forest_patch_radius_min];
  if (cfg.tier3_threshold < cfg.tier2_threshold) cfg.tier3_threshold = cfg.tier2_threshold + 0.05;
  return cfg;
}

function generateMap(configOverrides, seed) {
  const cfg = mergeConfig(configOverrides);
  let resolvedSeed = (seed !== null && seed !== undefined) ? seed : cfg.seed;
  if (resolvedSeed === null || resolvedSeed === undefined)
    resolvedSeed = Math.floor(Math.random() * 2147483648);

  const {heightmap, tileType} = _buildHeightmap(cfg, resolvedSeed);
  const decorations      = _generateDecorations(heightmap, tileType, cfg.width, cfg.height, resolvedSeed, cfg);
  const playerCount      = Math.max(2, Math.min(8, cfg.player_count));
  const {buildings, spawns, workers} = _placePlayers(heightmap, tileType, cfg.width, cfg.height, playerCount, resolvedSeed);
  const spawnTiles            = spawns.map(s => [Math.floor(s.y / TILE_SIZE), Math.floor(s.x / TILE_SIZE)]);
  const startGoldDecorations  = _placeStartGold(spawnTiles, heightmap, tileType, cfg.width, cfg.height, cfg.start_gold_per_player, cfg.start_gold_resources, resolvedSeed);
  const neutralGoldCount      = playerCount * Math.max(0, cfg.neutral_gold_per_player);
  const neutralGoldDecorations = neutralGoldCount > 0
    ? _placeGoldDeposits(heightmap, tileType, cfg.width, cfg.height, neutralGoldCount, spawnTiles, cfg.neutral_gold_resources, resolvedSeed)
    : [];
  const waterDecorations      = _placeWaterDecorations(tileType, cfg.width, cfg.height, resolvedSeed);
  const bears = _placeBears(heightmap, tileType, cfg.width, cfg.height, cfg.bear_count, spawnTiles, resolvedSeed);

  const result = {
    tilesX: cfg.width, tilesY: cfg.height,
    heightmap, tileType,
    decorations: [...decorations, ...startGoldDecorations, ...neutralGoldDecorations, ...waterDecorations],
    neutralUnits: bears,
    buildings, spawns, towers: [], workers,
    seed: resolvedSeed,
    params: {...cfg},
  };
  result.summary = _summarizeMap(result);
  return result;
}
