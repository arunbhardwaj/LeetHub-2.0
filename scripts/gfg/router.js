const GFG_HOSTS = new Set(['www.geeksforgeeks.org', 'geeksforgeeks.org']);

export function parseGfgProblemUrl(input) {
  let url;

  try {
    url = input instanceof URL ? input : new URL(input);
  } catch (_error) {
    return null;
  }

  if (url.protocol !== 'https:' || !GFG_HOSTS.has(url.hostname)) {
    return null;
  }

  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length !== 3 || parts[0] !== 'problems') {
    return null;
  }

  const [, slug, problemType] = parts;
  if (!slug || !problemType) {
    return null;
  }

  return Object.freeze({
    slug,
    problemType,
    routeKey: `${slug}/${problemType}`,
  });
}

export function isGfgProblemPage(input) {
  return parseGfgProblemUrl(input) !== null;
}

export function getProblemRouteKey(input) {
  return parseGfgProblemUrl(input)?.routeKey ?? null;
}

export function createRouteMonitor(windowObject, onRouteChange, intervalMs = 1000) {
  let currentRouteKey;

  const checkRoute = () => {
    const routeKey = getProblemRouteKey(windowObject.location.href);
    if (routeKey === currentRouteKey) return;

    const previousRouteKey = currentRouteKey ?? null;
    currentRouteKey = routeKey;
    onRouteChange(routeKey, previousRouteKey);
  };

  windowObject.addEventListener('popstate', checkRoute);
  windowObject.addEventListener('hashchange', checkRoute);
  const intervalId = windowObject.setInterval(checkRoute, intervalMs);
  checkRoute();

  return () => {
    windowObject.removeEventListener('popstate', checkRoute);
    windowObject.removeEventListener('hashchange', checkRoute);
    windowObject.clearInterval(intervalId);
  };
}
