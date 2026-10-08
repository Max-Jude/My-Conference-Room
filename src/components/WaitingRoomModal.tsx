import React from 'react';
import { Users, Check, X, Shield, Clock } from 'lucide-react';
import { Participant } from '../types';

interface WaitingRoomModalProps {
  waitingParticipants: Participant[];
  onAdmit: (userId: string) => void;
  onDeny: (userId: string) => void;
  onAdmitAll: () => void;
  onClose: () => void;
}

export const WaitingRoomModal: React.FC<WaitingRoomModalProps> = ({
  waitingParticipants,
  onAdmit,
  onDeny,
  onAdmitAll,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            <h3 className="font-semibold text-white">Waiting Room Queue</h3>
            <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-medium">
              {waitingParticipants.length} Waiting
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-80 overflow-y-auto">
          {waitingParticipants.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-xs">
              No participants currently waiting in the queue.
            </div>
          ) : (
            waitingParticipants.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700/60"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: p.avatarColor || '#3b82f6' }}
                  >
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <span className="text-sm font-medium text-slate-200">
                      {p.name}
                    </span>
                    <p className="text-[10px] text-slate-400">Requesting entry</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onAdmit(p.id)}
                    className="p-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 text-white transition-colors text-xs flex items-center gap-1 font-medium px-2.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Admit
                  </button>
                  <button
                    onClick={() => onDeny(p.id)}
                    className="p-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white transition-colors text-xs flex items-center gap-1 font-medium px-2.5"
                  >
                    <X className="w-3.5 h-3.5" />
                    Deny
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex justify-between items-center">
          {waitingParticipants.length > 1 && (
            <button
              onClick={onAdmitAll}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition-colors"
            >
              Admit All
            </button>
          )}
          <button
            onClick={onClose}
            className="ml-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
