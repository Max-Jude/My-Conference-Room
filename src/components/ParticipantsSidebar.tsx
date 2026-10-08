import React, { useState } from 'react';
import {
  X,
  Search,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Hand,
  MoreVertical,
  Shield,
  UserCheck,
  UserMinus,
  VolumeX,
  UserPlus,
} from 'lucide-react';
import { Participant } from '../types';

interface ParticipantsSidebarProps {
  participants: Participant[];
  localParticipant: Participant;
  isHost: boolean;
  waitingCount?: number;
  onOpenWaitingRoom?: () => void;
  onClose: () => void;
  onMuteAll: () => void;
  onLowerAllHands: () => void;
  onMuteParticipant: (id: string) => void;
  onKickParticipant: (id: string) => void;
  onMakeHost: (id: string) => void;
  onInvite: () => void;
}

export const ParticipantsSidebar: React.FC<ParticipantsSidebarProps> = ({
  participants,
  localParticipant,
  isHost,
  waitingCount = 0,
  onOpenWaitingRoom,
  onClose,
  onMuteAll,
  onLowerAllHands,
  onMuteParticipant,
  onKickParticipant,
  onMakeHost,
  onInvite,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserMenu, setSelectedUserMenu] = useState<string | null>(null);

  const filtered = participants.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-80 sm:w-96 bg-slate-900 border-l border-slate-800 flex flex-col h-full z-20 select-none shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-white">Participants</h2>
          <span className="bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded-full font-medium">
            {participants.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Waiting Room Queue Banner for Host */}
      {isHost && waitingCount > 0 && onOpenWaitingRoom && (
        <div className="p-3 bg-amber-950/40 border-b border-amber-800/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-semibold">Waiting Room ({waitingCount})</span>
          </div>
          <button
            onClick={onOpenWaitingRoom}
            className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-[11px] transition-colors shadow-sm cursor-pointer"
          >
            Review Queue
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="p-3 border-b border-slate-800/80">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search participants..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700/60 rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Participants List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40 p-2">
        {filtered.map((p) => {
          const isMenuOpen = selectedUserMenu === p.id;
          const initials = p.name
            .split(' ')
            .map((w) => w[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);

          return (
            <div
              key={p.id}
              className="py-2.5 px-3 flex items-center justify-between rounded-lg hover:bg-slate-800/50 transition-colors group relative"
            >
              {/* User Identity */}
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
                  style={{ backgroundColor: p.avatarColor || '#3b82f6' }}
                >
                  {initials}
                </div>
                <div className="truncate">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-sm font-medium text-slate-200 truncate">
                      {p.name}
                    </span>
                    {p.isLocal && (
                      <span className="text-xs text-slate-400 shrink-0">(Me)</span>
                    )}
                    {p.isHost && (
                      <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1 py-0.2 rounded border border-blue-500/30 uppercase font-semibold">
                        Host
                      </span>
                    )}
                  </div>
                  {p.isHandRaised && (
                    <div className="flex items-center gap-1 text-[11px] text-amber-400 mt-0.5">
                      <Hand className="w-3 h-3" />
                      <span>Hand raised</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Icons & Action Trigger */}
              <div className="flex items-center gap-2 shrink-0">
                {p.isAudioMuted ? (
                  <MicOff className="w-4 h-4 text-rose-500" />
                ) : (
                  <Mic className="w-4 h-4 text-slate-400" />
                )}
                {p.isVideoMuted ? (
                  <VideoOff className="w-4 h-4 text-rose-500" />
                ) : (
                  <Video className="w-4 h-4 text-slate-400" />
                )}

                {/* Host Control Actions for Remote Participants */}
                {isHost && !p.isLocal && (
                  <div className="relative">
                    <button
                      onClick={() =>
                        setSelectedUserMenu(isMenuOpen ? null : p.id)
                      }
                      className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {isMenuOpen && (
                      <div className="absolute right-0 top-7 w-44 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 z-30">
                        <button
                          onClick={() => {
                            onMuteParticipant(p.id);
                            setSelectedUserMenu(null);
                          }}
                          className="w-full px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-700 flex items-center gap-2"
                        >
                          <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                          Mute Participant
                        </button>
                        <button
                          onClick={() => {
                            onMakeHost(p.id);
                            setSelectedUserMenu(null);
                          }}
                          className="w-full px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-700 flex items-center gap-2"
                        >
                          <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                          Make Host
                        </button>
                        <button
                          onClick={() => {
                            onKickParticipant(p.id);
                            setSelectedUserMenu(null);
                          }}
                          className="w-full px-3 py-1.5 text-left text-xs text-rose-400 hover:bg-rose-500/10 flex items-center gap-2"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                          Remove from Meeting
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Host Tools */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/95 space-y-2">
        {isHost && (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onMuteAll}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
            >
              <VolumeX className="w-3.5 h-3.5 text-rose-400" />
              Mute All
            </button>
            <button
              onClick={onLowerAllHands}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
            >
              <Hand className="w-3.5 h-3.5 text-amber-400" />
              Lower All Hands
            </button>
          </div>
        )}
        <button
          onClick={onInvite}
          className="w-full px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-colors flex items-center justify-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Invite Participants
        </button>
      </div>
    </div>
  );
};
