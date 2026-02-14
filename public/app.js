// ─── 3D Table Visualizer — app.js ───────────────────────────────────────────
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ── Constants ───────────────────────────────────────────────────────────────
const TABLE_COUNT = 8;
const GRID = 16;
const TABLE_COLORS = [
  '#6c63ff', '#ff6384', '#36d399', '#f5a623',
  '#00bcd4', '#e040fb', '#ff5252', '#8bc34a',
];

// ── Storage Keys ────────────────────────────────────────────────────────────
const STORAGE_KEY = 'table-visualizer-state';

// ── State ───────────────────────────────────────────────────────────────────
const tables = Array.from({ length: TABLE_COUNT }, () => null); // Float32Array[16*16] | null
const tableNames = Array.from({ length: TABLE_COUNT }, (_, i) => `Table ${i + 1}`);
const tableVisible = Array.from({ length: TABLE_COUNT }, () => true);
const meshes = Array.from({ length: TABLE_COUNT }, () => null);

// ── Persistence ─────────────────────────────────────────────────────────────
const AXIS_FIELDS = ['x-label', 'x-units', 'x-ticks', 'y-label', 'y-units', 'y-ticks', 'z-label', 'z-units'];

function saveState() {
  try {
    const state = {
      axis: {},
      tableData: [],
      tableNames: [...tableNames],
      tableVisible: [...tableVisible],
    };
    // Axis fields
    for (const id of AXIS_FIELDS) {
      state.axis[id] = document.getElementById(id)?.value || '';
    }
    // Table data (serialize from Float32Array to CSV string)
    for (let i = 0; i < TABLE_COUNT; i++) {
      state.tableData[i] = tables[i] ? tableToTsv(tables[i]) : '';
    }
    // Sidebar width
    state.sidebarWidth = document.documentElement.style.getPropertyValue('--sidebar-w');

    // Revise Tab state
    state.reviseSource = document.getElementById('revise-source').value;
    state.reviseApplyTarget = document.getElementById('revise-apply-target').value;
    state.reviseMods = document.getElementById('revise-mods-grid') ? tableToTsv(readModifierGrid(document.getElementById('revise-mods-grid'))) : '';

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) { /* quota exceeded or private mode — silently skip */ }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) { return null; }
}

function restoreState() {
  const state = loadState();
  if (!state) return;

  // Restore axis fields
  if (state.axis) {
    for (const id of AXIS_FIELDS) {
      const el = document.getElementById(id);
      if (el && state.axis[id] !== undefined) el.value = state.axis[id];
    }
  }

  // Restore table data + names
  for (let i = 0; i < TABLE_COUNT; i++) {
    const nameInput = document.getElementById(`table-name-${i}`);
    const status = document.getElementById(`table-status-${i}`);

    if (state.tableData && state.tableData[i]) {
      const data = parseTable(state.tableData[i]);
      tables[i] = data;
      updateGridFromData(i, data);
      if (status) status.textContent = data ? `${GRID}×${GRID} ✓` : 'empty';
    }
    if (nameInput && state.tableNames && state.tableNames[i]) {
      const name = state.tableNames[i];
      tableNames[i] = name;
      if (name !== `Table ${i + 1}`) nameInput.value = name;
    }
  }

  // Restore visibility
  if (state.tableVisible) {
    for (let i = 0; i < TABLE_COUNT; i++) {
      tableVisible[i] = state.tableVisible[i] !== false; // default to visible
      const btn = document.getElementById(`table-vis-${i}`);
      if (btn) {
        btn.textContent = tableVisible[i] ? '👁' : '—';
        btn.classList.toggle('hidden-table', !tableVisible[i]);
      }
    }
  }

  // Restore sidebar width
  if (state.sidebarWidth) {
    document.documentElement.style.setProperty('--sidebar-w', state.sidebarWidth);
    resize();
  }

  // Restore Revise tab settings
  if (state.reviseSource !== undefined) {
    document.getElementById('revise-source').value = state.reviseSource;
  }
  if (state.reviseApplyTarget !== undefined) {
    document.getElementById('revise-apply-target').value = state.reviseApplyTarget;
  }
  if (state.reviseMods) {
    const mods = parseTable(state.reviseMods);
    writeGridData(document.getElementById('revise-mods-grid'), mods);
  }
}

// ── Three.js Setup ──────────────────────────────────────────────────────────
const canvas = document.getElementById('three-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
camera.position.set(18, 14, 18);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(7.5, 0, 7.5);
controls.update();

// Lighting
const ambient = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambient);
const dir1 = new THREE.DirectionalLight(0xffffff, 0.8);
dir1.position.set(10, 20, 15);
scene.add(dir1);
const dir2 = new THREE.DirectionalLight(0x6c63ff, 0.3);
dir2.position.set(-10, 10, -10);
scene.add(dir2);

// Subtle ground grid
const gridHelper = new THREE.GridHelper(15, 15, 0x333355, 0x222244);
gridHelper.position.set(7.5, -0.01, 7.5);
scene.add(gridHelper);

// Axis group (rebuilt on config change)
let axisGroup = new THREE.Group();
scene.add(axisGroup);

// ── Resize ──────────────────────────────────────────────────────────────────
function resize() {
  const vp = document.getElementById('viewport');
  const w = vp.clientWidth;
  const h = vp.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ── Data Parsing ────────────────────────────────────────────────────────────
function parseTable(text) {
  if (!text || !text.trim()) return null;
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 1) return null;

  // Auto-detect delimiter
  const delim = lines[0].includes('\t') ? '\t' : ',';
  const data = new Float32Array(GRID * GRID);

  for (let r = 0; r < Math.min(lines.length, GRID); r++) {
    const cols = lines[r].split(delim).map(s => parseFloat(s.trim()));
    for (let c = 0; c < Math.min(cols.length, GRID); c++) {
      data[r * GRID + c] = isNaN(cols[c]) ? 0 : cols[c];
    }
  }
  return data;
}

// ── Surface Builder ─────────────────────────────────────────────────────────
function buildSurface(data, colorIndex) {
  const color = new THREE.Color(TABLE_COLORS[colorIndex % TABLE_COLORS.length]);

  // Find the largest absolute value for scaling (Z=0 always maps to Y=0)
  let absMax = 0;
  for (let i = 0; i < data.length; i++) {
    const a = Math.abs(data[i]);
    if (a > absMax) absMax = a;
  }
  const scale = absMax > 0 ? 6 / absMax : 1; // map to ~6 units tall

  const geom = new THREE.PlaneGeometry(15, 15, GRID - 1, GRID - 1);
  // Rotate so it lies in XZ plane with Y as height, then shift to 0–15 range
  geom.rotateX(-Math.PI / 2);
  geom.translate(7.5, 0, 7.5);

  const pos = geom.attributes.position;
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const idx = r * GRID + c;
      const height = data[idx] * scale;
      pos.setY(idx, height);
    }
  }
  geom.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
    metalness: 0.1,
    roughness: 0.55,
    wireframe: false,
  });

  // Also add a wireframe overlay for readability
  const wire = new THREE.MeshBasicMaterial({
    color,
    wireframe: true,
    transparent: true,
    opacity: 0.18,
  });

  const group = new THREE.Group();
  const solidMesh = new THREE.Mesh(geom, mat);
  const wireMesh = new THREE.Mesh(geom.clone(), wire);
  group.add(solidMesh);
  group.add(wireMesh);

  return group;
}

// ── Axis Builder ────────────────────────────────────────────────────────────
function buildAxes() {
  // Remove previous
  scene.remove(axisGroup);
  axisGroup = new THREE.Group();

  const xLabel = document.getElementById('x-label').value || '';
  const xUnits = document.getElementById('x-units').value || '';
  const yLabel = document.getElementById('y-label').value || '';
  const yUnits = document.getElementById('y-units').value || '';
  const zLabel = document.getElementById('z-label').value || '';
  const zUnits = document.getElementById('z-units').value || '';

  const xTicks = parseTicks(document.getElementById('x-ticks').value);
  const yTicks = parseTicks(document.getElementById('y-ticks').value);

  const lineMat = new THREE.LineBasicMaterial({ color: 0x555577 });

  // X axis line
  const xGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(15, 0, 0),
  ]);
  axisGroup.add(new THREE.Line(xGeom, lineMat));

  // Y axis line (world Z direction = "rows")
  const yGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 15),
  ]);
  axisGroup.add(new THREE.Line(yGeom, lineMat));

  // Z axis line (world Y = height)
  const zGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 7, 0),
  ]);
  axisGroup.add(new THREE.Line(zGeom, lineMat));

  // Tick marks & labels using sprites
  const step = 15 / (GRID - 1);

  // X ticks
  for (let i = 0; i < GRID; i++) {
    if (i % 3 !== 0 && GRID > 8) continue; // skip some for legibility
    const label = xTicks[i] !== undefined ? String(xTicks[i]) : String(i);
    const sprite = makeTextSprite(label, '#8a8fa8', 0.4);
    sprite.position.set(i * step, -0.6, -0.3);
    axisGroup.add(sprite);
  }

  // Y ticks (rows)
  for (let i = 0; i < GRID; i++) {
    if (i % 3 !== 0 && GRID > 8) continue;
    const label = yTicks[i] !== undefined ? String(yTicks[i]) : String(i);
    const sprite = makeTextSprite(label, '#8a8fa8', 0.4);
    sprite.position.set(-0.6, -0.3, i * step);
    axisGroup.add(sprite);
  }

  // Axis labels
  if (xLabel || xUnits) {
    const txt = xLabel + (xUnits ? ` (${xUnits})` : '');
    const s = makeTextSprite(txt, '#6c63ff', 0.55);
    s.position.set(7.5, -1.3, -0.5);
    axisGroup.add(s);
  }
  if (yLabel || yUnits) {
    const txt = yLabel + (yUnits ? ` (${yUnits})` : '');
    const s = makeTextSprite(txt, '#6c63ff', 0.55);
    s.position.set(-1.5, -0.5, 7.5);
    axisGroup.add(s);
  }
  if (zLabel || zUnits) {
    const txt = zLabel + (zUnits ? ` (${zUnits})` : '');
    const s = makeTextSprite(txt, '#6c63ff', 0.55);
    s.position.set(-1.2, 3.5, -0.5);
    axisGroup.add(s);
  }

  scene.add(axisGroup);
}

function parseTicks(str) {
  if (!str || !str.trim()) return [];
  return str.split(',').map(s => s.trim()).filter(Boolean);
}

// ── Text Sprites ────────────────────────────────────────────────────────────
function makeTextSprite(text, color = '#ffffff', scale = 1) {
  const cvs = document.createElement('canvas');
  const ctx = cvs.getContext('2d');
  const fontSize = 48;
  ctx.font = `500 ${fontSize}px Inter, sans-serif`;
  const metrics = ctx.measureText(text);
  const w = Math.ceil(metrics.width) + 16;
  const h = fontSize + 16;
  cvs.width = w; cvs.height = h;
  ctx.font = `500 ${fontSize}px Inter, sans-serif`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 8, h / 2);

  const tex = new THREE.CanvasTexture(cvs);
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set((w / h) * scale, scale, 1);
  return sprite;
}

// ── Update Scene ────────────────────────────────────────────────────────────
function updateScene() {
  // Remove old meshes
  for (let i = 0; i < TABLE_COUNT; i++) {
    if (meshes[i]) { scene.remove(meshes[i]); meshes[i] = null; }
  }

  // Build new meshes
  for (let i = 0; i < TABLE_COUNT; i++) {
    if (!tables[i]) continue;
    meshes[i] = buildSurface(tables[i], i);
    scene.add(meshes[i]);
  }

  updateVisibility();
  buildAxes();
  updateLegend();
}

function updateVisibility() {
  for (let i = 0; i < TABLE_COUNT; i++) {
    if (!meshes[i]) continue;
    meshes[i].visible = tableVisible[i];
  }
}

// ── Legend ───────────────────────────────────────────────────────────────────
function updateLegend() {
  const legend = document.getElementById('legend');
  legend.innerHTML = '';
  let hasAny = false;

  for (let i = 0; i < TABLE_COUNT; i++) {
    if (!tables[i] || !tableVisible[i]) continue;
    hasAny = true;
    const item = document.createElement('div');
    item.className = 'legend-item';
    const dot = document.createElement('span');
    dot.className = 'legend-color';
    dot.style.background = TABLE_COLORS[i];
    item.appendChild(dot);
    const txt = document.createElement('span');
    txt.textContent = tableNames[i];
    item.appendChild(txt);
    legend.appendChild(item);
  }
  legend.classList.toggle('hidden', !hasAny);
}

// ── UI Wiring ───────────────────────────────────────────────────────────────

// Build table data grids
const dataContent = document.getElementById('data-content');
for (let i = 0; i < TABLE_COUNT; i++) {
  const entry = document.createElement('div');
  entry.className = 'table-entry';
  entry.innerHTML = `
    <div class="table-entry-header">
      <span><span class="table-color-dot" style="background:${TABLE_COLORS[i]}"></span> Table ${i + 1}</span>
      <span style="display:flex;align-items:center;gap:6px;">
        <span class="status" id="table-status-${i}">empty</span>
        <button class="table-action-btn" id="table-copy-${i}" title="Copy to clipboard">📋</button>
        <button class="table-action-btn danger" id="table-clear-${i}" title="Clear table">🗑</button>
        <button class="table-visibility-btn" id="table-vis-${i}" title="Toggle visibility">👁</button>
      </span>
    </div>
  `;
  // Create and append grid
  const grid = createTableGrid(i);
  entry.appendChild(grid);
  
  // Name input
  const nameInputWrapper = document.createElement('div');
  nameInputWrapper.innerHTML = `<input class="table-name-input" id="table-name-${i}" type="text" placeholder="Custom name (optional)" />`;
  entry.appendChild(nameInputWrapper.firstChild);

  dataContent.appendChild(entry);
}

// Debounce helper
function debounce(fn, ms) {
  let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

// Name input listeners
for (let i = 0; i < TABLE_COUNT; i++) {
  const nameInput = document.getElementById(`table-name-${i}`);
  nameInput.addEventListener('input', debounce(() => {
    tableNames[i] = nameInput.value.trim() || `Table ${i + 1}`;
    updateLegend();
    saveState();
  }, 300));
}

// Per-table action buttons (Copy/Clear/Visibility)
for (let i = 0; i < TABLE_COUNT; i++) {
  // Visibility
  const visBtn = document.getElementById(`table-vis-${i}`);
  visBtn.addEventListener('click', () => {
    tableVisible[i] = !tableVisible[i];
    visBtn.textContent = tableVisible[i] ? '👁' : '—';
    visBtn.classList.toggle('hidden-table', !tableVisible[i]);
    updateVisibility();
    updateLegend();
    saveState();
  });

  // Copy
  const copyBtn = document.getElementById(`table-copy-${i}`);
  copyBtn.addEventListener('click', () => {
    if (tables[i]) {
      navigator.clipboard.writeText(tableToTsv(tables[i]));
      const orig = copyBtn.textContent;
      copyBtn.textContent = '✓';
      setTimeout(() => copyBtn.textContent = orig, 1000);
    }
  });

  // Clear
  const clearBtn = document.getElementById(`table-clear-${i}`);
  clearBtn.addEventListener('click', () => {
    if (confirm(`Clear Table ${i + 1}?`)) {
      tables[i] = null;
      updateGridFromData(i, new Float32Array(GRID * GRID));
      const status = document.getElementById(`table-status-${i}`);
      if (status) status.textContent = 'empty';
      updateScene();
      saveState();
    }
  });
}

// ── Grid Helpers ────────────────────────────────────────────────────────────

function createTableGrid(tableIndex) {
  const container = document.createElement('div');
  container.className = 'table-grid';
  container.id = `table-grid-${tableIndex}`;

  const callbacks = {
    onInput: (r, c, val) => {
      handleCellInput(tableIndex, r, c, val);
      saveState();
    },
    onPaste: (e, r, c) => {
      handleGridPaste(e, tableIndex, r, c); // Existing pasted-to-data logic
    }
  };

  buildGrid(container, callbacks);
  return container;
}

// ── Generic Grid Builder ──
function buildGrid(container, options = {}) {
  // Clear any existing
  container.innerHTML = '';
  // Ensure class if missing (though usually set on container before passing)
  if (!container.className.includes('table-grid')) {
    container.classList.add('table-grid');
  }

  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'cell-input';
      input.dataset.r = r;
      input.dataset.c = c;
      if (options.readOnly) input.readOnly = true;

      // Input handler
      if (options.onInput) {
        input.addEventListener('input', () => {
          options.onInput(r, c, input.value, input);
        });
      }

      // Paste handler
      if (options.onPaste) {
        input.addEventListener('paste', (e) => {
          options.onPaste(e, r, c, input);
        });
      }

      // Default focus/select behavior
      input.addEventListener('focus', () => input.select());

      container.appendChild(input);
    }
  }
}

function handleCellInput(tableIndex, r, c, value) {
  if (!tables[tableIndex]) {
    tables[tableIndex] = new Float32Array(GRID * GRID);
  }
  const val = parseFloat(value);
  tables[tableIndex][r * GRID + c] = isNaN(val) ? 0 : val;
  
  const status = document.getElementById(`table-status-${tableIndex}`);
  if (status) status.textContent = `${GRID}×${GRID} ✓`;

  updateScene();
  updateCellColors(tableIndex);
}



function updateCellColors(tableIndex) {
  const data = tables[tableIndex];
  const grid = document.getElementById(`table-grid-${tableIndex}`);
  if (!data || !grid) return;
  
  const baseColor = new THREE.Color(TABLE_COLORS[tableIndex % TABLE_COLORS.length]);
  applyHeatmap(data, grid, baseColor);
}

function applyHeatmap(data, container, baseColor) {
  if (!data || !container) {
    console.warn('applyHeatmap missing args');
    return;
  }
  const inputs = container.getElementsByTagName('input');
  // console.log('applyHeatmap', { inputs: inputs.length, dataMin: Math.min(...data), dataMax: Math.max(...data) });

  // Find min/max
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (isNaN(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  
  // If all NaN or empty, clear all and return
  if (min === Infinity) {
    for (let i = 0; i < inputs.length; i++) {
        inputs[i].style.backgroundColor = '';
        inputs[i].style.color = '';
    }
    return;
  }

  const range = max - min;
  
  // Calculate inverse (complementary) color
  const inverseColor = baseColor.clone();
  const hsl = { h: 0, s: 0, l: 0 };
  inverseColor.getHSL(hsl);
  hsl.h = (hsl.h + 0.5) % 1.0; // Rotate hue by 180 degrees
  inverseColor.setHSL(hsl.h, hsl.s, hsl.l);

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    // For generic grids (Revise), we might just iterate by index if dataset.r/c not dependable?
    // But our buildGrid sets dataset r/c.
    const r = parseInt(input.dataset.r, 10);
    const c = parseInt(input.dataset.c, 10);
    // Safety check
    if (isNaN(r) || isNaN(c)) continue;

    const val = data[r * GRID + c];
    if (isNaN(val)) {
        input.style.backgroundColor = '';
        input.style.color = '';
        continue;
    }

    // Calculate intensity (0 to 1)
    let t = 0;
    if (range > 0.000001) {
        t = (val - min) / range;
    } else {
        t = 0.5; // Default if all values are same
    }
    
    // Interpolate color: linear interpolation from inverse to base
    const finalColor = inverseColor.clone().lerp(baseColor, t);
    
    // Convert to rgbaCSS
    const rCol = Math.round(finalColor.r * 255);
    const gCol = Math.round(finalColor.g * 255);
    const bCol = Math.round(finalColor.b * 255);
    
    // Use a fixed opacity for better visibility against dark background
    // 0.6 seems reasonable
    input.style.backgroundColor = `rgba(${rCol}, ${gCol}, ${bCol}, 0.6)`;

    // Contrast text color
    // Determine the brightness of the background color
    // Simple luminance formula: 0.299*R + 0.587*G + 0.114*B
    const lum = 0.299 * finalColor.r + 0.587 * finalColor.g + 0.114 * finalColor.b;
    
    if (lum > 0.5) {
        input.style.color = '#000'; // Dark text for light background
        input.style.fontWeight = '500';
    } else {
        input.style.color = '#fff'; // White text for dark background
        input.style.fontWeight = '';
    }
  }
}

function handleGridPaste(e, tableIndex, startR, startC) {
  e.preventDefault();
  const text = (e.clipboardData || window.clipboardData).getData('text');
  if (!text) return;

  // Parse pasted text
  // Remove trailing newlines only, preserving leading ones for vertical offset
  const cleanText = text.replace(/\r?\n$/, '');
  const lines = cleanText.split(/\r?\n/);
  if (lines.length === 0) return;
  const delim = text.includes('\t') ? '\t' : ','; // simple auto-detect

  if (!tables[tableIndex]) {
    tables[tableIndex] = new Float32Array(GRID * GRID);
  }

  for (let i = 0; i < lines.length; i++) {
    const r = startR + i;
    if (r >= GRID) break;
    const cols = lines[i].split(delim);
    for (let j = 0; j < cols.length; j++) {
      const c = startC + j;
      if (c >= GRID) break;
      const clean = cols[j].replace(/[^0-9.\-]/g, ''); // strip non-numeric except . and -
      const val = parseFloat(clean);
      if (!isNaN(val)) {
        tables[tableIndex][r * GRID + c] = val;
      }
    }
  }

  // Update UI and Scene
  updateGridFromData(tableIndex, tables[tableIndex]);
  const status = document.getElementById(`table-status-${tableIndex}`);
  if (status) status.textContent = `${GRID}×${GRID} ✓`;
  
  updateScene();
  saveState();
}

function updateGridFromData(tableIndex, data) {
  const grid = document.getElementById(`table-grid-${tableIndex}`);
  if (!grid || !data) return;
  const inputs = grid.getElementsByTagName('input');
  
  for (let i = 0; i < inputs.length; i++) {
    const r = parseInt(inputs[i].dataset.r, 10);
    const c = parseInt(inputs[i].dataset.c, 10);
    const val = data[r * GRID + c];
    // Enforce 3 decimals, including trailing zeros
    inputs[i].value = val.toFixed(3);
  }
  updateCellColors(tableIndex);
}

// Axis config change (rebuild axes + persist)
AXIS_FIELDS.forEach(id => {
  document.getElementById(id).addEventListener('input', debounce(() => {
    buildAxes();
    saveState();
  }, 400));
});

// Panel collapse
document.querySelectorAll('.panel-title[data-toggle]').forEach(title => {
  title.addEventListener('click', () => {
    const targetId = title.dataset.toggle;
    const body = document.getElementById(targetId);
    title.classList.toggle('collapsed');
    body.classList.toggle('collapsed');
  });
});

// ── Tab Switching ───────────────────────────────────────────────────────────
document.querySelectorAll('.header-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.header-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.tab;
    document.querySelectorAll('.sidebar-panel').forEach(p => {
      p.style.display = p.dataset.panel === target ? '' : 'none';
    });
  });
});

// ── Revision Logic ──────────────────────────────────────────────────────────
// ── Revision Logic ──────────────────────────────────────────────────────────
const reviseSource = document.getElementById('revise-source');
// We now use containers instead of textareas
const reviseBaseContainer = document.getElementById('revise-base-grid');
const reviseModsContainer = document.getElementById('revise-mods-grid');
const reviseOutputContainer = document.getElementById('revise-output-grid');

// Build the grids
buildGrid(reviseBaseContainer, {
  onInput: () => debounce(computeRevision, 300)(),
  onPaste: (e, r, c) => handleGenericGridPaste(e, reviseBaseContainer, r, c, () => computeRevision())
});

// Modifiers grid
buildGrid(reviseModsContainer, {
  onInput: () => {
    debounce(() => {
      computeRevision();
      saveState();
    }, 300)();
    // Also update modifier self-colors if we want
    // applyHeatmap(readModifierGrid(reviseModsContainer), reviseModsContainer, new THREE.Color('#6c63ff'));
  }, 
  onPaste: (e, r, c) => handleGenericGridPaste(e, reviseModsContainer, r, c, () => {
      computeRevision();
      saveState();
      // applyHeatmap(readModifierGrid(reviseModsContainer), reviseModsContainer, new THREE.Color('#6c63ff'));
  })
});

buildGrid(reviseOutputContainer, {
  readOnly: true
});

// ── Revision Grid Sync ──
function highlightReviseCells(r, c, active, sourceContainer) {
  [reviseBaseContainer, reviseModsContainer, reviseOutputContainer].forEach(container => {
    // Skip the container where the action originated
    if (container === sourceContainer) return;
    const inputs = container.getElementsByTagName('input');
    const idx = parseInt(r) * GRID + parseInt(c);
    if (inputs[idx]) {
      inputs[idx].classList.toggle('selection-shadow', active);
    }
  });
}

[reviseBaseContainer, reviseModsContainer, reviseOutputContainer].forEach(container => {
  container.addEventListener('focusin', (e) => {
    if (e.target.classList.contains('cell-input')) {
      highlightReviseCells(e.target.dataset.r, e.target.dataset.c, true, container);
    }
  });
  container.addEventListener('focusout', (e) => {
    if (e.target.classList.contains('cell-input')) {
      highlightReviseCells(e.target.dataset.r, e.target.dataset.c, false, container);
    }
  });
});


// Helper: read grid to float32
function readGridData(container) {
  const inputs = container.getElementsByTagName('input');
  const data = new Float32Array(GRID * GRID);
  for (let i = 0; i < inputs.length; i++) {
    const r = parseInt(inputs[i].dataset.r, 10);
    const c = parseInt(inputs[i].dataset.c, 10);
    const val = parseFloat(inputs[i].value);
    data[r * GRID + c] = isNaN(val) ? 0 : val;
  }
  return data;
}

// Helper: write float32 to grid
function writeGridData(container, data) {
  const inputs = container.getElementsByTagName('input');
  for (let i = 0; i < inputs.length; i++) {
    const r = parseInt(inputs[i].dataset.r, 10);
    const c = parseInt(inputs[i].dataset.c, 10);
    const val = data[r * GRID + c];
    inputs[i].value = isNaN(val) ? '' : val.toFixed(3);
  }
}

// Helper: Generic grid paste logic (DOM-based)
function handleGenericGridPaste(e, container, startR, startC, onComplete) {
  e.preventDefault();
  const text = (e.clipboardData || window.clipboardData).getData('text');
  if (!text) return;
  // Remove trailing newlines only
  const cleanText = text.replace(/\r?\n$/, '');
  const lines = cleanText.split(/\r?\n/);
  if (lines.length === 0) return;
  const delim = text.includes('\t') ? '\t' : ',';
  
  const inputs = container.getElementsByTagName('input');
  // Map inputs by coordinate for easier access? Or just iterate?
  // Easier to index directly since we know order is (row-major) r*GRID + c
  
  for (let i = 0; i < lines.length; i++) {
    const r = startR + i;
    if (r >= GRID) break;
    const cols = lines[i].split(delim);
    for (let j = 0; j < cols.length; j++) {
      const c = startC + j;
      if (c >= GRID) break;
      const clean = cols[j].replace(/[^0-9.\-]/g, '');
      const val = clean; // Keep as string for input value
      
      const idx = r * GRID + c;
      if (idx < inputs.length) {
        inputs[idx].value = val;
      }
    }
  }
  if (onComplete) onComplete();
}

// Helper: parse a partial modifier table (empty cells = NaN → no change)
// We need a specific reader for Modifiers because empty = NaN
function readModifierGrid(container) {
  const inputs = container.getElementsByTagName('input');
  const data = new Float32Array(GRID * GRID).fill(NaN);
  for (let i = 0; i < inputs.length; i++) {
    const valStr = inputs[i].value.trim();
    if (valStr === '') continue; // NaN
    const val = parseFloat(valStr);
    if (!isNaN(val)) data[i] = val;
  }
  return data;
}

/**
 * Applies percentage modifiers to a base table.
 * @param {Float32Array} base - 16x16 base table
 * @param {Float32Array} mods - 16x16 modifier table (NaN means no change)
 * @returns {Float32Array} - Resulting table
 */
function applyRevision(base, mods) {
  const result = new Float32Array(GRID * GRID);
  for (let i = 0; i < GRID * GRID; i++) {
    const b = base[i];
    const m = mods[i];
    // Formula: base * (1 + modifier). Logic: 5 = +5%
    result[i] = isNaN(m) ? b : b * (1 + m/100);
  }
  return result;
}

/**
 * Serializes a 16x16 table to a CSV string.
 * @param {Float32Array} data
 * @returns {string}
 */
function tableToTsv(data) {
  if (!data) return '';
  let csv = '';
  for (let r = 0; r < GRID; r++) {
    const row = [];
    for (let c = 0; c < GRID; c++) {
      const val = data[r * GRID + c];
      row.push(val.toFixed(3));
    }
    csv += row.join('\t') + (r < GRID - 1 ? '\n' : '');
  }
  return csv;
}

// Compute revised output
function computeRevision() {
  const baseData = readGridData(reviseBaseContainer);
  const modData = readModifierGrid(reviseModsContainer);
  
  
  const result = applyRevision(baseData, modData);
  writeGridData(reviseOutputContainer, result);

  // Apply Heatmaps
  
  // Base: Color of source table
  const srcIdx = parseInt(reviseSource.value, 10);
  if (srcIdx >= 0 && srcIdx < TABLE_COUNT) {
    applyHeatmap(baseData, reviseBaseContainer, new THREE.Color(TABLE_COLORS[srcIdx % TABLE_COLORS.length]));
  } else {
    // Default color if custom paste
    applyHeatmap(baseData, reviseBaseContainer, new THREE.Color('#888888'));
  }

  // Modifiers: Match Source Color
  if (srcIdx >= 0 && srcIdx < TABLE_COUNT) {
    applyHeatmap(modData, reviseModsContainer, new THREE.Color(TABLE_COLORS[srcIdx % TABLE_COLORS.length]));
  } else {
    applyHeatmap(modData, reviseModsContainer, new THREE.Color('#888888'));
  }

  // Output: Use Source Color (to match the table being revised)
  if (srcIdx >= 0 && srcIdx < TABLE_COUNT) {
    applyHeatmap(result, reviseOutputContainer, new THREE.Color(TABLE_COLORS[srcIdx % TABLE_COLORS.length]));
  } else {
    applyHeatmap(result, reviseOutputContainer, new THREE.Color('#888888'));
  }
}

// When source selector changes, populate base grid
reviseSource.addEventListener('change', () => {
  const idx = parseInt(reviseSource.value, 10);
  if (idx >= 0 && idx < TABLE_COUNT) {
    // Sync "Apply to" target with source table selection
    document.getElementById('revise-apply-target').value = idx;

    if (tables[idx]) {
      writeGridData(reviseBaseContainer, tables[idx]);
    } else {
      writeGridData(reviseBaseContainer, new Float32Array(GRID * GRID));
    }
  } else {
    // Clear base, but keep grid structure - just clear values?
    // We already have generic paste that works.
    // If text, clearing values is enough.
    writeGridData(reviseBaseContainer, new Float32Array(GRID * GRID));
  }
  computeRevision();
  saveState();
});

// Update Output color when target changes
document.getElementById('revise-apply-target').addEventListener('change', () => {
  computeRevision();
  saveState();
});

// Copy output (Grid to CSV)
document.getElementById('revise-copy-btn').addEventListener('click', () => {
    const data = readGridData(reviseOutputContainer);
    const csv = tableToTsv(data);
    if (csv) {
    navigator.clipboard.writeText(csv);
    const btn = document.getElementById('revise-copy-btn');
    const orig = btn.textContent;
    btn.textContent = '✓ Copied';
    setTimeout(() => btn.textContent = orig, 1500);
  }
});

// ... existing code ...

function updateTableSlot(index, newData) {
  tables[index] = newData;
  updateGridFromData(index, newData);
  const status = document.getElementById(`table-status-${index}`);
  if (status) status.textContent = newData ? `${GRID}×${GRID} ✓` : 'empty';
}

// Apply output to a single table slot
document.getElementById('revise-apply-btn').addEventListener('click', () => {
  const base = readGridData(reviseBaseContainer);
  const mods = readModifierGrid(reviseModsContainer);
  
  const target = parseInt(document.getElementById('revise-apply-target').value, 10);
  if (target < 0 || target >= TABLE_COUNT) return;

  // We should make sure we have valid data. If Base is all zeros, maybe that's fine?
  // If undefined/null, handle it:
  const newData = applyRevision(base, mods);
  updateTableSlot(target, newData);
  
  updateScene();
  saveState();

  // Flash button
  const btn = document.getElementById('revise-apply-btn');
  const orig = btn.textContent;
  btn.textContent = '✓ Applied';
  setTimeout(() => btn.textContent = orig, 1500);

  // Clear modifiers after apply
  writeGridData(reviseModsContainer, new Float32Array(GRID * GRID).fill(NaN));
  computeRevision();
  saveState();
});

// Apply output to ALL active tables
document.getElementById('revise-apply-all-btn').addEventListener('click', () => {
  const mods = readModifierGrid(reviseModsContainer);
  // Check if mods has any values?
  let hasMods = false;
  for(let i=0; i<mods.length; i++) { if(!isNaN(mods[i])) hasMods = true; }
  
  // If no mods, maybe we just want to apply base? But "Apply All" usually implies applying the modifier to all.
  // The original logic was: applyRevision(tables[i], mods).
  
  if (!hasMods) return; // nothing to do

  let count = 0;
  for (let i = 0; i < TABLE_COUNT; i++) {
    if (tables[i]) {
      const newData = applyRevision(tables[i], mods);
      updateTableSlot(i, newData);
      count++;
    }
  }

  if (count > 0) {
    updateScene();
    saveState();
    
    // Flash button
    const btn = document.getElementById('revise-apply-all-btn');
    const orig = btn.textContent;
    btn.textContent = `✓ Applied to ${count}`;
    setTimeout(() => btn.textContent = orig, 1500);

    // Clear modifiers after apply
    writeGridData(reviseModsContainer, new Float32Array(GRID * GRID).fill(NaN));
    computeRevision();
    saveState();
  }
});

// ── Revise Tab Actions ──
document.getElementById('revise-base-copy').addEventListener('click', () => {
  const data = readGridData(reviseBaseContainer);
  navigator.clipboard.writeText(tableToTsv(data));
  const el = document.getElementById('revise-base-copy');
  const orig = el.textContent;
  el.textContent = '✓';
  setTimeout(() => el.textContent = orig, 1000);
});

document.getElementById('revise-base-clear').addEventListener('click', () => {
  if (confirm('Clear Base Table?')) {
    writeGridData(reviseBaseContainer, new Float32Array(GRID * GRID));
    computeRevision();
    saveState();
  }
});

document.getElementById('revise-mods-copy').addEventListener('click', () => {
  const data = readModifierGrid(reviseModsContainer);
  // Need a special version of tableToCsv that handle NaNs as empty strings
  let tsv = '';
  for (let r = 0; r < GRID; r++) {
    const row = [];
    for (let c = 0; c < GRID; c++) {
      const v = data[r * GRID + c];
      row.push(isNaN(v) ? '' : v);
    }
    tsv += row.join('\t') + (r < GRID - 1 ? '\n' : '');
  }
  navigator.clipboard.writeText(tsv);
  const el = document.getElementById('revise-mods-copy');
  const orig = el.textContent;
  el.textContent = '✓';
  setTimeout(() => el.textContent = orig, 1000);
});

document.getElementById('revise-mods-clear').addEventListener('click', () => {
  if (confirm('Clear Percentage Modifiers?')) {
    writeGridData(reviseModsContainer, new Float32Array(GRID * GRID).fill(NaN));
    computeRevision();
    saveState();
  }
});

document.getElementById('revise-output-clear').addEventListener('click', () => {
  if (confirm('Clear Output & Modifiers?')) {
    writeGridData(reviseModsContainer, new Float32Array(GRID * GRID).fill(NaN));
    computeRevision();
    saveState();
  }
});

// ── Restore Saved State & Initial Build ────────────────────────────────────
restoreState();
updateScene();

// Initial populate for Revise tab
const initialReviseIdx = parseInt(document.getElementById('revise-source').value, 10);
if (initialReviseIdx >= 0 && initialReviseIdx < TABLE_COUNT && tables[initialReviseIdx]) {
  writeGridData(document.getElementById('revise-base-grid'), tables[initialReviseIdx]);
}
computeRevision();

// ── Sidebar Resizer ───────────────────────────────────────────────────────
const resizer = document.getElementById('sidebar-resizer');
let isResizing = false;

resizer.addEventListener('mousedown', () => {
  isResizing = true;
  resizer.classList.add('active');
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none'; // prevent text selection
});

document.addEventListener('mousemove', (e) => {
  if (!isResizing) return;
  const newWidth = Math.max(280, Math.min(window.innerWidth * 0.8, e.clientX));
  document.documentElement.style.setProperty('--sidebar-w', `${newWidth}px`);
  resize(); // update Three.js canvas size
});

document.addEventListener('mouseup', () => {
  if (isResizing) {
    isResizing = false;
    resizer.classList.remove('active');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    saveState(); // persist new width
  }
});

// ── Render Loop ─────────────────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
