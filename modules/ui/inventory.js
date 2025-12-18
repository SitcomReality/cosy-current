import { ITEM_REGISTRY } from '../data/items.js';

export function createInventoryUI({ state, container }) {
  // Refactored to render directly into an on-screen container
  function render() {
    if (!container) return;
    
    const items = Object.entries(state.inventory || {}).filter(([_, qty]) => qty > 0);
    
    // Check if DOM update is actually needed (simple equality check on content)
    // To keep it simple, we just regenerate if length changed or check counts
    const currentItemsStr = items.map(i => i[0] + i[1]).join(',');
    if (container._lastItemsStr === currentItemsStr) return;
    container._lastItemsStr = currentItemsStr;

    container.innerHTML = '';

    for (const [itemId, quantity] of items) {
      const item = ITEM_REGISTRY[itemId];
      if (!item) continue;

      const pill = document.createElement('div');
      pill.className = 'inventory-item-pill';
      
      const icon = document.createElement('div');
      icon.className = 'inventory-pill-icon';
      icon.style.backgroundColor = getItemColor(item);
      
      const label = document.createElement('div');
      label.className = 'inventory-pill-label';
      label.textContent = item.name;
      
      const qty = document.createElement('div');
      qty.className = 'inventory-pill-qty';
      qty.textContent = quantity;
      
      pill.appendChild(icon);
      pill.appendChild(label);
      pill.appendChild(qty);
      container.appendChild(pill);
    }
  }

  return { render };
}

function getItemColor(item) {
  if (item.type === 'collectable') return '#a78bfa';
  if (item.rarity < 0.3) return '#ef4444';
  if (item.rarity < 0.6) return '#f59e0b';
  return '#fbbf24';
}

