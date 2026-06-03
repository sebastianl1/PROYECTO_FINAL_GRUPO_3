/**
 * viewer-3d.js — Vista 3D con carga de archivos GLB
 * NexSCADA v5 — Módulo independiente
 *
 * - Si hay archivos .glb en /models/, los carga con THREE.GLTFLoader
 * - Fallback: escena de geometría procedimental (ya construida en scada-core.js)
 * - Botón "Cargar Modelo..." abre modal de selección
 */

window._3dCurrentModel = null;

// ─── LISTA DE MODELOS DISPONIBLES ────────────────────────────────
window.listGLBModels = async function() {
  try {
    const res = await fetch('/api/files/list?path=/models');
    if (!res.ok) return [];
    const files = await res.json();
    return files.filter(f => f.name && f.name.toLowerCase().endsWith('.glb'));
  } catch { return []; }
};

// ─── CARGAR GLB ──────────────────────────────────────────────────
window.loadGLBModel = function(filename) {
  // Persistir selección
  try { localStorage.setItem('scada_last_glb', filename); } catch {}

  if (typeof window.threeScene === 'undefined' || !window.threeScene) {
    window.showNotif('Inicializa primero la vista 3D', 'warning');
    return;
  }

  // Verificar que THREE y GLTFLoader estén disponibles
  if (typeof THREE === 'undefined') { window.showNotif('Three.js no cargado', 'danger'); return; }

  // Eliminar modelo anterior
  if (window._3dCurrentModel) {
    window.threeScene.remove(window._3dCurrentModel);
    window._3dCurrentModel = null;
  }

  // Ocultar capa base procedimental para evitar sobreposición
  if (window.threeProceduralGroup) {
    window.threeProceduralGroup.visible = false;
  }

  // Verificar si GLTFLoader existe
  if (!THREE.GLTFLoader) {
    // Cargar dinámicamente
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/js/loaders/GLTFLoader.js';
    script.onload = () => _doLoadGLB(filename);
    script.onerror = () => window.showNotif('No se pudo cargar GLTFLoader', 'danger');
    document.head.appendChild(script);
    return;
  }
  _doLoadGLB(filename);
};

function _doLoadGLB(filename) {
  const url = `/api/files/raw?path=/models&name=${encodeURIComponent(filename)}`;
  window.showNotif(`Cargando modelo: ${filename}...`, 'info');

  const selectedLabel = document.getElementById('selectedLabel');
  if (selectedLabel) selectedLabel.textContent = `Cargando ${filename}...`;

  const loader = new THREE.GLTFLoader();
  loader.load(url,
    gltf => {
      const model = gltf.scene;
      // Centrar el modelo
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 12 / maxDim;
      model.scale.set(scale, scale, scale);
      model.position.sub(center.multiplyScalar(scale));

      window.threeScene.add(model);
      window._3dCurrentModel = model;
      // Mostrar nombre en overlay solo si hay click en equipo
      if (selectedLabel) selectedLabel.style.display = 'none';
      // Actualizar título del panel
      const titleEl = document.getElementById('3dModelTitle');
      if (titleEl) titleEl.textContent = filename.replace('.glb','').replace(/_/g,' ');
      window.showNotif(`Modelo "${filename}" cargado correctamente`, 'success');
    },
    xhr => {
      if (xhr.total > 0) {
        const pct = Math.round(xhr.loaded / xhr.total * 100);
        if (selectedLabel) selectedLabel.textContent = `Cargando ${filename}... ${pct}%`;
      }
    },
    err => {
      window.showNotif(`Error al cargar GLB: ${err.message || err}`, 'danger');
      if (selectedLabel) selectedLabel.textContent = '● Vista General (3D)';
    }
  );
}

// ─── MODAL DE SELECCIÓN ──────────────────────────────────────────
window.openGLBModal = async function() {
  const models = await window.listGLBModels();

  let modalEl = document.getElementById('glbModal');
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'glbModal';
    modalEl.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1050;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
    document.body.appendChild(modalEl);
  }

  if (models.length === 0) {
    modalEl.innerHTML = `
    <div style="background:var(--bg-elevated);border:1px solid var(--border-default);border-radius:16px;padding:28px;width:440px;max-width:95vw">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h5 style="margin:0;font-size:16px;color:var(--text-heading)">Cargar Modelo 3D (.glb)</h5>
        <button onclick="document.getElementById('glbModal').remove()" style="background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:18px">×</button>
      </div>
      <p style="color:var(--text-secondary);font-size:13px;margin-bottom:16px">No hay archivos .glb en la carpeta <code>models/</code> del servidor.</p>
      <p style="color:var(--text-disabled);font-size:12px">Sube archivos GLB a través del File Manager en la carpeta <code>models/</code>.</p>
      <div style="margin-top:20px;text-align:right"><button class="btn btn-outline-secondary btn-sm" onclick="document.getElementById('glbModal').remove()">Cerrar</button></div>
    </div>`;
    modalEl.style.display = 'flex';
    return;
  }

  modalEl.innerHTML = `
  <div style="background:var(--bg-elevated);border:1px solid var(--border-default);border-radius:16px;padding:28px;width:480px;max-width:95vw">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <h5 style="margin:0;font-size:16px;color:var(--text-heading)">Seleccionar Modelo 3D</h5>
      <button onclick="document.getElementById('glbModal').remove()" style="background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:18px">×</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;max-height:320px;overflow-y:auto">
      ${models.map(m => `
      <div onclick="window.loadGLBModel('${m.name}');document.getElementById('glbModal').remove()"
        style="padding:12px 16px;border:1px solid var(--border-subtle);border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:12px;transition:all 0.15s"
        onmouseenter="this.style.borderColor='var(--primary)';this.style.background='var(--primary-soft)'"
        onmouseleave="this.style.borderColor='var(--border-subtle)';this.style.background=''">
        <span style="font-size:20px">📦</span>
        <div>
          <div style="font-size:13px;font-weight:500;color:var(--text-primary)">${m.name}</div>
          <div style="font-size:11px;color:var(--text-disabled)">${m.size ? (m.size/1024).toFixed(0) + ' KB' : ''}</div>
        </div>
      </div>`).join('')}
    </div>
    <div style="margin-top:16px;text-align:right"><button class="btn btn-outline-secondary btn-sm" onclick="document.getElementById('glbModal').remove()">Cancelar</button></div>
  </div>`;
  modalEl.style.display = 'flex';
};

// ─── BOTÓN EN TAB 3D + AUTO-CARGA ───────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const toolbar3D = document.getElementById('toolbar3D');
  if (toolbar3D) {
    const btn = document.createElement('button');
    btn.style.cssText = 'display:flex;align-items:center;gap:6px;background:none;border:1px solid var(--border);color:var(--text-secondary);border-radius:7px;padding:5px 11px;font-size:12px;font-weight:500;cursor:pointer;transition:all 0.15s;font-family:Inter,sans-serif;margin-right:4px';
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg> Modelo GLB';
    btn.onmouseover = () => { btn.style.borderColor='var(--primary)'; btn.style.color='var(--primary)'; };
    btn.onmouseout  = () => { btn.style.borderColor='var(--border)';  btn.style.color='var(--text-secondary)'; };
    btn.onclick = window.openGLBModal;
    toolbar3D.prepend(btn);
  }

  // Auto-cargar último modelo cuando el tab 3D se hace visible
  const observer = new MutationObserver(() => {
    const tab = document.getElementById('tab-3d');
    if (!tab || tab.style.display === 'none') return;
    observer.disconnect();
    setTimeout(() => {
      const lastModel = localStorage.getItem('scada_last_glb');
      if (lastModel && window.threeScene) {
        window.loadGLBModel(lastModel);
      }
    }, 700);
  });
  observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['style'] });
});
