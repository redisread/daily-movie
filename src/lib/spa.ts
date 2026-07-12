/**
 * SPA Router — Hash-based client-side navigation
 *
 * Routes:
 *   /           → home (today's movie hero)
 *   /#/archive  → movie list/archive view
 *   /#/movie/YYYY-MM-DD → movie detail view
 *
 * All data is embedded in the page at build time.
 */

export type Route =
  | { name: 'home'; params: Record<string, never> }
  | { name: 'archive'; params: Record<string, never> }
  | { name: 'movie'; params: { date: string } };

let currentRoute: Route = { name: 'home', params: {} };
const listeners = new Set<(route: Route) => void>();

function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, ''); // strip leading # and /
  if (!path || path === '') {
    return { name: 'home', params: {} };
  }

  if (path === 'archive' || path === 'library' || path === 'search') {
    return { name: 'archive', params: {} };
  }

  const movieMatch = path.match(/^movie\/(\d{4}-\d{2}-\d{2})\/?$/);
  if (movieMatch) {
    return { name: 'movie', params: { date: movieMatch[1] } };
  }

  // Fallback to home for unknown routes
  return { name: 'home', params: {} };
}

function updateRoute(): void {
  const route = parseHash(window.location.hash);
  currentRoute = route;
  listeners.forEach((cb) => cb(route));
}

export function getCurrentRoute(): Route {
  return currentRoute;
}

export function navigateTo(name: Route['name'], params?: Record<string, string>): void {
  let hash: string;
  switch (name) {
    case 'home':
      hash = '';
      break;
    case 'archive':
      hash = '#/archive';
      break;
    case 'movie':
      hash = `#/movie/${params?.date ?? ''}`;
      break;
    default:
      hash = '';
  }
  window.location.hash = hash;
  // hashchange event fires automatically
}

export function onRouteChange(cb: (route: Route) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// View visibility
const VIEW_IDS: Record<Route['name'], string> = {
  home: 'view-home',
  archive: 'view-archive',
  movie: 'view-movie',
};

function hideAllViews(): void {
  Object.values(VIEW_IDS).forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = 'none';
      el.setAttribute('hidden', '');
    }
  });
  // Also hide all movie-detail sub-views
  document.querySelectorAll('[data-movie-detail]').forEach((el) => {
    (el as HTMLElement).style.display = 'none';
    el.setAttribute('hidden', '');
  });
}

export function showView(name: Route['name'], date?: string): void {
  hideAllViews();

  if (name === 'movie' && date) {
    // Show movie detail container and the specific movie
    const container = document.getElementById(VIEW_IDS.movie);
    if (container) {
      container.style.display = '';
      container.removeAttribute('hidden');
    }
    const detailEl = document.querySelector(`[data-movie-date="${date}"]`);
    if (detailEl) {
      (detailEl as HTMLElement).style.display = '';
      detailEl.removeAttribute('hidden');
    } else {
      // Movie not found — fall back to home
      const homeEl = document.getElementById(VIEW_IDS.home);
      if (homeEl) {
        homeEl.style.display = '';
        homeEl.removeAttribute('hidden');
      }
    }
  } else {
    const el = document.getElementById(VIEW_IDS[name]);
    if (el) {
      el.style.display = '';
      el.removeAttribute('hidden');
    }
  }

  // Scroll to top on view change
  window.scrollTo({ top: 0, behavior: 'auto' });
}

/** Initialize the SPA router and event listeners */
export function initRouter(): void {
  // Handle hash changes
  window.addEventListener('hashchange', updateRoute);

  // Intercept clicks on SPA links
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const link = target.closest('a[data-spa-link]') as HTMLAnchorElement | null;
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href || !href.startsWith('#/')) return;

    e.preventDefault();
    window.location.hash = href;
  });

  // Initial route
  updateRoute();
}
