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
      // Detectar y enlazar hotspots con variables
      _wireSVGHotspots(svgEl);
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

// ─── CARGA LOCAL DE ARCHIVO (cliente, sin backend) ──────────────
window.loadPIDFromLocalFile = function(file) {
  if (!file) return;
  const container = document.getElementById('pidContainer');
  if (!container) return;

  const name = file.name || 'archivo';
  const ext  = name.split('.').pop().toLowerCase();
  const label = document.getElementById('pidLabel');

  if (ext === 'svg') {
    const reader = new FileReader();
    reader.onload = e => {
      container.innerHTML = e.target.result;
      const svgEl = container.querySelector('svg');
      if (svgEl) {
        svgEl.style.width = '100%';
        svgEl.style.height = '100%';
        svgEl.style.maxHeight = 'calc(100vh - 200px)';
        svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        _addSVGPanZoom(svgEl);
      } else {
        container.innerHTML = `<div style="padding:24px;color:var(--danger,#dc3545)">El archivo no contiene un &lt;svg&gt; válido.</div>`;
      }
      window._pidCurrentFile = name;
      if (label) label.textContent = name;
      if (typeof window.showNotif === 'function') window.showNotif(`P&ID "${name}" cargado`, 'success');
    };
    reader.onerror = () => window.showNotif?.('Error leyendo el archivo', 'danger');
    reader.readAsText(file);

  } else if (ext === 'dwg' || ext === 'dxf') {
    // Los navegadores no pueden renderizar DWG/DXF de forma nativa.
    const sizeKB = (file.size / 1024).toFixed(1);
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;min-height:340px;padding:32px;text-align:center;color:var(--text-secondary)">
        <div style="font-size:48px;margin-bottom:12px">📐</div>
        <div style="font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:6px">${name}</div>
        <div style="font-size:12px;margin-bottom:16px">Archivo ${ext.toUpperCase()} · ${sizeKB} KB</div>
        <div style="font-size:13px;max-width:480px;line-height:1.5">
          Los archivos <b>${ext.toUpperCase()}</b> no se pueden previsualizar directamente en el navegador.
          Conviértelo a <b>SVG</b> (desde AutoCAD: <i>Exportar → SVG</i>, o usa un convertidor online)
          y vuelve a cargarlo aquí.
        </div>
      </div>`;
    window._pidCurrentFile = name;
    if (label) label.textContent = name + ' (DWG)';
    if (typeof window.showNotif === 'function') {
      window.showNotif(`DWG cargado: previsualización no disponible. Convierte a SVG.`, 'warning');
    }

  } else {
    if (typeof window.showNotif === 'function') {
      window.showNotif(`Formato .${ext} no soportado. Usa .svg o .dwg`, 'danger');
    }
  }
};

// ─── INIT ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const tab = document.getElementById('tab-process');
  if (!tab) return;

  const toolbar = document.getElementById('pidToolbar');
  if (toolbar) {
    // Input file oculto (acepta SVG y DWG/DXF)
    const fileInput = document.getElementById('pidLocalFileInput') || document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.svg,.dwg,.dxf,image/svg+xml';
    fileInput.style.display = 'none';
    fileInput.id = 'pidLocalFileInput';
    fileInput.addEventListener('change', e => {
      const f = e.target.files?.[0];
      if (f) window.loadPIDFromLocalFile(f);
      e.target.value = '';
    });
    if (!fileInput.parentElement) document.body.appendChild(fileInput);

    // Botón "Subir P&ID" (carga local desde el equipo del usuario)
    const uploadBtn = document.getElementById('pidLocalUploadBtn') || document.createElement('button');
    uploadBtn.className = 'btn btn-sm';
    uploadBtn.style.cssText = 'border:1px solid var(--accent-cyan,#00d4ff);color:var(--accent-cyan,#00d4ff);background:transparent;font-size:12px;display:flex;align-items:center;gap:6px;margin-right:6px';
    uploadBtn.innerHTML = '📤 Subir P&ID (.svg / .dwg)';
    uploadBtn.onclick = () => fileInput.click();
    if (!uploadBtn.parentElement) toolbar.prepend(uploadBtn);

    // Drag & drop sobre el contenedor del P&ID
    const container = document.getElementById('pidContainer');
    if (container) {
      container.addEventListener('dragover', e => {
        e.preventDefault();
        container.style.outline = '2px dashed var(--accent-cyan,#00d4ff)';
      });
      container.addEventListener('dragleave', () => { container.style.outline = ''; });
      container.addEventListener('drop', e => {
        e.preventDefault();
        container.style.outline = '';
        const f = e.dataTransfer?.files?.[0];
        if (f) window.loadPIDFromLocalFile(f);
      });
    }
  }

  // Intento opcional de listar SVGs del backend (si existe)
  try {
    const svgs = await window.listPIDSVGs();
    if (svgs.length > 0) {
      const tabObserver = new MutationObserver(() => {
        if (tab.style.display !== 'none') {
          window.loadPIDSVG(svgs[0].name);
          tabObserver.disconnect();
        }
      });
      tabObserver.observe(tab, { attributes: true, attributeFilter: ['style'] });
    }
  } catch {}
});
