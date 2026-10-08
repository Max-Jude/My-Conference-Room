import React, { useState } from 'react';
import {
  X,
  Users,
  Plus,
  Trash2,
  Radio,
  Send,
  DoorOpen,
  ArrowRight,
} from 'lucide-react';
import { BreakoutRoom, Participant } from '../types';

interface BreakoutRoomsModalProps {
  participants: Participant[];
  breakoutRooms: BreakoutRoom[];
  onUpdateRooms: (rooms: BreakoutRoom[]) => void;
  onBroadcastMessage: (message: string) => void;
  onClose: () => void;
}

export const BreakoutRoomsModal: React.FC<BreakoutRoomsModalProps> = ({
  participants,
  breakoutRooms,
  onUpdateRooms,
  onBroadcastMessage,
  onClose,
}) => {
  const [broadcastText, setBroadcastText] = useState('');
  const [roomCount, setRoomCount] = useState<number>(2);

  const handleCreateAutoRooms = () => {
    const newRooms: BreakoutRoom[] = [];
    const nonHostParticipants = participants.filter((p) => !p.isHost);

    for (let i = 1; i <= roomCount; i++) {
      newRooms.push({
        id: 'room-' + i,
        name: `Breakout Room ${i}`,
        participantIds: [],
      });
    }

    // Distribute participants round-robin
    nonHostParticipants.forEach((p, idx) => {
      const roomIdx = idx % roomCount;
      newRooms[roomIdx].participantIds.push(p.id);
    });

    onUpdateRooms(newRooms);
  };

  const handleCloseAllRooms = () => {
    onUpdateRooms([]);
  };

  const handleBroadcast = () => {
    if (!broadcastText.trim()) return;
    onBroadcastMessage(broadcastText.trim());
    setBroadcastText('');
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DoorOpen className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-white">Breakout Rooms</h3>
            <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-medium">
              Free Feature
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
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {breakoutRooms.length === 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-300">
                Split meeting participants into smaller group sessions for team discussions and focused collaboration.
              </p>

              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 space-y-3">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Number of breakout rooms:
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="2"
                    max="8"
                    value={roomCount}
                    onChange={(e) => setRoomCount(parseInt(e.target.value))}
                    className="flex-1 accent-indigo-500 cursor-pointer"
                  />
                  <span className="w-8 text-center font-bold text-white bg-slate-700 px-2 py-1 rounded text-sm">
                    {roomCount}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Participants will be automatically distributed evenly across the {roomCount} rooms.
                </p>
              </div>

              <button
                onClick={handleCreateAutoRooms}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <DoorOpen className="w-4 h-4" />
                Create and Open {roomCount} Rooms
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Active Rooms ({breakoutRooms.length})
                </span>
                <button
                  onClick={handleCloseAllRooms}
                  className="text-xs text-rose-400 hover:text-rose-300 font-medium transition-colors"
                >
                  Close All Rooms & Return
                </button>
              </div>

              {/* Rooms List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {breakoutRooms.map((room) => {
                  const assignedParticipants = participants.filter((p) =>
                    room.participantIds.includes(p.id)
                  );

                  return (
                    <div
                      key={room.id}
                      className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-white">
                          {room.name}
                        </span>
                        <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                          {assignedParticipants.length}
                        </span>
                      </div>

                      <div className="text-xs text-slate-400 space-y-1">
                        {assignedParticipants.length === 0 ? (
                          <span className="italic text-slate-500">No participants</span>
                        ) : (
                          assignedParticipants.map((p) => (
                            <div key={p.id} className="truncate">
                              • {p.name}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Broadcast Message to All Rooms */}
              <div className="border-t border-slate-800 pt-4 space-y-2">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-indigo-400" />
                  Broadcast Announcement to All Rooms:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. 2 minutes left before returning..."
                    value={broadcastText}
                    onChange={(e) => setBroadcastText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleBroadcast()}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    onClick={handleBroadcast}
                    disabled={!broadcastText.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Broadcast
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
