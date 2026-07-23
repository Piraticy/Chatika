function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function notifyInstallAvailable(detail = {}) {
  window.dispatchEvent(new CustomEvent('chatika:install-available', { detail }));
}

function notifyUpdateAvailable(registration) {
  window.__chatikaWaitingRegistration = registration;
  window.dispatchEvent(new CustomEvent('chatika:update-available'));
  registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
}

const RELEASE_KEY = 'chatika_release_id';

async function refreshForNewRelease() {
  try {
    const response = await fetch(`/release.json?at=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return;

    const release = await response.json();
    const releaseId = String(release?.id || '');
    if (!releaseId) return;

    const previousReleaseId = localStorage.getItem(RELEASE_KEY);
    localStorage.setItem(RELEASE_KEY, releaseId);
    if (!previousReleaseId || previousReleaseId === releaseId) return;

    const reloadKey = `chatika_release_reloaded_${releaseId}`;
    if (sessionStorage.getItem(reloadKey)) return;
    sessionStorage.setItem(reloadKey, 'true');

    const registration = await navigator.serviceWorker?.getRegistration();
    await registration?.update();
    registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  } catch (_error) {
    return;
  }
}

export function registerPwa() {
  const standalone = isStandalone();

  if (!standalone) {
    window.__chatikaInstall = async () => {
      const promptEvent = window.__chatikaInstallPrompt;
      if (!promptEvent) return false;
      promptEvent.prompt();
      const result = await promptEvent.userChoice;
      window.__chatikaInstallPrompt = null;
      return result.outcome === 'accepted';
    };

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      window.__chatikaInstallPrompt = event;
      notifyInstallAvailable({ browser: true });
    });

    window.addEventListener('appinstalled', () => {
      window.__chatikaInstallPrompt = null;
      window.dispatchEvent(new CustomEvent('chatika:install-complete'));
    });

    if (isIos()) {
      window.setTimeout(() => notifyInstallAvailable({ ios: true }), 1800);
    }
  }

  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then((registration) => {
    if (registration.waiting) notifyUpdateAvailable(registration);

    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          notifyUpdateAvailable(registration);
        }
      });
    });

    const checkForUpdates = () => {
      registration.update().catch(() => undefined);
      refreshForNewRelease();
    };

    checkForUpdates();
    window.addEventListener('pageshow', checkForUpdates);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdates();
    });
    window.setInterval(checkForUpdates, 60 * 1000);
    window.addEventListener('pagehide', () => {
      registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
    });
  }).catch(() => undefined);

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (window.__chatikaReloading) return;
    window.__chatikaReloading = true;
    window.location.reload();
  });

  window.__chatikaApplyUpdate = () => {
    window.__chatikaWaitingRegistration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
  };
}
