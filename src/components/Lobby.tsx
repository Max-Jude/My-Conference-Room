import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  Plus,
  Calendar,
  Share2,
  Mic,
  MicOff,
  VideoOff,
  Settings,
  Code,
  Clock,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Zap,
  Play,
  Copy,
  Trash2,
  Check,
  Monitor,
  Volume2,
  Camera,
  RefreshCw,
  Image as ImageIcon,
} from 'lucide-react';
import { ScheduledMeeting, VirtualBackgroundType } from '../types';
import { ScheduleModal } from './ScheduleModal';
import { SettingsModal } from './SettingsModal';
import { OpenDoorIcon } from './OpenDoorIcon';
import { virtualBackground, optimizeImageForBackground } from '../services/virtualBackground';

interface LobbyProps {
  onStartMeeting: (
    roomId: string,
    userName: string,
    audioEnabled: boolean,
    videoEnabled: boolean,
    startWithScreenShare?: boolean,
    virtualBg?: VirtualBackgroundType
  ) => void;
  initialRoomId?: string;
}

export const Lobby: React.FC<LobbyProps> = ({ onStartMeeting, initialRoomId }) => {
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem('openroom_username') || localStorage.getItem('openzoom_username') || 'Guest User';
  });
  const [roomIdInput, setRoomIdInput] = useState(initialRoomId || '');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [micLevel, setMicLevel] = useState(0);

  const [showJoinModal, setShowJoinModal] = useState(!!initialRoomId);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const [virtualBg, setVirtualBg] = useState<VirtualBackgroundType>('none');
  const [mirrorVideo, setMirrorVideo] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Hardware devices
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [selectedAudioId, setSelectedAudioId] = useState<string>('');
  const [testingSpeaker, setTestingSpeaker] = useState(false);

  // Custom background image upload
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
        await handlePreviewBgChange('custom');
      } catch (err) {
        console.warn('Image processing error:', err);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const [scheduledMeetings, setScheduledMeetings] = useState<ScheduledMeeting[]>(() => {
    const saved = localStorage.getItem('openroom_scheduled') || localStorage.getItem('openzoom_scheduled');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [
      {
        id: '849204918',
        title: 'Community Open Source Sync',
        scheduledTime: new Date(Date.now() + 3600000).toISOString().slice(0, 16),
        durationMinutes: 60,
        passcode: '123456',
        waitingRoom: false,
        createdAt: Date.now(),
      },
    ];
  });

  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Register preview canvas for direct GPU rendering with 0ms latency
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (canvas) {
      virtualBackground.registerPreviewCanvas(canvas);
    }
    return () => {
      if (canvas) {
        virtualBackground.unregisterPreviewCanvas(canvas);
      }
    };
  }, []);

  // Initialize camera preview
  useEffect(() => {
    let active = true;

    async function initPreview() {
      try {
        const constraints: MediaStreamConstraints = {
          video: selectedVideoId
            ? { deviceId: { exact: selectedVideoId } }
            : true,
          audio: selectedAudioId
            ? { deviceId: { exact: selectedAudioId } }
            : true,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((t) => t.stop());
        }

        localStreamRef.current = stream;

        // Direct hardware video for zero delay
        if (previewVideoRef.current && active) {
          previewVideoRef.current.srcObject = stream;
        }

        // Apply virtual background if one is active
        if (virtualBg !== 'none') {
          await virtualBackground.start(stream, virtualBg);
        } else {
          virtualBackground.stop();
        }

        // Enumerate devices for selector
        if (navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const cams = devices.filter((d) => d.kind === 'videoinput');
          const mics = devices.filter((d) => d.kind === 'audioinput');
          setVideoDevices(cams);
          setAudioDevices(mics);
          if (!selectedVideoId && cams.length > 0) setSelectedVideoId(cams[0].deviceId);
          if (!selectedAudioId && mics.length > 0) setSelectedAudioId(mics[0].deviceId);
        }

        // Setup microphone visualizer level
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => {});
          }
          const ctx = new AudioCtx();
          audioContextRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const interval = setInterval(() => {
            if (!active) {
              clearInterval(interval);
              return;
            }
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
          }, 100);
        }
      } catch (err) {
        console.warn('Camera/mic preview permission not granted:', err);
      }
    }

    initPreview();

    return () => {
      active = false;
      virtualBackground.stop();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [selectedVideoId, selectedAudioId]);

  const handlePreviewBgChange = async (bg: VirtualBackgroundType) => {
    setVirtualBg(bg);
    if (localStreamRef.current) {
      if (bg === 'none') {
        virtualBackground.stop();
        if (previewVideoRef.current) {
          previewVideoRef.current.srcObject = localStreamRef.current;
        }
      } else {
        await virtualBackground.start(localStreamRef.current, bg);
      }
    }
  };

  const handleTestSpeaker = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      setTestingSpeaker(true);
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.2);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.5);

      setTimeout(() => {
        setTestingSpeaker(false);
        ctx.close();
      }, 600);
    } catch (e) {
      setTestingSpeaker(false);
    }
  };

  const toggleVideo = () => {
    const next = !videoEnabled;
    setVideoEnabled(next);
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => {
        t.enabled = next;
      });
    }
  };

  const toggleAudio = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = next;
      });
    }
  };

  const saveUserName = (name: string) => {
    setUserName(name);
    localStorage.setItem('openroom_username', name);
  };

  const handleStartInstantMeeting = () => {
    const newRoomId = Math.floor(100000000 + Math.random() * 900000000).toString();
    saveUserName(userName);
    onStartMeeting(newRoomId, userName, audioEnabled, videoEnabled, false, virtualBg);
  };

  const handleStartScreenShareMeeting = () => {
    const newRoomId = Math.floor(100000000 + Math.random() * 900000000).toString();
    saveUserName(userName);
    onStartMeeting(newRoomId, userName, audioEnabled, videoEnabled, true, virtualBg);
  };

  const handleJoinMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    let id = roomIdInput.trim();
    if (!id) return;

    // Handle full URL pasted into input
    if (id.includes('room=')) {
      try {
        const url = new URL(id);
        id = url.searchParams.get('room') || id;
      } catch (e) {}
    }

    saveUserName(userName);
    onStartMeeting(id, userName, audioEnabled, videoEnabled, false, virtualBg);
  };

  const handleScheduleNew = (meeting: ScheduledMeeting) => {
    const updated = [meeting, ...scheduledMeetings];
    setScheduledMeetings(updated);
    localStorage.setItem('openroom_scheduled', JSON.stringify(updated));
  };

  const handleDeleteScheduled = (id: string) => {
    const updated = scheduledMeetings.filter((m) => m.id !== id);
    setScheduledMeetings(updated);
    localStorage.setItem('openroom_scheduled', JSON.stringify(updated));
  };

  const handleCopyScheduled = (meeting: ScheduledMeeting) => {
    const link = `${window.location.origin}/?room=${meeting.id}`;
    const text = `Join OpenRoom Meeting: ${meeting.title}\nTime: ${new Date(
      meeting.scheduledTime
    ).toLocaleString()}\nLink: ${link}\nMeeting ID: ${meeting.id}\nPasscode: ${
      meeting.passcode
    }`;
    navigator.clipboard.writeText(text);
    setCopiedId(meeting.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col select-none">
      {/* Top Navbar */}
      <header className="h-16 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700/80 p-1 flex items-center justify-center shadow-lg shadow-blue-500/10">
            <OpenDoorIcon className="w-8 h-8" />
          </div>
          <div>
            <span className="font-bold text-lg text-white tracking-tight">
              OpenRoom
            </span>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Fast, simple, and private video meetings
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Quick Action Tiles & Scheduled Meetings */}
        <div className="lg:col-span-7 space-y-6">
          {/* User Welcome Card */}
          <div className="bg-gradient-to-r from-blue-950/40 via-slate-900 to-slate-900 border border-blue-900/30 rounded-2xl p-5 shadow-xl">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Welcome to OpenRoom
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">
              Host and join meetings with real-time screen sharing, interactive whiteboard, breakout rooms, and virtual backgrounds.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <span className="text-slate-400">Your Display Name:</span>
              <input
                type="text"
                value={userName}
                onChange={(e) => saveUserName(e.target.value)}
                placeholder="Enter your name"
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
              />
            </div>
          </div>

          {/* Zoom Signature 4-Box Action Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {/* 1. New Meeting */}
            <button
              onClick={handleStartInstantMeeting}
              className="group flex flex-col items-center justify-center p-5 rounded-2xl bg-slate-900 hover:bg-slate-800/90 border border-slate-800 hover:border-orange-500/50 transition-all transform hover:-translate-y-1 shadow-lg cursor-pointer"
            >
              <div className="w-14 h-14 rounded-2xl bg-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/30 group-hover:scale-105 transition-transform mb-3">
                <Video className="w-7 h-7" />
              </div>
              <span className="text-sm font-semibold text-white">New Meeting</span>
              <span className="text-[11px] text-slate-400 mt-0.5">Instant Room</span>
            </button>

            {/* 2. Join Meeting */}
            <button
              onClick={() => setShowJoinModal(true)}
              className="group flex flex-col items-center justify-center p-5 rounded-2xl bg-slate-900 hover:bg-slate-800/90 border border-slate-800 hover:border-blue-500/50 transition-all transform hover:-translate-y-1 shadow-lg cursor-pointer"
            >
              <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/30 group-hover:scale-105 transition-transform mb-3">
                <Plus className="w-7 h-7" />
              </div>
              <span className="text-sm font-semibold text-white">Join</span>
              <span className="text-[11px] text-slate-400 mt-0.5">With Room ID</span>
            </button>

            {/* 3. Schedule Meeting */}
            <button
              onClick={() => setShowScheduleModal(true)}
              className="group flex flex-col items-center justify-center p-5 rounded-2xl bg-slate-900 hover:bg-slate-800/90 border border-slate-800 hover:border-indigo-500/50 transition-all transform hover:-translate-y-1 shadow-lg cursor-pointer"
            >
              <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30 group-hover:scale-105 transition-transform mb-3">
                <Calendar className="w-7 h-7" />
              </div>
              <span className="text-sm font-semibold text-white">Schedule</span>
              <span className="text-[11px] text-slate-400 mt-0.5">For Later</span>
            </button>

            {/* 4. Share Screen */}
            <button
              onClick={handleStartScreenShareMeeting}
              className="group flex flex-col items-center justify-center p-5 rounded-2xl bg-slate-900 hover:bg-slate-800/90 border border-slate-800 hover:border-emerald-500/50 transition-all transform hover:-translate-y-1 shadow-lg cursor-pointer"
            >
              <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-600/30 group-hover:scale-105 transition-transform mb-3">
                <Monitor className="w-7 h-7" />
              </div>
              <span className="text-sm font-semibold text-white">Share Screen</span>
              <span className="text-[11px] text-slate-400 mt-0.5">Present Directly</span>
            </button>
          </div>

          {/* Scheduled Meetings List */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <h3 className="font-semibold text-sm text-white">Upcoming Meetings</h3>
              </div>
              <button
                onClick={() => setShowScheduleModal(true)}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                + Schedule Another
              </button>
            </div>

            {scheduledMeetings.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                No meetings scheduled yet. Click Schedule above to set one up.
              </p>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {scheduledMeetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <h4 className="text-sm font-medium text-slate-200">
                        {meeting.title}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        <span>{new Date(meeting.scheduledTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                        <span>•</span>
                        <span>ID: {meeting.id}</span>
                        <span>•</span>
                        <span>Passcode: {meeting.passcode}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          onStartMeeting(meeting.id, userName, audioEnabled, videoEnabled, false, virtualBg)
                        }
                        className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition-colors flex items-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        Start
                      </button>
                      <button
                        onClick={() => handleCopyScheduled(meeting)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs transition-colors"
                        title="Copy Invitation"
                      >
                        {copiedId === meeting.id ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteScheduled(meeting.id)}
                        className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Hardware Video & Audio Green Room Preview */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Green Room Preview
              </span>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Ready to Join</span>
              </div>
            </div>

            {/* Video Preview Frame */}
            <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
              {/* Direct Hardware Video Element for 0ms lag when no background is active */}
              <video
                ref={previewVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${
                  videoEnabled && virtualBg === 'none' ? 'block' : 'hidden'
                } ${mirrorVideo ? 'scale-x-[-1]' : ''}`}
              />

              {/* Direct Rendered Canvas for 0ms lag when virtual background is active */}
              <canvas
                ref={previewCanvasRef}
                className={`w-full h-full object-cover ${
                  videoEnabled && virtualBg !== 'none' ? 'block' : 'hidden'
                } ${mirrorVideo ? 'scale-x-[-1]' : ''}`}
              />

              {!videoEnabled && (
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-500">
                    <VideoOff className="w-8 h-8" />
                  </div>
                  <span className="text-xs text-slate-400">Camera is turned off</span>
                </div>
              )}

              {/* In-Frame Hardware Controls */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleAudio}
                    className={`p-2.5 rounded-xl backdrop-blur-md transition-all shadow-md ${
                      audioEnabled
                        ? 'bg-slate-900/80 hover:bg-slate-800 text-slate-200'
                        : 'bg-rose-600/90 hover:bg-rose-600 text-white'
                    }`}
                  >
                    {audioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={toggleVideo}
                    className={`p-2.5 rounded-xl backdrop-blur-md transition-all shadow-md ${
                      videoEnabled
                        ? 'bg-slate-900/80 hover:bg-slate-800 text-slate-200'
                        : 'bg-rose-600/90 hover:bg-rose-600 text-white'
                    }`}
                  >
                    {videoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                  </button>
                </div>

                <div className="bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 border border-slate-800">
                  {userName || 'Guest'}
                </div>
              </div>
            </div>

            {/* Microphone Live Level Meter & Speaker Test */}
            <div className="space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-blue-400" />
                  <span>Microphone Signal</span>
                </div>
                <span className="font-mono text-[11px] text-emerald-400 font-semibold">{micLevel > 15 ? 'Speaking Detected' : 'Idle'}</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2 transition-all duration-100 rounded-full"
                  style={{ width: `${micLevel}%` }}
                />
              </div>

              {/* Speaker Test & Devices */}
              <div className="pt-1 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-400">Test Headphones/Speakers:</span>
                <button
                  type="button"
                  onClick={handleTestSpeaker}
                  disabled={testingSpeaker}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Volume2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>{testingSpeaker ? 'Playing...' : 'Test Speaker'}</span>
                </button>
              </div>
            </div>

            {/* Hardware Devices Selector */}
            {(videoDevices.length > 1 || audioDevices.length > 1) && (
              <div className="space-y-2 bg-slate-950/40 p-3 rounded-xl border border-slate-800/60 text-xs">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Hardware Devices
                </span>
                {videoDevices.length > 1 && (
                  <div className="flex items-center gap-2">
                    <Camera className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <select
                      value={selectedVideoId}
                      onChange={(e) => setSelectedVideoId(e.target.value)}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer truncate"
                    >
                      {videoDevices.map((d, i) => (
                        <option key={d.deviceId || i} value={d.deviceId}>
                          {d.label || `Camera ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {audioDevices.length > 1 && (
                  <div className="flex items-center gap-2">
                    <Mic className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <select
                      value={selectedAudioId}
                      onChange={(e) => setSelectedAudioId(e.target.value)}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer truncate"
                    >
                      {audioDevices.map((d, i) => (
                        <option key={d.deviceId || i} value={d.deviceId}>
                          {d.label || `Microphone ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Live Virtual Background Reviewer */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  Live Virtual Background Reviewer
                </span>
                <span className="text-[11px] font-medium text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/60 capitalize">
                  {virtualBg === 'none'
                    ? 'No Filter'
                    : virtualBg === 'custom'
                    ? 'Custom Image'
                    : virtualBg.replace('-', ' ')}
                </span>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-4 gap-2">
                {[
                  { id: 'none', label: 'None', desc: 'Natural', color: 'from-slate-700 to-slate-800' },
                  { id: 'half-blur', label: 'Half Blur', desc: 'Soft f/2.8', color: 'from-blue-600/30 to-indigo-600/30' },
                  { id: 'blur', label: 'Blur', desc: 'Standard', color: 'from-blue-600/50 to-indigo-600/50' },
                  { id: 'heavy-blur', label: 'Heavy Blur', desc: 'Privacy', color: 'from-blue-700/70 to-indigo-800/70' },
                  { id: 'office', label: 'Office', desc: 'Executive', color: 'from-amber-900/40 to-slate-800' },
                  { id: 'space', label: 'Space', desc: 'Cosmic', color: 'from-purple-900/50 to-blue-950' },
                  { id: 'studio', label: 'Studio', desc: 'Neon RGB', color: 'from-cyan-900/40 to-purple-900/40' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handlePreviewBgChange(opt.id as VirtualBackgroundType)}
                    className={`py-2 px-2 rounded-xl text-left border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                      virtualBg === opt.id
                        ? 'bg-blue-600/25 border-blue-500 text-white shadow-md ring-2 ring-blue-500/50'
                        : 'bg-slate-800/50 border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[11px] font-semibold leading-tight">{opt.label}</span>
                      {virtualBg === opt.id && (
                        <Check className="w-3 h-3 text-blue-400 shrink-0" />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-0.5 leading-none">
                      {opt.desc}
                    </span>
                  </button>
                ))}

                {/* Custom Uploaded Background Card (if already uploaded) */}
                {customBgUrl && (
                  <button
                    type="button"
                    onClick={() => handlePreviewBgChange('custom')}
                    className={`py-1.5 px-2 rounded-xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                      virtualBg === 'custom'
                        ? 'bg-blue-600/25 border-blue-500 text-white shadow-md ring-2 ring-blue-500/50'
                        : 'bg-slate-800/50 border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800 hover:border-slate-600'
                    }`}
                    title="Use your uploaded custom image"
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-1.5 truncate">
                        <img
                          src={customBgUrl}
                          alt="Custom thumbnail"
                          className="w-4 h-4 rounded object-cover shrink-0 border border-slate-600"
                        />
                        <span className="text-[11px] font-semibold truncate">Custom</span>
                      </div>
                      {virtualBg === 'custom' && (
                        <Check className="w-3 h-3 text-blue-400 shrink-0" />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-0.5 leading-none truncate">
                      From system
                    </span>
                  </button>
                )}

                {/* + Button to Upload Image From System */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="py-2 px-2 rounded-xl border-2 border-dashed border-slate-600 hover:border-blue-400 bg-slate-800/30 hover:bg-slate-800/70 text-slate-300 hover:text-white transition-all flex flex-col items-center justify-center text-center cursor-pointer group shadow-sm"
                  title="Upload image from your system to use as background"
                >
                  <div className="flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5 text-blue-400 group-hover:scale-125 transition-transform" />
                    <ImageIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-300 transition-colors" />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-200 mt-0.5">
                    + Add Image
                  </span>
                  <span className="text-[9px] text-slate-400 leading-tight">From System</span>
                </button>
              </div>

              {/* Hidden file input for custom image upload */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/jpg, image/webp"
                onChange={handleCustomImageUpload}
                className="hidden"
              />
            </div>
          </div>
        </div>
      </main>

      {/* Join Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-5">
            <h3 className="text-base font-semibold text-white">Join Meeting</h3>
            <form onSubmit={handleJoinMeeting} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Meeting ID or Personal Link
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 849204918 or room URL"
                  value={roomIdInput}
                  onChange={(e) => setRoomIdInput(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Your Display Name
                </label>
                <input
                  type="text"
                  required
                  value={userName}
                  onChange={(e) => saveUserName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                  <span>Turn off my video</span>
                  <input
                    type="checkbox"
                    checked={!videoEnabled}
                    onChange={(e) => setVideoEnabled(!e.target.checked)}
                    className="rounded accent-blue-600"
                  />
                </label>
                <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                  <span>Do not connect to audio</span>
                  <input
                    type="checkbox"
                    checked={!audioEnabled}
                    onChange={(e) => setAudioEnabled(!e.target.checked)}
                    className="rounded accent-blue-600"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md"
                >
                  Join
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <ScheduleModal
          onSchedule={handleScheduleNew}
          onClose={() => setShowScheduleModal(false)}
        />
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <SettingsModal
          currentBg={virtualBg}
          onChangeBg={setVirtualBg}
          mirrorVideo={mirrorVideo}
          onToggleMirror={setMirrorVideo}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
    </div>
  );
};
