import React, { useEffect, useRef, useState } from 'react';
import { resolveMediaUrl } from '../lib/api';

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
  targetProfile,
  participantNames,
  participantProfiles,
  muted,
  cameraOff,
  speakerOn,
  onStart,
  onAccept,
  onReject,
  onHangup,
  onClose,
  onToggleMute,
  onToggleCamera,
  onToggleSpeaker
}) {
  const localVideoRef = useRef(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!active || connectionStatus !== 'Live') {
      setElapsed(0);
      return undefined;
    }
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [active, connectionStatus]);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream || null;
  }, [localStream]);

  if (!open && !incoming) return null;

  const remoteEntries = Object.entries(remoteStreams || {});
  const isVideo = (incoming?.kind || kind) === 'video';
  const status = incoming ? 'Incoming' : active ? connectionStatus || 'Connecting' : 'Ready';
  const incomingProfile = incoming
    ? Object.values(participantProfiles || {}).find((profile) => profile.username === incoming.username) || { username: incoming.username }
    : null;
  const displayProfile = incomingProfile || targetProfile || { username: String(targetLabel || 'Chatika').replace(/^@/, '') };
  const displayName = displayProfile?.username ? `@${displayProfile.username}` : targetLabel || 'Chatika contact';

  return (
    <div className="modal-backdrop call-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !active && onClose()}>
      <section className={`call-dialog portrait-call-dialog ${isVideo ? 'is-video' : 'is-audio'}`} role="dialog" aria-modal="true" aria-labelledby="call-title">
        <header className="call-dialog-header compact-call-header">
          <div>
            <div className="call-kicker">CHATIKA {isVideo ? 'VIDEO' : 'AUDIO'}</div>
            <h2 id="call-title">{incoming ? 'Incoming call' : displayName}</h2>
          </div>
          <div className={`call-status-chip ${status.toLowerCase()}`}><span className="status-dot" />{status}{active && status === 'Live' && <b>{formatDuration(elapsed)}</b>}</div>
          {!active && !incoming && <button className="icon-button" type="button" onClick={onClose} aria-label="Close call dialog"><CallIcon name="close" /></button>}
        </header>

        {error && <div className="notice-card error-card">{error}</div>}

        <div className="portrait-call-stage">
          {isVideo && remoteEntries.map(([userId, stream]) => (
            <RemoteCallMedia key={userId} userId={userId} username={participantNames?.[userId]} profile={participantProfiles?.[userId]} stream={stream} video speakerOn={speakerOn} />
          ))}

          {(!isVideo || !remoteEntries.length) && (
            <div className="call-contact-card">
              <CallAvatar profile={displayProfile} large />
              <strong>{displayName}</strong>
              <span>{incoming ? `Incoming ${isVideo ? 'video' : 'audio'} call` : status === 'Live' ? formatDuration(elapsed) : status === 'Ringing' ? 'Ringing…' : 'Connecting…'}</span>
              {status !== 'Live' && <div className="incoming-wave" aria-hidden="true"><i /><i /><i /><i /><i /></div>}
            </div>
          )}

          {!isVideo && remoteEntries.map(([userId, stream]) => (
            <RemoteCallMedia key={userId} userId={userId} username={participantNames?.[userId]} profile={participantProfiles?.[userId]} stream={stream} speakerOn={speakerOn} />
          ))}

          {isVideo && localStream && <video ref={localVideoRef} className={`call-video local-call-video ${cameraOff ? 'is-hidden' : ''}`} autoPlay muted playsInline />}
        </div>

        <div className="call-control-bar compact-call-controls">
          {incoming ? (
            <>
              <button type="button" className="call-control accept-control" onClick={onAccept}><CallIcon name="phone" /><span>Answer</span></button>
              <button type="button" className="call-control decline-control" onClick={onReject}><CallIcon name="close" /><span>Decline</span></button>
            </>
          ) : active ? (
            <>
              <button type="button" className={`call-control ${muted ? 'control-on' : ''}`} onClick={onToggleMute}><CallIcon name={muted ? 'micOff' : 'mic'} /><span>{muted ? 'Unmute' : 'Mute'}</span></button>
              <button type="button" className={`call-control speaker-control ${speakerOn ? 'control-on' : ''}`} onClick={onToggleSpeaker}><CallIcon name={speakerOn ? 'speaker' : 'speakerOff'} /><span>{speakerOn ? 'Speaker' : 'Muted'}</span></button>
              {isVideo && <button type="button" className={`call-control ${cameraOff ? 'control-on' : ''}`} onClick={onToggleCamera}><CallIcon name={cameraOff ? 'videoOff' : 'video'} /><span>{cameraOff ? 'Camera on' : 'Camera off'}</span></button>}
              <button type="button" className="call-control end-control" onClick={onHangup}><CallIcon name="phoneOff" /><span>End</span></button>
            </>
          ) : (
            <>
              <button type="button" className="call-control accept-control" onClick={() => onStart('audio')}><CallIcon name="phone" /><span>Audio</span></button>
              <button type="button" className="call-control video-control" onClick={() => onStart('video')}><CallIcon name="video" /><span>Video</span></button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function CallAvatar({ profile, large = false }) {
  if (profile?.avatar_url) return <img className={`call-profile-photo ${large ? 'large' : ''}`} src={resolveMediaUrl(profile.avatar_url)} alt="" />;
  return <div className={`call-avatar ${large ? 'call-avatar-large' : ''}`}>{(profile?.username || '?').slice(0, 1).toUpperCase()}</div>;
}

function RemoteCallMedia({ userId, username, profile, stream, video, speakerOn }) {
  const mediaRef = useRef(null);
  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;
    media.srcObject = stream;
    // Real earpiece/speaker output routing (setSinkId) isn't available in Safari/WebKit,
    // so this can only toggle whether remote audio is actually audible, not which
    // physical output it plays from.
    media.volume = speakerOn ? 1 : 0;
    media.muted = !speakerOn;
    if (speakerOn && typeof media.setSinkId === 'function') media.setSinkId('default').catch(() => undefined);
  }, [speakerOn, stream]);
  if (video) return <div className="remote-call-media portrait-remote-video"><video ref={mediaRef} className="call-video" autoPlay playsInline /><span>@{username || userId.slice(0, 6)}</span></div>;
  return <audio ref={mediaRef} className="remote-call-audio" autoPlay playsInline />;
}

function CallIcon({ name }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (name === 'phone') return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M7 4 9.4 8.5l-2 2.1a15 15 0 0 0 6 6l2.1-2L20 17l-.8 3a2 2 0 0 1-2 1.4A16.4 16.4 0 0 1 2.6 6.8 2 2 0 0 1 4 4.8L7 4Z" /></svg>;
  if (name === 'phoneOff') return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M5 15.5c4.7-3.3 9.3-3.3 14 0M7.5 14l-1 4M16.5 14l1 4" /></svg>;
  if (name === 'video' || name === 'videoOff') return <svg viewBox="0 0 24 24" aria-hidden="true"><rect {...common} x="3" y="6" width="12" height="12" rx="3" /><path {...common} d="m15 10 5-3v10l-5-3" />{name === 'videoOff' && <path {...common} d="M4 4 20 20" />}</svg>;
  if (name === 'mic' || name === 'micOff') return <svg viewBox="0 0 24 24" aria-hidden="true"><rect {...common} x="9" y="3" width="6" height="12" rx="3" /><path {...common} d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" />{name === 'micOff' && <path {...common} d="M4 4 20 20" />}</svg>;
  if (name === 'speaker' || name === 'speakerOff') return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 10v4h4l5 4V6l-5 4H4Z" /><path {...common} d="M16 9.5a4 4 0 0 1 0 5M18.5 7a7.5 7.5 0 0 1 0 10" />{name === 'speakerOff' && <path {...common} d="M4 4 20 20" />}</svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="m6 6 12 12M18 6 6 18" /></svg>;
}
