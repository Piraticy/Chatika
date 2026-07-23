import React, { useEffect, useRef } from 'react';

export default function ScreenShareDialog({
  open,
  supported,
  isMobile,
  unavailableMessage,
  active,
  localStream,
  remoteStreams,
  error,
  dataSaver,
  onStart,
  onStop,
  onClose,
  onToggleDataSaver
}) {
  const localVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream || null;
  }, [localStream]);

  if (!open) return null;

  const remoteEntries = Object.entries(remoteStreams || {});

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-title">
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">ROOM COLLABORATION</span>
            <h2 id="share-title">Share your screen</h2>
            <p>Private peer-to-peer sharing with adaptive quality.</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close screen share dialog"><ShareIcon name="close" /></button>
        </div>

        {!supported && (
          <div className="notice-card warning share-availability-card">
            <strong>{isMobile ? 'Screen viewing is ready on this device.' : 'Screen capture is unavailable in this browser.'}</strong>
            <span>{unavailableMessage}</span>
          </div>
        )}

        {error && <div className="notice-card error-card">{error}</div>}

        <div className="share-stage">
          {active && localStream ? (
            <video ref={localVideoRef} className="share-video" autoPlay muted playsInline />
          ) : (
            <div className="share-placeholder">
              <span className="share-glyph"><ShareIcon name="screen" /></span>
              <strong>Ready when you are</strong>
              <span>Your screen stays peer-to-peer. Chat messages keep working in the background.</span>
            </div>
          )}
          {remoteEntries.map(([userId, stream]) => (
            <RemoteVideo key={userId} userId={userId} stream={stream} />
          ))}
        </div>

        <div className="share-options">
          <label className="toggle-row">
            <span>
              <strong>Data saver</strong>
              <small>Cap screen share at 720p / 15 fps</small>
            </span>
            <input type="checkbox" checked={dataSaver} onChange={onToggleDataSaver} />
          </label>
          <span className="quality-note"><span className="status-dot" /> {active ? 'Sharing securely' : 'No data used yet'}</span>
        </div>

        <div className="dialog-actions">
          {active ? (
            <button type="button" className="danger-button premium-dialog-button" onClick={onStop}><ShareIcon name="stop" />Stop sharing</button>
          ) : (
            <button type="button" className="primary-button premium-dialog-button" onClick={onStart} disabled={!supported}><ShareIcon name="screen" />{supported ? 'Choose a screen' : isMobile ? 'View-only on this browser' : 'Screen sharing unavailable'}</button>
          )}
          <button type="button" className="quiet-button premium-dialog-button" onClick={onClose}>Close</button>
        </div>
      </section>
    </div>
  );
}

function ShareIcon({ name }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (name === 'screen') return <svg viewBox="0 0 24 24" aria-hidden="true"><rect {...common} x="3" y="4" width="18" height="13" rx="2" /><path {...common} d="M8 21h8M12 17v4" /></svg>;
  if (name === 'stop') return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="m6 6 12 12M18 6 6 18" /></svg>;
}

function RemoteVideo({ userId, stream }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <div className="remote-video-wrap">
      <video ref={videoRef} className="share-video" autoPlay playsInline />
      <span>Participant {userId.slice(0, 6)}</span>
    </div>
  );
}
