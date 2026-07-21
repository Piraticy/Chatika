import React, { useEffect, useRef, useState } from 'react';

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

export default function CallDialog({
  open,
  active,
  kind,
  incoming,
  localStream,
  remoteStreams,
  error,
  connectionStatus,
  targetLabel,
  participantNames,
  muted,
  cameraOff,
  onStart,
  onAccept,
  onReject,
  onHangup,
  onClose,
  onToggleMute,
  onToggleCamera
}) {
  const localVideoRef = useRef(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return undefined;
    }
    if (connectionStatus !== 'Live') return undefined;
    const startedAt = Date.now() - (elapsed * 1000);
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [active, connectionStatus]);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream || null;
  }, [localStream]);

  if (!open && !incoming) return null;

  const remoteEntries = Object.entries(remoteStreams || {});
  const callKind = incoming?.kind || kind;
  const isVideo = callKind === 'video';
  const status = incoming ? 'Incoming' : active ? connectionStatus || 'Connecting' : 'Ready';
  const callDescription = incoming
    ? `@${incoming.username || 'A participant'} is calling you.`
    : active
      ? `${status === 'Live' ? 'Connected with' : 'Calling'} ${targetLabel || 'room participants'}.`
      : 'Private calling with adaptive quality and secure peer-to-peer media.';

  return (
    <div className="modal-backdrop call-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="call-dialog" role="dialog" aria-modal="true" aria-labelledby="call-title">
        <header className="call-dialog-header">
          <div>
            <div className="call-kicker"><span className="live-pulse" /> ROOM CALL</div>
            <h2 id="call-title">{incoming ? 'Incoming call' : `${isVideo ? 'Video' : 'Audio'} call`}</h2>
            <p>{callDescription}</p>
          </div>
          <div className={`call-status-chip ${status.toLowerCase()}`}><span className="status-dot" />{status}{active && status === 'Live' && <b>{formatDuration(elapsed)}</b>}</div>
          {!active && !incoming && <button className="icon-button" type="button" onClick={onClose} aria-label="Close call dialog">×</button>}
        </header>

        {error && <div className="notice-card error-card">{error}</div>}

        {incoming ? (
          <div className="incoming-call-card">
            <div className="call-avatar call-avatar-large">{(incoming.username || '?').slice(0, 1).toUpperCase()}</div>
            <strong>@{incoming.username || 'participant'}</strong>
            <span>{isVideo ? 'Video call' : 'Audio call'} · Chatika room</span>
            <div className="incoming-wave" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div>
          </div>
        ) : (
          <div className={isVideo ? 'call-stage video-call-stage' : 'call-stage audio-call-stage'}>
            <div className="call-stage-toolbar"><span>{targetLabel || 'Private room'}</span><span>{status}</span></div>
            {isVideo && localStream && <video ref={localVideoRef} className={`call-video local-call-video ${cameraOff ? 'is-hidden' : ''}`} autoPlay muted playsInline />}
            {!isVideo && !remoteEntries.length && <div className="call-placeholder"><div className="call-glyph"><span>☎</span></div><strong>{status === 'Connecting' ? `Calling ${targetLabel || 'participant'}` : 'Ready when you are'}</strong><small>{status === 'Connecting' ? 'Waiting for them to answer' : 'Audio is protected in this room'}</small></div>}
            {isVideo && !remoteEntries.length && <div className="call-placeholder"><div className="call-glyph"><span>▣</span></div><strong>{status === 'Connecting' ? `Calling ${targetLabel || 'participant'}` : 'Waiting for participants'}</strong><small>They will appear here when they join</small></div>}
            {remoteEntries.map(([userId, stream]) => (
              <RemoteCallMedia key={userId} userId={userId} username={participantNames?.[userId]} stream={stream} video={isVideo} />
            ))}
          </div>
        )}

        <div className="call-control-bar">
          {incoming ? (
            <>
              <button type="button" className="call-control accept-control" onClick={onAccept}><span>☎</span>Answer</button>
              <button type="button" className="call-control decline-control" onClick={onReject}><span>×</span>Decline</button>
            </>
          ) : active ? (
            <>
              <button type="button" className={`call-control ${muted ? 'control-on' : ''}`} onClick={onToggleMute}><span>{muted ? '×' : '●'}</span>{muted ? 'Unmute' : 'Mute'}</button>
              {isVideo && <button type="button" className={`call-control ${cameraOff ? 'control-on' : ''}`} onClick={onToggleCamera}><span>{cameraOff ? '×' : '▣'}</span>{cameraOff ? 'Camera on' : 'Camera off'}</button>}
              <button type="button" className="call-control end-control" onClick={onHangup}><span>×</span>End</button>
            </>
          ) : (
            <>
              <button type="button" className="call-control accept-control" onClick={() => onStart('audio')}><span>☎</span>Start audio</button>
              <button type="button" className="call-control video-control" onClick={() => onStart('video')}><span>▣</span>Start video</button>
              <button type="button" className="quiet-button" onClick={onClose}>Not now</button>
            </>
          )}
        </div>
        <p className="compatibility-note">Works over HTTPS on current desktop, Android, and iOS browsers. Allow microphone/camera access when prompted. TURN servers are recommended for restrictive networks.</p>
      </section>
    </div>
  );
}

function RemoteCallMedia({ userId, username, stream, video }) {
  const mediaRef = useRef(null);

  useEffect(() => {
    if (mediaRef.current) mediaRef.current.srcObject = stream;
  }, [stream]);

  if (video) {
    return (
      <div className="remote-call-media">
        <video ref={mediaRef} className="call-video" autoPlay playsInline />
        <span>@{username || userId.slice(0, 6)}</span>
      </div>
    );
  }

  return (
    <div className="audio-participant">
      <div className="call-avatar">{(username || userId).slice(0, 1).toUpperCase()}</div>
      <strong>@{username || userId.slice(0, 8)}</strong>
      <small>Connected</small>
      <audio ref={mediaRef} autoPlay playsInline />
    </div>
  );
}
