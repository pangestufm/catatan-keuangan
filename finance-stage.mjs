// Meja kas: one pair of banknote stacks per month (income in cobalt, expense in tomato) on an isometric desk.
// Stack heights are the real monthly totals (the last bundle is cut to the exact remainder), never decoration.
// Bundled with esbuild into vendor/finance-stage.js (IIFE) so the page also works when opened from disk.
import {
  WebGLRenderer, Scene, OrthographicCamera, AmbientLight, DirectionalLight, HemisphereLight,
  BoxGeometry, PlaneGeometry, MeshStandardMaterial, MeshPhysicalMaterial, MeshBasicMaterial, ShadowMaterial,
  InstancedMesh, Mesh, Object3D, Color, Vector3, BackSide, PCFSoftShadowMap, SRGBColorSpace, MathUtils, PMREMGenerator,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const MAX_MONTHS = 6;
const SLOT = 1.75;            // distance between months on the desk
const STACK_MAX = 2.6;        // height of the largest stack in world units
const BUNDLE = 0.13;          // thickness of one banknote bundle
const BUNDLE_GAP = 0.018;
const BILL = { w: 0.66, d: 0.36 };
const MAX_LAYERS = Math.ceil(STACK_MAX / (BUNDLE + BUNDLE_GAP)) + 1;
const PREF_KEY = 'catatan-keuangan-motion';

const compact = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', notation: 'compact', maximumFractionDigits: 1 });
const full = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

function cssColor(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}
function seeded(seed) {
  let a = 0;
  for (let i = 0; i < seed.length; i++) a = (a * 31 + seed.charCodeAt(i)) | 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const easeOutBack = (x) => { const c1 = 1.2, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const easeOut = (x) => 1 - Math.pow(1 - x, 3);

function motionAllowed() {
  let pref = 'on';
  try { pref = localStorage.getItem(PREF_KEY) || 'on'; } catch { /* storage blocked: keep motion */ }
  return pref !== 'off' && !matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function pickWindow(points, activeMonth) {
  if (!points.length) return [];
  const index = points.findIndex((p) => p.sort === activeMonth);
  const end = index >= 0 ? Math.min(points.length, Math.max(index + 1, MAX_MONTHS)) : points.length;
  return points.slice(Math.max(0, end - MAX_MONTHS), end);
}

function buildNote(windowPoints, allPoints, activeMonth) {
  const current = allPoints.find((p) => p.sort === activeMonth) || allPoints[allPoints.length - 1];
  if (!current) return '';
  const net = current.income - current.expense;
  const lines = [`${current.label}: ${net >= 0 ? 'surplus' : 'defisit'} ${compact.format(Math.abs(net))}`];
  const prev = allPoints[allPoints.indexOf(current) - 1];
  if (prev && prev.expense > 0) {
    const change = (current.expense - prev.expense) / prev.expense;
    if (Math.abs(change) >= 0.005) lines.push(`keluar ${Math.round(Math.abs(change) * 100)}% ${change < 0 ? 'lebih hemat' : 'lebih banyak'} dari ${prev.label.split(' ')[0]}`);
  }
  return lines.join('\n');
}

function webglAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')));
  } catch { return false; }
}

class Stage {
  constructor(root) {
    this.root = root;
    this.host = root.querySelector('#stageCanvasHost');
    this.monthsHost = root.querySelector('#stageMonths');
    this.note = root.querySelector('#stageNote');
    this.summary = root.querySelector('#stageSummary');
    this.points = [];
    this.allPoints = [];
    this.activeMonth = '';
    this.visible = false;
    this.started = 0;
    this.raf = 0;
    this.scroll = { target: 0, value: 0 };
    this.pointer = { tx: 0, ty: 0, x: 0, y: 0 };
    this.motion = motionAllowed();
    this.gl = webglAvailable();
    if (this.gl) this.initThree();
    this.bind();
  }

  initThree() {
    const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, matchMedia('(max-width: 600px)').matches ? 1.5 : 2));
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
    this.host.append(renderer.domElement);
    this.renderer = renderer;

    const scene = new Scene();
    this.scene = scene;
    this.camera = new OrthographicCamera(-5, 5, 3, -3, 0.1, 100);

    this.hemi = new HemisphereLight(0xfffaf0, 0xb9b0a0, 1.15);
    this.ambient = new AmbientLight(0xffffff, 0.25);
    this.rim = new DirectionalLight(0xfff1d6, 0);
    this.rim.position.set(6, 5, -7);
    scene.add(this.hemi, this.ambient, this.rim);
    const sun = new DirectionalLight(0xffffff, 1.6);
    this.sun = sun;
    sun.position.set(-4, 9, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -9; sun.shadow.camera.right = 9;
    sun.shadow.camera.top = 9; sun.shadow.camera.bottom = -9;
    sun.shadow.radius = 4;
    sun.shadow.bias = -0.0008;
    scene.add(sun);

    const floor = new Mesh(new PlaneGeometry(60, 60), new ShadowMaterial({ opacity: 0.16 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    this.floor = floor;

    this.geometry = new BoxGeometry(BILL.w, 1, BILL.d);
    this.bandGeometry = new BoxGeometry(0.16, 1, BILL.d + 0.012);
    this.matTag = new MeshStandardMaterial({ roughness: 0.9 });
    this.matTagMetal = new MeshStandardMaterial({ roughness: 0.3, metalness: 0.9 });
    this.tag = new Mesh(new BoxGeometry(SLOT * 0.9, 0.02, 1.3), this.matTag);
    this.tag.receiveShadow = true;
    this.tag.visible = false;
    scene.add(this.tag);

    const capacity = MAX_MONTHS * MAX_LAYERS;
    this.layers = {};
    // Two looks for the same bundles: 'ink' (paper clay with a marker outline) and 'metal'
    // (studio-lit gold bullion and dark lacquer). The skin picks one through --stage-style.
    for (const kind of ['income', 'expense']) {
      const fills = {
        ink: new MeshStandardMaterial({ roughness: 0.72, metalness: 0, transparent: true }),
        metal: kind === 'income'
          ? new MeshPhysicalMaterial({ metalness: 1, roughness: 0.34, clearcoat: 0.25, clearcoatRoughness: 0.3, transparent: true })
          : new MeshPhysicalMaterial({ metalness: 0.1, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.25, transparent: true }),
      };
      const bandsMat = {
        ink: new MeshStandardMaterial({ roughness: 0.85, transparent: true }),
        metal: new MeshStandardMaterial({ roughness: 0.45, metalness: 0.6, transparent: true }),
      };
      const ink = new MeshBasicMaterial({ side: BackSide });
      const body = new InstancedMesh(this.geometry, fills.ink, capacity);
      const outline = new InstancedMesh(this.geometry, ink, capacity);
      const bands = new InstancedMesh(this.bandGeometry, bandsMat.ink, capacity);
      body.castShadow = true; body.receiveShadow = true;
      for (const mesh of [body, outline, bands]) { mesh.count = 0; mesh.frustumCulled = false; scene.add(mesh); }
      this.layers[kind] = { body, outline, bands, fills, bandsMat, ink, items: [] };
    }
    this.dummy = new Object3D();
    this.applyColors();
  }

  applyColors() {
    if (!this.gl) return;
    const metal = cssColor('--stage-style', 'ink') === 'metal';
    const dark = document.documentElement.dataset.theme === 'dark';
    const ink = new Color(cssColor('--ink', '#1b1a17'));
    for (const kind of ['income', 'expense']) {
      const layer = this.layers[kind];
      const color = metal ? cssColor(kind === 'income' ? '--stage-income' : '--stage-expense', '#b8954f') : cssColor(kind === 'income' ? '--cobalt' : '--tomato', '#2340d8');
      layer.fills[metal ? 'metal' : 'ink'].color.set(color);
      layer.bandsMat.ink.color.set(cssColor('--sun', '#f7c948'));
      layer.bandsMat.metal.color.set(cssColor('--stage-band', '#2a2a2e'));
      layer.body.material = layer.fills[metal ? 'metal' : 'ink'];
      layer.bands.material = layer.bandsMat[metal ? 'metal' : 'ink'];
      layer.ink.color.copy(ink);
      layer.outline.visible = !metal;
    }
    if (metal && !this.envMap) {
      const pmrem = new PMREMGenerator(this.renderer);
      this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
    }
    this.scene.environment = metal ? this.envMap : null;
    this.scene.environmentIntensity = metal ? (dark ? 0.42 : 0.55) : 1;
    this.hemi.intensity = metal ? (dark ? 0.12 : 0.35) : 1.15;
    this.ambient.intensity = metal ? 0.05 : 0.25;
    this.sun.intensity = metal ? (dark ? 1.25 : 1.1) : 1.6;
    this.rim.intensity = metal ? (dark ? 1.6 : 0.6) : 0;
    this.tag.material = metal ? this.matTagMetal : this.matTag;
    this.matTag.color.set(cssColor('--sun', '#f7c948'));
    this.matTagMetal.color.set(cssColor('--stage-tag', '#121214'));
    this.floor.material.opacity = metal ? (dark ? 0.6 : 0.2) : (dark ? 0.42 : 0.16);
    this.metal = metal;
    this.requestFrame();
  }

  bind() {
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        this.visible = entry.isIntersecting;
        if (this.visible && !this.started && this.points.length) this.startIntro();
        if (this.visible) this.requestFrame();
      }
    }, { threshold: 0.15 });
    io.observe(this.root);
    new ResizeObserver(() => this.resize()).observe(this.root);
    window.addEventListener('scroll', () => this.onScroll(), { passive: true });
    this.root.addEventListener('pointermove', (event) => {
      if (!this.motion) return;
      const rect = this.root.getBoundingClientRect();
      this.pointer.tx = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      this.pointer.ty = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      this.requestFrame();
    });
    this.root.addEventListener('pointerleave', () => { this.pointer.tx = 0; this.pointer.ty = 0; this.requestFrame(); });
    this.monthsHost.addEventListener('click', (event) => {
      const button = event.target.closest('[data-month]');
      if (!button) return;
      const input = document.getElementById('monthFilterInput');
      if (!input) return;
      input.value = button.dataset.month;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    new MutationObserver(() => this.applyColors()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-skin'] });
    window.addEventListener('finance:motion', () => {
      this.motion = motionAllowed();
      if (!this.motion) { this.started = 1; this.pointer.tx = this.pointer.ty = 0; this.layout(true); }
      this.requestFrame();
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.requestFrame(); });
  }

  onScroll() {
    if (!this.motion || !this.visible) return;
    const rect = this.root.getBoundingClientRect();
    const progress = 1 - (rect.top + rect.height) / (window.innerHeight + rect.height);
    this.scroll.target = MathUtils.clamp(progress, 0, 1);
    this.requestFrame();
  }

  update({ points = [], activeMonth = '' } = {}) {
    this.allPoints = points;
    this.activeMonth = activeMonth;
    this.points = pickWindow(points, activeMonth);
    this.root.dataset.state = this.points.length ? 'ready' : 'empty';
    this.note.textContent = buildNote(this.points, points, activeMonth);
    this.summary.textContent = this.points.length
      ? `Meja kas ${this.points.length} bulan terakhir: ${this.points.map((p) => `${p.label} pemasukan ${full.format(p.income)}, pengeluaran ${full.format(p.expense)}`).join('; ')}.`
      : 'Belum ada data bulanan.';
    this.renderButtons();
    if (!this.gl) { this.renderFallback(); return; }
    this.layout(!this.motion || this.started > 0);
    if (this.visible && !this.started && this.points.length) this.startIntro();
    this.resize();
  }

  renderButtons() {
    const active = this.activeMonth;
    this.monthsHost.innerHTML = this.points.map((p) => {
      const tip = `${p.label} | Pemasukan ${full.format(p.income)} | Pengeluaran ${full.format(p.expense)} | Saldo ${full.format(p.income - p.expense)}`;
      const [month, year = ''] = p.label.split(' ');
      return `<button class="stage-month" type="button" data-month="${p.sort}" aria-pressed="${p.sort === active}" data-tooltip="${tip.replace(/"/g, '&quot;')}" aria-label="Buka ${p.label}">${month}<span aria-hidden="true">${year ? `’${year.slice(2)}` : ''}</span></button>`;
    }).join('');
  }

  // Lay out every bundle; settled = place them at rest instead of starting the drop.
  layout(settled) {
    const max = Math.max(1, ...this.points.flatMap((p) => [p.income, p.expense]));
    const offsetX = ((this.points.length - 1) * SLOT) / 2;
    this.tallest = this.points.length ? STACK_MAX + 0.1 : 1;
    for (const kind of ['income', 'expense']) {
      const items = [];
      this.points.forEach((point, slot) => {
        const total = (point[kind] / max) * STACK_MAX;
        const rand = seeded(`${point.sort}-${kind}`);
        let y = 0;
        let layer = 0;
        while (total - y > 0.004) {
          const height = Math.min(BUNDLE, total - y);
          items.push({
            slot, layer, height,
            x: slot * SLOT - offsetX + (kind === 'income' ? -0.38 : 0.38) + (rand() - 0.5) * 0.05,
            z: (rand() - 0.5) * 0.06,
            y: y + height / 2,
            rot: (rand() - 0.5) * 0.14,
            delay: slot * 120 + layer * 55 + (kind === 'expense' ? 60 : 0),
          });
          y += height + BUNDLE_GAP;
          layer += 1;
        }
      });
      this.layers[kind].items = items;
      for (const mesh of [this.layers[kind].body, this.layers[kind].outline, this.layers[kind].bands]) mesh.count = items.length;
    }
    const activeIndex = this.points.findIndex((p) => p.sort === this.activeMonth);
    this.tag.visible = activeIndex >= 0;
    if (activeIndex >= 0) this.tag.position.set(activeIndex * SLOT - offsetX, 0.01, 0.05);
    this.offsetX = offsetX;
    if (settled) this.started = this.started || 1;
    this.writeInstances(settled ? Infinity : 0);
  }

  startIntro() {
    if (!this.motion) { this.started = 1; this.writeInstances(Infinity); this.requestFrame(); return; }
    this.started = performance.now();
    this.requestFrame();
  }

  // Each bundle falls from above and lands on the one below it; the ink outline is drawn first, the colour fills after.
  writeInstances(elapsed) {
    const d = this.dummy;
    let busy = false;
    for (const kind of ['income', 'expense']) {
      const { body, outline, bands, items } = this.layers[kind];
      const fill = body.material, band = bands.material;
      items.forEach((item, i) => {
        const t = MathUtils.clamp((elapsed - item.delay) / 520, 0, 1);
        if (t < 1) busy = true;
        const fallY = item.y + (1 - easeOutBack(t)) * 3.2;
        const scale = t <= 0 ? 0.0001 : 1;
        d.position.set(item.x, fallY, item.z);
        d.rotation.set(0, item.rot + (1 - t) * 0.6, 0);
        d.scale.set(scale, item.height * scale, scale);
        d.updateMatrix();
        body.setMatrixAt(i, d.matrix);
        bands.setMatrixAt(i, d.matrix);
        d.scale.set(scale * 1.07, item.height * scale + 0.022, scale * 1.12);
        d.updateMatrix();
        outline.setMatrixAt(i, d.matrix);
      });
      for (const mesh of [body, outline, bands]) mesh.instanceMatrix.needsUpdate = true;
      const fillProgress = elapsed === Infinity ? 1 : MathUtils.clamp((elapsed - 450) / 900, 0, 1);
      fill.opacity = easeOut(fillProgress);
      band.opacity = easeOut(fillProgress);
      fill.depthWrite = fillProgress > 0.6;
      if (fillProgress < 1) busy = true;
    }
    return busy;
  }

  resize() {
    if (!this.gl) return;
    const width = this.root.clientWidth;
    const height = this.root.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.aspect = width / height;
    this.fitCamera();
    this.requestFrame();
  }

  // Fit the orthographic frustum to the desk seen from the widest camera angle, leaving room for the caption.
  fitCamera() {
    const n = Math.max(this.points.length, 3);
    const halfWidth = ((n - 1) * SLOT) / 2 + 0.9;
    const spanWorld = halfWidth * 2 * Math.cos(Math.PI / 5) + 1.6;
    const tall = STACK_MAX + 1.4;
    let viewHeight = Math.max(spanWorld / this.aspect, tall * 1.25);
    this.view = { width: viewHeight * this.aspect, height: viewHeight };
  }

  pose() {
    const s = this.scroll.value;
    const azimuth = MathUtils.degToRad(-24 - s * 20 + this.pointer.x * 5);
    const elevation = MathUtils.degToRad(30 + s * 6 - this.pointer.y * 3);
    const radius = 20;
    const target = new Vector3(0, STACK_MAX * 0.42, 0);
    const cam = this.camera;
    cam.position.set(
      target.x + radius * Math.cos(elevation) * Math.sin(azimuth),
      target.y + radius * Math.sin(elevation),
      target.z + radius * Math.cos(elevation) * Math.cos(azimuth),
    );
    cam.lookAt(target);
    cam.updateMatrixWorld();
    // Frame the whole desk from this angle: project its bounding box into camera space, then pad for the
    // caption and note above and the month labels below, and widen to the canvas aspect.
    const half = (this.offsetX || 0) + 0.75;
    const topY = (this.tallest || STACK_MAX) + 0.25;
    const inv = cam.matrixWorldInverse;
    const v = this.corner || (this.corner = new Vector3());
    let l = Infinity, r = -Infinity, b = Infinity, t = -Infinity;
    for (const x of [-half, half]) for (const y of [0, topY]) for (const z of [-0.55, 1.05]) {
      v.set(x, y, z).applyMatrix4(inv);
      l = Math.min(l, v.x); r = Math.max(r, v.x); b = Math.min(b, v.y); t = Math.max(t, v.y);
    }
    const h0 = t - b;
    const narrow = (this.aspect || 1.6) < 1.35;
    l -= (r - l) * 0.05; r += (r - l) * 0.05;
    t += h0 * ((this.aspect || 1.6) < 1.05 ? 0.62 : narrow ? 0.42 : 0.3);
    b -= h0 * 0.12;
    const aspect = this.aspect || 1.6;
    const w = r - l, h = t - b;
    if (w / h < aspect) { const extra = h * aspect - w; l -= extra / 2; r += extra / 2; }
    else { const extra = w / aspect - h; b -= extra * 0.6; t += extra * 0.4; }
    cam.left = l; cam.right = r; cam.top = t; cam.bottom = b;
    cam.updateProjectionMatrix();
  }

  placeButtons() {
    const rect = this.root.getBoundingClientRect();
    const buttons = this.monthsHost.children;
    const v = new Vector3();
    this.points.forEach((_, slot) => {
      const button = buttons[slot];
      if (!button) return;
      v.set(slot * SLOT - this.offsetX, 0, 0.72).project(this.camera);
      const x = (v.x * 0.5 + 0.5) * rect.width;
      const y = (-v.y * 0.5 + 0.5) * rect.height;
      button.style.left = `${x}px`;
      button.style.top = `${Math.min(y, rect.height - 50)}px`;
    });
  }

  requestFrame() {
    if (!this.gl || this.raf || !this.visible || document.hidden) return;
    this.raf = requestAnimationFrame((now) => this.frame(now));
  }

  frame(now) {
    this.raf = 0;
    const p = this.pointer;
    const ease = this.motion ? 0.12 : 1;
    p.x += (p.tx - p.x) * ease;
    p.y += (p.ty - p.y) * ease;
    this.scroll.value += (this.scroll.target - this.scroll.value) * ease;
    const settling = Math.abs(p.tx - p.x) > 0.002 || Math.abs(p.ty - p.y) > 0.002 || Math.abs(this.scroll.target - this.scroll.value) > 0.001;
    let busy = false;
    if (this.started > 1) busy = this.writeInstances(now - this.started);
    if (!busy && this.started > 1) this.started = 1;
    this.pose();
    this.renderer.render(this.scene, this.camera);
    this.placeButtons();
    if (busy || settling) this.requestFrame();
  }

  // Without WebGL: the same stacks drawn as flat SVG columns, so the figures are still read and the buttons still work.
  renderFallback() {
    const n = this.points.length;
    if (!n) { this.host.innerHTML = ''; return; }
    const max = Math.max(1, ...this.points.flatMap((p) => [p.income, p.expense]));
    const w = 600, h = 300, base = 236, top = 86, slot = w / (n + 1);
    const bars = this.points.map((p, i) => {
      const cx = slot * (i + 1);
      const hi = ((base - top) * p.income) / max;
      const he = ((base - top) * p.expense) / max;
      return `<rect class="stage-fallback-bar" x="${cx - 26}" y="${base - hi}" width="24" height="${hi}" rx="3" fill="var(--income)"/><rect class="stage-fallback-bar" x="${cx + 2}" y="${base - he}" width="24" height="${he}" rx="3" fill="var(--expense)"/>`;
    }).join('');
    this.host.innerHTML = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet"><line x1="20" x2="${w - 20}" y1="${base}" y2="${base}" stroke="var(--control-border)" stroke-width="1.5"/>${bars}</svg>`;
    const buttons = this.monthsHost.children;
    const rect = this.root.getBoundingClientRect();
    this.points.forEach((_, i) => {
      if (!buttons[i]) return;
      const scale = Math.min(rect.width / w, rect.height / h);
      const offsetX = (rect.width - w * scale) / 2;
      const offsetY = (rect.height - h * scale) / 2;
      buttons[i].style.left = `${offsetX + slot * (i + 1) * scale}px`;
      buttons[i].style.top = `${offsetY + (base + 8) * scale}px`;
    });
  }
}

function mount() {
  const root = document.getElementById('financeStage');
  if (!root || root.dataset.mounted) return;
  root.dataset.mounted = 'true';
  const stage = new Stage(root);
  window.FinanceStage = { update: (data) => stage.update(data), stage };
  if (window.__financeStageData) stage.update(window.__financeStageData);
  window.addEventListener('finance:data', (event) => stage.update(event.detail));
  if (!stage.gl) new ResizeObserver(() => stage.renderFallback()).observe(root);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
else mount();
