import React, { useEffect, useRef } from 'react';

export default function ScreenShareDialog({
  open,
  supported,
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
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close screen share dialog">×</button>
        </div>

        {!supported && (
          <div className="notice-card warning">
            <strong>Screen capture is not available here.</strong>
            <span>Use a current HTTPS desktop browser. Android and iOS browsers can join calls and watch shared screens; capturing a mobile screen requires a native app wrapper with OS capture permission.</span>
          </div>
        )}

        {error && <div className="notice-card error-card">{error}</div>}

        <div className="share-stage">
          {active && localStream ? (
            <video ref={localVideoRef} className="share-video" autoPlay muted playsInline />
          ) : (
            <div className="share-placeholder">
              <span className="share-glyph">▣</span>
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
            <button type="button" className="danger-button" onClick={onStop}>Stop sharing</button>
          ) : (
            <button type="button" className="primary-button" onClick={onStart} disabled={!supported}>Choose a screen</button>
          )}
          <button type="button" className="quiet-button" onClick={onClose}>Not now</button>
        </div>
        <p className="compatibility-note">Works best in current Chrome, Edge, Firefox, and Safari over HTTPS. Cross-network sharing needs a configured TURN server in production; mobile capture requires native iOS/Android screen-capture modules.</p>
      </section>
    </div>
  );
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
