export function createCollectionUI({ state, container, ITEM_REGISTRY }) {
  const modal = document.getElementById('collection-modal');
  const tabsContainer = document.getElementById('collection-tabs');
  const grid = document.getElementById('collection-grid');
  const closeBtn = document.getElementById('btn-close-collection');

  const CATEGORIES = {
    'flotsam': 'Flotsam & Materials',
    'collectables': 'Relics & Treasures'
  };

  let activeTab = 'flotsam';

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
      tab.textContent = label;
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

      if (isUnlocked) {
        card.classList.add('unlocked');
        
        const icon = document.createElement('div');
        icon.className = 'collection-icon';
        icon.style.backgroundColor = getItemColor(item);
        
        const name = document.createElement('div');
        name.className = 'collection-name';
        name.textContent = item.name;
        
        const desc = document.createElement('div');
        desc.className = 'collection-description';
        desc.textContent = item.description;
        
        card.appendChild(icon);
        card.appendChild(name);
        card.appendChild(desc);
      } else {
        card.classList.add('locked');
        
        const icon = document.createElement('div');
        icon.className = 'collection-icon locked-icon';
        icon.textContent = '?';
        
        const name = document.createElement('div');
        name.className = 'collection-name';
        name.textContent = 'Unknown';
        
        card.appendChild(icon);
        card.appendChild(name);
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
  // This will be populated dynamically based on ITEM_REGISTRY
  // For now, return all items (caller will filter)
  return [];
}

function getItemColor(item) {
  if (item.type === 'collectable') return '#a78bfa';
  if (item.rarity < 0.3) return '#ef4444';
  if (item.rarity < 0.6) return '#f59e0b';
  return '#fbbf24';
}

