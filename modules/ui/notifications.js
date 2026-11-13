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

  // Onboarding hints - non-blocking, dismiss on tap
  let hintQueue = [
    { message: 'Tap items to collect them', delay: 3000 },
    { message: 'Follow the relic counter (✦) to find 4 treasures', delay: 10000 },
    { message: 'Hold SPACE to gather nearby items', delay: 20000 },
    { message: 'Tap ⚓ to customize your raft at The Dock', delay: 35000 }
  ];
  let hintIndex = 0;
  let hintTimer = 0;

  function updateHints(dt, onboardingSeen) {
    if (onboardingSeen) return;
    hintTimer += dt;
    if (hintIndex < hintQueue.length && hintTimer >= hintQueue[hintIndex].delay / 1000) {
      show(hintQueue[hintIndex].message, 'info', 5000);
      hintIndex++;
    }
  }

  function markOnboardingSeen() {
    hintQueue = []; // Clear queue
  }

  return { show, discovery, warning, info, updateHints, markOnboardingSeen };
}

