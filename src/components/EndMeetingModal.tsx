import React from 'react';
import { PhoneOff, X, LogOut, Users, AlertTriangle } from 'lucide-react';

interface EndMeetingModalProps {
  isHost: boolean;
  participantCount: number;
  onEndForAll: () => void;
  onLeave: () => void;
  onCancel: () => void;
}

export const EndMeetingModal: React.FC<EndMeetingModalProps> = ({
  isHost,
  participantCount,
  onEndForAll,
  onLeave,
  onCancel,
}) => {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden p-6 space-y-5 text-center">
        {/* Icon */}
        <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto shadow-inner">
          <PhoneOff className="w-7 h-7" />
        </div>

        {/* Text */}
        <div className="space-y-1.5">
          <h3 className="text-lg font-bold text-white tracking-tight">
            {isHost && participantCount > 1
              ? 'End Meeting or Leave?'
              : 'Leave Meeting?'}
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed px-2">
            {isHost && participantCount > 1
              ? 'As the host, you can end this meeting for everyone or leave and let the remaining participants continue.'
              : 'Are you sure you want to leave this video meeting? You can return at any time.'}
          </p>
        </div>

        {/* Buttons */}
        <div className="space-y-2.5 pt-2">
          {isHost && participantCount > 1 && (
            <button
              onClick={onEndForAll}
              className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-all shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 cursor-pointer"
            >
              <PhoneOff className="w-4 h-4" />
              <span>End Meeting for All</span>
            </button>
          )}

          <button
            onClick={onLeave}
            className={`w-full py-2.5 px-4 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
              isHost && participantCount > 1
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                : 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30'
            }`}
          >
            <LogOut className="w-4 h-4" />
            <span>Leave Meeting</span>
          </button>

          <button
            onClick={onCancel}
            className="w-full py-2 px-4 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-medium transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
