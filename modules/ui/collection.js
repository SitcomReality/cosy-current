import { ITEM_REGISTRY } from '../data/items.js';
import { COLLECTABLE_DRAWERS } from '../renderer/objects/collectables/drawers.js';

export function createCollectionUI({ state, container }) {
  const modal = document.getElementById('collection-modal');
  const tabsContainer = document.getElementById('collection-tabs');
  const grid = document.getElementById('collection-grid');
  const closeBtn = document.getElementById('btn-close-collection');

  const CATEGORIES = {
    'flotsam': 'Flotsam & Materials',
    'collectables': 'Relics & Treasures'
  };

  let activeTab = 'flotsam';

  // Relic hints for locked state
  const RELIC_HINTS = {
    'ancient_coin': 'Found on riverbanks at dusk',
    'river_gem': 'Gleams in deep water at night',
    'message_bottle': 'Washes up during rain',
    'old_compass': 'Lost in the forest at dawn'
  };

  function open() {
    modal.classList.remove('hidden');
    render();
  }

  function close() {
    modal.classList.add('hidden');
  }

  function renderTabs() {
    tabsContainer.innerHTML = '';
    for (const [key, label] of Object.entries(CATEGORIES)) {
      const tab = document.createElement('button');
      tab.className = `collection-tab ${key === activeTab ? 'active' : ''}`;
      
      // Add relic counter to the Relics tab
      if (key === 'collectables') {
        const discovered = Object.values(ITEM_REGISTRY)
          .filter(i => i.type === 'collectable' && state.collection[i.id])
          .length;
        const total = Object.values(ITEM_REGISTRY).filter(i => i.type === 'collectable').length;
        tab.innerHTML = `${label} <span class="tab-counter">${discovered} / ${total}</span>`;
      } else {
        tab.textContent = label;
      }
      
      tab.addEventListener('click', () => {
        activeTab = key;
        renderTabs();
        renderGrid();
      });
      tabsContainer.appendChild(tab);
    }
  }

  function renderGrid() {
    grid.innerHTML = '';

    const items = getItemsForCategory(activeTab);
    
    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'collection-empty';
      empty.textContent = 'No items in this category';
      grid.appendChild(empty);
      return;
    }

    for (const item of items) {
      const card = document.createElement('div');
      card.className = 'collection-card';

      const isUnlocked = state.collection && state.collection[item.id];
      const count = state.inventory[item.id] || 0;

      if (isUnlocked) {
        card.classList.add('unlocked');
        
        // Use canvas to draw the actual item sprite
        const icon = document.createElement('canvas');
        icon.className = 'collection-icon';
        icon.width = 80;
        icon.height = 80;
        const ctx = icon.getContext('2d');
        drawItemIcon(ctx, item, 32);
        
        const name = document.createElement('div');
        name.className = 'collection-name';
        name.textContent = item.name;
        
        const desc = document.createElement('div');
        desc.className = 'collection-description';
        desc.textContent = item.description;
        
        // Show count for materials
        if (item.type === 'material' && count > 0) {
          const countEl = document.createElement('div');
          countEl.className = 'collection-count';
          countEl.textContent = `×${count}`;
          countEl.style.fontSize = '0.85rem';
          countEl.style.fontWeight = 'bold';
          countEl.style.color = '#fbbf24';
          countEl.style.marginTop = '0.25rem';
          card.appendChild(countEl);
        }
        
        card.appendChild(icon);
        card.appendChild(name);
        card.appendChild(desc);
      } else {
        card.classList.add('locked');
        
        // For locked relics, show a silhouette/hint
        if (item.type === 'collectable') {
          const icon = document.createElement('canvas');
          icon.className = 'collection-icon locked-icon';
          icon.width = 80;
          icon.height = 80;
          const ctx = icon.getContext('2d');
          drawLockedRelicSilhouette(ctx, item, 32);
          
          const name = document.createElement('div');
          name.className = 'collection-name';
          name.textContent = '???';
          
          const hint = document.createElement('div');
          hint.className = 'collection-hint';
          hint.textContent = RELIC_HINTS[item.id] || 'Location unknown';
          hint.style.fontSize = '0.7rem';
          hint.style.color = 'var(--text-secondary)';
          hint.style.fontStyle = 'italic';
          hint.style.marginTop = '0.5rem';
          hint.style.textAlign = 'center';
          
          card.appendChild(icon);
          card.appendChild(name);
          card.appendChild(hint);
        } else {
          // Locked materials - show generic icon
          const icon = document.createElement('div');
          icon.className = 'collection-icon locked-icon';
          icon.textContent = '?';
          
          const name = document.createElement('div');
          name.className = 'collection-name';
          name.textContent = 'Unknown';
          
          card.appendChild(icon);
          card.appendChild(name);
        }
      }

      grid.appendChild(card);
    }
  }

  function render() {
    renderTabs();
    renderGrid();
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', close);
  }

  return { open, close, render };
}

function getItemsForCategory(category) {
  const items = Object.values(ITEM_REGISTRY);
  if (category === 'flotsam') {
    return items.filter(item => item.type === 'material');
  } else if (category === 'collectables') {
    return items.filter(item => item.type === 'collectable');
  }
  return items;
}

function drawItemIcon(ctx, item, size) {
  // Clear
  ctx.clearRect(0, 0, 80, 80);
  ctx.save();
  ctx.translate(40, 40);
  
  const drawer = COLLECTABLE_DRAWERS[item.id];
  if (drawer) {
    const color = getItemColor(item);
    drawer(ctx, color, size * 0.7);
  } else {
    // Fallback
    ctx.fillStyle = getItemColor(item);
    ctx.fillRect(-size/2, -size/2, size, size);
  }
  
  ctx.restore();
}

function drawLockedRelicSilhouette(ctx, item, size) {
  // Draw a dimmed silhouette of the relic
  ctx.clearRect(0, 0, 80, 80);
  ctx.save();
  ctx.translate(40, 40);
  ctx.globalAlpha = 0.3;
  
  const drawer = COLLECTABLE_DRAWERS[item.id];
  if (drawer) {
    const color = '#6b7280'; // dim gray
    drawer(ctx, color, size * 0.7);
  } else {
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(-size/2, -size/2, size, size);
  }
  
  ctx.restore();
}

function getItemColor(item) {
  if (item.type === 'collectable') return '#a78bfa';
  if (item.rarity < 0.3) return '#ef4444';
  if (item.rarity < 0.6) return '#f59e0b';
  return '#fbbf24';
}