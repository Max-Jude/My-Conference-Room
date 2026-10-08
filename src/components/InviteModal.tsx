import React, { useState } from 'react';
import { X, Copy, Check, Share2, Mail, ExternalLink, QrCode } from 'lucide-react';

interface InviteModalProps {
  roomId: string;
  passcode?: string;
  onClose: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({
  roomId,
  passcode = '123456',
  onClose,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedInvitation, setCopiedInvitation] = useState(false);

  const inviteUrl = `${window.location.origin}/?room=${encodeURIComponent(roomId)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyInvitation = () => {
    const text = `Join OpenRoom Meeting:
Meeting URL: ${inviteUrl}
Meeting ID: ${roomId}
Passcode: ${passcode}`;
    navigator.clipboard.writeText(text);
    setCopiedInvitation(true);
    setTimeout(() => setCopiedInvitation(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-white">Invite People</h3>
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
          {/* Meeting ID & Passcode Card */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Meeting ID:</span>
              <span className="font-mono font-bold text-white tracking-wide">
                {roomId}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Passcode:</span>
              <span className="font-mono font-bold text-white tracking-wide">
                {passcode}
              </span>
            </div>
          </div>

          {/* Direct Link */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Invite Link
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 select-all focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0 shadow-md"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedLink ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="pt-2 grid grid-cols-2 gap-2">
            <button
              onClick={handleCopyInvitation}
              className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition-colors flex items-center justify-center gap-2"
            >
              {copiedInvitation ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-blue-400" />
              )}
              {copiedInvitation ? 'Copied Invite' : 'Copy Invitation'}
            </button>

            <a
              href={`mailto:?subject=Join OpenRoom Meeting: ${roomId}&body=${encodeURIComponent(
                `Join my OpenRoom meeting at ${inviteUrl}\nMeeting ID: ${roomId}\nPasscode: ${passcode}`
              )}`}
              className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Mail className="w-3.5 h-3.5 text-indigo-400" />
              Email Invite
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
