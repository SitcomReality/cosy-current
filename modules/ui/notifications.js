export function createNotificationSystem() {
  const container = document.getElementById('notification-container');
  const activeToasts = [];

  function show(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `notification-toast notification-${type}`;
    toast.innerHTML = `<span>${message}</span>`;

    container.appendChild(toast);
    activeToasts.push(toast);

    // Auto-remove after duration
    setTimeout(() => {
      toast.classList.add('fade-out');
      // Match JS removal delay to the slower CSS exit animation (1s) for a gentler fade
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
        const idx = activeToasts.indexOf(toast);
        if (idx >= 0) activeToasts.splice(idx, 1);
      }, 1000);
    }, duration);
  }

  function discovery(itemName) {
    show(`✨ New Discovery: ${itemName}!`, 'discovery', 4000);
  }

  function warning(message) {
    show(message, 'warning', 3000);
  }

  function info(message) {
    show(message, 'info', 2500);
  }

  return { show, discovery, warning, info };
}

