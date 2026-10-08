import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Video,
  Mic,
  Sliders,
  Sparkles,
  Volume2,
  Check,
  Shield,
  Code,
  Github,
  Keyboard,
  Info,
  Plus,
  Image as ImageIcon,
} from 'lucide-react';
import { VirtualBackgroundType } from '../types';
import { virtualBackground, optimizeImageForBackground } from '../services/virtualBackground';
import { OpenDoorIcon } from './OpenDoorIcon';

interface SettingsModalProps {
  currentBg: VirtualBackgroundType;
  onChangeBg: (bg: VirtualBackgroundType) => void;
  mirrorVideo: boolean;
  onToggleMirror: (mirror: boolean) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  currentBg,
  onChangeBg,
  mirrorVideo,
  onToggleMirror,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'video' | 'audio' | 'shortcuts' | 'about'>('video');
  const [audioInputLevel, setAudioInputLevel] = useState(0);
  const [testingSpeaker, setTestingSpeaker] = useState(false);
  const [customBgUrl, setCustomBgUrl] = useState<string | null>(() =>
    virtualBackground.getCustomImage()
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCustomImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const optimizedDataUrl = await optimizeImageForBackground(file);
        await virtualBackground.setCustomImage(optimizedDataUrl);
        setCustomBgUrl(optimizedDataUrl);
        onChangeBg('custom');
      } catch (err) {
        console.warn('Custom image error', err);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Play test audio beep using Web Audio API
  const handleTestSpeaker = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      setTestingSpeaker(true);
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime); // A4 note
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3); // Chime up

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.6);

      setTimeout(() => {
        setTestingSpeaker(false);
        ctx.close();
      }, 700);
    } catch (e) {
      console.warn('Audio test error', e);
      setTestingSpeaker(false);
    }
  };

  const BACKGROUND_OPTIONS: { id: VirtualBackgroundType; label: string; desc: string }[] = [
    { id: 'none', label: 'None', desc: 'Natural video' },
    { id: 'half-blur', label: 'Half Blur', desc: 'Subtle natural depth-of-field blur' },
    { id: 'blur', label: 'Blur', desc: 'Standard balanced background blur' },
    { id: 'heavy-blur', label: 'Heavy Blur', desc: 'Full maximum privacy background blur' },
    { id: 'office', label: 'Modern Office', desc: 'Executive boardroom interior' },
    { id: 'studio', label: 'Cyber Studio', desc: 'Sleek neon tech studio' },
    { id: 'space', label: 'Cosmic Nebula', desc: 'Deep galactic space glow' },
  ];

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-white">Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body with Tabs */}
        <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
          {/* Side Nav Tabs */}
          <div className="w-full sm:w-48 bg-slate-950/50 border-b sm:border-b-0 sm:border-r border-slate-800 p-2 space-y-1 shrink-0 flex sm:flex-col overflow-x-auto sm:overflow-x-visible">
            <button
              onClick={() => setActiveTab('video')}
              className={`w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors ${
                activeTab === 'video'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Video className="w-4 h-4" />
              <span>Video & Effects</span>
            </button>
            <button
              onClick={() => setActiveTab('audio')}
              className={`w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors ${
                activeTab === 'audio'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Mic className="w-4 h-4" />
              <span>Audio</span>
            </button>
            <button
              onClick={() => setActiveTab('shortcuts')}
              className={`w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors ${
                activeTab === 'shortcuts'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Keyboard className="w-4 h-4" />
              <span>Shortcuts</span>
            </button>
            <button
              onClick={() => setActiveTab('about')}
              className={`w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors ${
                activeTab === 'about'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Info className="w-4 h-4" />
              <span>About</span>
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 p-5 overflow-y-auto space-y-5">
            {activeTab === 'video' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Virtual Backgrounds & Effects
                  </h4>
                  <p className="text-xs text-slate-400 mb-3">
                    Choose a smart blur or studio backdrop for enhanced privacy.
                  </p>

                  <div className="grid grid-cols-2 gap-2.5">
                    {BACKGROUND_OPTIONS.map((opt) => (
                      <div
                        key={opt.id}
                        onClick={() => onChangeBg(opt.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          currentBg === opt.id
                            ? 'bg-blue-600/20 border-blue-500 text-white ring-1 ring-blue-500'
                            : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold">{opt.label}</span>
                          {currentBg === opt.id && (
                            <Check className="w-3.5 h-3.5 text-blue-400" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">{opt.desc}</p>
                      </div>
                    ))}

                    {/* Custom Uploaded Background Card */}
                    {customBgUrl && (
                      <div
                        onClick={() => onChangeBg('custom')}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                          currentBg === 'custom'
                            ? 'bg-blue-600/20 border-blue-500 text-white ring-1 ring-blue-500'
                            : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 truncate">
                            <img
                              src={customBgUrl}
                              alt="Custom preview"
                              className="w-5 h-5 rounded object-cover shrink-0"
                            />
                            <span className="text-xs font-semibold truncate">Custom Image</span>
                          </div>
                          {currentBg === 'custom' && (
                            <Check className="w-3.5 h-3.5 text-blue-400" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">Uploaded from system</p>
                      </div>
                    )}

                    {/* + Upload Custom Background Image Button */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="p-3 rounded-xl border border-dashed border-slate-600 hover:border-blue-400 bg-slate-800/30 hover:bg-slate-800/60 text-slate-300 hover:text-white cursor-pointer transition-all flex flex-col items-center justify-center text-center group"
                    >
                      <Plus className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform mb-1" />
                      <span className="text-xs font-semibold">Upload Image</span>
                      <p className="text-[10px] text-slate-400 mt-0.5">From computer (.png, .jpg)</p>
                    </div>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png, image/jpeg, image/jpg, image/webp"
                    onChange={handleCustomImageUpload}
                    className="hidden"
                  />
                </div>

                <div className="border-t border-slate-800 pt-4 space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Camera Options
                  </h4>
                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-800 cursor-pointer">
                    <span className="text-xs text-slate-300">Mirror My Video</span>
                    <input
                      type="checkbox"
                      checked={mirrorVideo}
                      onChange={(e) => onToggleMirror(e.target.checked)}
                      className="rounded accent-blue-600"
                    />
                  </label>
                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-800 cursor-pointer">
                    <span className="text-xs text-slate-300">HD 720p/1080p Video Quality</span>
                    <input
                      type="checkbox"
                      defaultChecked
                      className="rounded accent-blue-600"
                    />
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'audio' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Microphone & Speaker
                  </h4>

                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-300">
                        <span>Test Speaker Sound:</span>
                        <button
                          onClick={handleTestSpeaker}
                          disabled={testingSpeaker}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-1.5 transition-colors shadow"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          {testingSpeaker ? 'Playing...' : 'Test Sound'}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Plays a test audio chime to verify your headphones/speakers.
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-300">
                        <span>Microphone Noise Suppression:</span>
                        <span className="text-xs text-emerald-400 font-semibold">Active</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Echo cancellation and background noise filtering are automatically enabled.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'shortcuts' && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Keyboard Shortcuts
                </h4>
                <div className="divide-y divide-slate-800 text-xs">
                  <div className="py-2 flex items-center justify-between text-slate-300">
                    <span>Mute / Unmute Audio</span>
                    <kbd className="px-2 py-1 bg-slate-800 rounded border border-slate-700 font-mono text-[11px]">Alt + A / Space</kbd>
                  </div>
                  <div className="py-2 flex items-center justify-between text-slate-300">
                    <span>Start / Stop Video</span>
                    <kbd className="px-2 py-1 bg-slate-800 rounded border border-slate-700 font-mono text-[11px]">Alt + V</kbd>
                  </div>
                  <div className="py-2 flex items-center justify-between text-slate-300">
                    <span>Share Screen</span>
                    <kbd className="px-2 py-1 bg-slate-800 rounded border border-slate-700 font-mono text-[11px]">Alt + S</kbd>
                  </div>
                  <div className="py-2 flex items-center justify-between text-slate-300">
                    <span>Toggle Chat Window</span>
                    <kbd className="px-2 py-1 bg-slate-800 rounded border border-slate-700 font-mono text-[11px]">Alt + H</kbd>
                  </div>
                  <div className="py-2 flex items-center justify-between text-slate-300">
                    <span>Raise / Lower Hand</span>
                    <kbd className="px-2 py-1 bg-slate-800 rounded border border-slate-700 font-mono text-[11px]">Alt + Y</kbd>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'about' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700/80 p-1 flex items-center justify-center shadow-md">
                    <OpenDoorIcon className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white tracking-tight">OpenRoom</h4>
                    <p className="text-xs text-slate-400">Version 1.0.0</p>
                  </div>
                </div>

                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 space-y-3 text-xs text-slate-300 leading-relaxed">
                  <p>
                    OpenRoom is a private, modern video conferencing workspace built for instant team meetings, interactive collaboration, and presentations.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-400 pt-2 border-t border-slate-700/50">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>HD Video & Audio</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      <span>Screen & Audio Sharing</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                      <span>Virtual Backgrounds & Custom Uploads</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                      <span>Interactive Whiteboard & Breakout Rooms</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/95 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};
