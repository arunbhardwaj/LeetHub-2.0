const HOST_ID = 'gfghub-sync-notification';

function createSyncNotifier(
  documentObject,
  { timeoutMs = 6000, setTimer = setTimeout, clearTimer = clearTimeout } = {}
) {
  let host = null;
  let timer = null;

  const cleanup = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
    host?.remove();
    host = null;
  };

  const show = ({ type, heading, detail }) => {
    cleanup();
    host = documentObject.createElement('div');
    host.id = HOST_ID;
    host.setAttribute('role', type === 'error' ? 'alert' : 'status');
    host.setAttribute('aria-live', 'polite');
    Object.assign(host.style, {
      position: 'fixed',
      top: '18px',
      right: '18px',
      zIndex: '2147483647',
      maxWidth: '320px',
      padding: '12px 14px',
      borderRadius: '8px',
      color: '#ffffff',
      background: type === 'error' ? '#8f2d2d' : '#176b45',
      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.24)',
      font: '14px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      pointerEvents: 'none',
    });

    const headingElement = documentObject.createElement('div');
    headingElement.style.fontWeight = '600';
    headingElement.textContent = heading;
    const detailElement = documentObject.createElement('div');
    detailElement.style.marginTop = '2px';
    detailElement.textContent = detail;
    host.append(headingElement, detailElement);
    (documentObject.body ?? documentObject.documentElement).append(host);
    timer = setTimer(cleanup, timeoutMs);
  };

  return Object.freeze({ cleanup, show });
}

export { createSyncNotifier, HOST_ID };
