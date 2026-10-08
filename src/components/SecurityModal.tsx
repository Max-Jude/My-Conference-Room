import React from 'react';
import {
  Shield,
  X,
  Lock,
  Unlock,
  Users,
  Monitor,
  MessageSquare,
  Mic,
  PenTool,
  Check,
} from 'lucide-react';
import { MeetingSettings } from '../types';

interface SecurityModalProps {
  settings: MeetingSettings;
  waitingCount?: number;
  onOpenWaitingRoom?: () => void;
  onUpdateSettings: (newSettings: Partial<MeetingSettings>) => void;
  onClose: () => void;
}

export const SecurityModal: React.FC<SecurityModalProps> = ({
  settings,
  waitingCount = 0,
  onOpenWaitingRoom,
  onUpdateSettings,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-white">Meeting Security</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Host Security Controls
          </div>

          {/* Lock Meeting Toggle */}
          <div
            onClick={() => onUpdateSettings({ isLocked: !settings.isLocked })}
            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
              settings.isLocked
                ? 'bg-rose-950/30 border-rose-800/60 text-rose-200'
                : 'bg-slate-800/60 border-slate-700/60 text-slate-200 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-3">
              {settings.isLocked ? (
                <Lock className="w-4 h-4 text-rose-400" />
              ) : (
                <Unlock className="w-4 h-4 text-slate-400" />
              )}
              <div>
                <div className="text-sm font-medium">Lock Meeting</div>
                <div className="text-[11px] text-slate-400">
                  {settings.isLocked
                    ? 'Meeting is locked. No new participants can join.'
                    : 'Prevent any new participants from joining.'}
                </div>
              </div>
            </div>
            <div
              className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                settings.isLocked
                  ? 'bg-rose-600 border-rose-500 text-white'
                  : 'border-slate-600'
              }`}
            >
              {settings.isLocked && <Check className="w-3.5 h-3.5" />}
            </div>
          </div>

          {/* Waiting Room Toggle */}
          <div
            onClick={() =>
              onUpdateSettings({
                waitingRoomEnabled: !settings.waitingRoomEnabled,
              })
            }
            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
              settings.waitingRoomEnabled
                ? 'bg-blue-950/30 border-blue-800/60 text-blue-200'
                : 'bg-slate-800/60 border-slate-700/60 text-slate-200 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4 text-blue-400" />
              <div>
                <div className="text-sm font-medium">Enable Waiting Room</div>
                <div className="text-[11px] text-slate-400">
                  Admit participants before they can enter meeting.
                </div>
              </div>
            </div>
            <div
              className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                settings.waitingRoomEnabled
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'border-slate-600'
              }`}
            >
              {settings.waitingRoomEnabled && <Check className="w-3.5 h-3.5" />}
            </div>
          </div>

          <div className="pt-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Allow Participants To:
            </div>
            <div className="space-y-2">
              {/* Share Screen */}
              <label
                onClick={() =>
                  onUpdateSettings({ allowScreenShare: !settings.allowScreenShare })
                }
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/40 hover:bg-slate-800/80 border border-slate-800 cursor-pointer"
              >
                <div className="flex items-center gap-2.5 text-xs text-slate-300">
                  <Monitor className="w-4 h-4 text-slate-400" />
                  <span>Share Screen</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.allowScreenShare}
                  readOnly
                  className="rounded accent-blue-600"
                />
              </label>

              {/* Chat */}
              <label
                onClick={() =>
                  onUpdateSettings({ allowChat: !settings.allowChat })
                }
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/40 hover:bg-slate-800/80 border border-slate-800 cursor-pointer"
              >
                <div className="flex items-center gap-2.5 text-xs text-slate-300">
                  <MessageSquare className="w-4 h-4 text-slate-400" />
                  <span>Send Chat Messages</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.allowChat}
                  readOnly
                  className="rounded accent-blue-600"
                />
              </label>

              {/* Unmute themselves */}
              <label
                onClick={() =>
                  onUpdateSettings({ allowUnmute: !settings.allowUnmute })
                }
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/40 hover:bg-slate-800/80 border border-slate-800 cursor-pointer"
              >
                <div className="flex items-center gap-2.5 text-xs text-slate-300">
                  <Mic className="w-4 h-4 text-slate-400" />
                  <span>Unmute Themselves</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.allowUnmute}
                  readOnly
                  className="rounded accent-blue-600"
                />
              </label>

              {/* Whiteboard */}
              <label
                onClick={() =>
                  onUpdateSettings({ allowWhiteboard: !settings.allowWhiteboard })
                }
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/40 hover:bg-slate-800/80 border border-slate-800 cursor-pointer"
              >
                <div className="flex items-center gap-2.5 text-xs text-slate-300">
                  <PenTool className="w-4 h-4 text-slate-400" />
                  <span>Use Collaborative Whiteboard</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.allowWhiteboard}
                  readOnly
                  className="rounded accent-blue-600"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
          >
            Apply Settings
          </button>
        </div>
      </div>
    </div>
  );
};
