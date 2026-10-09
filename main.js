import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// =====================================================================
//  Shreya's Dream House — 3D version of the 2D floor plan (plan.html)
//  Plan coordinates are in "plan pixels" (same numbers as the 2D map);
//  S converts them to metres.
// =====================================================================

const S = 0.03;                       // metres per plan pixel
const X = px => (px - 360) * S;       // plan x -> world x
const Z = py => (py - 400) * S;       // plan y -> world z (north = -z)
const FH = 3.0;                       // first-floor level
const WH0 = 2.99, WH1 = 2.8;          // wall heights (ground / first)
const WT = 0.15;                      // wall thickness
const N = 0, SO = Math.PI, WE = Math.PI / 2, EA = -Math.PI / 2;  // "back against" N/S/W/E wall
const off = d => 2.5 + d / (2 * S);   // plan px from wall line to centre of an object of depth d

// ---------- seeded random so the house looks the same every time ----------
let _seed = 20261009;
const rand = () => {
  _seed = (_seed + 0x6D2B79F5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const rr = (a, b) => a + (b - a) * rand();
const pick = arr => arr[Math.floor(rand() * arr.length)];

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 500);
camera.position.set(24, 20, 28);

const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// ---------- materials ----------
const _mc = new Map();
const glowMats = [];
function M(color, rough = 0.75, metal = 0) {
  const k = `${color}|${rough}|${metal}`;
  if (!_mc.has(k)) _mc.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, envMap: metal > 0.4 ? envTex : null }));
  return _mc.get(k);
}
function glow(color, ei = 1, side = THREE.FrontSide) {
  const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: ei, roughness: 0.4, side });
  m.userData.base = ei;
  glowMats.push(m);
  return m;
}
const chrome = M('#e6e9ee', 0.15, 1);
const gold = M('#d4af37', 0.3, 0.9);
const blackGloss = M('#141414', 0.2, 0.3);
const glassMat = new THREE.MeshStandardMaterial({ color: '#cfeeff', transparent: true, opacity: 0.25, roughness: 0.05, metalness: 0.3, envMap: envTex, depthWrite: false });
const mirrorMat = new THREE.MeshStandardMaterial({ color: '#e8f4ff', roughness: 0.02, metalness: 1, envMap: envTex });

function shade(hex, amt) { const c = new THREE.Color(hex); c.offsetHSL(0, 0, amt); return '#' + c.getHexString(); }

// ---------- primitive helpers (y = bottom for box/cyl, centre for sphere) ----------
const asMat = c => (c && c.isMaterial) ? c : M(c);
function add(p, geo, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, asMat(mat));
  m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = true;
  p.add(m);
  return m;
}
const box = (p, w, h, d, c, x = 0, y = 0, z = 0) => add(p, new THREE.BoxGeometry(w, h, d), c, x, y + h / 2, z);
const cyl = (p, rt, rb, h, c, x = 0, y = 0, z = 0, seg = 24) => add(p, new THREE.CylinderGeometry(rt, rb, h, seg), c, x, y + h / 2, z);
const sph = (p, r, c, x = 0, y = 0, z = 0, seg = 20) => add(p, new THREE.SphereGeometry(r, seg, Math.ceil(seg * 0.7)), c, x, y, z);
const G = () => new THREE.Group();
function put(parent, obj, px, py, rot = 0, y = 0) {
  obj.position.set(X(px), y, Z(py));
  obj.rotation.y = rot;
  parent.add(obj);
  return obj;
}

// ---------- canvas textures ----------
function ctex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function drawPattern(type, g, w, h, c, c2) {
  g.fillStyle = c; g.fillRect(0, 0, w, h);
  if (type === 'wood') {
    const rows = 6;
    for (let i = 0; i < rows; i++) {
      const y = i * h / rows;
      g.fillStyle = shade(c, rr(-0.05, 0.05)); g.fillRect(0, y, w, h / rows);
      g.strokeStyle = shade(c, -0.14); g.globalAlpha = 0.3;
      for (let k = 0; k < 5; k++) {
        const yy = y + rr(4, h / rows - 4);
        g.beginPath(); g.moveTo(0, yy); g.bezierCurveTo(w * 0.3, yy + rr(-3, 3), w * 0.6, yy + rr(-3, 3), w, yy); g.stroke();
      }
      g.globalAlpha = 1;
      g.fillStyle = shade(c, -0.22); g.fillRect(0, y, w, 2);
      g.fillRect((i * 89) % w, y, 2, h / rows);
    }
  } else if (type === 'tiles' || type === 'checker' || type === 'pooltile') {
    const n = type === 'pooltile' ? 8 : 4, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      g.fillStyle = type === 'checker' ? ((i + j) % 2 ? c2 : c) : shade(c, rr(-0.04, 0.04));
      g.fillRect(i * s, j * s, s, s);
    }
    g.strokeStyle = type === 'checker' ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.75)'; g.lineWidth = type === 'pooltile' ? 2 : 3;
    for (let i = 0; i <= n; i++) {
      g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, h); g.stroke();
      g.beginPath(); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke();
    }
  } else if (type === 'marble') {
    g.strokeStyle = 'rgba(120,110,100,.18)';
    for (let k = 0; k < 7; k++) {
      g.lineWidth = rr(0.5, 2); g.beginPath();
      let x = rr(0, w), y = 0; g.moveTo(x, y);
      while (y < h) { x += rr(-20, 20); y += rr(10, 30); g.lineTo(x, y); }
      g.stroke();
    }
    g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 2; g.strokeRect(0, 0, w, h);
  } else if (type === 'carpet') {
    for (let k = 0; k < 2500; k++) { g.fillStyle = shade(c, rr(-0.06, 0.06)); g.fillRect(rr(0, w), rr(0, h), 2, 2); }
  } else if (type === 'grass') {
    for (let k = 0; k < 3500; k++) {
      g.strokeStyle = shade(c, rr(-0.1, 0.1));
      const x = rr(0, w), y = rr(0, h);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + rr(-2, 2), y - rr(3, 8)); g.stroke();
    }
  } else if (type === 'deck') {
    g.fillStyle = shade(c, -0.25); g.fillRect(0, 0, w, h);
    const rows = 8;
    for (let i = 0; i < rows; i++) { g.fillStyle = shade(c, rr(-0.05, 0.05)); g.fillRect(0, i * h / rows + 1, w, h / rows - 3); }
  } else if (type === 'paving') {
    g.fillStyle = shade(c, -0.18); g.fillRect(0, 0, w, h);
    const rows = 6, cols = 4;
    for (let i = 0; i < rows; i++) for (let j = -1; j < cols; j++) {
      const ox = (i % 2) * (w / cols / 2);
      g.fillStyle = shade(c, rr(-0.06, 0.06));
      g.fillRect(j * w / cols + ox + 2, i * h / rows + 2, w / cols - 4, h / rows - 4);
    }
  } else if (type === 'asphalt') {
    for (let k = 0; k < 3000; k++) { g.fillStyle = shade(c, rr(-0.08, 0.08)); g.fillRect(rr(0, w), rr(0, h), 2, 2); }
  }
}
const TILE = { wood: 1.8, tiles: 1.2, checker: 1.2, marble: 1.6, carpet: 2, grass: 2.5, deck: 1.6, paving: 1.6, pooltile: 1.2, asphalt: 4 };
const ROUGH = { marble: 0.3, tiles: 0.35, checker: 0.35, pooltile: 0.3 };
function texMat(type, c, c2, wm, dm) {
  const t = ctex(256, 256, (g, w, h) => drawPattern(type, g, w, h, c, c2));
  const tile = TILE[type] || 1.5;
  t.repeat.set(Math.max(1, wm / tile), Math.max(1, dm / tile));
  return new THREE.MeshStandardMaterial({ map: t, roughness: ROUGH[type] ?? 0.85 });
}

// ---------- picture textures (TV screens, art, signs) ----------
function picture(kind, w = 512, h = 288) {
  return ctex(w, h, (g, W, H) => {
    if (kind === 'movie') {
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#ff7e5f'); gr.addColorStop(0.6, '#feb47b'); gr.addColorStop(1, '#6a3093');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = '#fff4b0'; g.beginPath(); g.arc(W * 0.65, H * 0.55, H * 0.16, 0, 7); g.fill();
      g.fillStyle = '#3d1f5c'; g.beginPath(); g.moveTo(0, H);
      for (let x = 0; x <= W; x += 32) g.lineTo(x, H * 0.62 + Math.sin(x * 0.02) * 30 + (x % 64 ? 18 : -10));
      g.lineTo(W, H); g.fill();
    } else if (kind === 'game') {
      g.fillStyle = '#120a2e'; g.fillRect(0, 0, W, H);
      g.strokeStyle = '#ff2fd6'; g.lineWidth = 2;
      for (let i = 0; i < 14; i++) { g.beginPath(); g.moveTo(W / 2, H * 0.45); g.lineTo(i * W / 13, H); g.stroke(); }
      for (let i = 0; i < 6; i++) { const y = H * 0.45 + Math.pow(i / 6, 2) * H * 0.55; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(W / 2, H * 0.33, H * 0.18, 0, 7); g.fill();
      g.fillStyle = '#29f0ff'; g.font = `bold ${H * 0.13}px Poppins, sans-serif`; g.textAlign = 'center'; g.fillText('LEVEL 7 ★', W / 2, H * 0.14);
      ['#ff4d8d', '#29f0ff', '#7bff5c'].forEach((c, i) => { g.fillStyle = c; g.fillRect(W * (0.2 + i * 0.25), H * 0.72, 30, 30); });
    } else if (kind === 'cartoon') {
      g.fillStyle = '#8fd3ff'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#7bd36b'; g.beginPath(); g.ellipse(W * 0.3, H, W * 0.45, H * 0.45, 0, 0, 7); g.fill();
      g.fillStyle = '#5cc25a'; g.beginPath(); g.ellipse(W * 0.8, H, W * 0.4, H * 0.35, 0, 0, 7); g.fill();
      g.fillStyle = '#ffe14d'; g.beginPath(); g.arc(W * 0.8, H * 0.25, H * 0.13, 0, 7); g.fill();
      g.fillStyle = '#fff'; [[0.2, 0.2], [0.45, 0.15]].forEach(([x, y]) => { g.beginPath(); g.arc(W * x, H * y, 22, 0, 7); g.arc(W * x + 25, H * y, 28, 0, 7); g.arc(W * x + 50, H * y, 20, 0, 7); g.fill(); });
    } else if (kind === 'home') {
      g.fillStyle = '#fff8ef'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#ff4d8d'; g.font = `bold ${H * 0.2}px Poppins, sans-serif`; g.textAlign = 'center';
      g.fillText('Home', W / 2, H * 0.36); g.fillStyle = '#7b5cff'; g.fillText('Sweet Home', W / 2, H * 0.62);
      g.font = `${H * 0.16}px sans-serif`; g.fillText('💖 🏡 💖', W / 2, H * 0.88);
    } else if (kind === 'abstract' || kind === 'abstract2') {
      g.fillStyle = kind === 'abstract' ? '#fff3e0' : '#e8f4ff'; g.fillRect(0, 0, W, H);
      const cols = kind === 'abstract' ? ['#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff', '#ff9f1c'] : ['#7b5cff', '#2ec4b6', '#ff4d8d', '#ffd23f'];
      for (let i = 0; i < 9; i++) { g.fillStyle = pick(cols); g.globalAlpha = 0.85; g.beginPath(); g.arc(rr(0, W), rr(0, H), rr(H * 0.08, H * 0.3), 0, 7); g.fill(); }
      g.globalAlpha = 1;
    } else if (kind === 'flowers') {
      g.fillStyle = '#e9fbe5'; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 9; i++) {
        const x = rr(30, W - 30), y = rr(30, H - 30), c = pick(['#ff6b9d', '#ffd93d', '#c77dff', '#ff922b']);
        g.strokeStyle = '#4caf50'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x, H); g.stroke();
        g.fillStyle = c; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(x + Math.cos(k) * 12, y + Math.sin(k) * 12, 9, 0, 7); g.fill(); }
        g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill();
      }
    } else if (kind === 'poster') {
      const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#29f0ff'); gr.addColorStop(1, '#ff2fd6');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = '#120a2e'; g.font = `bold ${W * 0.16}px Poppins, sans-serif`; g.textAlign = 'center';
      g.fillText('PLAYER', W / 2, H * 0.4); g.fillText('ONE', W / 2, H * 0.6);
      g.font = `${W * 0.2}px sans-serif`; g.fillText('🎮', W / 2, H * 0.88);
    } else if (kind === 'stars') {
      g.fillStyle = '#1b1446'; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 60; i++) { g.fillStyle = pick(['#fff', '#ffe14d', '#bde0ff']); g.fillRect(rr(0, W), rr(0, H), 2, 2); }
      g.fillStyle = '#ffe14d'; g.beginPath(); g.arc(W * 0.75, H * 0.3, H * 0.12, 0, 7); g.fill();
    }
  }, false);
}
function textSign(text, color = '#ff2fd6', w = 512, h = 128, font = 'bold 74px Poppins, sans-serif', bg = null) {
  return ctex(w, h, (g, W, H) => {
    if (bg) { g.fillStyle = bg; g.beginPath(); g.roundRect(4, 4, W - 8, H - 8, 26); g.fill(); }
    g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 24; g.fillStyle = bg ? '#fff' : color;
    g.fillText(text, W / 2, H / 2 + 4);
    if (!bg) { g.shadowBlur = 0; g.fillStyle = '#fff'; g.globalAlpha = 0.7; g.fillText(text, W / 2, H / 2 + 4); }
  }, false);
}

// =====================================================================
//  Furniture & decor builders. Origin = floor centre, front = +z, back = -z
// =====================================================================
function bed(w, l, blanket, frame = '#8d6e63', pillow = '#ffffff') {
  const g = G();
  box(g, w + 0.08, 0.28, l, frame);
  box(g, w, 0.2, l - 0.06, '#fbfbfb', 0, 0.28, 0.02);
  box(g, w + 0.06, 0.24, l * 0.62, blanket, 0, 0.26, l / 2 - l * 0.31);
  box(g, w + 0.07, 0.03, 0.18, shade(blanket, 0.18), 0, 0.5, l / 2 - l * 0.62 + 0.09);
  box(g, w + 0.16, 1.15, 0.1, frame, 0, 0, -l / 2 - 0.03);
  box(g, w * 0.9, 0.5, 0.06, shade(frame, 0.15), 0, 0.55, -l / 2 + 0.04);
  const pc = w > 1.4 ? [-w * 0.23, w * 0.23] : [0];
  pc.forEach(px => { const p = box(g, w > 1.4 ? w * 0.4 : w * 0.7, 0.13, 0.36, pillow, px, 0.48, -l / 2 + 0.3); p.rotation.x = -0.18; });
  if (w > 1.4) { const c = box(g, w * 0.28, 0.24, 0.08, blanket, 0, 0.5, -l / 2 + 0.52); c.rotation.x = -0.25; }
  return g;
}
function tableLamp(p, x, y, z, color = '#ffe8b0') {
  cyl(p, 0.07, 0.09, 0.03, gold, x, y, z);
  cyl(p, 0.012, 0.012, 0.25, gold, x, y + 0.03, z, 8);
  add(p, new THREE.CylinderGeometry(0.09, 0.14, 0.18, 20, 1, true), glow(color, 0.8, THREE.DoubleSide), x, y + 0.37, z);
}
function nightstand(c = '#a1887f', lamp = '#ffe8b0') {
  const g = G();
  box(g, 0.5, 0.5, 0.42, c);
  box(g, 0.44, 0.005, 0.01, shade(c, -0.2), 0, 0.25, 0.212);
  sph(g, 0.018, gold, 0, 0.37, 0.22);
  tableLamp(g, 0, 0.5, 0, lamp);
  return g;
}
function wardrobe(w, c = '#efe6d8', h = 2.2) {
  const g = G();
  box(g, w, h, 0.6, c);
  const n = Math.max(2, Math.round(w / 0.5)), dw = w / n;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + dw * (i + 0.5);
    box(g, dw - 0.02, h - 0.1, 0.02, shade(c, -0.03), x, 0.05, 0.3);
    box(g, 0.02, 0.32, 0.03, gold, x + (i % 2 ? -1 : 1) * (dw / 2 - 0.07), h / 2 - 0.16, 0.32);
  }
  return g;
}
function sofa(w, c, cushion = '#ffd23f') {
  const g = G(), d = 0.9;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => cyl(g, 0.03, 0.025, 0.08, '#4e342e', a * (w / 2 - 0.08), 0, b * (d / 2 - 0.08), 8));
  box(g, w, 0.34, d, c, 0, 0.08, 0);
  const n = Math.max(1, Math.round((w - 0.36) / 0.75)), sw = (w - 0.36) / n;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.18 + sw * (i + 0.5);
    box(g, sw - 0.03, 0.13, d - 0.27, shade(c, 0.07), x, 0.42, 0.1);
    box(g, sw - 0.05, 0.4, 0.13, shade(c, 0.07), x, 0.48, -d / 2 + 0.28);
  }
  box(g, w, 0.48, 0.22, c, 0, 0.42, -d / 2 + 0.11);
  [-1, 1].forEach(s => box(g, 0.18, 0.62, d, shade(c, -0.05), s * (w / 2 - 0.09), 0.08, 0));
  if (w > 1.3) [-1, 1].forEach(s => { const p = box(g, 0.36, 0.34, 0.12, cushion, s * (w / 2 - 0.45), 0.52, -d / 2 + 0.38); p.rotation.z = s * 0.15; p.rotation.x = -0.2; });
  return g;
}
function coffeeTable(w, d, c = '#8d6e63') {
  const g = G();
  box(g, w, 0.05, d, c, 0, 0.38, 0);
  box(g, w * 0.9, 0.03, d * 0.85, shade(c, -0.1), 0, 0.1, 0);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => box(g, 0.05, 0.38, 0.05, shade(c, -0.15), a * (w / 2 - 0.05), 0, b * (d / 2 - 0.05)));
  box(g, 0.22, 0.04, 0.16, '#e63946', -w * 0.25, 0.43, 0);
  box(g, 0.2, 0.04, 0.15, '#457b9d', -w * 0.25, 0.47, 0.01);
  cyl(g, 0.05, 0.04, 0.16, '#ffffff', w * 0.22, 0.43, 0);
  sph(g, 0.06, '#ff70a6', w * 0.22, 0.65, 0);
  return g;
}
function chair(c = '#8d6e63', seat = '#fff3e0') {
  const g = G();
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => box(g, 0.04, 0.44, 0.04, c, a * 0.19, 0, b * 0.19));
  box(g, 0.46, 0.07, 0.46, seat, 0, 0.44, 0);
  box(g, 0.44, 0.48, 0.05, c, 0, 0.5, -0.2);
  return g;
}
function diningTable(w, d) {
  const g = G();
  box(g, w, 0.05, d, '#a47148', 0, 0.74, 0);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => box(g, 0.06, 0.74, 0.06, '#7f5539', a * (w / 2 - 0.08), 0, b * (d / 2 - 0.08)));
  box(g, w * 0.8, 0.01, 0.3, '#ffd6a5', 0, 0.79, 0);
  cyl(g, 0.12, 0.08, 0.07, '#ffffff', 0, 0.8, 0);
  ['#ff4d4d', '#ffd23f', '#7bd36b', '#ff9f1c'].forEach((c, i) => sph(g, 0.045, c, Math.cos(i * 1.6) * 0.05, 0.9, Math.sin(i * 1.6) * 0.05));
  [-0.5, 0.5].forEach(x => { cyl(g, 0.02, 0.03, 0.02, gold, x, 0.79, 0); cyl(g, 0.012, 0.012, 0.18, '#fffbe6', x, 0.81, 0, 8); sph(g, 0.02, glow('#ffb703', 2), x, 1.01, 0); });
  return g;
}
function tv(w, kind = 'movie') {
  const g = G(), h = w * 0.56;
  box(g, w, h, 0.05, blackGloss);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.96, h * 0.92), new THREE.MeshBasicMaterial({ map: picture(kind) }));
  scr.position.set(0, h / 2, 0.026);
  g.add(scr);
  return g;
}
function tvCabinet(w, c = '#f2e8dc') {
  const g = G();
  box(g, w, 0.45, 0.45, c);
  box(g, w, 0.04, 0.47, '#8d6e63', 0, 0.45, 0);
  for (let i = 0; i < 3; i++) box(g, w / 3 - 0.04, 0.35, 0.01, shade(c, -0.05), -w / 3 + i * w / 3, 0.05, 0.226);
  box(g, 0.32, 0.06, 0.25, '#222', -w * 0.25, 0.49, 0);
  sph(g, 0.01, glow('#29f0ff', 2), -w * 0.25 + 0.12, 0.52, 0.126);
  return g;
}
function rug(w, d, c1, c2, kind = 'border') {
  const t = ctex(256, 256, (g, W, H) => {
    g.fillStyle = c1; g.fillRect(0, 0, W, H);
    if (kind === 'border') { g.strokeStyle = c2; g.lineWidth = 14; g.strokeRect(16, 16, W - 32, H - 32); g.lineWidth = 5; g.strokeRect(40, 40, W - 80, H - 80); g.fillStyle = c2; g.beginPath(); g.arc(W / 2, H / 2, 40, 0, 7); g.fill(); }
    if (kind === 'stripes') for (let i = 0; i < 8; i += 2) { g.fillStyle = c2; g.fillRect(0, i * H / 8, W, H / 8); }
    if (kind === 'dots') for (let i = 0; i < 40; i++) { g.fillStyle = pick([c2, '#ffffff', '#ffd23f']); g.beginPath(); g.arc(rr(0, W), rr(0, H), rr(6, 14), 0, 7); g.fill(); }
    if (kind === 'rainbow') ['#ff595e', '#ff924c', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'].forEach((c, i) => { g.strokeStyle = c; g.lineWidth = 16; g.beginPath(); g.arc(W / 2, H / 2, 112 - i * 18, 0, 7); g.stroke(); });
  }, false);
  const g = G();
  const geo = kind === 'rainbow' ? new THREE.CylinderGeometry(w / 2, w / 2, 0.012, 48) : new THREE.BoxGeometry(w, 0.012, d);
  const m = add(g, geo, new THREE.MeshStandardMaterial({ map: t, roughness: 1 }), 0, 0.006, 0, false);
  return g;
}
const GREENS = ['#2e7d32', '#43a047', '#66bb6a', '#388e3c'];
function plant(h = 1.1, pot = '#e07a5f', kind = 'leafy') {
  const g = G();
  cyl(g, 0.17, 0.12, 0.32, pot);
  cyl(g, 0.155, 0.155, 0.02, '#5d4037', 0, 0.3, 0);
  if (kind === 'tall') {
    cyl(g, 0.02, 0.025, h * 0.75, '#6d4c41', 0, 0.3, 0, 8);
    for (let i = 0; i < 9; i++) { const s = sph(g, rr(0.1, 0.16), pick(GREENS), rr(-0.18, 0.18), 0.3 + h * rr(0.55, 1), rr(-0.18, 0.18), 10); s.scale.y = 0.7; }
  } else if (kind === 'cactus') {
    cyl(g, 0.07, 0.08, h * 0.6, '#43a047', 0, 0.3, 0, 12); sph(g, 0.07, '#43a047', 0, 0.3 + h * 0.6, 0, 12);
    cyl(g, 0.04, 0.04, 0.18, '#43a047', 0.1, 0.5, 0, 8); sph(g, 0.03, '#ff4d8d', 0, 0.38 + h * 0.6, 0, 8);
  } else if (kind === 'flower') {
    for (let i = 0; i < 6; i++) sph(g, rr(0.08, 0.12), pick(GREENS), rr(-0.1, 0.1), 0.38 + rr(0, 0.12), rr(-0.1, 0.1), 10);
    const fc = pick(['#ff4d8d', '#ffd23f', '#c77dff', '#ff922b']);
    for (let i = 0; i < 6; i++) sph(g, 0.045, fc, rr(-0.12, 0.12), 0.5 + rr(0, 0.15), rr(-0.12, 0.12), 8);
  } else {
    for (let i = 0; i < 8; i++) { const s = sph(g, rr(0.12, 0.2), pick(GREENS), rr(-0.15, 0.15), 0.35 + (h - 0.4) * rand(), rr(-0.15, 0.15), 10); s.scale.y = 0.8; }
  }
  return g;
}
function floorLamp(color = '#fff1c4') {
  const g = G();
  cyl(g, 0.16, 0.18, 0.03, '#333');
  cyl(g, 0.015, 0.015, 1.55, gold, 0, 0.03, 0, 8);
  add(g, new THREE.CylinderGeometry(0.14, 0.22, 0.3, 20, 1, true), glow(color, 0.9, THREE.DoubleSide), 0, 1.6, 0);
  return g;
}
function pendant(color = '#ffd8a8', drop = 0.6) {
  const g = G();
  cyl(g, 0.006, 0.006, drop, '#333', 0, -drop, 0, 6);
  add(g, new THREE.ConeGeometry(0.16, 0.2, 20, 1, true), M('#2b2140', 0.4, 0.3), 0, -drop - 0.05, 0).material.side = THREE.DoubleSide;
  sph(g, 0.06, glow(color, 2), 0, -drop - 0.13, 0, 12);
  return g;
}
// The house is shown open-topped (no ceilings), so ceiling lights would float in mid-air;
// rooms are lit at night by point lights instead.
function ceilingLight() { return G(); }
const spinners = [];
function ceilingFan(c = '#ffffff') {
  const g = G();
  cyl(g, 0.02, 0.02, 0.35, '#888', 0, -0.35, 0, 8);
  const rot = G(); rot.position.y = -0.38; g.add(rot);
  cyl(rot, 0.12, 0.1, 0.1, c, 0, -0.05, 0);
  for (let i = 0; i < 3; i++) {
    const b = box(rot, 0.6, 0.015, 0.14, '#c9a27e', 0, 0, 0);
    b.position.set(Math.cos(i * 2.094) * 0.38, 0, Math.sin(i * 2.094) * 0.38);
    b.rotation.y = -i * 2.094;
  }
  sph(rot, 0.07, glow('#fff3c4', 1), 0, -0.1, 0, 12);
  spinners.push({ obj: rot, speed: 6 });
  return g;
}
function chandelier() {
  const g = G();
  cyl(g, 0.008, 0.008, 0.5, gold, 0, -0.5, 0, 6);
  const ring = add(g, new THREE.TorusGeometry(0.35, 0.02, 8, 32), gold, 0, -0.55, 0);
  ring.rotation.x = Math.PI / 2;
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    sph(g, 0.045, glow('#fff1b8', 2), Math.cos(a) * 0.35, -0.5, Math.sin(a) * 0.35, 10);
    const cr = add(g, new THREE.OctahedronGeometry(0.03), glassMat, Math.cos(a + 0.4) * 0.28, -0.68, Math.sin(a + 0.4) * 0.28, false);
  }
  add(g, new THREE.OctahedronGeometry(0.08), M('#e8f4ff', 0.05, 0.6), 0, -0.75, 0);
  return g;
}
function ac() {
  const g = G();
  box(g, 0.95, 0.3, 0.22, '#fbfbfb', 0, 0, 0);
  box(g, 0.88, 0.03, 0.02, '#d0d7de', 0, 0.04, 0.11);
  box(g, 0.88, 0.015, 0.02, '#d0d7de', 0, 0.09, 0.11);
  sph(g, 0.012, glow('#3ddc84', 3), 0.38, 0.22, 0.112, 8);
  return g;
}
function wallArt(w, h, kind, frame = '#2b2140') {
  const g = G();
  box(g, w + 0.08, h + 0.08, 0.04, frame, 0, -0.04, 0);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: picture(kind, 512, Math.round(512 * h / w)), roughness: 0.8 }));
  p.position.set(0, h / 2, 0.021);
  g.add(p);
  return g;
}
const BOOK_COLS = ['#e63946', '#f1c453', '#2a9d8f', '#264653', '#e76f51', '#8338ec', '#3a86ff', '#ff006e', '#06d6a0'];
function bookshelf(w, h, c = '#a47148') {
  const g = G(), d = 0.35;
  box(g, w, h, 0.03, shade(c, -0.1), 0, 0, -d / 2 + 0.015);
  [-1, 1].forEach(s => box(g, 0.04, h, d, c, s * (w / 2 - 0.02), 0, 0));
  const shelves = Math.round(h / 0.38);
  for (let i = 0; i <= shelves; i++) {
    const y = i * (h - 0.03) / shelves;
    box(g, w, 0.03, d, c, 0, y, 0);
    if (i === shelves) break;
    let x = -w / 2 + 0.06;
    while (x < w / 2 - 0.1) {
      const bw = rr(0.03, 0.06), bh = rr(0.2, 0.3);
      if (rand() < 0.12) { sph(g, 0.06, pick(['#ffd23f', '#06d6a0', '#ff70a6']), x + 0.06, y + 0.09, 0); x += 0.16; continue; }
      const b = box(g, bw, bh, 0.24, pick(BOOK_COLS), x + bw / 2, y + 0.03, 0.02);
      if (rand() < 0.1) b.rotation.z = 0.15;
      x += bw + 0.005;
    }
  }
  return g;
}
function desk(w, c = '#f4f1ec', laptop = true) {
  const g = G();
  box(g, w, 0.04, 0.6, c, 0, 0.72, 0);
  [-1, 1].forEach(s => box(g, 0.04, 0.72, 0.56, shade(c, -0.08), s * (w / 2 - 0.03), 0, 0));
  if (laptop) {
    box(g, 0.34, 0.02, 0.24, '#b0bec5', 0, 0.76, 0.05);
    const lid = G(); lid.position.set(0, 0.78, -0.07); lid.rotation.x = -0.25; g.add(lid);
    box(lid, 0.34, 0.22, 0.012, '#b0bec5');
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.31, 0.19), new THREE.MeshBasicMaterial({ map: picture('cartoon') }));
    s.position.set(0, 0.11, 0.007); lid.add(s);
  }
  cyl(g, 0.06, 0.07, 0.02, '#ff70a6', w / 2 - 0.15, 0.76, -0.15);
  const arm = cyl(g, 0.012, 0.012, 0.35, '#ff70a6', w / 2 - 0.15, 0.78, -0.15, 8);
  add(g, new THREE.ConeGeometry(0.08, 0.1, 16, 1, true), glow('#fff1c4', 1, THREE.DoubleSide), w / 2 - 0.15, 1.15, -0.1);
  box(g, 0.15, 0.03, 0.2, '#06d6a0', -w / 2 + 0.15, 0.76, -0.1);
  box(g, 0.14, 0.03, 0.19, '#ffd23f', -w / 2 + 0.15, 0.79, -0.1);
  return g;
}
function officeChair(c = '#7b5cff') {
  const g = G();
  for (let i = 0; i < 5; i++) { const l = box(g, 0.03, 0.03, 0.28, '#333', 0, 0.04, 0); l.rotation.y = i * 1.257; l.position.x = Math.sin(i * 1.257) * 0.14; l.position.z = Math.cos(i * 1.257) * 0.14; }
  cyl(g, 0.025, 0.025, 0.4, chrome, 0, 0.05, 0, 8);
  box(g, 0.48, 0.08, 0.46, c, 0, 0.45, 0);
  box(g, 0.44, 0.55, 0.07, c, 0, 0.55, -0.22);
  return g;
}
// ---- kitchen ----
function counter(w, kind = 'plain', cab = '#ff9f6b', top = '#f5f5f5') {
  const g = G();
  box(g, w, 0.08, 0.56, '#3a2e2a', 0, 0, 0.0);
  box(g, w - 0.01, 0.78, 0.58, cab, 0, 0.08, 0);
  box(g, w + 0.01, 0.04, 0.62, top, 0, 0.86, 0.01);
  box(g, 0.14, 0.02, 0.02, chrome, 0, 0.75, 0.3);
  if (kind === 'sink') {
    box(g, w * 0.6, 0.02, 0.36, '#9aa5b1', 0, 0.895, 0.02);
    cyl(g, 0.018, 0.018, 0.28, chrome, 0, 0.9, -0.2, 10);
    box(g, 0.03, 0.03, 0.17, chrome, 0, 1.15, -0.13);
  } else if (kind === 'stove') {
    box(g, w * 0.85, 0.012, 0.5, '#111', 0, 0.9, 0.01);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => {
      const r = add(g, new THREE.TorusGeometry(0.07, 0.012, 6, 20), M('#555', 0.4, 0.6), a * 0.18, 0.92, b * 0.12, false);
      r.rotation.x = Math.PI / 2;
    });
    const flame = add(g, new THREE.ConeGeometry(0.05, 0.08, 10), glow('#4dabff', 2), 0.18, 0.95, 0.12, false);
    box(g, w - 0.04, 0.5, 0.02, '#2b2b2b', 0, 0.2, 0.3);
    box(g, w * 0.7, 0.2, 0.01, '#555', 0, 0.35, 0.31);
  } else if (kind === 'dw') {
    box(g, w - 0.04, 0.72, 0.02, '#cfd8dc', 0, 0.1, 0.3);
    box(g, w * 0.6, 0.03, 0.03, chrome, 0, 0.74, 0.32);
    sph(g, 0.01, glow('#3ddc84', 3), w * 0.35, 0.78, 0.31, 6);
  }
  return g;
}
function fridge() {
  const g = G();
  const steel = M('#c9d3db', 0.3, 0.6);
  box(g, 0.85, 1.9, 0.7, steel);
  box(g, 0.005, 1.86, 0.02, '#8a959f', 0, 0.02, 0.351);
  [-1, 1].forEach(s => box(g, 0.025, 0.6, 0.04, chrome, s * 0.06, 0.8, 0.37));
  box(g, 0.18, 0.28, 0.01, '#2b2b2b', -0.2, 1.1, 0.352);
  sph(g, 0.012, glow('#29f0ff', 2), -0.2, 1.3, 0.356, 8);
  [['#ff4d8d', 0.2, 1.5], ['#ffd23f', 0.28, 1.3], ['#7bd36b', 0.15, 1.2]].forEach(([c, x, y]) => box(g, 0.06, 0.06, 0.02, c, x, y, 0.36));
  return g;
}
function hood() {
  const g = G();
  const steel = M('#c9d3db', 0.3, 0.6);
  box(g, 0.9, 0.12, 0.5, steel, 0, 0, 0);
  add(g, new THREE.CylinderGeometry(0.16, 0.38, 0.25, 4), steel, 0, 0.24, -0.05).rotation.y = Math.PI / 4;
  box(g, 0.3, 0.6, 0.3, steel, 0, 0.36, -0.08);
  box(g, 0.6, 0.01, 0.3, glow('#fff3c4', 0.8), 0, -0.005, 0);
  return g;
}
function upperCab(w, c = '#ffd3b6') {
  const g = G();
  box(g, w, 0.7, 0.35, c);
  box(g, 0.012, 0.66, 0.01, shade(c, -0.15), 0, 0.02, 0.176);
  [-1, 1].forEach(s => box(g, 0.02, 0.14, 0.02, chrome, s * 0.06, 0.05, 0.185));
  return g;
}
function microwave() {
  const g = G();
  box(g, 0.5, 0.3, 0.36, '#2f3640');
  box(g, 0.32, 0.22, 0.01, '#0b0f14', -0.06, 0.04, 0.181);
  box(g, 0.08, 0.04, 0.01, glow('#3ddc84', 1.5), 0.17, 0.22, 0.181);
  return g;
}
function kettleToaster() {
  const g = G();
  cyl(g, 0.08, 0.1, 0.22, '#ff4d8d', -0.15, 0, 0);
  sph(g, 0.03, '#222', -0.15, 0.24, 0, 8);
  box(g, 0.26, 0.18, 0.16, chrome, 0.15, 0, 0);
  box(g, 0.18, 0.01, 0.03, '#222', 0.15, 0.18, -0.03);
  box(g, 0.18, 0.01, 0.03, '#222', 0.15, 0.18, 0.03);
  return g;
}
function island(w, d) {
  const g = G();
  box(g, w - 0.1, 0.86, d - 0.1, '#7b5cff', 0, 0, 0);
  box(g, w, 0.05, d, M('#f7f3ee', 0.25), 0, 0.86, 0);
  cyl(g, 0.18, 0.12, 0.08, '#ffffff', 0, 0.91, 0);
  ['#ff4d4d', '#ffd23f', '#7bd36b', '#ff9f1c', '#ff4d4d'].forEach((c, i) => sph(g, 0.05, c, Math.cos(i * 1.3) * 0.08, 1.0, Math.sin(i * 1.3) * 0.08, 10));
  box(g, 0.3, 0.02, 0.2, '#c9a27e', w * 0.3, 0.91, 0);
  return g;
}
function barStool(c = '#ffd23f') {
  const g = G();
  cyl(g, 0.16, 0.18, 0.03, chrome, 0, 0, 0);
  cyl(g, 0.025, 0.025, 0.62, chrome, 0, 0.03, 0, 8);
  const t = add(g, new THREE.TorusGeometry(0.13, 0.012, 6, 20), chrome, 0, 0.28, 0); t.rotation.x = Math.PI / 2;
  cyl(g, 0.19, 0.17, 0.08, c, 0, 0.65, 0);
  return g;
}
function pantry() {
  const g = G();
  box(g, 0.9, 2.1, 0.6, '#ff9f6b');
  [-1, 1].forEach(s => { box(g, 0.43, 2.0, 0.02, '#ffb38a', s * 0.225, 0.05, 0.3); box(g, 0.02, 0.3, 0.03, chrome, s * 0.04, 0.9, 0.32); });
  return g;
}
function purifier() {
  const g = G();
  box(g, 0.3, 0.45, 0.2, '#f5f7fa');
  box(g, 0.2, 0.08, 0.01, '#4dabff', 0, 0.3, 0.101);
  box(g, 0.04, 0.04, 0.08, '#888', 0, 0.02, 0.12);
  return g;
}
// ---- bathroom ----
function bathtub(l = 1.7, w = 0.75) {
  const g = G(), white = M('#ffffff', 0.2);
  box(g, l, 0.4, w, white);
  box(g, l, 0.18, 0.07, white, 0, 0.4, -w / 2 + 0.035);
  box(g, l, 0.18, 0.07, white, 0, 0.4, w / 2 - 0.035);
  box(g, 0.07, 0.18, w, white, -l / 2 + 0.035, 0.4, 0);
  box(g, 0.07, 0.18, w, white, l / 2 - 0.035, 0.4, 0);
  box(g, l - 0.14, 0.1, w - 0.14, new THREE.MeshStandardMaterial({ color: '#8fe3ff', roughness: 0.05, transparent: true, opacity: 0.85 }), 0, 0.4, 0);
  for (let i = 0; i < 14; i++) sph(g, rr(0.03, 0.06), '#ffffff', rr(-l / 2 + 0.2, l / 2 - 0.2), 0.52, rr(-w / 2 + 0.15, w / 2 - 0.15), 8);
  cyl(g, 0.02, 0.02, 0.25, chrome, l / 2 - 0.12, 0.58, -w / 2 + 0.05, 8);
  box(g, 0.03, 0.03, 0.15, chrome, l / 2 - 0.12, 0.81, -w / 2 + 0.11);
  const duck = G(); duck.position.set(-0.3, 0.52, 0.05); g.add(duck);
  sph(duck, 0.05, '#ffd23f', 0, 0, 0, 10); sph(duck, 0.035, '#ffd23f', 0.03, 0.06, 0, 10);
  add(duck, new THREE.ConeGeometry(0.015, 0.03, 6), '#ff8c00', 0.07, 0.06, 0).rotation.z = -Math.PI / 2;
  return g;
}
function toilet() {
  const g = G(), white = M('#ffffff', 0.2);
  box(g, 0.42, 0.38, 0.17, white, 0, 0.42, -0.22);
  box(g, 0.44, 0.03, 0.19, white, 0, 0.8, -0.22);
  cyl(g, 0.02, 0.02, 0.012, chrome, 0, 0.83, -0.22, 10);
  const base = cyl(g, 0.15, 0.13, 0.36, white, 0, 0, 0.05); base.scale.z = 1.3;
  const bowl = cyl(g, 0.2, 0.17, 0.06, white, 0, 0.36, 0.06); bowl.scale.z = 1.35;
  const seat = cyl(g, 0.2, 0.2, 0.025, '#f0f4f8', 0, 0.42, 0.06); seat.scale.z = 1.35;
  return g;
}
function vanity(w = 0.8, c = '#a47148', withMirror = true) {
  const g = G();
  box(g, w, 0.8, 0.5, c);
  box(g, w + 0.02, 0.04, 0.52, M('#ffffff', 0.25), 0, 0.8, 0);
  const basin = cyl(g, 0.17, 0.14, 0.12, M('#ffffff', 0.2), 0, 0.84, 0.03, 24); basin.scale.z = 0.8;
  cyl(g, 0.015, 0.015, 0.2, chrome, 0, 0.84, -0.18, 8);
  box(g, 0.025, 0.025, 0.12, chrome, 0, 1.03, -0.13);
  box(g, w - 0.06, 0.6, 0.01, shade(c, 0.1), 0, 0.1, 0.25);
  if (withMirror) {
    box(g, w * 0.85, 0.75, 0.03, '#ffffff', 0, 1.25, -0.235);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, 0.7), mirrorMat); m.position.set(0, 1.625, -0.218); g.add(m);
    box(g, w * 0.6, 0.03, 0.05, glow('#fff6e0', 1.5), 0, 2.03, -0.22);
  }
  cyl(g, 0.03, 0.03, 0.12, '#ff70a6', w / 2 - 0.1, 0.84, -0.1, 10);
  cyl(g, 0.025, 0.025, 0.09, '#29b6f6', w / 2 - 0.18, 0.84, -0.12, 10);
  return g;
}
function smallSink() {
  const g = G();
  const b = cyl(g, 0.2, 0.15, 0.16, M('#ffffff', 0.2), 0, 0.72, 0); b.scale.z = 0.75;
  cyl(g, 0.05, 0.06, 0.72, M('#ffffff', 0.2), 0, 0, -0.03, 12);
  cyl(g, 0.012, 0.012, 0.15, chrome, 0, 0.88, -0.12, 8);
  box(g, 0.55, 0.7, 0.02, '#ffffff', 0, 1.15, -0.15);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.65), mirrorMat); m.position.set(0, 1.5, -0.138); g.add(m);
  return g;
}
function shower(w = 0.9, d = 0.9) {
  const g = G();
  box(g, w, 0.06, d, M('#ffffff', 0.2));
  box(g, 0.02, 2.0, d, glassMat, -w / 2, 0.06, 0);
  box(g, w, 2.0, 0.02, glassMat, 0, 0.06, d / 2);
  box(g, 0.02, 2.0, 0.02, chrome, -w / 2, 0.06, d / 2);
  cyl(g, 0.012, 0.012, 2.1, chrome, w / 2 - 0.08, 0.06, -d / 2 + 0.08, 8);
  cyl(g, 0.13, 0.13, 0.02, chrome, w / 2 - 0.25, 2.15, -d / 2 + 0.25, 20);
  box(g, 0.2, 0.02, 0.02, chrome, w / 2 - 0.16, 2.17, -d / 2 + 0.16).rotation.y = Math.PI / 4;
  return g;
}
function washer() {
  const g = G();
  box(g, 0.6, 0.85, 0.6, '#f8f9fa');
  box(g, 0.56, 0.12, 0.01, '#dfe6ec', 0, 0.7, 0.301);
  sph(g, 0.02, glow('#29b6f6', 2), 0.18, 0.76, 0.305, 8);
  cyl(g, 0.03, 0.03, 0.02, '#9aa5b1', -0.15, 0.76, 0.3, 12).rotation.x = Math.PI / 2;
  const ring = add(g, new THREE.TorusGeometry(0.17, 0.03, 10, 32), chrome, 0, 0.36, 0.305);
  const glassDoor = add(g, new THREE.CircleGeometry(0.16, 32), M('#1f3b57', 0.1, 0.3), 0, 0.36, 0.302);
  return g;
}
function towelRack(colors = ['#ff70a6', '#29b6f6']) {
  const g = G();
  box(g, 0.6, 0.02, 0.06, chrome, 0, 1.2, 0);
  colors.forEach((c, i) => box(g, 0.24, 0.55, 0.04, c, -0.14 + i * 0.28, 0.67, 0.02));
  return g;
}
// ---- gaming ----
const ledMats = [];
function ledMat(h) { const m = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(h, 1, 0.55) }); m.userData.h = h; ledMats.push(m); return m; }
function monitor(w = 0.6) {
  const g = G();
  box(g, 0.2, 0.02, 0.15, '#222');
  box(g, 0.04, 0.3, 0.04, '#222', 0, 0.02, -0.03);
  box(g, w, w * 0.56, 0.03, '#111', 0, 0.25, 0);
  const s = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.95, w * 0.5), new THREE.MeshBasicMaterial({ map: picture('game') }));
  s.position.set(0, 0.25 + w * 0.28, 0.016); g.add(s);
  return g;
}
function gamingDesk(w = 1.8) {
  const g = G();
  box(g, w, 0.04, 0.75, '#1b1b2f', 0, 0.72, 0);
  [-1, 1].forEach(s => box(g, 0.06, 0.72, 0.65, '#ff2fd6', s * (w / 2 - 0.05), 0, 0));
  box(g, w - 0.1, 0.012, 0.012, ledMat(0.85), 0, 0.71, 0.37);
  const m1 = monitor(0.62); m1.position.set(0, 0.76, -0.18); g.add(m1);
  const m2 = monitor(0.5); m2.position.set(-0.55, 0.76, -0.12); m2.rotation.y = 0.45; g.add(m2);
  const m3 = monitor(0.5); m3.position.set(0.55, 0.76, -0.12); m3.rotation.y = -0.45; g.add(m3);
  box(g, 0.45, 0.025, 0.15, '#111', 0, 0.76, 0.15);
  box(g, 0.43, 0.006, 0.13, ledMat(0.5), 0, 0.786, 0.15);
  box(g, 0.9, 0.003, 0.4, '#2b2140', 0.1, 0.76, 0.14);
  box(g, 0.06, 0.03, 0.1, '#111', 0.35, 0.765, 0.16);
  // PC tower
  box(g, 0.22, 0.48, 0.45, '#111', w / 2 - 0.2, 0.76, -0.05);
  box(g, 0.005, 0.42, 0.4, ledMat(0.3), w / 2 - 0.31, 0.79, -0.05);
  [0.92, 1.05, 1.18].forEach(y => { const f = add(g, new THREE.TorusGeometry(0.05, 0.01, 6, 16), ledMat(0.6), w / 2 - 0.315, y, 0.08); f.rotation.y = Math.PI / 2; });
  // headphones
  const hp = add(g, new THREE.TorusGeometry(0.08, 0.015, 6, 16, Math.PI), '#ff2fd6', -0.75, 0.84, 0.15);
  return g;
}
function gamingChair() {
  const g = G();
  for (let i = 0; i < 5; i++) { const l = box(g, 0.035, 0.035, 0.3, '#111', 0, 0.04, 0); l.rotation.y = i * 1.257; l.position.x = Math.sin(i * 1.257) * 0.15; l.position.z = Math.cos(i * 1.257) * 0.15; }
  cyl(g, 0.03, 0.03, 0.38, chrome, 0, 0.06, 0, 8);
  box(g, 0.52, 0.1, 0.5, '#111', 0, 0.44, 0);
  box(g, 0.3, 0.02, 0.4, '#ff2fd6', 0, 0.54, 0);
  const back = G(); back.position.set(0, 0.54, -0.22); back.rotation.x = -0.12; g.add(back);
  box(back, 0.5, 0.82, 0.1, '#111');
  box(back, 0.18, 0.7, 0.02, '#ff2fd6', 0, 0.06, 0.05);
  box(back, 0.3, 0.12, 0.06, '#ff2fd6', 0, 0.62, 0.08);
  [-1, 1].forEach(s => { box(g, 0.05, 0.22, 0.05, '#222', s * 0.26, 0.5, 0); box(g, 0.08, 0.03, 0.3, '#222', s * 0.26, 0.72, 0.02); });
  return g;
}
function beanBag(c) {
  const g = G();
  const b = sph(g, 0.42, M(c, 0.9), 0, 0.26, 0, 20); b.scale.set(1, 0.62, 1);
  const t = sph(g, 0.3, M(shade(c, 0.08), 0.9), 0, 0.38, -0.12, 16); t.scale.set(1, 0.7, 0.8);
  return g;
}
function arcade(c = '#7b5cff') {
  const g = G();
  box(g, 0.7, 1.75, 0.75, c);
  box(g, 0.66, 0.25, 0.02, M('#111'), 0, 1.45, 0.38);
  const mq = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.2), new THREE.MeshBasicMaterial({ map: textSign('ARCADE', '#ffd23f', 512, 160, 'bold 96px Poppins, sans-serif') }));
  mq.position.set(0, 1.575, 0.392); g.add(mq);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.42), new THREE.MeshBasicMaterial({ map: picture('game') }));
  scr.position.set(0, 1.12, 0.36); scr.rotation.x = -0.18; g.add(scr);
  box(g, 0.7, 0.06, 0.25, '#222', 0, 0.85, 0.45);
  cyl(g, 0.012, 0.012, 0.08, '#999', -0.15, 0.91, 0.45, 6); sph(g, 0.03, '#ff2fd6', -0.15, 1.0, 0.45, 10);
  ['#ff4d4d', '#ffd23f', '#29f0ff', '#7bff5c'].forEach((col, i) => cyl(g, 0.025, 0.025, 0.02, glow(col, 1.5), 0.05 + i * 0.07, 0.91, 0.45 + (i % 2) * 0.05, 10));
  [-1, 1].forEach(s => box(g, 0.01, 1.7, 0.02, ledMat(0.75), s * 0.355, 0.02, 0.37));
  return g;
}
function poolTable() {
  const g = G();
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => box(g, 0.12, 0.7, 0.12, '#5d3a1a', a * 0.95, 0, b * 0.48));
  box(g, 2.2, 0.12, 1.2, '#6d4122', 0, 0.68, 0);
  box(g, 2.0, 0.02, 1.0, '#0f8a4b', 0, 0.8, 0);
  [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1]].forEach(([a, b]) => cyl(g, 0.045, 0.045, 0.01, '#000', a * 1.0, 0.815, b * 0.5, 12));
  const cols = ['#ffffff', '#ffd23f', '#1d4ed8', '#e11d48', '#7c3aed', '#f97316', '#16a34a', '#111', '#ffd23f', '#1d4ed8'];
  cols.forEach((c, i) => {
    const row = Math.floor((Math.sqrt(8 * i + 1) - 1) / 2), k = i - row * (row + 1) / 2;
    const x = i === 0 ? -0.6 : 0.35 + row * 0.055, z = i === 0 ? 0 : (k - row / 2) * 0.062;
    sph(g, 0.028, M(c, 0.15), x, 0.84, z, 12);
  });
  const cue = cyl(g, 0.008, 0.012, 1.4, '#c9a27e', -0.2, 0.84, 0.25, 8); cue.rotation.z = Math.PI / 2; cue.position.y = 0.84;
  return g;
}
function speaker(h = 1.0) {
  const g = G();
  box(g, 0.28, h, 0.3, '#1b1b1b');
  [0.25, 0.55, 0.8].forEach((y, i) => { const c = add(g, new THREE.CylinderGeometry(i ? 0.09 : 0.05, i ? 0.09 : 0.05, 0.02, 20), M('#333', 0.4), 0, y * h, 0.15); c.rotation.x = Math.PI / 2; });
  box(g, 0.01, h - 0.05, 0.01, ledMat(0.6), -0.14, 0.02, 0.15);
  return g;
}
function neonSign(text, color) {
  const g = G();
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), new THREE.MeshBasicMaterial({ map: textSign(text, color), transparent: true }));
  m.position.y = 0.22; g.add(m);
  return g;
}
const discoBalls = [];
function discoBall() {
  const g = G();
  cyl(g, 0.006, 0.006, 0.3, '#888', 0, -0.3, 0, 6);
  const b = add(g, new THREE.IcosahedronGeometry(0.16, 1), M('#e8eef5', 0.1, 1), 0, -0.45, 0);
  b.material = new THREE.MeshStandardMaterial({ color: '#e8eef5', roughness: 0.1, metalness: 1, envMap: envTex, flatShading: true });
  discoBalls.push(b);
  return g;
}
// ---- closet ----
const CLOTHES = ['#ff4d8d', '#ffd23f', '#7b5cff', '#2ec4b6', '#ff9f1c', '#ffffff', '#1d3557', '#e63946', '#c77dff', '#90e0ef'];
function clothesRack(w = 1.4) {
  const g = G();
  box(g, w, 0.03, 0.55, '#f7f0e8', 0, 2.0, 0);
  [-1, 1].forEach(s => box(g, 0.04, 2.2, 0.55, '#f7f0e8', s * (w / 2 - 0.02), 0, 0));
  box(g, w, 0.03, 0.55, '#f7f0e8', 0, 0.02, 0);
  const rod = cyl(g, 0.012, 0.012, w - 0.08, gold, 0, 1.8, 0, 8); rod.rotation.z = Math.PI / 2; rod.position.y = 1.8;
  for (let x = -w / 2 + 0.12; x < w / 2 - 0.08; x += 0.09) {
    const len = rr(0.6, 1.05), c = pick(CLOTHES);
    box(g, 0.025, len, 0.42, c, x, 1.78 - len, 0);
    box(g, 0.03, 0.04, 0.3, '#c9a27e', x, 1.76, 0);
  }
  for (let x = -w / 2 + 0.2; x < w / 2 - 0.15; x += 0.32) {
    const c = pick(['#ff4d8d', '#8d6e63', '#111', '#ffd23f', '#c77dff']);
    box(g, 0.24, 0.18, 0.12, c, x, 2.03, 0);
    const hdl = add(g, new THREE.TorusGeometry(0.06, 0.01, 6, 14, Math.PI), c, x, 2.21, 0);
  }
  return g;
}
function shoeShelf(w = 1.2) {
  const g = G(), d = 0.35;
  [-1, 1].forEach(s => box(g, 0.03, 1.2, d, '#ffffff', s * (w / 2 - 0.015), 0, 0));
  for (let i = 0; i < 4; i++) {
    const y = 0.05 + i * 0.3;
    box(g, w, 0.025, d, '#ffffff', 0, y, 0);
    for (let x = -w / 2 + 0.12; x < w / 2 - 0.1; x += 0.22) {
      const c = pick(['#ff4d8d', '#ffffff', '#111', '#ffd23f', '#e63946', '#7b5cff', '#c9a27e']);
      box(g, 0.07, 0.07, 0.24, c, x - 0.04, y + 0.025, 0); box(g, 0.07, 0.07, 0.24, c, x + 0.04, y + 0.025, 0);
      if (rand() < 0.3) box(g, 0.02, 0.1, 0.02, c, x, y + 0.09, 0.08);
    }
  }
  box(g, w, 0.025, d, '#ffffff', 0, 1.2, 0);
  cyl(g, 0.08, 0.08, 0.2, '#ffd1e3', -0.3, 1.225, 0);
  cyl(g, 0.09, 0.09, 0.16, '#c77dff', 0.3, 1.225, 0);
  return g;
}
function fullMirror() {
  const g = G();
  box(g, 0.7, 1.9, 0.04, gold);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.82), mirrorMat); m.position.set(0, 0.95, 0.021); g.add(m);
  return g;
}
function dressingTable() {
  const g = G();
  box(g, 1.1, 0.04, 0.45, '#ffffff', 0, 0.74, 0);
  [-1, 1].forEach(s => box(g, 0.4, 0.74, 0.43, '#ffe0ef', s * 0.33, 0, 0));
  [-1, 1].forEach(s => { box(g, 0.36, 0.005, 0.01, '#d8a', s * 0.33, 0.37, 0.216); sph(g, 0.015, gold, s * 0.33, 0.55, 0.22, 8); });
  const frame = add(g, new THREE.TorusGeometry(0.33, 0.025, 10, 40), gold, 0, 1.2, -0.18); frame.scale.y = 1.3;
  const mir = add(g, new THREE.CircleGeometry(0.32, 40), mirrorMat, 0, 1.2, -0.185, false); mir.scale.y = 1.3;
  ['#ff4d8d', '#c77dff', '#ffd23f', '#90e0ef'].forEach((c, i) => cyl(g, 0.025, 0.03, 0.1 + i * 0.02, M(c, 0.1), -0.35 + i * 0.09, 0.78, 0.05, 10));
  cyl(g, 0.06, 0.06, 0.08, '#ffffff', 0.35, 0.78, 0.05);
  sph(g, 0.05, '#ff70a6', 0.35, 0.9, 0.05, 10);
  return g;
}
function pouf(c = '#ff70a6') {
  const g = G();
  cyl(g, 0.22, 0.22, 0.42, M(c, 0.95), 0, 0, 0);
  return g;
}
function piano() {
  const g = G();
  box(g, 1.45, 1.25, 0.4, blackGloss, 0, 0, -0.1);
  box(g, 1.45, 0.06, 0.32, blackGloss, 0, 0.7, 0.18);
  box(g, 1.3, 0.03, 0.18, '#ffffff', 0, 0.76, 0.2);
  for (let i = 0; i < 18; i++) if (i % 7 !== 2 && i % 7 !== 6) box(g, 0.025, 0.03, 0.1, '#111', -0.6 + i * 0.07, 0.78, 0.16);
  [-1, 1].forEach(s => box(g, 0.06, 0.7, 0.06, blackGloss, s * 0.66, 0, 0.3));
  box(g, 0.5, 0.3, 0.02, blackGloss, 0, 1.0, 0.11).rotation.x = -0.2;
  box(g, 0.2, 0.28, 0.01, '#fff8e7', 0, 1.02, 0.13).rotation.x = -0.2;
  return g;
}
function bench(w = 1.4, c = '#a47148') {
  const g = G();
  [-1, 1].forEach(s => { box(g, 0.06, 0.42, 0.42, '#3a3a3a', s * (w / 2 - 0.1), 0, 0); box(g, 0.06, 0.45, 0.06, '#3a3a3a', s * (w / 2 - 0.1), 0.42, -0.18); });
  for (let i = 0; i < 3; i++) box(g, w, 0.04, 0.12, c, 0, 0.42, -0.14 + i * 0.14);
  for (let i = 0; i < 2; i++) box(g, w, 0.1, 0.03, c, 0, 0.58 + i * 0.15, -0.2);
  return g;
}
function roundTable(r = 0.4, h = 0.72, c = '#ffffff') {
  const g = G();
  cyl(g, r, r, 0.04, c, 0, h - 0.04, 0, 28);
  cyl(g, 0.03, 0.03, h - 0.04, '#333', 0, 0, 0, 8);
  cyl(g, 0.2, 0.22, 0.03, '#333', 0, 0, 0, 20);
  cyl(g, 0.05, 0.05, 0.1, '#ffffff', 0, h, 0, 12);
  sph(g, 0.07, '#ff70a6', 0, h + 0.15, 0, 10);
  return g;
}
function eggChair() {
  const g = G();
  cyl(g, 0.3, 0.35, 0.04, '#333', 0, 0, 0);
  const pole = cyl(g, 0.025, 0.025, 1.9, '#333', 0, 0.04, -0.25, 8);
  box(g, 0.04, 0.04, 0.3, '#333', 0, 1.9, -0.12);
  const egg = add(g, new THREE.SphereGeometry(0.45, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62), M('#f5deb3', 0.9), 0, 0.85, 0.02);
  egg.material = new THREE.MeshStandardMaterial({ color: '#f1d6a8', roughness: 0.9, side: THREE.DoubleSide });
  egg.rotation.x = -Math.PI * 0.62;
  egg.position.y = 0.9;
  cyl(g, 0.006, 0.006, 0.6, '#555', 0, 1.3, 0.02, 6);
  const cu = sph(g, 0.3, '#ff70a6', 0, 0.62, 0.05, 16); cu.scale.y = 0.35;
  return g;
}
function lounger(towel = '#ff70a6') {
  const g = G();
  box(g, 0.65, 0.25, 1.4, '#ffffff', 0, 0, 0.25);
  box(g, 0.6, 0.06, 1.35, '#2ec4b6', 0, 0.25, 0.25);
  const back = G(); back.position.set(0, 0.28, -0.42); back.rotation.x = -0.7; g.add(back);
  box(back, 0.65, 0.05, 0.75, '#ffffff', 0, 0, -0.3);
  box(back, 0.6, 0.05, 0.72, '#2ec4b6', 0, 0.05, -0.3);
  box(g, 0.5, 0.02, 0.6, towel, 0, 0.31, 0.45);
  return g;
}
function umbrella(c = '#ff4d8d') {
  const g = G();
  cyl(g, 0.25, 0.28, 0.08, '#555');
  cyl(g, 0.025, 0.025, 2.3, '#f5f5f5', 0, 0.08, 0, 8);
  const tex = ctex(256, 64, (gg, W, H) => { for (let i = 0; i < 8; i++) { gg.fillStyle = i % 2 ? '#ffffff' : c; gg.fillRect(i * W / 8, 0, W / 8, H); } }, false);
  add(g, new THREE.ConeGeometry(1.3, 0.5, 16, 1, true), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.8 }), 0, 2.2, 0);
  sph(g, 0.05, c, 0, 2.48, 0, 10);
  return g;
}
const floaters = [];
function floatRing() {
  const tex = ctex(256, 32, (gg, W, H) => { for (let i = 0; i < 8; i++) { gg.fillStyle = i % 2 ? '#ffffff' : '#ff4d4d'; gg.fillRect(i * W / 8, 0, W / 8, H); } }, false);
  const m = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.12, 12, 32), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 }));
  m.rotation.x = Math.PI / 2; m.castShadow = true;
  return m;
}
// ---- outdoor ----
function tree(kind = 'round', h = 3) {
  const g = G();
  if (kind === 'pine') {
    cyl(g, 0.1, 0.14, h * 0.35, '#6d4c41', 0, 0, 0, 10);
    for (let i = 0; i < 3; i++) add(g, new THREE.ConeGeometry(h * (0.32 - i * 0.07), h * 0.38, 12), M(GREENS[i % 4], 0.9), 0, h * (0.42 + i * 0.2), 0);
  } else if (kind === 'palm') {
    const t = cyl(g, 0.1, 0.14, h, '#a1887f', 0, 0, 0, 10);
    for (let i = 0; i < 7; i++) { const l = box(g, 0.25, 0.03, 1.4, '#43a047', 0, h, 0); l.rotation.set(-0.5, i * 0.9, 0); l.translateZ(0.6); }
    sph(g, 0.1, '#8d6e63', 0, h, 0, 10);
  } else {
    cyl(g, 0.12, 0.17, h * 0.5, '#795548', 0, 0, 0, 10);
    const col = kind === 'blossom' ? ['#ffb3c6', '#ff8fab', '#ffc8dd'] : GREENS;
    for (let i = 0; i < 6; i++) sph(g, h * rr(0.17, 0.25), M(pick(col), 0.9), rr(-0.4, 0.4) * h * 0.3, h * rr(0.55, 0.85), rr(-0.4, 0.4) * h * 0.3, 12);
  }
  return g;
}
function bush(r = 0.35, c) {
  const g = G();
  for (let i = 0; i < 3; i++) sph(g, r * rr(0.7, 1), M(c || pick(GREENS), 0.9), rr(-r, r) * 0.5, r * 0.6, rr(-r, r) * 0.5, 10);
  return g;
}
function lampPost(h = 2.4) {
  const g = G();
  cyl(g, 0.1, 0.12, 0.1, '#2b2b2b');
  cyl(g, 0.035, 0.04, h, '#2b2b2b', 0, 0.1, 0, 8);
  box(g, 0.22, 0.3, 0.22, glassMat, 0, h + 0.1, 0);
  sph(g, 0.08, glow('#ffd27a', 1.6), 0, h + 0.25, 0, 12);
  add(g, new THREE.ConeGeometry(0.2, 0.15, 4), '#2b2b2b', 0, h + 0.47, 0).rotation.y = Math.PI / 4;
  return g;
}
const swings = [];
function swingSet() {
  const g = G();
  [-1, 1].forEach(s => [-1, 1].forEach(t => { const l = box(g, 0.08, 2.4, 0.08, '#ff9f1c', s * 1.0, 0, t * 0.35); l.rotation.x = -t * 0.18; }));
  const bar = cyl(g, 0.05, 0.05, 2.2, '#ff4d8d', 0, 2.3, 0, 10); bar.rotation.z = Math.PI / 2; bar.position.y = 2.32;
  [-0.45, 0.45].forEach((x, i) => {
    const sw = G(); sw.position.set(x, 2.3, 0); g.add(sw);
    [-0.18, 0.18].forEach(dx => cyl(sw, 0.008, 0.008, 1.75, '#ddd', dx, -1.8, 0, 4));
    box(sw, 0.45, 0.04, 0.2, i ? '#7b5cff' : '#2ec4b6', 0, -1.85, 0);
    swings.push({ obj: sw, phase: i * 1.7 });
  });
  return g;
}
function fountain() {
  const g = G();
  cyl(g, 1.0, 1.1, 0.4, '#e9e4dc', 0, 0, 0, 32);
  cyl(g, 0.9, 0.9, 0.02, new THREE.MeshStandardMaterial({ color: '#4fc3f7', roughness: 0.05, transparent: true, opacity: 0.85 }), 0, 0.35, 0, 32);
  cyl(g, 0.12, 0.15, 0.8, '#e9e4dc', 0, 0.35, 0, 16);
  cyl(g, 0.45, 0.35, 0.12, '#e9e4dc', 0, 1.1, 0, 24);
  cyl(g, 0.38, 0.38, 0.02, new THREE.MeshStandardMaterial({ color: '#4fc3f7', roughness: 0.05 }), 0, 1.21, 0, 24);
  const jet = add(g, new THREE.ConeGeometry(0.06, 0.6, 10, 1, true), new THREE.MeshStandardMaterial({ color: '#bfefff', transparent: true, opacity: 0.6, roughness: 0 }), 0, 1.5, 0, false);
  jet.rotation.x = Math.PI;
  return g;
}
function birdBath() {
  const g = G();
  cyl(g, 0.08, 0.15, 0.8, '#d7ccc8', 0, 0, 0, 12);
  cyl(g, 0.35, 0.2, 0.12, '#d7ccc8', 0, 0.8, 0, 20);
  cyl(g, 0.3, 0.3, 0.01, M('#4fc3f7', 0.05), 0, 0.9, 0, 20);
  const bird = G(); bird.position.set(0.25, 0.95, 0); g.add(bird);
  sph(bird, 0.05, '#4dabff', 0, 0, 0, 10); sph(bird, 0.035, '#4dabff', 0.04, 0.05, 0, 10);
  add(bird, new THREE.ConeGeometry(0.012, 0.03, 6), '#ffb703', 0.08, 0.05, 0).rotation.z = -Math.PI / 2;
  return g;
}
function mailbox() {
  const g = G();
  cyl(g, 0.03, 0.03, 1.0, '#5d4037', 0, 0, 0, 8);
  box(g, 0.22, 0.24, 0.42, '#ff4d8d', 0, 1.0, 0);
  box(g, 0.02, 0.15, 0.06, '#ffd23f', 0.12, 1.15, 0.1);
  return g;
}
function car(c = '#ff2e63') {
  const g = G();
  const paint = new THREE.MeshStandardMaterial({ color: c, roughness: 0.25, metalness: 0.6, envMap: envTex });
  box(g, 1.8, 0.55, 4.3, paint, 0, 0.3, 0);
  const cab = box(g, 1.6, 0.55, 2.3, M('#1d2733', 0.05, 0.6), 0, 0.85, -0.25);
  box(g, 1.62, 0.06, 2.0, paint, 0, 1.38, -0.3);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => {
    const w = add(g, new THREE.CylinderGeometry(0.36, 0.36, 0.26, 24), M('#1a1a1a', 0.8), a * 0.85, 0.36, b * 1.35); w.rotation.z = Math.PI / 2;
    const r = add(g, new THREE.CylinderGeometry(0.2, 0.2, 0.27, 12), chrome, a * 0.85, 0.36, b * 1.35); r.rotation.z = Math.PI / 2;
  });
  [-1, 1].forEach(s => { box(g, 0.35, 0.12, 0.04, glow('#fffbe0', 2), s * 0.6, 0.62, 2.15); box(g, 0.35, 0.1, 0.04, glow('#ff1e3c', 1.5), s * 0.6, 0.65, -2.15); });
  box(g, 0.5, 0.12, 0.02, '#ffffff', 0, 0.42, 2.16);
  box(g, 0.9, 0.1, 0.04, '#222', 0, 0.45, 2.15);
  return g;
}
function bicycle(c = '#2ec4b6') {
  const g = G();
  [-0.5, 0.5].forEach(z => { const w = add(g, new THREE.TorusGeometry(0.32, 0.025, 8, 28), '#222', 0, 0.34, z); w.rotation.y = Math.PI / 2; });
  const f1 = cyl(g, 0.02, 0.02, 0.75, c, 0, 0.55, 0, 6); f1.rotation.x = Math.PI / 2; f1.position.y = 0.6;
  const f2 = cyl(g, 0.02, 0.02, 0.45, c, 0, 0.34, -0.05, 6); f2.rotation.x = 0.5;
  box(g, 0.1, 0.04, 0.22, '#222', 0, 0.82, -0.2);
  box(g, 0.5, 0.025, 0.025, '#222', 0, 0.85, 0.42);
  box(g, 0.2, 0.15, 0.2, '#ff4d8d', 0, 0.75, 0.55);
  return g;
}
function evCharger() {
  const g = G();
  box(g, 0.3, 1.3, 0.22, '#f5f7fa');
  box(g, 0.2, 0.12, 0.01, glow('#3ddc84', 1.5), 0, 1.0, 0.111);
  const cable = add(g, new THREE.TorusGeometry(0.12, 0.02, 6, 16), '#222', 0, 0.6, 0.15);
  return g;
}
function gateArch(text) {
  const g = G();
  [-1, 1].forEach(s => { box(g, 0.35, 2.6, 0.35, '#f7f1e6', s * 0.75, 0, 0); box(g, 0.45, 0.12, 0.45, '#ff4d8d', s * 0.75, 2.6, 0); sph(g, 0.12, glow('#ffd27a', 1.4), s * 0.75, 2.85, 0, 12); });
  box(g, 1.85, 0.42, 0.2, '#7b5cff', 0, 2.2, 0);
  [1, -1].forEach(side => {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 0.36), new THREE.MeshBasicMaterial({ map: textSign(text, '#ffffff', 1024, 210, 'bold 92px Poppins, sans-serif', '#7b5cff') }));
    sign.position.set(0, 2.41, side * 0.105); if (side < 0) sign.rotation.y = Math.PI; g.add(sign);
  });
  return g;
}
function pergola(w = 3.2, d = 3.2, h = 2.4) {
  const g = G();
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => box(g, 0.12, h, 0.12, '#f7f1e6', a * w / 2, 0, b * d / 2));
  [-1, 1].forEach(b => box(g, w + 0.4, 0.14, 0.1, '#c9a27e', 0, h, b * d / 2));
  for (let i = 0; i < 9; i++) box(g, 0.06, 0.1, d + 0.4, '#c9a27e', -w / 2 + i * w / 8, h + 0.14, 0);
  // vines
  for (let i = 0; i < 14; i++) sph(g, rr(0.12, 0.2), M(pick(GREENS), 0.9), rr(-w / 2, w / 2), h + 0.25, rr(-d / 2, d / 2), 8);
  for (let i = 0; i < 10; i++) sph(g, 0.05, pick(['#ff70a6', '#c77dff', '#ffffff']), rr(-w / 2, w / 2), h + 0.2, rr(-d / 2, d / 2), 8);
  return g;
}
function raisedPlanter(w, d = 0.6) {
  const g = G();
  box(g, w, 0.55, d, '#a47148');
  box(g, w - 0.1, 0.02, d - 0.1, '#5d4037', 0, 0.54, 0);
  for (let x = -w / 2 + 0.25; x < w / 2 - 0.15; x += 0.32) {
    if (rand() < 0.5) { const b = bush(0.2); b.position.set(x, 0.5, rr(-0.08, 0.08)); g.add(b); }
    else { for (let k = 0; k < 4; k++) { cyl(g, 0.006, 0.006, 0.25, '#3a7d2c', x + rr(-0.1, 0.1), 0.55, rr(-0.15, 0.15), 4); } for (let k = 0; k < 4; k++) sph(g, 0.045, pick(['#ff4d8d', '#ffd23f', '#c77dff', '#ff922b', '#ffffff']), x + rr(-0.1, 0.1), 0.8 + rr(0, 0.05), rr(-0.15, 0.15), 8); }
  }
  return g;
}
function telescope() {
  const g = G();
  [0, 2.1, 4.2].forEach(a => { const l = cyl(g, 0.015, 0.015, 1.1, '#333', Math.sin(a) * 0.2, 0, Math.cos(a) * 0.2, 6); l.rotation.set(Math.cos(a) * 0.2, 0, -Math.sin(a) * 0.2); });
  const t = cyl(g, 0.07, 0.09, 0.9, '#ffffff', 0, 0.8, 0, 16); t.rotation.x = 1.0; t.position.set(0, 1.15, 0.1);
  return g;
}
// ---- kids ----
function teddy() {
  const g = G(), c = '#b07a4f';
  sph(g, 0.14, c, 0, 0.14, 0, 14); sph(g, 0.1, c, 0, 0.34, 0, 14);
  [-1, 1].forEach(s => { sph(g, 0.04, c, s * 0.07, 0.43, 0, 8); sph(g, 0.05, c, s * 0.13, 0.18, 0.04, 8); sph(g, 0.05, c, s * 0.08, 0.04, 0.08, 8); sph(g, 0.012, '#111', s * 0.035, 0.36, 0.09, 6); });
  sph(g, 0.04, '#e8c39e', 0, 0.31, 0.08, 8);
  box(g, 0.1, 0.03, 0.03, '#ff4d8d', 0, 0.24, 0.09);
  return g;
}
function playTent() {
  const g = G();
  const tex = ctex(256, 64, (gg, W, H) => { for (let i = 0; i < 8; i++) { gg.fillStyle = ['#ff70a6', '#ffffff', '#7b5cff', '#ffffff'][i % 4]; gg.fillRect(i * W / 8, 0, W / 8, H); } }, false);
  add(g, new THREE.ConeGeometry(0.65, 1.6, 6, 1, true), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide }), 0, 0.8, 0);
  add(g, new THREE.ConeGeometry(0.05, 0.25, 6), '#ffd23f', 0, 1.65, 0);
  box(g, 0.35, 0.3, 0.01, '#ffd23f', 0, 1.25, 0.32);
  return g;
}
function toyBlocks() {
  const g = G();
  ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff924c'].forEach((c, i) => {
    const b = box(g, 0.12, 0.12, 0.12, c, (i % 3) * 0.14 - 0.14, Math.floor(i / 3) * 0.12, 0);
    b.rotation.y = rr(-0.3, 0.3);
  });
  sph(g, 0.12, '#ff595e', 0.4, 0.12, 0.2, 16);
  return g;
}
function globe() {
  const g = G();
  cyl(g, 0.06, 0.08, 0.03, gold);
  cyl(g, 0.01, 0.01, 0.1, gold, 0, 0.03, 0, 6);
  const tex = ctex(256, 128, (gg, W, H) => { gg.fillStyle = '#2f80ed'; gg.fillRect(0, 0, W, H); gg.fillStyle = '#7bd36b'; for (let i = 0; i < 9; i++) { gg.beginPath(); gg.ellipse(rr(0, W), rr(20, H - 20), rr(10, 35), rr(8, 25), rr(0, 3), 0, 7); gg.fill(); } }, false);
  add(g, new THREE.SphereGeometry(0.12, 24, 16), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }), 0, 0.25, 0).rotation.z = 0.4;
  return g;
}
function wallStars(n, w, h) {
  const g = G();
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.04 : 0.09, a = i * Math.PI / 5 - Math.PI / 2; i ? shape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : shape.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const geo = new THREE.ShapeGeometry(shape);
  const mats = ['#ffe14d', '#ff9de2', '#9ad8ff'].map(c => glow(c, 0.8));
  for (let i = 0; i < n; i++) { const s = new THREE.Mesh(geo, pick(mats)); s.position.set(rr(-w / 2, w / 2), rr(0, h), 0); s.scale.setScalar(rr(0.6, 1.3)); g.add(s); }
  return g;
}
function consoleTable(w = 1.0) {
  const g = G();
  box(g, w, 0.04, 0.35, '#c9a27e', 0, 0.8, 0);
  [-1, 1].forEach(s => box(g, 0.04, 0.8, 0.3, '#2b2140', s * (w / 2 - 0.04), 0, 0));
  cyl(g, 0.06, 0.08, 0.25, '#2ec4b6', -w * 0.25, 0.84, 0, 14);
  for (let i = 0; i < 5; i++) sph(g, 0.04, pick(['#ff4d8d', '#ffd23f', '#ffffff']), -w * 0.25 + rr(-0.06, 0.06), 1.12 + rr(0, 0.08), rr(-0.05, 0.05), 8);
  sph(g, 0.06, '#ffd23f', w * 0.25, 0.9, 0, 10);
  return g;
}

// =====================================================================
//  House data (same coordinates as the 2D plan)
// =====================================================================
const ROOMS0 = [
  { name: 'Living Hall', x: 40, y: 190, w: 260, h: 240, floor: 'wood', fc: '#d9a066', paint: '#fff0bf' },
  { name: 'Kitchen', x: 300, y: 190, w: 170, h: 140, floor: 'checker', fc: '#ffffff', fc2: '#ffcf99', paint: '#ffe2c9' },
  { name: 'Toilet 1', x: 300, y: 330, w: 85, h: 100, floor: 'tiles', fc: '#b2ebf2', paint: '#c9f5e6' },
  { name: 'Bathroom 1', x: 385, y: 330, w: 85, h: 100, floor: 'tiles', fc: '#90caf9', paint: '#cdeeff' },
  { name: 'Lobby', x: 330, y: 430, w: 140, h: 80, floor: 'marble', fc: '#f5efe6', paint: '#fff5d1' },
  { name: 'Gaming Room', x: 470, y: 310, w: 210, h: 200, floor: 'carpet', fc: '#3b2d6b', paint: '#2e2a5c' },
  { name: 'Bedroom 1 (Guest)', x: 40, y: 430, w: 210, h: 170, floor: 'wood', fc: '#c58f5c', paint: '#ffd9e4' },
  { name: 'Staircase', x: 250, y: 430, w: 80, h: 170, floor: 'marble', fc: '#efe7dc', paint: '#f3ead9' },
];
const GAPS0 = [
  ['h', 190, 170, 205, 'door'], ['h', 190, 60, 150, 'window'], ['h', 190, 220, 290, 'window'], ['v', 40, 330, 410, 'window'],
  ['v', 300, 240, 270, 'door'], ['h', 430, 250, 300, 'open'], ['h', 430, 210, 240, 'door'],
  ['h', 190, 335, 360, 'window'], ['v', 470, 250, 280, 'door'],
  ['h', 430, 335, 360, 'door'], ['h', 430, 415, 440, 'door'],
  ['v', 330, 430, 470, 'open'], ['v', 470, 440, 470, 'door'], ['h', 510, 380, 410, 'door'],
  ['h', 310, 620, 670, 'window'], ['h', 510, 620, 670, 'window'],
  ['h', 600, 150, 180, 'door'], ['h', 600, 60, 130, 'window'],
];
const ROOMS1 = [
  { name: 'Master Bedroom', x: 40, y: 190, w: 200, h: 200, floor: 'wood', fc: '#a0673f', paint: '#e6dbff' },
  { name: 'Closet Area', x: 240, y: 190, w: 90, h: 100, floor: 'carpet', fc: '#f3d9e6', paint: '#ffd6ec' },
  { name: 'Bathroom 2', x: 240, y: 290, w: 90, h: 100, floor: 'tiles', fc: '#80deea', paint: '#d0f4f7' },
  { name: 'Family Lounge', x: 330, y: 190, w: 140, h: 200, floor: 'wood', fc: '#d9a066', paint: '#fff0c9' },
  { name: 'Corridor', x: 40, y: 390, w: 430, h: 60, floor: 'marble', fc: '#f5efe6', paint: '#fdf6ec' },
  { name: 'Bedroom 3', x: 470, y: 310, w: 210, h: 200, floor: 'wood', fc: '#c89b6d', paint: '#d4e9ff' },
  { name: 'Bedroom 4 (Kids)', x: 40, y: 450, w: 210, h: 150, floor: 'carpet', fc: '#9fd8a0', paint: '#dff7d2' },
  { name: 'Toilet 2', x: 330, y: 450, w: 140, h: 60, floor: 'tiles', fc: '#b2dfdb', paint: '#d9f7ef' },
  { name: 'Staircase', x: 250, y: 450, w: 80, h: 150, floor: 'marble', fc: '#efe7dc', paint: '#f3ead9', slab: { x: 250, y: 450, w: 80, h: 20 } },
];
const GAPS1 = [
  ['h', 190, 100, 130, 'door'], ['v', 40, 345, 380, 'window'], ['v', 40, 200, 235, 'window'],
  ['v', 240, 215, 245, 'door'], ['v', 240, 325, 355, 'door'], ['h', 390, 150, 180, 'door'],
  ['h', 190, 380, 410, 'door'], ['h', 190, 420, 460, 'window'], ['v', 470, 240, 270, 'door'], ['h', 390, 345, 455, 'open'],
  ['h', 450, 150, 180, 'door'], ['h', 450, 250, 330, 'open'], ['h', 450, 380, 410, 'door'], ['v', 470, 400, 440, 'door'], ['v', 40, 400, 440, 'window'],
  ['h', 310, 600, 660, 'window'], ['h', 510, 600, 660, 'window'],
  ['h', 600, 60, 130, 'window'], ['v', 40, 560, 590, 'window'], ['h', 510, 420, 450, 'window'],
];
// outdoor areas (for floors and the minimap)
const OUT0 = [
  { name: 'Front Garden', x: 40, y: 50, w: 430, h: 140, c: '#9be38a' },
  { name: 'Parking Area', x: 470, y: 50, w: 210, h: 260, c: '#cfd4dc' },
  { name: 'Pool Deck', x: 330, y: 510, w: 350, h: 240, c: '#f4dcb4' },
  { name: 'Back Garden', x: 40, y: 600, w: 290, h: 150, c: '#9be38a' },
];
const OUT1 = [
  { name: 'Balcony', x: 40, y: 110, w: 430, h: 80, c: '#ffd6a5' },
  { name: 'Terrace Garden', x: 470, y: 50, w: 210, h: 260, c: '#7fd88f' },
];
const POOL = { x: 380, y: 560, w: 260, h: 150 };

// =====================================================================
//  Walls (built from room outlines, with doors / windows / openings)
// =====================================================================
const occluders = [[], []];
function gapType(gaps, o, at, pos) {
  for (const g of gaps) if (g[0] === o && g[1] === at && pos >= g[2] && pos + 5 <= g[3]) return g[4];
  return 'wall';
}
function runs(cells) {
  const out = []; let cur = null;
  for (const c of cells) {
    if (cur && c.pos === cur.to && c.type === cur.type) cur.to += 5;
    else { cur = { from: c.pos, to: c.pos + 5, type: c.type }; out.push(cur); }
  }
  return out;
}
function pieces(type, H) {
  if (type === 'wall') return [[0, H]];
  if (type === 'door') return [[2.15, H]];
  if (type === 'window') return [[0, 0.9], [2.1, H]];
  return [];
}
function fadeMat(color) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.92, transparent: true, opacity: 1 });
  m.userData.target = 1;
  return m;
}
function buildWalls(parent, rooms, gaps, H, level) {
  const lines = new Map();
  for (const r of rooms) {
    for (let x = r.x; x < r.x + r.w; x += 5) for (const at of [r.y, r.y + r.h]) { const k = 'h|' + at; if (!lines.has(k)) lines.set(k, new Set()); lines.get(k).add(x); }
    for (let y = r.y; y < r.y + r.h; y += 5) for (const at of [r.x, r.x + r.w]) { const k = 'v|' + at; if (!lines.has(k)) lines.set(k, new Set()); lines.get(k).add(y); }
  }
  for (const [k, set] of lines) {
    const [o, atS] = k.split('|'), at = +atS;
    const cells = [...set].sort((a, b) => a - b).map(pos => ({ pos, type: gapType(gaps, o, at, pos) }));
    for (const run of runs(cells)) {
      const len = (run.to - run.from) * S, mid = (run.from + run.to) / 2;
      const L = len + (run.type === 'wall' ? WT : 0);
      const cx = o === 'h' ? X(mid) : X(at), cz = o === 'h' ? Z(at) : Z(mid);
      for (const [y0, y1] of pieces(run.type, H)) {
        const geo = o === 'h' ? new THREE.BoxGeometry(L, y1 - y0, WT) : new THREE.BoxGeometry(WT, y1 - y0, L);
        const m = add(parent, geo, fadeMat('#f8f3ea'), cx, (y0 + y1) / 2, cz);
        occluders[level].push(m);
      }
      if (run.type === 'window') {
        const gl = o === 'h' ? new THREE.BoxGeometry(len, 1.2, 0.03) : new THREE.BoxGeometry(0.03, 1.2, len);
        add(parent, gl, glassMat, cx, 1.5, cz, false);
        const sill = o === 'h' ? new THREE.BoxGeometry(len + 0.1, 0.05, WT + 0.12) : new THREE.BoxGeometry(WT + 0.12, 0.05, len + 0.1);
        add(parent, sill, '#ffffff', cx, 0.9, cz);
        const mull = o === 'h' ? new THREE.BoxGeometry(0.04, 1.2, 0.05) : new THREE.BoxGeometry(0.05, 1.2, 0.04);
        add(parent, mull, '#ffffff', cx, 1.5, cz, false);
      }
      if (run.type === 'door') {
        for (const end of [run.from, run.to]) {
          const ex = o === 'h' ? X(end) : X(at), ez = o === 'h' ? Z(at) : Z(end);
          add(parent, new THREE.BoxGeometry(o === 'h' ? 0.06 : WT + 0.05, 2.15, o === 'h' ? WT + 0.05 : 0.06), '#a47148', ex, 1.075, ez);
        }
      }
    }
  }
  // per-room coloured paint on the inner faces
  for (const r of rooms) {
    const sides = [
      { o: 'h', at: r.y, a: r.x, b: r.x + r.w, rot: 0, pos: (m) => [X(m), Z(r.y) + WT / 2 + 0.004] },
      { o: 'h', at: r.y + r.h, a: r.x, b: r.x + r.w, rot: Math.PI, pos: (m) => [X(m), Z(r.y + r.h) - WT / 2 - 0.004] },
      { o: 'v', at: r.x, a: r.y, b: r.y + r.h, rot: Math.PI / 2, pos: (m) => [X(r.x) + WT / 2 + 0.004, Z(m)] },
      { o: 'v', at: r.x + r.w, a: r.y, b: r.y + r.h, rot: -Math.PI / 2, pos: (m) => [X(r.x + r.w) - WT / 2 - 0.004, Z(m)] },
    ];
    for (const sd of sides) {
      const cells = [];
      for (let p = sd.a; p < sd.b; p += 5) cells.push({ pos: p, type: gapType(gaps, sd.o, sd.at, p) });
      for (const run of runs(cells)) {
        const len = (run.to - run.from) * S, [px, pz] = sd.pos((run.from + run.to) / 2);
        for (const [y0, y1] of pieces(run.type, H)) {
          const m = new THREE.Mesh(new THREE.PlaneGeometry(len, y1 - y0), fadeMat(r.paint));
          m.position.set(px, (y0 + y1) / 2, pz); m.rotation.y = sd.rot; m.receiveShadow = true;
          parent.add(m); occluders[level].push(m);
        }
        // skirting board
        if (run.type === 'wall' || run.type === 'window') {
          const sk = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.1), M(shade(r.paint, -0.25)));
          sk.position.set(px, 0.05, pz); sk.rotation.y = sd.rot; sk.translateZ(0.003); parent.add(sk);
        }
      }
    }
  }
}
function buildFloors(parent, list, top, thick) {
  for (const r of list) {
    const rect = r.slab || r, w = rect.w * S, d = rect.h * S;
    add(parent, new THREE.BoxGeometry(w, thick, d), texMat(r.floor, r.fc, r.fc2, w, d), X(rect.x) + w / 2, top - thick / 2, Z(rect.y) + d / 2, false);
  }
}
function railing(parent, o, at, from, to, kind = 'glass', h = 1.0) {
  const len = (to - from) * S, mid = (from + to) / 2;
  const cx = o === 'h' ? X(mid) : X(at), cz = o === 'h' ? Z(at) : Z(mid);
  const geo = (w, hh, t) => o === 'h' ? new THREE.BoxGeometry(w, hh, t) : new THREE.BoxGeometry(t, hh, w);
  if (kind === 'glass') {
    add(parent, geo(len, h - 0.05, 0.03), glassMat, cx, (h - 0.05) / 2, cz, false);
    add(parent, geo(len + 0.04, 0.05, 0.07), chrome, cx, h, cz);
    const n = Math.max(2, Math.round(len / 1.4));
    for (let i = 0; i <= n; i++) {
      const p = from + (to - from) * i / n;
      add(parent, new THREE.BoxGeometry(0.05, h, 0.05), chrome, o === 'h' ? X(p) : cx, h / 2, o === 'h' ? cz : Z(p));
    }
  } else {
    add(parent, geo(len + 0.2, h, 0.2), '#f8f3ea', cx, h / 2, cz);
    add(parent, geo(len + 0.26, 0.06, 0.28), '#c9a27e', cx, h + 0.03, cz);
  }
}

// =====================================================================
//  Build the world
// =====================================================================
const site = G(); scene.add(site);
const ground = G(); scene.add(ground);
const upper = G(); upper.position.y = FH; scene.add(upper);
const upperExtras = [];   // first-floor things that live directly in the scene

// ---------- sky, lights ----------
const daySky = ctex(4, 512, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#5aa9ff'); gr.addColorStop(0.55, '#a8d8ff'); gr.addColorStop(1, '#fde9d9'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, false);
const nightSky = ctex(1024, 512, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#060818'); gr.addColorStop(0.6, '#1a1747'); gr.addColorStop(1, '#3b2a5c'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(255,255,255,${rr(0.3, 1)})`; g.fillRect(rr(0, w), rr(0, h * 0.7), rr(1, 2.2), rr(1, 2.2)); }
}, false);
scene.background = daySky;
scene.fog = new THREE.Fog('#cfe6ff', 80, 230);

const hemi = new THREE.HemisphereLight('#dff1ff', '#8aa86a', 1.25);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff4e0', 2.6);
sun.position.set(-14, 26, 16);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 70 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
scene.add(sun);
const amb = new THREE.AmbientLight('#ffffff', 0.25);
scene.add(amb);

// night-time room lights (always in the scene so shaders never recompile)
const nightLights = [];
[[170, 300, 2.5, '#ffd9a0'], [385, 260, 2.5, '#fff0d0'], [575, 410, 2.4, '#c77dff'], [145, 515, 2.4, '#ffc8dd'], [400, 470, 2.4, '#ffe8b0'],
 [510, 635, -0.4, '#29d3ff'], [300, 120, 2.2, '#ffd27a'], [180, 680, 2.2, '#ffd27a'],
 [140, 290, FH + 2.4, '#ffd9f0'], [400, 290, FH + 2.4, '#fff0c9'], [575, 410, FH + 2.4, '#cde6ff'], [145, 525, FH + 2.4, '#fff3a8'], [575, 180, FH + 2.2, '#ffd27a']]
  .forEach(([px, py, y, c]) => { const l = new THREE.PointLight(c, 0, 10, 1.6); l.position.set(X(px), y, Z(py)); scene.add(l); nightLights.push(l); });

// ---------- land, road, hills ----------
{
  const shape = new THREE.Shape();
  shape.moveTo(-150, -150); shape.lineTo(150, -150); shape.lineTo(150, 150); shape.lineTo(-150, 150); shape.lineTo(-150, -150);
  const hole = new THREE.Path();
  const [x0, x1, z0, z1] = [X(POOL.x), X(POOL.x + POOL.w), Z(POOL.y), Z(POOL.y + POOL.h)];
  hole.moveTo(x0, -z0); hole.lineTo(x0, -z1); hole.lineTo(x1, -z1); hole.lineTo(x1, -z0); hole.lineTo(x0, -z0);
  shape.holes.push(hole);
  const geo = new THREE.ShapeGeometry(shape); geo.rotateX(-Math.PI / 2);
  const gm = texMat('grass', '#7cb85a', null, 300, 300);
  gm.map.repeat.set(1 / 3, 1 / 3);
  // ShapeGeometry UVs are world units: scale texture accordingly
  const land = new THREE.Mesh(geo, gm); land.position.y = -0.06; land.receiveShadow = true; site.add(land);

  add(site, new THREE.BoxGeometry(300, 0.04, 40 * S), texMat('asphalt', '#4a525e', null, 300, 40 * S), 0, -0.04, Z(22), false);
  for (let x = -60; x < 60; x += 3) add(site, new THREE.BoxGeometry(1.4, 0.01, 0.12), '#ffffff', x, -0.015, Z(22), false);
  add(site, new THREE.BoxGeometry(300, 0.08, 8 * S), '#d7d2cb', 0, -0.04, Z(46), false);

  // distant hills
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2 + rr(-0.1, 0.1), r = rr(110, 150);
    const h = add(site, new THREE.SphereGeometry(rr(25, 45), 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M(pick(['#7fb069', '#6a9e5a', '#8cc084']), 1), Math.cos(a) * r, -1, Math.sin(a) * r, false);
    h.scale.y = rr(0.3, 0.5);
  }
  // neighbourhood trees
  for (let i = 0; i < 70; i++) {
    const x = rr(-55, 55), z = rr(-55, 55);
    if (Math.abs(x) < 12 && Math.abs(z) < 13) continue;
    if (z > -14 && z < -9.5) continue;
    const t = tree(pick(['round', 'pine', 'round', 'blossom']), rr(3, 6));
    t.position.set(x, 0, z); site.add(t);
  }
}

// ---------- outdoor floors ----------
{
  const flo = (x, y, w, h, type, c, top = 0, thick = 0.06) => add(site, new THREE.BoxGeometry(w * S, thick, h * S), texMat(type, c, null, w * S, h * S), X(x) + w * S / 2, top - thick / 2, Z(y) + h * S / 2, false);
  flo(40, 50, 430, 140, 'grass', '#8fd16a', 0.0);
  flo(170, 46, 35, 144, 'paving', '#e6d3b3', 0.012);
  flo(470, 50, 210, 260, 'paving', '#cfd4dc', 0.005);
  flo(470, 40, 210, 10, 'paving', '#bfc5ce', 0.005);
  flo(40, 600, 290, 150, 'grass', '#8fd16a', 0.0);
  // deck around the pool
  flo(330, 510, 350, 50, 'deck', '#e3b97f', 0.01, 0.1);
  flo(330, 710, 350, 40, 'deck', '#e3b97f', 0.01, 0.1);
  flo(330, 560, 50, 150, 'deck', '#e3b97f', 0.01, 0.1);
  flo(640, 560, 40, 150, 'deck', '#e3b97f', 0.01, 0.1);
}

// ---------- swimming pool ----------
let water;
{
  const [x0, z0, w, d, depth] = [X(POOL.x), Z(POOL.y), POOL.w * S, POOL.h * S, 1.4];
  const cx = x0 + w / 2, cz = z0 + d / 2;
  const tm = texMat('pooltile', '#4fc3f7', null, w, d);
  add(site, new THREE.BoxGeometry(w, 0.1, d), tm, cx, -depth - 0.05, cz, false);
  const wallTex = (len) => texMat('pooltile', '#29b6f6', null, len, depth);
  add(site, new THREE.BoxGeometry(w, depth, 0.1), wallTex(w), cx, -depth / 2, z0 - 0.05, false);
  add(site, new THREE.BoxGeometry(w, depth, 0.1), wallTex(w), cx, -depth / 2, z0 + d + 0.05, false);
  add(site, new THREE.BoxGeometry(0.1, depth, d), wallTex(d), x0 - 0.05, -depth / 2, cz, false);
  add(site, new THREE.BoxGeometry(0.1, depth, d), wallTex(d), x0 + w + 0.05, -depth / 2, cz, false);
  // coping
  const cop = M('#fbf7f0', 0.5);
  add(site, new THREE.BoxGeometry(w + 0.5, 0.06, 0.25), cop, cx, 0.03, z0 - 0.125);
  add(site, new THREE.BoxGeometry(w + 0.5, 0.06, 0.25), cop, cx, 0.03, z0 + d + 0.125);
  add(site, new THREE.BoxGeometry(0.25, 0.06, d), cop, x0 - 0.125, 0.03, cz);
  add(site, new THREE.BoxGeometry(0.25, 0.06, d), cop, x0 + w + 0.125, 0.03, cz);
  const wg = new THREE.PlaneGeometry(w, d, 48, 28); wg.rotateX(-Math.PI / 2);
  water = new THREE.Mesh(wg, new THREE.MeshStandardMaterial({ color: '#2ec8ff', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.72, envMap: envTex, emissive: '#0aa6d6', emissiveIntensity: 0.15 }));
  water.position.set(cx, -0.14, cz); site.add(water);
  water.userData.base = wg.attributes.position.array.slice();
  // ladder
  const lad = G(); put(site, lad, 615, 562);
  [-0.22, 0.22].forEach(x => { const r = cyl(lad, 0.025, 0.025, 1.6, chrome, x, -1.2, 0.08, 8); const t = add(lad, new THREE.TorusGeometry(0.15, 0.025, 8, 16, Math.PI), chrome, x, 0.4, -0.07); t.rotation.y = Math.PI / 2; });
  for (let i = 0; i < 3; i++) box(lad, 0.44, 0.03, 0.08, chrome, 0, -0.3 - i * 0.3, 0.1);
  const ring = floatRing(); ring.position.set(X(470), -0.1, Z(610)); site.add(ring); floaters.push({ obj: ring, ph: 0 });
  const duck = G(); duck.position.set(X(560), -0.1, Z(660)); site.add(duck); floaters.push({ obj: duck, ph: 2 });
  sph(duck, 0.18, '#ffd23f', 0, 0, 0, 14); sph(duck, 0.12, '#ffd23f', 0.12, 0.18, 0, 14);
  add(duck, new THREE.ConeGeometry(0.05, 0.1, 8), '#ff8c00', 0.25, 0.17, 0).rotation.z = -Math.PI / 2;
  [-1, 1].forEach(s => sph(duck, 0.018, '#111', 0.2, 0.22, s * 0.06, 6));
  const ball = sph(site, 0.2, '#ff4d8d', X(590), -0.05, Z(600), 16); floaters.push({ obj: ball, ph: 4 });
  // loungers & umbrella
  put(site, lounger('#ff70a6'), 440, 730, WE, 0.01);
  put(site, lounger('#ffd23f'), 520, 730, WE, 0.01);
  put(site, lounger('#7b5cff'), 600, 730, WE, 0.01);
  put(site, umbrella('#ff4d8d'), 355, 732, 0, 0.01);
  put(site, roundTable(0.3, 0.55), 480, 736, 0, 0.01);
  put(site, roundTable(0.3, 0.55), 560, 736, 0, 0.01);
  put(site, plant(1.0, '#2ec4b6', 'tall'), 665, 525, 0, 0.01);
  put(site, plant(0.9, '#ff9f1c', 'flower'), 665, 735, 0, 0.01);
  put(site, lampPost(1.6), 345, 525, 0, 0.01);
  put(site, lampPost(1.6), 665, 600, 0, 0.01);
}

// ---------- gardens, fence, gate ----------
const flowerSets = new Map();
const FLOWER_COLS = ['#ff4d8d', '#ffd23f', '#c77dff', '#ff922b', '#ffffff', '#ff6b6b', '#4dabf7'];
function flowers(parent, x1, y1, x2, y2, n, base = 0) {
  if (!flowerSets.has(parent)) flowerSets.set(parent, []);
  const arr = flowerSets.get(parent);
  for (let i = 0; i < n; i++) arr.push({ x: X(rr(x1, x2)), z: Z(rr(y1, y2)), y: base, h: rr(0.15, 0.4), c: pick(FLOWER_COLS) });
}
function buildFlowers() {
  const stemG = new THREE.CylinderGeometry(0.008, 0.008, 1, 4); stemG.translate(0, 0.5, 0);
  const headG = new THREE.IcosahedronGeometry(0.05, 0);
  const leafG = new THREE.SphereGeometry(0.07, 6, 4);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), col = new THREE.Color();
  for (const [parent, arr] of flowerSets) {
    const stems = new THREE.InstancedMesh(stemG, M('#3a7d2c'), arr.length);
    const heads = new THREE.InstancedMesh(headG, new THREE.MeshStandardMaterial({ roughness: 0.6 }), arr.length);
    const leaves = new THREE.InstancedMesh(leafG, M('#4caf50', 0.9), arr.length);
    arr.forEach((f, i) => {
      m.compose(pos.set(f.x, f.y, f.z), q, sc.set(1, f.h, 1)); stems.setMatrixAt(i, m);
      m.compose(pos.set(f.x, f.y + f.h, f.z), q, sc.set(1, 0.8, 1)); heads.setMatrixAt(i, m); heads.setColorAt(i, col.set(f.c));
      m.compose(pos.set(f.x, f.y + 0.03, f.z), q, sc.set(1.2, 0.6, 1.2)); leaves.setMatrixAt(i, m);
    });
    parent.add(stems, heads, leaves);
  }
}
function fence(parent, segs) {
  const pickets = [];
  const railG = [];
  for (const [o, at, a, b] of segs) {
    const len = (b - a) * S;
    for (let p = a * S; p <= b * S; p += 0.16) pickets.push(o === 'h' ? [X(0) + p, Z(at)] : [X(at), Z(0) + p]);
    railG.push([o, at, a, b, len]);
  }
  const pg = new THREE.BoxGeometry(0.07, 0.9, 0.04); pg.translate(0, 0.45, 0);
  const inst = new THREE.InstancedMesh(pg, M('#ffffff', 0.6), pickets.length);
  const m = new THREE.Matrix4();
  pickets.forEach(([x, z], i) => { m.makeTranslation(x, 0, z); inst.setMatrixAt(i, m); });
  inst.castShadow = true; parent.add(inst);
  for (const [o, at, a, b, len] of railG) {
    const mid = (a + b) / 2;
    for (const y of [0.3, 0.7]) add(parent, o === 'h' ? new THREE.BoxGeometry(len, 0.06, 0.03) : new THREE.BoxGeometry(0.03, 0.06, len), '#ffffff', o === 'h' ? X(mid) : X(at), y, o === 'h' ? Z(at) : Z(mid));
  }
}
{
  fence(site, [['h', 50, 40, 168], ['h', 50, 207, 475], ['v', 40, 50, 190], ['v', 40, 600, 750], ['h', 750, 40, 680], ['v', 680, 50, 310], ['v', 680, 510, 750]]);
  put(site, gateArch("Shreya's Dream House"), 188, 48);
  put(site, mailbox(), 222, 58, Math.PI);
  put(site, fountain(), 330, 100);
  put(site, tree('round', 4.2), 75, 90);
  put(site, tree('blossom', 3.6), 440, 80);
  put(site, tree('pine', 3.8), 110, 175);
  put(site, lampPost(), 160, 120); put(site, lampPost(), 216, 120);
  [[150, 70], [150, 100], [225, 75], [225, 100], [260, 175], [455, 175]].forEach(([x, y]) => put(site, bush(0.3), x, y));
  flowers(site, 45, 178, 165, 187, 70); flowers(site, 212, 178, 465, 187, 120);
  flowers(site, 45, 55, 60, 185, 30); flowers(site, 230, 55, 290, 70, 30); flowers(site, 375, 55, 465, 68, 40);
  // parking
  put(site, car('#ff2e63'), 612, 168, SO, 0.005);
  put(site, evCharger(), 680 - off(0.22), 255, EA, 0.005);
  put(site, bicycle(), 520, 285, WE, 0.005);
  put(site, plant(1.0, '#7b5cff', 'tall'), 490, 295, 0, 0.005);
  [[475, 55], [675, 55], [675, 305]].forEach(([x, y]) => put(site, (() => { const g = G(); box(g, 0.3, FH, 0.3, '#f8f3ea'); return g; })(), x, y));
  box(site, 1.9, 0.02, 0.12, '#ffffff', X(560), 0.01, Z(120)); box(site, 0.12, 0.02, 4.2, '#ffffff', X(568), 0.01, Z(170));
  // back garden
  put(site, swingSet(), 110, 700, 0);
  put(site, bench(1.6), 230, 742, SO);
  put(site, birdBath(), 95, 640);
  put(site, tree('round', 4.5), 65, 727);
  put(site, tree('blossom', 3.4), 305, 735);
  put(site, tree('pine', 4), 300, 620);
  put(site, lampPost(), 325, 610);
  flowers(site, 45, 740, 200, 748, 50); flowers(site, 45, 605, 55, 735, 30); flowers(site, 180, 610, 290, 625, 45);
  [[160, 742], [290, 690], [45, 690]].forEach(([x, y]) => put(site, bush(0.32), x, y));
}

// ---------- stairs (U-shaped) ----------
{
  const stepMat = M('#f2ebe0', 0.5), sideMat = M('#e0d6c8', 0.7);
  for (let i = 0; i < 10; i++) {
    const top = (i + 1) * 0.15;
    add(ground, new THREE.BoxGeometry(40 * S, top, 10 * S), i % 2 ? stepMat : sideMat, X(270), top / 2, Z(470 + i * 10 + 5));
    add(ground, new THREE.BoxGeometry(40 * S, 0.02, 10 * S), M('#a47148', 0.6), X(270), top + 0.01, Z(470 + i * 10 + 5));
  }
  add(ground, new THREE.BoxGeometry(80 * S, 1.5, 30 * S), sideMat, X(290), 0.75, Z(585));
  add(ground, new THREE.BoxGeometry(80 * S, 0.02, 30 * S), M('#a47148', 0.6), X(290), 1.51, Z(585));
  for (let j = 0; j < 10; j++) {
    const top = 1.5 + (j + 1) * 0.15;
    add(ground, new THREE.BoxGeometry(40 * S, top, 10 * S), j % 2 ? stepMat : sideMat, X(310), top / 2, Z(570 - j * 10 - 5));
    add(ground, new THREE.BoxGeometry(40 * S, 0.02, 10 * S), M('#a47148', 0.6), X(310), top + 0.01, Z(570 - j * 10 - 5));
  }
  const mw = add(ground, new THREE.BoxGeometry(0.12, 3.9, 100 * S), M('#f8f3ea', 0.9), X(290), 1.95, Z(520));
  occluders[0].push(mw);
}

// ---------- ground floor ----------
buildFloors(ground, ROOMS0, 0, 0.1);
buildWalls(ground, ROOMS0, GAPS0, WH0, 0);
{
  const g = ground;
  // living hall
  put(g, tvCabinet(2.2), 40 + off(0.45), 265, WE);
  put(g, tv(1.9, 'movie'), 40 + off(0.05), 265, WE, 1.0);
  put(g, ac(), 40 + off(0.22), 265, WE, 2.35);
  put(g, speaker(1.0), 40 + off(0.3), 222, WE);
  put(g, speaker(1.0), 40 + off(0.3), 308, WE);
  put(g, rug(3.2, 2.4, '#f4a261', '#2a9d8f'), 100, 265, WE);
  put(g, sofa(2.6, '#4f6d9a', '#ffb703'), 150, 265, EA);
  put(g, sofa(1.0, '#e76f51', '#ffffff'), 100, 190 + off(0.9), N);
  put(g, coffeeTable(1.1, 0.6), 100, 265, WE);
  put(g, floorLamp(), 168, 212);
  put(g, (() => { const t = G(); cyl(t, 0.22, 0.22, 0.03, '#a47148', 0, 0.55, 0); cyl(t, 0.03, 0.03, 0.55, '#333', 0, 0, 0, 8); tableLamp(t, 0, 0.58, 0); return t; })(), 168, 320);
  put(g, diningTable(1.8, 0.9), 110, 385);
  [88, 110, 132].forEach(x => { put(g, chair('#7f5539', '#ffd6a5'), x, 364, 0); put(g, chair('#7f5539', '#ffd6a5'), x, 406, SO); });
  put(g, chair('#7f5539', '#ffd6a5'), 66, 385, WE); put(g, chair('#7f5539', '#ffd6a5'), 154, 385, EA);
  put(g, chandelier(), 110, 385, 0, WH0 - 0.05);
  put(g, ceilingFan(), 100, 265, 0, WH0);
  put(g, wallArt(1.4, 0.7, 'home'), 110, 430 - off(0.04), SO, 1.35);
  put(g, wallArt(0.9, 1.1, 'abstract'), 300 - off(0.04), 375, EA, 1.2);
  put(g, plant(1.4, '#ffd23f', 'tall'), 57, 207);
  put(g, plant(1.0, '#e07a5f'), 288, 330);
  put(g, plant(0.8, '#7b5cff', 'flower'), 56, 418);
  put(g, (() => { const t = G(); box(t, 1.0, 0.85, 0.4, '#ffffff'); box(t, 0.96, 0.02, 0.01, '#ddd', 0, 0.42, 0.2); sph(t, 0.07, '#ff70a6', -0.3, 0.92, 0, 10); return t; })(), 240, 190 + off(0.4), N);
  put(g, rug(1.0, 0.6, '#ff4d8d', '#ffffff', 'stripes'), 188, 205);
  put(g, ceilingLight(0.3), 200, 300, 0, WH0);
  // kitchen
  const ky = 190 + off(0.6);
  put(g, fridge(), 318, 190 + off(0.7), N);
  put(g, counter(0.9, 'sink'), 348, ky, N);
  put(g, counter(0.9, 'dw'), 378, ky, N);
  put(g, counter(0.9, 'stove'), 408, ky, N);
  put(g, counter(0.9), 438, ky, N);
  put(g, counter(0.42), 460, ky, N);
  put(g, hood(), 408, 190 + off(0.5), N, 1.55);
  put(g, upperCab(0.9), 378, 190 + off(0.35), N, 1.5);
  put(g, upperCab(0.9), 438, 190 + off(0.35), N, 1.5);
  put(g, upperCab(0.42), 460, 190 + off(0.35), N, 1.5);
  put(g, microwave(), 438, ky, N, 0.9);
  put(g, kettleToaster(), 375, ky + 2, N, 0.9);
  put(g, pantry(), 300 + off(0.6), 310, WE);
  put(g, island(2.0, 0.9), 385, 292);
  [362, 385, 408].forEach(x => put(g, barStool(), x, 318));
  put(g, pendant(), 365, 292, 0, WH0); put(g, pendant(), 405, 292, 0, WH0);
  put(g, purifier(), 470 - off(0.2), 215, EA, 1.25);
  put(g, plant(0.5, '#ffffff', 'cactus'), 460, ky, N, 0.9);
  // toilet 1
  put(g, toilet(), 342, 330 + off(0.62), N);
  put(g, smallSink(), 300 + off(0.45), 395, WE);
  put(g, plant(0.6, '#2ec4b6', 'flower'), 375, 420);
  put(g, ceilingLight(0.18), 342, 380, 0, WH0);
  // bathroom 1
  put(g, bathtub(1.7, 0.75), 427, 330 + off(0.75), N);
  put(g, washer(), 470 - off(0.6), 395, EA);
  put(g, vanity(0.7), 385 + off(0.5), 393, WE);
  put(g, towelRack(), 427, 430 - off(0.06), SO, 0);
  put(g, ceilingLight(0.18), 427, 380, 0, WH0);
  // lobby
  put(g, consoleTable(1.0), 350, 510 - off(0.35), SO);
  put(g, wallArt(0.8, 0.6, 'flowers'), 330 + off(0.04), 490, WE, 1.3);
  put(g, plant(1.3, '#ff4d8d', 'tall'), 458, 497);
  put(g, ceilingLight(0.25), 400, 470, 0, WH0);
  // gaming room
  put(g, tv(2.4, 'game'), 680 - off(0.05), 400, EA, 0.75);
  put(g, tvCabinet(2.4, '#1b1b2f'), 680 - off(0.45), 400, EA);
  put(g, speaker(1.1), 680 - off(0.3), 345, EA); put(g, speaker(1.1), 680 - off(0.3), 455, EA);
  put(g, beanBag('#ff4d8d'), 622, 378); put(g, beanBag('#29f0ff'), 622, 425);
  put(g, gamingDesk(1.8), 575, 310 + off(0.75), N);
  put(g, gamingChair(), 575, 352, SO);
  put(g, arcade('#7b5cff'), 470 + off(0.75), 340, WE); put(g, arcade('#ff2fd6'), 470 + off(0.75), 385, WE);
  put(g, poolTable(), 560, 475);
  put(g, neonSign('GAME ON', '#ff2fd6'), 560, 510 - off(0.02), SO, 1.7);
  put(g, wallArt(0.55, 0.8, 'poster', '#ff2fd6'), 470 + off(0.04), 415, WE, 1.2);
  put(g, discoBall(), 575, 410, 0, WH0);
  { // LED strips along the gaming-room walls
    const y = 2.75, i = 4 / S;
    [[575, 310 + i, 200, 'h'], [575, 510 - i, 200, 'h'], [470 + i, 410, 190, 'v'], [680 - i, 410, 190, 'v']].forEach(([px, py, len, o], k) => {
      add(g, o === 'h' ? new THREE.BoxGeometry(len * S, 0.04, 0.03) : new THREE.BoxGeometry(0.03, 0.04, len * S), ledMat(k * 0.25), X(px), y, Z(py), false);
      add(g, o === 'h' ? new THREE.BoxGeometry(len * S, 0.03, 0.03) : new THREE.BoxGeometry(0.03, 0.03, len * S), ledMat(k * 0.25 + 0.5), X(px), 0.12, Z(py), false);
    });
  }
  // bedroom 1
  put(g, rug(2.4, 1.8, '#ffc8dd', '#cdb4db', 'dots'), 140, 515, WE);
  put(g, bed(1.8, 2.1, '#ff8fab'), 40 + off(2.2), 515, WE);
  put(g, nightstand(), 40 + off(0.42), 470, WE); put(g, nightstand(), 40 + off(0.42), 560, WE);
  put(g, wardrobe(2.0, '#f3e9ff'), 250 - off(0.6), 513, EA);
  put(g, desk(1.2), 120, 430 + off(0.6), N);
  put(g, officeChair('#ff70a6'), 120, 462, SO);
  put(g, ac(), 75, 430 + off(0.22), N, 2.3);
  put(g, wallArt(1.2, 0.6, 'flowers'), 40 + off(0.04), 515, WE, 1.45);
  put(g, plant(1.1, '#ffd23f'), 235, 590);
  put(g, ceilingFan(), 145, 515, 0, WH0);
  // staircase hall
  put(g, ceilingLight(0.2), 290, 450, 0, WH0);
}

// ---------- first floor ----------
buildFloors(upper, ROOMS1, 0, 0.2);
buildWalls(upper, ROOMS1, GAPS1, WH1, 1);
{
  const u = upper;
  // balcony + terrace floors and railings
  const flo = (x, y, w, h, type, c, c2) => add(u, new THREE.BoxGeometry(w * S, 0.2, h * S), texMat(type, c, c2, w * S, h * S), X(x) + w * S / 2, -0.1, Z(y) + h * S / 2, false);
  flo(40, 110, 430, 80, 'tiles', '#ffe1c2');
  flo(470, 50, 210, 260, 'deck', '#d9a066');
  add(u, new THREE.BoxGeometry(150 * S, 0.02, 190 * S), texMat('grass', '#86d36b', null, 150 * S, 190 * S), X(500) + 75 * S, 0.01, Z(85) + 95 * S, false);
  railing(u, 'h', 110, 40, 470, 'glass');
  railing(u, 'v', 40, 110, 190, 'glass');
  railing(u, 'h', 50, 470, 680, 'parapet');
  railing(u, 'v', 680, 50, 310, 'parapet');
  railing(u, 'v', 470, 50, 110, 'parapet');
  railing(u, 'h', 470, 250, 290, 'glass');
  // master bedroom
  put(u, rug(2.6, 2.2, '#cdb4db', '#ffffff'), 150, 290, WE);
  put(u, bed(2.0, 2.2, '#9b5de5', '#5e3b2a'), 40 + off(2.3), 290, WE);
  put(u, nightstand('#5e3b2a'), 40 + off(0.42), 240, WE); put(u, nightstand('#5e3b2a'), 40 + off(0.42), 340, WE);
  put(u, dressingTable(), 190, 190 + off(0.45), N);
  put(u, pouf('#ff70a6'), 190, 226);
  put(u, tv(1.4, 'cartoon'), 240 - off(0.05), 290, EA, 1.1);
  put(u, tvCabinet(1.6, '#ffffff'), 240 - off(0.45), 290, EA);
  put(u, sofa(0.95, '#f15bb5', '#ffffff'), 205, 362, EA);
  put(u, ac(), 80, 390 - off(0.22), SO, 2.3);
  put(u, chandelier(), 140, 290, 0, WH1);
  put(u, plant(1.2, '#ffffff', 'tall'), 228, 378);
  put(u, wallArt(1.3, 0.65, 'abstract2'), 40 + off(0.04), 290, WE, 1.5);
  // closet
  put(u, clothesRack(1.4), 290, 190 + off(0.55), N);
  put(u, clothesRack(1.4), 330 - off(0.55), 245, EA);
  put(u, shoeShelf(1.2), 285, 290 - off(0.35), SO);
  put(u, fullMirror(), 240 + off(0.04), 270, WE, 0.1);
  put(u, chandelier(), 285, 240, 0, WH1 + 0.15);
  // bathroom 2
  put(u, shower(0.9, 0.9), 312, 307);
  put(u, bathtub(1.7, 0.75), 280, 390 - off(0.75), SO);
  put(u, vanity(0.9, '#ffffff'), 330 - off(0.5), 345, EA);
  put(u, towelRack(['#ffd23f', '#7b5cff']), 240 + off(0.06), 290 + 15, WE, 0);
  put(u, plant(0.7, '#2ec4b6'), 252, 300);
  put(u, ceilingLight(0.2), 285, 340, 0, WH1);
  // family lounge
  put(u, rug(2.2, 1.6, '#ffd166', '#06d6a0', 'stripes'), 415, 330, WE);
  put(u, bookshelf(2.0, 2.2), 330 + off(0.35), 290, WE);
  put(u, piano(), 355, 190 + off(0.6), N);
  put(u, (() => { const s = G(); box(s, 0.6, 0.45, 0.35, blackGloss); return s; })(), 355, 228);
  put(u, sofa(2.2, '#06d6a0', '#ff70a6'), 470 - off(0.9), 330, EA);
  put(u, coffeeTable(0.9, 0.5, '#ffffff'), 420, 330, WE);
  put(u, sofa(0.95, '#ffd166', '#7b5cff'), 400, 372, SO);
  put(u, floorLamp(), 460, 280);
  put(u, wallArt(1.2, 0.7, 'movie'), 470 - off(0.04), 330, EA, 1.45);
  put(u, pendant('#ffd8a8', 0.8), 410, 300, 0, WH1);
  put(u, plant(1.0, '#e07a5f'), 455, 205);
  // corridor
  put(u, consoleTable(1.0), 290, 390 + off(0.35), N);
  put(u, wallArt(0.8, 0.6, 'flowers'), 100, 390 + off(0.04), N, 1.5);
  put(u, wallArt(0.6, 0.6, 'abstract'), 210, 390 + off(0.04), N, 1.5);
  put(u, plant(1.0, '#7b5cff'), 55, 440);
  [100, 220, 340, 440].forEach(x => put(u, ceilingLight(0.18), x, 420, 0, WH1));
  // bedroom 3
  put(u, rug(2.6, 2.0, '#bde0fe', '#ffffff'), 585, 410, EA);
  put(u, bed(1.8, 2.1, '#4cc9f0'), 680 - off(2.2), 410, EA);
  put(u, nightstand('#ffffff'), 680 - off(0.42), 365, EA); put(u, nightstand('#ffffff'), 680 - off(0.42), 455, EA);
  put(u, wardrobe(1.8, '#dbe9ff'), 530, 310 + off(0.6), N);
  put(u, desk(1.2, '#ffffff'), 530, 510 - off(0.6), SO);
  put(u, officeChair('#4cc9f0'), 530, 478, 0);
  put(u, ac(), 680 - off(0.22), 410, EA, 2.35);
  put(u, beanBag('#ffd23f'), 615, 478);
  put(u, plant(1.2, '#2ec4b6', 'tall'), 488, 492);
  put(u, wallArt(0.9, 0.6, 'cartoon'), 470 + off(0.04), 350, WE, 1.5);
  put(u, ceilingFan(), 580, 410, 0, WH1);
  // bedroom 4 (kids)
  put(u, rug(1.8, 1.8, '#ffffff', '#ffffff', 'rainbow'), 160, 525);
  put(u, bed(1.2, 2.0, '#ffd166', '#ff70a6'), 40 + off(2.1), 530, WE);
  put(u, teddy(), 70, 520, WE, 0.5);
  put(u, (() => { const n = nightstand('#ff70a6', '#9ad8ff'); return n; })(), 40 + off(0.42), 495, WE);
  put(u, bookshelf(1.2, 1.4, '#ffd166'), 85, 450 + off(0.35), N);
  put(u, desk(1.2, '#ffffff', false), 150, 600 - off(0.6), SO);
  put(u, globe(), 165, 590, 0, 0.74);
  put(u, officeChair('#ffd166'), 150, 568, 0);
  put(u, playTent(), 215, 490);
  put(u, toyBlocks(), 200, 565);
  put(u, wallStars(18, 2.2, 1.0), 40 + off(0.01), 530, WE, 1.6);
  put(u, ac(), 215, 450 + off(0.22), N, 2.3);
  put(u, ceilingLight(0.25), 145, 525, 0, WH1);
  // toilet 2
  put(u, toilet(), 470 - off(0.62), 480, EA);
  put(u, smallSink(), 330 + off(0.45), 480, WE);
  put(u, plant(0.6, '#ff70a6', 'flower'), 440, 462);
  put(u, ceilingLight(0.18), 400, 480, 0, WH1);
  // balcony
  put(u, eggChair(), 75, 150);
  put(u, roundTable(0.4), 330, 140);
  put(u, chair('#333', '#ff70a6'), 305, 140, WE); put(u, chair('#333', '#ff70a6'), 355, 140, EA);
  [150, 210, 410, 455].forEach((x, i) => put(u, plant(0.9, ['#ff4d8d', '#ffd23f', '#2ec4b6', '#7b5cff'][i], i % 2 ? 'flower' : 'leafy'), x, 122));
  // terrace garden
  put(u, raisedPlanter(5.5), 575, 50 + off(0.6), N);
  put(u, raisedPlanter(5.4), 680 - off(0.6), 190, EA);
  put(u, pergola(3.2, 3.2, 2.4), 575, 180);
  put(u, bench(1.6, '#ff9f1c'), 575, 145, N);
  put(u, roundTable(0.35, 0.5), 575, 195);
  put(u, telescope(), 640, 292);
  put(u, plant(1.0, '#ff4d8d', 'flower'), 490, 290);
  put(u, plant(1.2, '#2ec4b6', 'tall'), 490, 70);
}
// string lights (balcony railing + pergola)
{
  const pts = [];
  for (let x = 45; x < 470; x += 8) pts.push([X(x), FH + 1.0 + Math.sin(x * 0.07) * 0.05, Z(112)]);
  for (let i = 0; i < 4; i++) for (let k = 0; k <= 12; k++) {
    const a = [[525, 130], [625, 130], [625, 230], [525, 230]][i], b = [[625, 130], [625, 230], [525, 230], [525, 130]][i];
    const t = k / 12; pts.push([X(a[0] + (b[0] - a[0]) * t), FH + 2.3 - Math.sin(t * Math.PI) * 0.25, Z(a[1] + (b[1] - a[1]) * t)]);
  }
  const geo = new THREE.SphereGeometry(0.035, 8, 6);
  const cols = ['#ffd27a', '#ff9de2', '#9ad8ff', '#b8ff9a'];
  cols.forEach((c, ci) => {
    const sub = pts.filter((_, i) => i % 4 === ci);
    const inst = new THREE.InstancedMesh(geo, glow(c, 1.2), sub.length);
    const m = new THREE.Matrix4();
    sub.forEach((p, i) => { m.makeTranslation(p[0], p[1], p[2]); inst.setMatrixAt(i, m); });
    scene.add(inst); inst.userData.upper = true; upperExtras.push(inst);
  });
}
// ---------- roof ----------
const roof = G(); roof.position.y = FH + WH1; scene.add(roof);
{
  const tileTex = ctex(256, 256, (g, w, h) => {
    g.fillStyle = '#8f3b2b'; g.fillRect(0, 0, w, h);
    const rows = 8, cols = 8, tw = w / cols, th = h / rows;
    for (let r = 0; r < rows; r++) for (let c = -1; c < cols + 1; c++) {
      const x = c * tw + (r % 2) * tw / 2, y = r * th;
      g.fillStyle = shade('#c8553d', rr(-0.06, 0.05));
      g.beginPath(); g.moveTo(x + 1, y); g.lineTo(x + tw - 1, y); g.lineTo(x + tw - 1, y + th * 0.6);
      g.quadraticCurveTo(x + tw / 2, y + th * 1.15, x + 1, y + th * 0.6); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x + 3, y + 2, tw - 6, 3);
    }
  });
  tileTex.repeat.set(1, 1);
  const roofMat = new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.75, side: THREE.DoubleSide });
  function hipRoof(px, py, pw, ph, rise, ov = 0.55) {
    const x0 = X(px) - ov, x1 = X(px + pw) + ov, z0 = Z(py) - ov, z1 = Z(py + ph) + ov;
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const A = [x0, 0, z0], B = [x1, 0, z0], C = [x1, 0, z1], D = [x0, 0, z1];
    let tris;
    if (w >= d) {
      const r1 = [x0 + d / 2, rise, cz], r2 = [x1 - d / 2, rise, cz];
      tris = [A, B, r2, A, r2, r1, C, D, r1, C, r1, r2, D, A, r1, B, C, r2];
    } else {
      const r1 = [cx, rise, z0 + w / 2], r2 = [cx, rise, z1 - w / 2];
      tris = [A, B, r1, B, C, r2, B, r2, r1, C, D, r2, D, A, r1, D, r1, r2];
    }
    const pos = new Float32Array(tris.flat()), uv = new Float32Array(tris.length * 2);
    tris.forEach((p, i) => { uv[i * 2] = p[0] / 1.6; uv[i * 2 + 1] = (p[2] + p[1] * 0.6) / 1.6; });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    const m = add(roof, geo, roofMat, 0, 0.12, 0);
    // eaves: fascia boards and a soffit slab
    const fas = M('#ffffff', 0.6);
    add(roof, new THREE.BoxGeometry(w, 0.18, 0.06), fas, cx, 0.06, z0);
    add(roof, new THREE.BoxGeometry(w, 0.18, 0.06), fas, cx, 0.06, z1);
    add(roof, new THREE.BoxGeometry(0.06, 0.18, d), fas, x0, 0.06, cz);
    add(roof, new THREE.BoxGeometry(0.06, 0.18, d), fas, x1, 0.06, cz);
    add(roof, new THREE.BoxGeometry(w, 0.04, d), M('#f3ece2', 0.9), cx, 0.0, cz);
    return { cx, cz, w, d, z1, rise };
  }
  const main = hipRoof(40, 190, 430, 410, 2.6);
  hipRoof(470, 310, 210, 200, 2.0);
  // chimney
  const ch = G(); put(roof, ch, 120, 300);
  box(ch, 0.7, 2.6, 0.7, '#a0522d'); box(ch, 0.85, 0.15, 0.85, '#6d3b1f', 0, 2.6, 0);
  // solar panels on the south slope
  const slope = Math.atan2(main.rise, main.d / 2);
  const solar = G(); roof.add(solar);
  solar.position.set(X(255), main.rise * 0.42 + 0.2, main.cz + (main.d / 2) * 0.58);
  solar.rotation.x = slope;
  const panelTex = ctex(128, 128, (g, w, h) => { g.fillStyle = '#1d3b6e'; g.fillRect(0, 0, w, h); g.strokeStyle = '#8fb3e8'; g.lineWidth = 2; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * w / 4, 0); g.lineTo(i * w / 4, h); g.stroke(); g.beginPath(); g.moveTo(0, i * h / 4); g.lineTo(w, i * h / 4); g.stroke(); } }, false);
  const pm = new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.2, metalness: 0.5, envMap: envTex });
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) box(solar, 1.0, 0.05, 1.6, pm, -1.65 + i * 1.1, 0, -0.85 + j * 1.7);
  // little skylight
  const sky = G(); roof.add(sky); sky.position.set(X(400), main.rise * 0.45 + 0.15, main.cz + (main.d / 2) * 0.55); sky.rotation.x = slope;
  box(sky, 1.2, 0.12, 0.9, '#ffffff'); box(sky, 1.0, 0.03, 0.7, glassMat, 0, 0.12, 0);
}
flowers(upper, 505, 90, 650, 110, 40, 0.02);
buildFlowers();

// clouds
const clouds = [];
for (let i = 0; i < 9; i++) {
  const c = G();
  for (let k = 0; k < 5; k++) { const s = sph(c, rr(1.5, 3), M('#ffffff', 1), rr(-3, 3), rr(-0.5, 0.8), rr(-1.5, 1.5), 12); s.castShadow = false; }
  c.position.set(rr(-90, 90), rr(28, 40), rr(-90, 40)); c.scale.y = 0.6;
  scene.add(c); clouds.push(c);
}

// =====================================================================
//  Shreya — the tour guide
// =====================================================================
function makeShreya() {
  const root = G();
  const skin = '#e0a87c', hairC = '#24140e', dressC = '#ff4d8d', dress2 = '#ffd23f';
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const leg = G(); leg.position.set(0.075 * s, 0.76, 0); root.add(leg);
    cyl(leg, 0.052, 0.045, 0.68, skin, 0, -0.74, 0, 12);
    box(leg, 0.1, 0.08, 0.2, '#ffffff', 0, -0.76, 0.03);
    box(leg, 0.104, 0.02, 0.08, dressC, 0, -0.69, 0.06);
    legs.push(leg);
  }
  add(root, new THREE.CylinderGeometry(0.16, 0.34, 0.5, 24), dressC, 0, 0.88, 0);
  const hem = add(root, new THREE.TorusGeometry(0.335, 0.016, 8, 32), dress2, 0, 0.64, 0); hem.rotation.x = Math.PI / 2;
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; sph(root, 0.025, '#ffffff', Math.sin(a) * 0.27, 0.78, Math.cos(a) * 0.27, 8); }
  cyl(root, 0.13, 0.16, 0.36, dressC, 0, 1.08, 0);
  cyl(root, 0.165, 0.165, 0.05, dress2, 0, 1.1, 0);
  sph(root, 0.03, dress2, 0, 1.3, 0.135, 10);
  for (const s of [-1, 1]) {
    const arm = G(); arm.position.set(0.19 * s, 1.4, 0); root.add(arm);
    sph(arm, 0.07, dressC, 0, 0, 0, 12);
    cyl(arm, 0.04, 0.036, 0.5, skin, 0, -0.52, 0, 10);
    sph(arm, 0.048, skin, 0, -0.55, 0, 10);
    arm.rotation.z = 0.12 * s;
    arms.push(arm);
  }
  sph(arms[0], 0.03, '#7b5cff', 0, -0.47, 0, 8);
  cyl(root, 0.045, 0.05, 0.1, skin, 0, 1.42, 0, 10);
  const head = G(); head.position.y = 1.5; root.add(head);
  sph(head, 0.15, skin, 0, 0.15, 0, 28);
  sph(head, 0.162, hairC, 0, 0.18, -0.035, 28);
  const fr = sph(head, 0.11, hairC, 0, 0.262, 0.07, 20); fr.scale.set(1.35, 0.5, 0.9);
  for (const s of [-1, 1]) { const sh = sph(head, 0.06, hairC, 0.125 * s, 0.07, -0.03, 12); sh.scale.set(0.6, 1.9, 0.9); }
  const pony = G(); pony.position.set(0, 0.22, -0.16); head.add(pony);
  sph(pony, 0.04, '#ff70a6', 0, 0, 0, 10);
  const p1 = sph(pony, 0.08, hairC, 0, -0.1, -0.04, 14); p1.scale.set(0.8, 1.4, 0.8);
  const p2 = sph(pony, 0.06, hairC, 0, -0.24, -0.05, 14); p2.scale.set(0.7, 1.3, 0.7);
  for (const s of [-1, 1]) {
    sph(head, 0.022, '#1b1b1b', 0.055 * s, 0.16, 0.133, 12);
    sph(head, 0.007, '#ffffff', 0.055 * s + 0.008, 0.168, 0.153, 6);
    const brow = box(head, 0.05, 0.012, 0.01, hairC, 0.055 * s, 0.205, 0.138); brow.rotation.z = -0.15 * s;
    const ck = sph(head, 0.026, '#ff8fa3', 0.088 * s, 0.112, 0.118, 10); ck.scale.z = 0.4;
    sph(head, 0.016, '#ffd23f', 0.15 * s, 0.1, 0, 8);
  }
  const sm = add(head, new THREE.TorusGeometry(0.035, 0.008, 8, 20, Math.PI), '#c2185b', 0, 0.105, 0.142); sm.rotation.z = Math.PI;
  sph(head, 0.013, shade(skin, -0.06), 0, 0.135, 0.15, 8);
  for (let i = 0; i < 5; i++) { const a = i * 1.2566; sph(head, 0.022, '#ffd23f', 0.1 + Math.cos(a) * 0.03, 0.29 + Math.sin(a) * 0.03, 0.05, 8); }
  sph(head, 0.018, '#ff4d8d', 0.1, 0.29, 0.06, 8);
  // name tag
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: textSign('Shreya ✨', '#ffffff', 512, 128, 'bold 64px Poppins, sans-serif', '#ff4d8d'), transparent: true }));
  tag.scale.set(0.9, 0.225, 1); tag.position.y = 2.1; tag.renderOrder = 10; root.add(tag);
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { root, legs, arms, head, pony };
}
const shreya = makeShreya();
scene.add(shreya.root);
shreya.root.position.set(X(188), 0, Z(15));
let heading = 0;         // radians, 0 = facing +z (south)

// =====================================================================
//  Tour script
// =====================================================================
const TOUR = [
  { room: 'Welcome', floor: 0, upper: true, path: [[188, 30]], look: [188, 120], say: "Hi! I'm Shreya, and welcome to my dream house! Come on in, I'll show you every corner." },
  { room: 'Front Garden', floor: 0, upper: true, path: [[188, 130]], look: [330, 100], say: 'This is my front garden, with colourful flower beds, a little fountain and shady trees. Morning tea out here is the best!' },
  { room: 'Parking Area', floor: 0, path: [[188, 155], [420, 155], [530, 170]], look: [612, 168], say: "Here's the parking area with my car, a bicycle and an EV charger. The terrace garden sits right above it, so the car stays cool in summer." },
  { room: 'Living Hall', floor: 0, path: [[420, 155], [188, 160], [188, 215], [205, 300]], look: [60, 280], say: 'Welcome to the living hall! A big comfy sofa, a smart TV with speakers, AC, a ceiling fan, and a dining table for six for family dinners.' },
  { room: 'Kitchen', floor: 0, path: [[255, 255], [330, 255], [385, 248]], look: [385, 195], say: 'My modular kitchen! Double-door fridge, gas hob with a chimney, microwave, dishwasher, water purifier, and an island where I bake cookies.' },
  { room: 'Lobby', floor: 0, path: [[330, 255], [255, 260], [270, 415], [290, 450], [380, 465]], look: [380, 420], say: 'This is the lobby. It connects the toilet, the bathroom, the gaming room and the swimming pool.' },
  { room: 'Bathroom 1 & Toilet 1', floor: 0, path: [[427, 445], [427, 395]], look: [427, 345], say: 'Bathroom 1 has a relaxing bubble bath and the washing machine. Toilet 1 is right next door.' },
  { room: 'Gaming Room', floor: 0, path: [[427, 460], [490, 455], [575, 420]], look: [670, 400], say: 'And my favourite room, the gaming room! A giant TV with a console, a triple-monitor gaming PC, two arcade machines, a pool table, and RGB lights everywhere!' },
  { room: 'Swimming Pool', floor: 0, path: [[490, 455], [450, 470], [395, 490], [395, 530], [470, 535]], look: [510, 640], say: "Let's step outside to the swimming pool! Sun loungers, an umbrella and crystal-blue water. Who's up for a swim?" },
  { room: 'Back Garden', floor: 0, path: [[355, 540], [355, 620], [210, 665]], look: [110, 700], say: 'This is the back garden, with a swing set, a bench, a bird bath and lots of trees. Perfect for evening walks.' },
  { room: 'Bedroom 1 (Guest)', floor: 0, path: [[165, 630], [165, 585], [160, 515]], look: [70, 515], say: 'Bedroom 1 is our guest room: a cozy queen bed, a wardrobe, a study desk and AC. Guests love it here!' },
  { room: 'Staircase', floor: 0, path: [[225, 470], [225, 415], [268, 418]], look: [270, 520], say: "Now let's head upstairs to see the rest of the house!" },
  { room: 'First Floor Corridor', floor: 1, upper: true, path: [[270, 455, 0], [270, 470, 0], [270, 570, 1.5], [270, 586, 1.5], [310, 586, 1.5], [310, 570, 1.5], [310, 470, FH], [310, 430, FH]], look: [200, 420], say: 'Welcome to the first floor! This corridor connects all the bedrooms, and the glass railing keeps the stairs safe.' },
  { room: 'Master Bedroom', floor: 1, path: [[165, 420], [165, 365], [140, 300]], look: [76, 290], say: 'The master bedroom: a king-size bed, a dressing table, a TV, AC, and a door straight out to the balcony.' },
  { room: 'Closet Area', floor: 1, path: [[225, 240], [282, 240]], look: [285, 195], say: 'Every girl’s dream: a walk-in closet with racks of clothes, shoes, bags and a full-length mirror!' },
  { room: 'Bathroom 2', floor: 1, path: [[225, 240], [225, 340], [282, 340]], look: [285, 380], say: 'Bathroom 2 is attached to the master bedroom, with a rain shower, a bathtub and a double vanity.' },
  { room: 'Balcony', floor: 1, path: [[225, 340], [150, 300], [115, 215], [115, 160], [250, 165]], look: [250, 80], say: 'The balcony! Look at the view of the front garden. A hanging swing chair, a coffee table and plants all around.' },
  { room: 'Family Lounge', floor: 1, path: [[260, 175], [395, 175], [395, 215], [400, 285]], look: [340, 290], say: 'The family lounge: a bookshelf full of stories, a piano and a comfy sofa. Movie nights happen here!' },
  { room: 'Terrace Garden', floor: 1, path: [[450, 255], [500, 255], [575, 255], [575, 190]], look: [575, 120], say: 'Welcome to the terrace garden! Raised planters, flowers, a pergola with fairy lights and a telescope. My favourite spot for stargazing.' },
  { room: 'Bedroom 3', floor: 1, path: [[575, 255], [500, 255], [450, 255], [395, 250], [365, 300], [365, 420], [490, 420], [575, 410]], look: [645, 410], say: 'Bedroom 3 has a queen bed, a big wardrobe, a study desk and a window looking down on the pool.' },
  { room: 'Toilet 2', floor: 1, path: [[490, 420], [395, 425], [395, 472]], look: [395, 500], say: 'Toilet 2 is up here on the first floor, so nobody has to run downstairs!' },
  { room: 'Bedroom 4 (Kids)', floor: 1, path: [[395, 425], [165, 425], [165, 470], [150, 525]], look: [70, 530], say: "And finally, Bedroom 4, a fun kids' room with a teddy bear, a play tent, toy blocks, a globe and glow-in-the-dark stars!" },
  { room: 'Goodbye!', floor: 1, path: [], look: null, say: "That's my dream house! Thank you so much for visiting. Feel free to explore on your own. See you soon!" },
];

// =====================================================================
//  UI, speech, modes
// =====================================================================
const $ = id => document.getElementById(id);
const ui = { chip: $('chip'), bubble: $('bubble'), say: $('sayText'), tour: $('bTour'), pause: $('bPause'), next: $('bNext'), explore: $('bExplore'), floor: $('bFloor'), voice: $('bVoice'), night: $('bNight') };
const state = {
  mode: 'intro',          // intro | tour | explore
  step: -1, phase: 'idle', queue: [], t: 0,
  paused: false, voiceOn: true, night: false,
  floorView: 'roof',      // explore: roof | upper | ground
  talkDone: false, voiceUsed: false, text: '', minTalk: 3,
};

let voice = null;
function pickVoice() {
  const vs = speechSynthesis.getVoices();
  const prefs = [v => /en-IN/i.test(v.lang) && /female|heera|neerja|veena|swara/i.test(v.name), v => /en-IN/i.test(v.lang),
    v => /Google UK English Female|Samantha|Zira|Jenny|Aria|Female/i.test(v.name), v => /^en/i.test(v.lang)];
  for (const p of prefs) { const v = vs.find(p); if (v) return v; }
  return null;
}
if ('speechSynthesis' in window) { voice = pickVoice(); speechSynthesis.onvoiceschanged = () => { voice = pickVoice(); }; }

function speak(text) {
  state.text = text; state.t = 0; state.talkDone = false;
  state.minTalk = Math.max(2.5, text.split(/\s+/).length * 0.33);
  ui.bubble.classList.remove('hide');
  state.voiceUsed = false;
  if (state.voiceOn && 'speechSynthesis' in window) {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[\u{1F300}-\u{1FAFF}]/gu, ''));
    if (voice) u.voice = voice;
    u.rate = 1.0; u.pitch = 1.25;
    u.onend = () => { state.talkDone = true; };
    u.onerror = () => { state.talkDone = true; };
    speechSynthesis.speak(u);
    state.voiceUsed = true;
  }
}
function stopSpeech() { if ('speechSynthesis' in window) speechSynthesis.cancel(); }

function setChip(text) { ui.chip.textContent = '📍 ' + text; }
function floorName(f) { return f ? 'First Floor' : 'Ground Floor'; }

function startStep(i) {
  if (i >= TOUR.length) { endTour(); return; }
  state.step = i;
  const st = TOUR[i];
  const base = st.floor ? FH : 0;
  state.queue = st.path.map(p => new THREE.Vector3(X(p[0]), p[2] !== undefined ? p[2] : base, Z(p[1])));
  state.phase = 'walk';
  setChip(`${st.room} · ${floorName(st.floor)}`);
}
function beginTalk() {
  state.phase = 'talk';
  speak(TOUR[state.step].say);
}
function startTour() {
  closeIntro();
  stopSpeech();
  state.mode = 'tour'; state.paused = false;
  shreya.root.position.set(X(188), 0, Z(15));
  controls.enabled = false;
  ui.tour.textContent = '↺ Restart'; ui.pause.disabled = false; ui.next.disabled = false;
  ui.pause.textContent = '⏸ Pause'; ui.explore.classList.remove('on');
  startStep(0);
}
function endTour() {
  state.phase = 'idle';
  setTimeout(() => { if (state.mode === 'tour') enterExplore(true); }, 600);
}
function enterExplore(fromTour = false) {
  closeIntro();
  if (!fromTour) stopSpeech();
  state.mode = 'explore'; state.phase = 'idle'; state.paused = false;
  controls.enabled = true;
  controls.target.set(0, 1.5, 0);
  ui.explore.classList.add('on'); ui.pause.disabled = true; ui.next.disabled = true;
  ui.tour.textContent = '▶ Tour';
  setChip('Explore mode · drag to look around');
  if (!fromTour) setTimeout(() => ui.bubble.classList.add('hide'), 300);
  else setTimeout(() => ui.bubble.classList.add('hide'), 6000);
}
function closeIntro() { $('intro').classList.add('gone'); }

ui.tour.onclick = startTour;
$('iTour').onclick = startTour;
$('iExplore').onclick = () => { enterExplore(); camera.position.set(22, 18, 24); };
ui.explore.onclick = () => enterExplore();
ui.pause.onclick = () => {
  state.paused = !state.paused;
  ui.pause.textContent = state.paused ? '▶ Resume' : '⏸ Pause';
  if ('speechSynthesis' in window) state.paused ? speechSynthesis.pause() : speechSynthesis.resume();
};
ui.next.onclick = () => {
  if (state.mode !== 'tour') return;
  stopSpeech();
  if (state.queue.length) shreya.root.position.copy(state.queue[state.queue.length - 1]);
  state.paused = false; ui.pause.textContent = '⏸ Pause';
  startStep(state.step + 1);
};
const VIEWS = { roof: '🏠 Full house', upper: '🏢 First floor', ground: '🛋️ Ground floor' };
ui.floor.onclick = () => {
  state.floorView = { roof: 'upper', upper: 'ground', ground: 'roof' }[state.floorView];
  ui.floor.textContent = VIEWS[state.floorView];
  if (state.mode !== 'explore') enterExplore();
};
ui.voice.onclick = () => {
  state.voiceOn = !state.voiceOn;
  ui.voice.classList.toggle('on', state.voiceOn);
  ui.voice.textContent = state.voiceOn ? '🔊 Voice' : '🔇 Voice';
  if (!state.voiceOn) { stopSpeech(); state.talkDone = true; state.voiceUsed = false; }
};
ui.night.onclick = () => {
  state.night = !state.night;
  ui.night.classList.toggle('on', state.night);
  ui.night.textContent = state.night ? '☀️ Day' : '🌙 Night';
  applyDayNight();
};
function applyDayNight() {
  const n = state.night;
  scene.background = n ? nightSky : daySky;
  scene.fog.color.set(n ? '#1a1747' : '#cfe6ff');
  hemi.intensity = n ? 0.25 : 1.25;
  hemi.color.set(n ? '#7f8cff' : '#dff1ff');
  sun.intensity = n ? 0.35 : 2.6;
  sun.color.set(n ? '#a9b8ff' : '#fff4e0');
  amb.intensity = n ? 0.12 : 0.25;
  nightLights.forEach(l => l.intensity = n ? 9 : 0);
  glowMats.forEach(m => m.emissiveIntensity = m.userData.base * (n ? 2.2 : 0.6));
  water.material.emissiveIntensity = n ? 1.0 : 0.15;
  clouds.forEach(c => c.visible = !n);
}
applyDayNight();

// =====================================================================
//  Camera, controls, minimap
// =====================================================================
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 4; controls.maxDistance = 70;
controls.target.set(0, 1.5, 0);
controls.enabled = false;

const camState = { yaw: Math.PI, pos: new THREE.Vector3(), look: new THREE.Vector3() };
const raycaster = new THREE.Raycaster();

const mm = $('minimap'), mctx = mm.getContext('2d');
function drawMinimap(level) {
  const W = mm.width, H = mm.height, sc = W / 720;
  mctx.clearRect(0, 0, W, H);
  mctx.save(); mctx.scale(sc, sc); mctx.translate(0, 5);
  mctx.fillStyle = '#eef6e8'; mctx.fillRect(40, 50, 640, 700);
  const outs = level ? OUT1 : OUT0, rooms = level ? ROOMS1 : ROOMS0;
  for (const o of outs) { mctx.fillStyle = o.c; mctx.fillRect(o.x, o.y, o.w, o.h); }
  if (!level) { mctx.fillStyle = '#4fc3f7'; mctx.fillRect(POOL.x, POOL.y, POOL.w, POOL.h); }
  for (const r of rooms) {
    mctx.fillStyle = r.paint; mctx.fillRect(r.x, r.y, r.w, r.h);
    mctx.strokeStyle = '#3a3a4a'; mctx.lineWidth = 5; mctx.strokeRect(r.x, r.y, r.w, r.h);
  }
  const p = shreya.root.position, px = p.x / S + 360, py = p.z / S + 400;
  mctx.fillStyle = '#ff4d8d'; mctx.beginPath(); mctx.arc(px, py, 20, 0, 7); mctx.fill();
  mctx.strokeStyle = '#fff'; mctx.lineWidth = 6; mctx.stroke();
  mctx.restore();
  mctx.fillStyle = '#2b2140'; mctx.font = '600 22px Poppins, sans-serif';
  mctx.fillText(level ? 'FIRST FLOOR' : 'GROUND FLOOR', 12, H - 10);
}

// =====================================================================
//  Animation loop
// =====================================================================
const clock = new THREE.Clock();
const tmp = new THREE.Vector3();
const angLerp = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; };
let walkPhase = 0, mmTimer = 0;

function updateShreya(dt, time) {
  const r = shreya.root;
  let walking = false, talking = false;
  if (state.mode === 'tour' && !state.paused) {
    if (state.phase === 'walk') {
      if (state.queue.length) {
        const target = state.queue[0];
        tmp.subVectors(target, r.position);
        const dist = tmp.length(), stepLen = 1.7 * dt;
        if (dist <= stepLen) { r.position.copy(target); state.queue.shift(); }
        else {
          r.position.addScaledVector(tmp, stepLen / dist);
          if (Math.hypot(tmp.x, tmp.z) > 0.01) heading = angLerp(heading, Math.atan2(tmp.x, tmp.z), Math.min(1, dt * 8));
        }
        walking = true;
      } else beginTalk();
    } else if (state.phase === 'talk') {
      talking = true;
      state.t += dt;
      const st = TOUR[state.step];
      if (st.look) heading = angLerp(heading, Math.atan2(X(st.look[0]) - r.position.x, Z(st.look[1]) - r.position.z), Math.min(1, dt * 4));
      else heading = angLerp(heading, Math.atan2(camera.position.x - r.position.x, camera.position.z - r.position.z), Math.min(1, dt * 4));
      const n = Math.min(state.text.length, Math.floor(state.t * 38));
      ui.say.textContent = state.text.slice(0, n);
      const done = state.voiceUsed ? ((state.talkDone && state.t > 1.2) || state.t > state.minTalk * 3) : state.t > state.minTalk;
      if (done) { state.phase = 'pause'; state.t = 0; }
    } else if (state.phase === 'pause') {
      talking = true; state.t += dt;
      if (state.t > 0.8) startStep(state.step + 1);
    }
  } else if (state.mode === 'tour' && state.paused) {
    talking = state.phase === 'talk';
  } else if (state.mode === 'explore' && !ui.bubble.classList.contains('hide')) {
    talking = true; state.t += dt;
    ui.say.textContent = state.text.slice(0, Math.min(state.text.length, Math.floor(state.t * 38)));
  }
  if (state.paused) { walking = false; }
  r.rotation.y = heading;

  // limbs
  const [legL, legR] = shreya.legs, [armL, armR] = shreya.arms;
  if (walking) {
    walkPhase += dt * 9;
    const s = Math.sin(walkPhase);
    legL.rotation.x = s * 0.55; legR.rotation.x = -s * 0.55;
    armL.rotation.x = -s * 0.5; armR.rotation.x = s * 0.5;
    armL.rotation.z = -0.12; armR.rotation.z = 0.12;
    shreya.head.rotation.set(0, 0, 0);
    shreya.pony.rotation.x = 0.25 + Math.sin(walkPhase * 2) * 0.12;
  } else {
    legL.rotation.x *= 0.8; legR.rotation.x *= 0.8;
    armL.rotation.x *= 0.85;
    if (talking) {
      const tt = state.t;
      if (tt < 1.6) { armR.rotation.z = 2.5 + Math.sin(time * 12) * 0.3; armR.rotation.x = 0; }
      else { armR.rotation.z = THREE.MathUtils.lerp(armR.rotation.z, 0.5 + Math.sin(time * 2.5) * 0.15, 0.1); armR.rotation.x = -0.7 + Math.sin(time * 3) * 0.2; }
      armL.rotation.z = -0.15 - Math.max(0, Math.sin(time * 1.7)) * 0.25;
      shreya.head.rotation.x = Math.sin(time * 5) * 0.05;
      shreya.head.rotation.z = Math.sin(time * 1.3) * 0.06;
    } else {
      armR.rotation.z = THREE.MathUtils.lerp(armR.rotation.z, 0.12, 0.1); armR.rotation.x *= 0.85;
      armL.rotation.z = THREE.MathUtils.lerp(armL.rotation.z, -0.12, 0.1);
      shreya.head.rotation.x *= 0.9; shreya.head.rotation.z = Math.sin(time * 0.8) * 0.04;
    }
    shreya.pony.rotation.x = 0.15 + Math.sin(time * 2) * 0.05;
  }
}

function upperVisible() {
  if (state.mode === 'intro') return true;
  if (state.mode === 'tour') { const st = TOUR[state.step]; return (st && st.upper && state.step < 2) || shreya.root.position.y > 1.0; }
  return state.floorView !== 'ground';
}
function roofVisible() {
  if (state.mode === 'intro') return true;
  if (state.mode === 'tour') return state.step < 2 && shreya.root.position.y < 1.0;
  return state.floorView === 'roof';
}
function updateCamera(dt, time) {
  if (state.mode === 'intro') {
    const a = time * 0.08;
    camera.position.set(Math.sin(a) * 30, 17, Math.cos(a) * 30);
    camera.lookAt(0, 1.5, 0);
    return;
  }
  if (state.mode === 'explore') { controls.update(); return; }
  // tour: follow behind Shreya, slowly
  const p = shreya.root.position;
  const outside = state.step <= 2;
  camState.yaw = angLerp(camState.yaw, heading + Math.PI, Math.min(1, dt * 1.2));
  const dist = outside ? 9 : 5.6, hgt = outside ? 6.5 : 4.6;
  tmp.set(p.x + Math.sin(camState.yaw) * dist, p.y + hgt, p.z + Math.cos(camState.yaw) * dist);
  const k = 1 - Math.exp(-dt * 2.2);
  camState.pos.lerp(tmp, k);
  camState.look.lerp(tmp.set(p.x, p.y + 1.1, p.z), 1 - Math.exp(-dt * 4));
  camera.position.copy(camState.pos);
  camera.lookAt(camState.look);
}

function updateFading(dt) {
  const fadeOn = state.mode === 'tour';
  const lists = upper.visible ? [...occluders[0], ...occluders[1]] : occluders[0];
  for (const m of occluders[0]) m.material.userData.target = 1;
  for (const m of occluders[1]) m.material.userData.target = 1;
  if (fadeOn) {
    // cast a fan of rays from the camera towards Shreya and what she is showing
    const p = shreya.root.position, st = TOUR[state.step];
    const side = new THREE.Vector3(Math.cos(heading), 0, -Math.sin(heading));
    const targets = [];
    for (const y of [0.3, 1.2, 2.0]) for (const s of [-1.6, -0.8, 0, 0.8, 1.6]) targets.push(new THREE.Vector3(p.x + side.x * s, p.y + y, p.z + side.z * s));
    if (st && st.look) targets.push(new THREE.Vector3(X(st.look[0]), p.y + 1.0, Z(st.look[1])));
    for (const t of targets) {
      const dir = t.sub(camera.position); const dist = dir.length(); dir.normalize();
      raycaster.set(camera.position, dir); raycaster.far = dist;
      for (const hit of raycaster.intersectObjects(lists, false)) hit.object.material.userData.target = 0.12;
    }
  }
  const k = Math.min(1, dt * 8);
  for (const arr of occluders) for (const m of arr) {
    const mat = m.material, tgt = mat.userData.target;
    if (Math.abs(mat.opacity - tgt) > 0.001) { mat.opacity += (tgt - mat.opacity) * k; mat.depthWrite = mat.opacity > 0.9; }
  }
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05), time = clock.elapsedTime;
  updateShreya(dt, time);
  const uv = upperVisible();
  upper.visible = uv; upperExtras.forEach(o => o.visible = uv);
  roof.visible = roofVisible();
  updateCamera(dt, time);
  updateFading(dt);

  spinners.forEach(s => s.obj.rotation.y += s.speed * dt);
  discoBalls.forEach(b => b.rotation.y += dt * 0.8);
  swings.forEach(s => s.obj.rotation.x = Math.sin(time * 1.6 + s.phase) * 0.35);
  ledMats.forEach(m => m.color.setHSL((m.userData.h + time * 0.08) % 1, 1, 0.55));
  floaters.forEach(f => { f.obj.position.y = -0.1 + Math.sin(time * 1.5 + f.ph) * 0.03; f.obj.rotation.y = Math.sin(time * 0.3 + f.ph) * 0.6; });
  clouds.forEach(c => { c.position.x += dt * 0.8; if (c.position.x > 110) c.position.x = -110; });
  // water ripples
  const pos = water.geometry.attributes.position, b = water.userData.base;
  for (let i = 0; i < pos.count; i++) {
    const x = b[i * 3], z = b[i * 3 + 2];
    pos.array[i * 3 + 1] = Math.sin(x * 2.2 + time * 1.8) * 0.025 + Math.cos(z * 3.1 + time * 1.4) * 0.02;
  }
  pos.needsUpdate = true; water.geometry.computeVertexNormals();

  mmTimer -= dt;
  if (mmTimer <= 0) { mmTimer = 0.1; drawMinimap(shreya.root.position.y > 1.0 ? 1 : 0); }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

camState.pos.copy(camera.position);
$('loading').classList.add('gone');
animate();
