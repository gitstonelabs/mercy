// Webcam view shared by the Webcam page, the Console side module, and any
// dashboard widget. Renders by source type:
//   mjpeg     <img> on the multipart stream
//   snapshot  <img> re-fetched once a second (cache-busted)
//   webrtc    <video> over RTCPeerConnection (camera-streamer or go2rtc/WHEP)
//
// StrictMode note: stream/peer setup happens in the effect body and teardown
// only in cleanup. Dev double-invoke (mount, cleanup, mount) therefore ends
// with the stream restored; blanking via a render-time src attribute plus a
// cleanup wipe never recovered.

import { useEffect, useRef, useState } from 'react';
import { useConfig } from '../store';
import type { WebcamConfig } from '../store/config';

export type CamService = 'mjpeg' | 'snapshot' | 'webrtc';

export function camService(cam: Pick<WebcamConfig, 'streamUrl'> & { service?: CamService }): CamService {
  if (cam.service) return cam.service;
  // Old persisted configs predate the service field. Default unknowns to
  // mjpeg, not webrtc: a wrong mjpeg guess fails visibly and recoverably,
  // while a wrong webrtc guess used to render a dead placeholder.
  if (cam.streamUrl.includes('action=snapshot')) return 'snapshot';
  return 'mjpeg';
}

// Map a Moonraker /server/webcams/list service name onto a renderer.
// Explicit names, not substring guessing: Detect used to collapse every
// non-webrtc service to mjpeg (dropping snapshot-only cams) while camService
// tagged any non-action=stream URL as webrtc. Unknown services stay mjpeg.
export function mapMoonrakerService(service: string): CamService {
  const s = service.toLowerCase();
  if (s.includes('webrtc')) return 'webrtc';                 // webrtc-camerastreamer, webrtc-go2rtc, webrtc-mediamtx
  if (s === 'jpegsnapshot' || s.includes('snapshot')) return 'snapshot';
  return 'mjpeg';                                            // mjpegstreamer, mjpegstreamer-adaptive, ustreamer, ipstream, unknown
}

// ---- WebRTC negotiation (ported from v1) ----
// Two dialects share the configured URL:
//   camera-streamer (crowsnest's webrtc service): POST {type:'request'} ->
//     {type:'offer', id, sdp}; we answer with {type:'remote', id, sdp}.
//   go2rtc / WHEP-style: WE make the offer; POST its SDP (application/sdp)
//     and the body of the response is the answer SDP.
// Try the camera-streamer JSON probe first, fall back to WHEP.

function iceComplete(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise<void>((resolve) => {
    // LAN peers produce host candidates immediately; cap the wait so a
    // missing STUN server (offline kiosk) cannot stall negotiation.
    const timer = window.setTimeout(done, 2000);
    function done() {
      pc.removeEventListener('icegatheringstatechange', check);
      window.clearTimeout(timer);
      resolve();
    }
    function check() {
      if (pc.iceGatheringState === 'complete') done();
    }
    pc.addEventListener('icegatheringstatechange', check);
  });
}

async function connectWebRtc(url: string, onTrack: (stream: MediaStream) => void): Promise<RTCPeerConnection> {
  // camera-streamer probe.
  let offer: { type?: string; id?: string; sdp?: string; iceServers?: RTCIceServer[] } | null = null;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'request' }),
    });
    if (res.ok) {
      const body = (await res.json().catch(() => null)) as { type?: string; id?: string; sdp?: string; iceServers?: RTCIceServer[] } | null;
      if (body && body.type === 'offer' && typeof body.sdp === 'string') offer = body;
    }
  } catch {
    // Not camera-streamer; try WHEP below.
  }

  if (offer) {
    const pc = new RTCPeerConnection({ iceServers: offer.iceServers ?? [] });
    pc.ontrack = (ev) => {
      if (ev.streams[0]) onTrack(ev.streams[0]);
    };
    try {
      await pc.setRemoteDescription({ type: 'offer', sdp: offer.sdp! });
      await pc.setLocalDescription(await pc.createAnswer());
      await iceComplete(pc);
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'remote', id: offer.id, sdp: pc.localDescription?.sdp ?? '' }),
      });
      return pc;
    } catch (e) {
      pc.close();
      throw e;
    }
  }

  // WHEP / go2rtc.
  const pc = new RTCPeerConnection();
  pc.ontrack = (ev) => {
    if (ev.streams[0]) onTrack(ev.streams[0]);
  };
  try {
    pc.addTransceiver('video', { direction: 'recvonly' });
    await pc.setLocalDescription(await pc.createOffer());
    await iceComplete(pc);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: pc.localDescription?.sdp ?? '',
    });
    if (!res.ok) throw new Error(`webrtc endpoint returned ${res.status}`);
    const sdp = await res.text();
    await pc.setRemoteDescription({ type: 'answer', sdp });
    return pc;
  } catch (e) {
    pc.close();
    throw e;
  }
}

export function WebcamView({ minHeight = 160, cam }: { minHeight?: number; cam?: WebcamConfig }) {
  const configured = useConfig((s) => s.webcam);
  const webcam = cam ?? configured;
  const service = camService(webcam);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [rtcError, setRtcError] = useState<string | null>(null);
  const [rtcRetry, setRtcRetry] = useState(0);

  const streamUrl = webcam.streamUrl;
  const snapshotUrl = webcam.snapshotUrl || streamUrl.replace('action=stream', 'action=snapshot');
  const showImg =
    webcam.enabled && service !== 'webrtc' && (service === 'mjpeg' ? Boolean(streamUrl) : Boolean(snapshotUrl));
  // Keep the <video> mounted through an error so Retry has an element to
  // attach to; the error renders as an overlay instead.
  const showVideo = webcam.enabled && service === 'webrtc' && Boolean(streamUrl);

  useEffect(() => {
    const img = imgRef.current;
    if (!img || !showImg) return;

    if (service === 'mjpeg') {
      img.src = streamUrl;
      return () => {
        // Kill the multipart connection on true unmount / source change; page
        // hops must not leak connections toward the per-host cap.
        img.src = '';
      };
    }

    // snapshot: poll with a cache-buster.
    let alive = true;
    const tick = () => {
      if (!alive) return;
      img.src = `${snapshotUrl}${snapshotUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => {
      alive = false;
      window.clearInterval(timer);
      img.src = '';
    };
  }, [service, streamUrl, snapshotUrl, showImg]);

  useEffect(() => {
    if (service !== 'webrtc' || !webcam.enabled || !streamUrl) return;
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    let pc: RTCPeerConnection | null = null;
    setRtcError(null);
    connectWebRtc(streamUrl, (stream) => {
      if (cancelled || !videoRef.current) return;
      videoRef.current.srcObject = stream;
      void videoRef.current.play().catch(() => {});
    })
      .then((conn) => {
        if (cancelled) {
          conn.close();
          return;
        }
        pc = conn;
        conn.onconnectionstatechange = () => {
          if (!cancelled && (conn.connectionState === 'failed' || conn.connectionState === 'closed')) {
            setRtcError(`peer connection ${conn.connectionState}`);
          }
        };
      })
      .catch((e) => {
        if (!cancelled) setRtcError(e instanceof Error ? e.message : 'negotiation failed');
      });
    return () => {
      cancelled = true;
      pc?.close();
      video.srcObject = null;
    };
  }, [service, streamUrl, webcam.enabled, rtcRetry]);

  return (
    <div
      className="sl-inset"
      style={{
        position: 'relative',
        flex: 1,
        minHeight,
        borderRadius: 10,
        background: 'radial-gradient(90% 90% at 50% 40%, #101625 0%, #070a12 70%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {showImg && <img ref={imgRef} alt={webcam.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
      {showVideo && (
        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      )}
      {showVideo && rtcError && (
        <span style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'rgba(5,6,13,.72)', font: "400 12px/1.6 'Manrope', sans-serif", color: 'var(--txd)', textAlign: 'center', padding: 16 }}>
          WebRTC stream failed: {rtcError}
          <button className="sl-btn" style={{ height: 28, fontSize: 11 }} onClick={() => setRtcRetry((n) => n + 1)}>
            Retry
          </button>
        </span>
      )}
      {!showImg && !showVideo && (
        <span style={{ font: "400 12px/1.6 'Manrope', sans-serif", color: 'var(--txd)', textAlign: 'center', padding: 16 }}>
          {webcam.enabled
            ? 'No stream URL set. Add one in Settings, or use Detect cameras.'
            : 'Webcam is disabled. Enable it in Settings.'}
        </span>
      )}
    </div>
  );
}
