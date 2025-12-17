export function createInventoryUI({ state, container }) {
  const modal = document.getElementById('inventory-modal');
  const grid = document.getElementById('inventory-grid');
  const closeBtn = document.getElementById('btn-close-inventory');

  function open() {
    modal.classList.remove('hidden');
    render();
  }

  function close() {
    modal.classList.add('hidden');
  }

  function render() {
    grid.innerHTML = '';

    if (!state.inventory || Object.keys(state.inventory).length === 0) {
      const empty = document.createElement('div');
      empty.className = 'inventory-empty';
      empty.textContent = 'No items collected yet';
      grid.appendChild(empty);
      return;
    }

    for (const [itemId, quantity] of Object.entries(state.inventory)) {
      if (quantity <= 0) continue;

      const item = getItemFromRegistry(itemId);
      if (!item) continue;

      const slot = document.createElement('div');
      slot.className = 'inventory-slot';
      
      const icon = document.createElement('div');
      icon.className = 'inventory-icon';
      icon.style.backgroundColor = getItemColor(item);
      icon.title = item.name;
      
      const label = document.createElement('div');
      label.className = 'inventory-label';
      label.textContent = item.name;
      
      const qty = document.createElement('div');
      qty.className = 'inventory-quantity';
      qty.textContent = `${quantity}`;
      
      slot.appendChild(icon);
      slot.appendChild(label);
      slot.appendChild(qty);
      grid.appendChild(slot);
    }
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', close);
  }

  return { open, close, render };
}

function getItemFromRegistry(itemId) {
  // Dynamic import would be needed, but for now rely on global state/ITEM_REGISTRY
  // Caller will pass it or we'll fetch from state
  return null;
}

function getItemColor(item) {
  if (item.type === 'collectable') return '#a78bfa';
  if (item.rarity < 0.3) return '#ef4444';
  if (item.rarity < 0.6) return '#f59e0b';
  return '#fbbf24';
}

