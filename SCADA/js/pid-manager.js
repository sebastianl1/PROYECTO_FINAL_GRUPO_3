/**
 * pid-manager.js — P&ID con carga de archivos SVG
 * NexSCADA v5 — Módulo independiente
 *
 * - Si hay archivos .svg en /pid/, los carga en el contenedor pidContainer
 * - SVG se incrusta directamente para permitir interactividad
 * - Fallback: dibuja el P&ID procedimental en canvas (drawPID de scada-core.js)
 * - Botón "Cargar P&ID..." abre modal de selección
 */

window._pidCurrentFile = null;

// ─── LISTAR SVGs ──────────────────────────────────────────────────
window.listPIDSVGs = async function() {
  try {
    const res = await fetch('/api/files/list?path=/pid');
    if (!res.ok) return [];
    const files = await res.json();
    return files.filter(f => f.name && f.name.toLowerCase().endsWith('.svg'));
  } catch { return []; }
};

// ─── CARGAR SVG ───────────────────────────────────────────────────
window.loadPIDSVG = async function(filename) {
  const container = document.getElementById('pidContainer');
  if (!container) return;

  container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-secondary)">
    <div class="spinner-border spinner-border-sm text-primary me-2"></div>
    Cargando P&ID: ${filename}...
  </div>`;

  try {
    const res = await fetch(`/api/files/raw?path=/pid&name=${encodeURIComponent(filename)}`);
    if (!res.ok) throw new Error(`Error ${res.status}`);
    const svgText = await res.text();

    // Insertar SVG directamente para interactividad
    container.innerHTML = svgText;
    const svgEl = container.querySelector('svg');
    if (svgEl) {
      svgEl.style.width  = '100%';
      svgEl.style.height = '100%';
      svgEl.style.maxHeight = 'calc(100vh - 200px)';
      svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      // Añadir pan/zoom básico con rueda del ratón y drag
      _addSVGPanZoom(svgEl);
    }

    window._pidCurrentFile = filename;
    const label = document.getElementById('pidLabel');
    if (label) label.textContent = filename;
    window.showNotif(`P&ID "${filename}" cargado`, 'success');

  } catch (err) {
    // Fallback al canvas procedimental
    container.innerHTML = `<canvas id="pidCanvas" style="width:100%;height:100%"></canvas>`;
    if (typeof drawPID === 'function') {
      const canvas = document.getElementById('pidCanvas');
      if (canvas) {
        canvas.width  = canvas.offsetWidth  || 900;
        canvas.height = canvas.offsetHeight || 450;
        drawPID();
      }
    }
    window.showNotif(`No se pudo cargar SVG. Mostrando P&ID procedimental. (${err.message})`, 'warning');
  }
};

// ─── PAN/ZOOM BÁSICO PARA SVG ────────────────────────────────────
function _addSVGPanZoom(svg) {
  let scale = 1, panX = 0, panY = 0, isDragging = false, lastX = 0, lastY = 0;
  
  svg.style.cursor = 'grab';
  svg.style.transition = 'transform 0.05s ease';

  function apply() {
    svg.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
  }

  svg.addEventListener('wheel', e => {
    e.preventDefault();
    scale = Math.max(0.2, Math.min(5, scale * (e.deltaY > 0 ? 0.9 : 1.1)));
    apply();
  }, { passive: false });

  svg.addEventListener('mousedown', e => { isDragging = true; lastX = e.clientX; lastY = e.clientY; svg.style.cursor = 'grabbing'; });
  window.addEventListener('mouseup', () => { isDragging = false; svg.style.cursor = 'grab'; });
  window.addEventListener('mousemove', e => {
    if (!isDragging) return;
    panX += e.clientX - lastX; panY += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    apply();
  });

  // Botón reset zoom
  const resetBtn = document.getElementById('pidResetZoom');
  if (resetBtn) resetBtn.addEventListener('click', () => { scale=1;panX=0;panY=0;apply(); });
}

// ─── MODAL DE SELECCIÓN ──────────────────────────────────────────
window.openPIDModal = async function() {
  const svgs = await window.listPIDSVGs();

  let modalEl = document.getElementById('pidModal');
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'pidModal';
    modalEl.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1050;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
    document.body.appendChild(modalEl);
  }

  if (svgs.length === 0) {
    modalEl.innerHTML = `
    <div style="background:var(--bg-elevated);border:1px solid var(--border-default);border-radius:16px;padding:28px;width:440px;max-width:95vw">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h5 style="margin:0;font-size:16px;color:var(--text-heading)">Cargar P&ID (.svg)</h5>
        <button onclick="document.getElementById('pidModal').remove()" style="background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:18px">×</button>
      </div>
      <p style="color:var(--text-secondary);font-size:13px;margin-bottom:16px">No hay archivos .svg en la carpeta <code>pid/</code> del servidor.</p>
      <p style="color:var(--text-disabled);font-size:12px">Sube archivos SVG de planos P&ID a través del File Manager en la carpeta <code>pid/</code>.</p>
      <div style="margin-top:20px;text-align:right"><button class="btn btn-outline-secondary btn-sm" onclick="document.getElementById('pidModal').remove()">Cerrar</button></div>
    </div>`;
    modalEl.style.display = 'flex';
    return;
  }

  modalEl.innerHTML = `
  <div style="background:var(--bg-elevated);border:1px solid var(--border-default);border-radius:16px;padding:28px;width:480px;max-width:95vw">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <h5 style="margin:0;font-size:16px;color:var(--text-heading)">Seleccionar P&ID</h5>
      <button onclick="document.getElementById('pidModal').remove()" style="background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:18px">×</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;max-height:320px;overflow-y:auto">
      ${svgs.map(f => `
      <div onclick="window.loadPIDSVG('${f.name}');document.getElementById('pidModal').remove()"
        style="padding:12px 16px;border:1px solid var(--border-subtle);border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:12px;transition:all 0.15s"
        onmouseenter="this.style.borderColor='var(--accent-cyan)';this.style.background='rgba(0,212,255,0.05)'"
        onmouseleave="this.style.borderColor='var(--border-subtle)';this.style.background=''">
        <span style="font-size:20px">📐</span>
        <div>
          <div style="font-size:13px;font-weight:500;color:var(--text-primary)">${f.name}</div>
          <div style="font-size:11px;color:var(--text-disabled)">${f.size ? (f.size/1024).toFixed(1) + ' KB SVG' : 'Diagrama P&ID'}</div>
        </div>
        ${f.name === window._pidCurrentFile ? '<span style="margin-left:auto;font-size:11px;color:var(--accent-green)">✓ actual</span>' : ''}
      </div>`).join('')}
    </div>
    <div style="margin-top:16px;text-align:right"><button class="btn btn-outline-secondary btn-sm" onclick="document.getElementById('pidModal').remove()">Cancelar</button></div>
  </div>`;
  modalEl.style.display = 'flex';
};

// ─── INIT ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Comprobar si hay SVGs disponibles al iniciar
  const svgs = await window.listPIDSVGs();

  const tab = document.getElementById('tab-process');
  if (!tab) return;

  // Añadir botón "Cargar P&ID" en la toolbar del tab proceso
  const toolbar = document.getElementById('pidToolbar');
  if (toolbar) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-sm';
    btn.style.cssText = 'border:1px solid var(--border-default);color:var(--text-secondary);background:transparent;font-size:12px;display:flex;align-items:center;gap:6px';
    btn.innerHTML = '📐 Cargar P&ID SVG';
    btn.onclick = window.openPIDModal;
    toolbar.prepend(btn);
  }

  // Si hay SVG disponibles, cargar el primero automáticamente
  if (svgs.length > 0) {
    const container = document.getElementById('pidContainer');
    if (container) {
      // Cargar cuando el tab sea visible
      const tabObserver = new MutationObserver(() => {
        if (tab.style.display !== 'none') {
          window.loadPIDSVG(svgs[0].name);
          tabObserver.disconnect();
        }
      });
      tabObserver.observe(tab, { attributes: true, attributeFilter: ['style'] });
    }
  }
});
