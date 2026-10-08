import React, { useEffect, useRef } from 'react';
import { MicOff, Pin, PinOff, Hand, Shield, Sparkles } from 'lucide-react';
import { Participant } from '../types';
import { virtualBackground } from '../services/virtualBackground';

interface VideoTileProps {
  participant: Participant;
  isPinned?: boolean;
  onTogglePin?: (id: string) => void;
  isSpeakerView?: boolean;
}

export const VideoTile: React.FC<VideoTileProps> = ({
  participant,
  isPinned = false,
  onTogglePin,
  isSpeakerView = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (participant.isLocal && canvasRef.current) {
      const c = canvasRef.current;
      virtualBackground.registerPreviewCanvas(c);
      return () => {
        virtualBackground.unregisterPreviewCanvas(c);
      };
    }
  }, [participant.isLocal]);

  useEffect(() => {
    if (videoRef.current) {
      const activeStream = participant.isScreenSharing
        ? participant.screenStream
        : participant.stream;

      if (activeStream && videoRef.current.srcObject !== activeStream) {
        videoRef.current.srcObject = activeStream;
      }
    }
  }, [participant.stream, participant.screenStream, participant.isScreenSharing]);

  const initials = participant.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  const avatarColor = participant.avatarColor || '#3b82f6';
  const showLocalCanvas = participant.isLocal && !participant.isScreenSharing && virtualBackground.isActive();

  return (
    <div
      className={`relative group rounded-xl overflow-hidden bg-slate-900 border transition-all duration-200 flex items-center justify-center select-none ${
        participant.isSpeaking
          ? 'border-emerald-500 ring-2 ring-emerald-500/50 shadow-lg shadow-emerald-500/20'
          : 'border-slate-800 hover:border-slate-700'
      } ${isSpeakerView ? 'w-full h-full' : 'aspect-video min-h-[140px]'}`}
    >
      {/* Zero-latency direct canvas for local user with virtual background */}
      {showLocalCanvas && (
        <canvas
          ref={canvasRef}
          className={`w-full h-full object-cover scale-x-[-1] ${
            participant.isVideoMuted ? 'hidden' : 'block'
          }`}
        />
      )}

      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={participant.isLocal} // Avoid local audio feedback
        className={`w-full h-full object-cover ${
          showLocalCanvas || (participant.isVideoMuted && !participant.isScreenSharing)
            ? 'hidden'
            : 'block'
        } ${participant.isLocal && !participant.isScreenSharing ? 'scale-x-[-1]' : ''}`}
      />

      {/* Avatar Fallback if camera is off */}
      {(participant.isVideoMuted && !participant.isScreenSharing) && (
        <div className="flex flex-col items-center justify-center p-4">
          <div
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center text-white text-2xl sm:text-3xl font-semibold shadow-xl ring-4 ring-slate-800 transition-transform transform group-hover:scale-105"
            style={{ backgroundColor: avatarColor }}
          >
            {initials}
          </div>
          <span className="mt-3 text-sm font-medium text-slate-300">
            {participant.name} {participant.isLocal && '(You)'}
          </span>
        </div>
      )}

      {/* Hand Raised Banner */}
      {participant.isHandRaised && (
        <div className="absolute top-3 left-3 bg-amber-500/90 backdrop-blur-md text-slate-950 font-semibold px-2.5 py-1 rounded-full text-xs flex items-center gap-1.5 shadow-lg animate-bounce">
          <Hand className="w-3.5 h-3.5" />
          <span>Hand Raised</span>
        </div>
      )}

      {/* Floating Reaction Bubble */}
      {participant.reaction && (
        <div className="absolute bottom-12 right-6 animate-fade-in-up pointer-events-none">
          <div className="text-4xl sm:text-5xl drop-shadow-xl filter animate-pulse">
            {participant.reaction.emoji}
          </div>
        </div>
      )}

      {/* Top Controls Overlay (Pin button) */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 z-10">
        {onTogglePin && (
          <button
            onClick={() => onTogglePin(participant.id)}
            title={isPinned ? 'Unpin participant' : 'Pin participant'}
            className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white backdrop-blur border border-slate-700/50 transition-colors"
          >
            {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Bottom Name & Status Tag */}
      <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-1.5 bg-slate-950/75 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-800/80 max-w-[85%] truncate">
          {participant.isAudioMuted ? (
            <MicOff className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          ) : participant.isSpeaking ? (
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
          ) : null}

          <span className="text-xs font-medium text-slate-200 truncate">
            {participant.name} {participant.isLocal && '(You)'}
          </span>

          {participant.isHost && (
            <span className="text-[10px] bg-blue-600/30 text-blue-400 border border-blue-500/30 px-1 rounded uppercase tracking-wider font-semibold shrink-0">
              Host
            </span>
          )}

          {participant.isScreenSharing && (
            <span className="text-[10px] bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 px-1 rounded uppercase tracking-wider font-semibold shrink-0">
              Presenting
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
