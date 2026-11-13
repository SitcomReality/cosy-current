import { RAFT_PARTS } from '../data/raftParts.js';
import { createCraftingModule } from '../game/crafting.js';
import { drawRaftSprite } from '../renderer/objects/player.js';
import { ITEM_REGISTRY } from '../data/items.js';

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
  
  // Human-readable material names
  const MATERIAL_NAMES = {
    wood: 'Driftwood',
    scrap: 'Rusted Scrap',
    cloth: 'Tattered Cloth',
    plastic: 'Hard Plastic',
    ancient_coin: 'Ancient Coin',
    river_gem: 'River Gem',
    message_bottle: 'Message in a Bottle',
    old_compass: 'Broken Compass'
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
      
      // Draw background - straight-line polygon water (no arc)
      previewCtx.fillStyle = '#0f172a';
      previewCtx.fillRect(0, 0, w, h);
      
      // Draw water as a straight-edged polygon (hexagon/octagon)
      previewCtx.fillStyle = '#0b63a8';
      previewCtx.beginPath();
      const centerX = w / 2;
      const centerY = h / 2;
      const radius = Math.min(w, h) * 0.4;
      const sides = 8;
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
        const x = centerX + Math.cos(a) * radius;
        const y = centerY + Math.sin(a) * radius;
        if (i === 0) previewCtx.moveTo(x, y);
        else previewCtx.lineTo(x, y);
      }
      previewCtx.closePath();
      previewCtx.fill();
      
      // Draw subtle water lines
      previewCtx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
      previewCtx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        const r = radius * (i / 4);
        previewCtx.beginPath();
        for (let j = 0; j < sides; j++) {
          const a = (j / sides) * Math.PI * 2 - Math.PI / 2;
          const x = centerX + Math.cos(a) * r;
          const y = centerY + Math.sin(a) * r;
          if (j === 0) previewCtx.moveTo(x, y);
          else previewCtx.lineTo(x, y);
        }
        previewCtx.closePath();
        previewCtx.stroke();
      }

      // Fake cycle for drawing - show light
      const cycle = { raftLightActive: true, raftLightIntensity: 1.0 };
      
      // Draw raft centered and scaled to fill preview nicely
      // Use a larger scale so the raft is visible
      const scale = Math.min(w, h) * 0.018; // ~5.4 at 300px, makes raft ~100px wide
      drawRaftSprite(previewCtx, centerX, centerY, angle + Math.PI * 1.5, scale, state.raft, cycle);

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

  function formatCost(cost) {
    if (!cost || Object.keys(cost).length === 0) return null;
    return Object.entries(cost).map(([materialId, qty]) => {
      const name = MATERIAL_NAMES[materialId] || materialId;
      return `${qty} ${name}`;
    }).join(', ');
  }

  function canAfford(cost) {
    if (!cost || Object.keys(cost).length === 0) return true;
    for (const [materialId, qty] of Object.entries(cost)) {
      if ((state.inventory[materialId] || 0) < qty) return false;
    }
    return true;
  }

  function getItemState(part, section) {
    const isActive = state.raft[section.key] === part.id;
    const unlockKey = `raft_part_${part.id}`;
    const isDefault = Object.keys(part.cost).length === 0;
    const isUnlocked = isDefault || state.collection[unlockKey];
    const affordable = canAfford(part.cost);
    
    if (isActive) return 'equipped';
    if (isUnlocked) return 'owned';
    if (affordable) return 'affordable';
    return 'locked';
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
        const itemState = getItemState(part, section);
        const isActive = state.raft[section.key] === part.id;
        
        item.className = `custom-item ${itemState}`;
        if (itemState === 'locked') item.classList.add('locked');
        if (isActive) item.classList.add('active');

        // Render preview swatch
        const swatch = document.createElement('div');
        swatch.className = 'custom-swatch';
        if (part.id.startsWith('#')) {
          swatch.style.backgroundColor = part.id;
        } else {
          // For shapes and light types, show a small icon/text
          swatch.textContent = part.name.charAt(0);
          swatch.style.display = 'flex';
          swatch.style.alignItems = 'center';
          swatch.style.justifyContent = 'center';
          swatch.style.fontSize = '0.7rem';
          swatch.style.fontWeight = 'bold';
          swatch.style.color = '#fff';
          swatch.style.background = '#374151';
        }
        item.appendChild(swatch);

        const name = document.createElement('div');
        name.className = 'custom-name';
        name.textContent = part.name;
        item.appendChild(name);

        // Show cost for non-default items
        if (!isActive && (itemState === 'locked' || itemState === 'affordable')) {
          const costText = formatCost(part.cost);
          if (costText) {
            const costDiv = document.createElement('div');
            costDiv.className = 'custom-cost';
            costDiv.textContent = costText;
            item.appendChild(costDiv);
          }
        }

        // Show state label
        const stateLabel = document.createElement('div');
        stateLabel.className = 'custom-state';
        switch (itemState) {
          case 'equipped':
            stateLabel.textContent = 'EQUIPPED';
            stateLabel.style.color = '#10b981';
            break;
          case 'owned':
            stateLabel.textContent = 'OWNED';
            stateLabel.style.color = '#3b82f6';
            break;
          case 'affordable':
            stateLabel.textContent = 'AFFORDABLE';
            stateLabel.style.color = '#f59e0b';
            break;
          case 'locked':
            stateLabel.textContent = 'LOCKED';
            stateLabel.style.color = '#ef4444';
            break;
        }
        item.appendChild(stateLabel);

        // Show description if available
        if (part.description) {
          const desc = document.createElement('div');
          desc.className = 'custom-desc';
          desc.textContent = part.description;
          desc.style.fontSize = '0.65rem';
          desc.style.color = 'var(--text-secondary)';
          desc.style.marginTop = '2px';
          desc.style.whiteSpace = 'nowrap';
          desc.style.overflow = 'hidden';
          desc.style.textOverflow = 'ellipsis';
          item.appendChild(desc);
        }

        // Click handler
        item.onclick = () => {
          if (itemState === 'locked' && !affordable) {
            if (state.notifications) state.notifications.warning('Not enough materials');
            return;
          }
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