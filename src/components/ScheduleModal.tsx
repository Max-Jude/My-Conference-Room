import React, { useState } from 'react';
import { Calendar, Clock, Lock, Shield, X, Check } from 'lucide-react';
import { ScheduledMeeting } from '../types';

interface ScheduleModalProps {
  onSchedule: (meeting: ScheduledMeeting) => void;
  onClose: () => void;
}

export const ScheduleModal: React.FC<ScheduleModalProps> = ({
  onSchedule,
  onClose,
}) => {
  const [title, setTitle] = useState("Team Meeting");
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [duration, setDuration] = useState(60);
  const [passcode, setPasscode] = useState(() =>
    Math.floor(100000 + Math.random() * 900000).toString()
  );
  const [waitingRoom, setWaitingRoom] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const meeting: ScheduledMeeting = {
      id: Math.floor(100000000 + Math.random() * 900000000).toString(),
      title: title.trim() || 'Scheduled Meeting',
      scheduledTime: date,
      durationMinutes: duration,
      passcode,
      waitingRoom,
      createdAt: Date.now(),
    };
    onSchedule(meeting);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-white">Schedule Meeting</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Topic
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Start Time
              </label>
              <input
                type="datetime-local"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Duration
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>1 hour</option>
                <option value={120}>2 hours</option>
                <option value={0}>No time limit</option>
              </select>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Security
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300">Passcode:</span>
              <input
                type="text"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="w-28 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-center font-mono text-xs text-white"
              />
            </div>

            <label className="flex items-center justify-between cursor-pointer pt-1">
              <span className="text-xs text-slate-300">Enable Waiting Room</span>
              <input
                type="checkbox"
                checked={waitingRoom}
                onChange={(e) => setWaitingRoom(e.target.checked)}
                className="rounded accent-blue-600"
              />
            </label>
          </div>

          <div className="p-4 border-t border-slate-800 -mx-5 -mb-5 bg-slate-900/90 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-colors"
            >
              Schedule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
