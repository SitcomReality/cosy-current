import { RAFT_PARTS } from '../data/raftParts.js';
import { createCraftingModule } from '../game/crafting.js';
import { drawRaftSprite } from '../renderer/objects/player.js';

export function createCustomizationUI({ state, container }) {
  const modal = document.getElementById('customization-modal');
  const closeBtn = document.getElementById('btn-close-customization');
  const tabContainer = document.getElementById('customization-tabs');
  const optionsContainer = document.getElementById('customization-options');
  const previewCanvas = document.getElementById('raft-preview');
  
  const crafting = createCraftingModule(state);
  
  let activeTab = 'Hull';
  let previewCtx = null;
  let animationFrame = null;
  
  // Tab definitions
  const TABS = {
    'Hull': [
      { key: 'hullColor', label: 'Paint', registry: 'hullColors' },
      { key: 'hullShape', label: 'Shape', registry: 'hullShapes' }
    ],
    'Cabin': [
      { key: 'cabinColor', label: 'Paint', registry: 'cabinColors' },
      { key: 'cabinShape', label: 'Shape', registry: 'cabinShapes' },
      { key: 'roofColor', label: 'Roof', registry: 'roofColors' }
    ],
    'Light': [
      { key: 'lightType', label: 'Type', registry: 'lightTypes' },
      { key: 'lightColor', label: 'Color', registry: 'lightColors' }
    ]
  };

  function init() {
    if (previewCanvas) {
      previewCtx = previewCanvas.getContext('2d');
    }
  }

  function open() {
    modal.classList.remove('hidden');
    renderTabs();
    renderOptions();
    startPreview();
  }

  function close() {
    modal.classList.add('hidden');
    stopPreview();
  }

  function startPreview() {
    if (!previewCtx) return;
    
    let angle = 0;
    const loop = () => {
      angle += 0.005;
      const w = previewCanvas.width;
      const h = previewCanvas.height;
      
      previewCtx.clearRect(0, 0, w, h);
      
      // Draw background circle
      previewCtx.fillStyle = '#0f172a';
      previewCtx.fillRect(0,0,w,h);
      previewCtx.fillStyle = '#0b63a8';
      previewCtx.beginPath();
      previewCtx.arc(w/2, h/2, 100, 0, Math.PI*2);
      previewCtx.fill();

      // Fake cycle for drawing
      const cycle = { raftLightActive: true, raftLightIntensity: 1.0 };
      
      // Draw raft centered
      drawRaftSprite(previewCtx, w/2, h/2, angle + Math.PI*1.5, 32, state.raft, cycle);

      animationFrame = requestAnimationFrame(loop);
    };
    loop();
  }

  function stopPreview() {
    if (animationFrame) cancelAnimationFrame(animationFrame);
  }

  function renderTabs() {
    tabContainer.innerHTML = '';
    Object.keys(TABS).forEach(tabName => {
      const btn = document.createElement('button');
      btn.className = `collection-tab ${activeTab === tabName ? 'active' : ''}`;
      btn.textContent = tabName;
      btn.onclick = () => {
        activeTab = tabName;
        renderTabs();
        renderOptions();
      };
      tabContainer.appendChild(btn);
    });
  }

  function renderOptions() {
    optionsContainer.innerHTML = '';
    const sections = TABS[activeTab];

    sections.forEach(section => {
      const sectionDiv = document.createElement('div');
      sectionDiv.className = 'custom-section';
      
      const title = document.createElement('h3');
      title.textContent = section.label;
      sectionDiv.appendChild(title);

      const grid = document.createElement('div');
      grid.className = 'custom-grid';

      const parts = RAFT_PARTS[section.registry];
      parts.forEach(part => {
        const item = document.createElement('div');
        const isActive = state.raft[section.key] === part.id;
        // Check if unlocked logic:
        const unlockKey = `raft_part_${part.id}`;
        // Default items (cost empty) are always unlocked
        const isDefault = Object.keys(part.cost).length === 0;
        const isUnlocked = isDefault || state.collection[unlockKey];

        item.className = `custom-item ${isActive ? 'active' : ''}`;
        if (!isUnlocked) item.classList.add('locked');

        // Render preview swatch
        const swatch = document.createElement('div');
        swatch.className = 'custom-swatch';
        if (part.id.startsWith('#')) {
          swatch.style.backgroundColor = part.id;
        } else {
          swatch.textContent = part.name[0]; // rudimentary icon
        }
        item.appendChild(swatch);

        const name = document.createElement('div');
        name.className = 'custom-name';
        name.textContent = part.name;
        item.appendChild(name);

        if (!isUnlocked && !isActive) {
          const costDiv = document.createElement('div');
          costDiv.className = 'custom-cost';
          // Show first cost item
          const entries = Object.entries(part.cost);
          if (entries.length > 0) {
            costDiv.textContent = `${entries[0][1]} ${entries[0][0]}`;
          }
          item.appendChild(costDiv);
        }

        item.onclick = () => {
          const res = crafting.unlockAndEquip(section.key, part.id);
          if (res.success) {
            renderOptions(); // Re-render to update active/locked states
            if (state.notifications) state.notifications.info(res.message || 'Equipped');
          } else {
            if (state.notifications) state.notifications.warning(res.message);
          }
        };

        grid.appendChild(item);
      });

      sectionDiv.appendChild(grid);
      optionsContainer.appendChild(sectionDiv);
    });
  }

  if (closeBtn) closeBtn.onclick = close;
  init();

  return { open, close };
}

