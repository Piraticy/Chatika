import React, { useEffect, useState } from 'react';

export default function AppLifecyclePrompts() {
  const [install, setInstall] = useState(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    function showInstall(event) {
      setInstall(event.detail || {});
    }
    function showUpdate() {
      setUpdateAvailable(true);
    }
    function hideInstall() {
      setInstall(null);
    }

    window.addEventListener('chatika:install-available', showInstall);
    window.addEventListener('chatika:install-complete', hideInstall);
    window.addEventListener('chatika:update-available', showUpdate);
    return () => {
      window.removeEventListener('chatika:install-available', showInstall);
      window.removeEventListener('chatika:install-complete', hideInstall);
      window.removeEventListener('chatika:update-available', showUpdate);
    };
  }, []);

  async function installApp() {
    if (install?.ios) {
      setInstall({ ...install, acknowledged: true });
      return;
    }
    const accepted = await window.__chatikaInstall?.();
    if (accepted) setInstall(null);
  }

  function applyUpdate() {
    window.__chatikaApplyUpdate?.();
  }

  return (
    <>
      {install && !install.acknowledged && (
        <aside className="lifecycle-toast install-toast" role="status">
          <div className="lifecycle-icon">↗</div>
          <div className="lifecycle-copy">
            <strong>Keep Chatika close</strong>
            <span>{install.ios ? 'Tap Share, then “Add to Home Screen” to hide Safari controls and open Chatika full screen.' : 'Install the app for faster access and a full-screen workspace.'}</span>
          </div>
          <button type="button" className="lifecycle-action" onClick={installApp}>{install.ios ? 'How to' : 'Install'}</button>
          <button type="button" className="lifecycle-dismiss" onClick={() => setInstall(null)} aria-label="Dismiss install prompt">×</button>
        </aside>
      )}
      {updateAvailable && (
        <aside className="lifecycle-toast update-toast" role="status">
          <div className="lifecycle-icon">↑</div>
          <div className="lifecycle-copy">
            <strong>A fresher Chatika is ready</strong>
            <span>Update now, or it will apply automatically the next time you restart.</span>
          </div>
          <button type="button" className="lifecycle-action" onClick={applyUpdate}>Update</button>
          <button type="button" className="lifecycle-dismiss" onClick={() => setUpdateAvailable(false)} aria-label="Dismiss update prompt">×</button>
        </aside>
      )}
    </>
  );
}
