import React, { useEffect, useRef } from 'react';

export default function CallDialog({
  open,
  active,
  kind,
  incoming,
  localStream,
  remoteStreams,
  error,
  onStart,
  onAccept,
  onReject,
  onHangup,
  onClose
}) {
  const localVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream || null;
  }, [localStream]);

  if (!open && !incoming) return null;

  const remoteEntries = Object.entries(remoteStreams || {});
  const callKind = incoming?.kind || kind;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="call-dialog" role="dialog" aria-modal="true" aria-labelledby="call-title">
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">ROOM CALL</span>
            <h2 id="call-title">{incoming ? 'Incoming call' : `${callKind === 'video' ? 'Video' : 'Audio'} call`}</h2>
            <p>{incoming ? `@${incoming.username || 'A participant'} is calling you.` : 'Private peer-to-peer calling with adaptive quality.'}</p>
          </div>
          {!active && !incoming && <button className="icon-button" type="button" onClick={onClose} aria-label="Close call dialog">×</button>}
        </div>

        {error && <div className="notice-card error-card">{error}</div>}

        {incoming ? (
          <div className="incoming-call-card">
            <div className="call-avatar">{(incoming.username || '?').slice(0, 1).toUpperCase()}</div>
            <strong>@{incoming.username || 'participant'}</strong>
            <span>{incoming.kind === 'video' ? 'Video call' : 'Audio call'}</span>
          </div>
        ) : (
          <div className={callKind === 'video' ? 'call-stage video-call-stage' : 'call-stage audio-call-stage'}>
            {callKind === 'video' && localStream && <video ref={localVideoRef} className="call-video local-call-video" autoPlay muted playsInline />}
            {callKind === 'audio' && <div className="call-placeholder"><span className="call-glyph">◉</span><strong>Audio call</strong></div>}
            {remoteEntries.map(([userId, stream]) => (
              <RemoteCallMedia key={userId} userId={userId} stream={stream} video={callKind === 'video'} />
            ))}
            {!remoteEntries.length && <span className="call-status">Waiting for participants to join…</span>}
          </div>
        )}

        <div className="dialog-actions call-actions">
          {incoming ? (
            <>
              <button type="button" className="primary-button" onClick={onAccept}>Answer</button>
              <button type="button" className="danger-button" onClick={onReject}>Decline</button>
            </>
          ) : active ? (
            <button type="button" className="danger-button" onClick={onHangup}>End call</button>
          ) : (
            <>
              <button type="button" className="primary-button" onClick={() => onStart('audio')}>Start audio call</button>
              <button type="button" className="primary-button secondary-call-button" onClick={() => onStart('video')}>Start video call</button>
            </>
          )}
          {!active && !incoming && <button type="button" className="quiet-button" onClick={onClose}>Not now</button>}
        </div>
        <p className="compatibility-note">Calls work in current browsers over HTTPS on desktop, Android, and iOS. Microphone and camera permission is required.</p>
      </section>
    </div>
  );
}

function RemoteCallMedia({ userId, stream, video }) {
  const mediaRef = useRef(null);

  useEffect(() => {
    if (mediaRef.current) mediaRef.current.srcObject = stream;
  }, [stream]);

  return video ? (
    <div className="remote-call-media">
      <video ref={mediaRef} className="call-video" autoPlay playsInline />
      <span>Participant {userId.slice(0, 6)}</span>
    </div>
  ) : (
    <audio ref={mediaRef} autoPlay playsInline />
  );
}
