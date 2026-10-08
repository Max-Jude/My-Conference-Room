import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  MessageSquare,
  Users,
  Shield,
  Circle,
  Square,
  Sparkles,
  Smile,
  Hand,
  PenTool,
  Maximize,
  Minimize,
  Grid,
  User,
  PhoneOff,
  Copy,
  Check,
  ChevronUp,
  Subtitles,
  DoorOpen,
  Lock,
  Clock,
  Pause,
  Play,
  Share2,
  Plus,
  Image as ImageIcon,
} from 'lucide-react';
import {
  Participant,
  ChatMessage,
  MeetingSettings,
  BreakoutRoom,
  Caption,
  ViewMode,
  VirtualBackgroundType,
} from '../types';
import { signaling } from '../services/signaling';
import { webrtc } from '../services/webrtc';
import { virtualBackground, optimizeImageForBackground } from '../services/virtualBackground';
import { speechService } from '../services/speech';
import { recorder } from '../services/recorder';
import { VideoTile } from './VideoTile';
import { ParticipantsSidebar } from './ParticipantsSidebar';
import { ChatSidebar } from './ChatSidebar';
import { WhiteboardView } from './WhiteboardView';
import { BreakoutRoomsModal } from './BreakoutRoomsModal';
import { SecurityModal } from './SecurityModal';
import { InviteModal } from './InviteModal';
import { SettingsModal } from './SettingsModal';
import { WaitingRoomModal } from './WaitingRoomModal';
import { EndMeetingModal } from './EndMeetingModal';
import { OpenDoorIcon } from './OpenDoorIcon';

interface MeetingRoomProps {
  roomId: string;
  userName: string;
  initialAudioEnabled: boolean;
  initialVideoEnabled: boolean;
  startWithScreenShare?: boolean;
  initialVirtualBg?: VirtualBackgroundType;
  onLeaveMeeting: () => void;
}

const EMOJI_REACTIONS = ['👏', '👍', '❤️', '😂', '😮', '🎉'];

export const MeetingRoom: React.FC<MeetingRoomProps> = ({
  roomId,
  userName,
  initialAudioEnabled,
  initialVideoEnabled,
  startWithScreenShare = false,
  initialVirtualBg = 'none',
  onLeaveMeeting,
}) => {
  const [localUserId] = useState(() => 'user-' + Math.random().toString(36).substr(2, 9));
  const [isHost, setIsHost] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(!initialAudioEnabled);
  const [isVideoMuted, setIsVideoMuted] = useState(!initialVideoEnabled);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string>(localUserId);
  const [pinnedParticipantId, setPinnedParticipantId] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('gallery');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Sidebars and Modals
  const [showParticipants, setShowParticipants] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showBreakout, setShowBreakout] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showWaitingRoom, setShowWaitingRoom] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [toastNotification, setToastNotification] = useState<string | null>(null);
  const [showReactionsMenu, setShowReactionsMenu] = useState(false);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [showVideoMenu, setShowVideoMenu] = useState(false);

  // Data states
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [waitingParticipants, setWaitingParticipants] = useState<Participant[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [breakoutRooms, setBreakoutRooms] = useState<BreakoutRoom[]>([]);
  const [activeBreakoutNotice, setActiveBreakoutNotice] = useState<string | null>(null);

  // Settings
  const [settings, setSettings] = useState<MeetingSettings>({
    isLocked: false,
    waitingRoomEnabled: false,
    allowScreenShare: true,
    allowChat: true,
    allowUnmute: true,
    allowWhiteboard: true,
  });

  // Recording
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Captions
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [activeCaption, setActiveCaption] = useState<Caption | null>(null);

  // Virtual background
  const [virtualBg, setVirtualBg] = useState<VirtualBackgroundType>(initialVirtualBg);
  const [mirrorVideo, setMirrorVideo] = useState(true);

  // Waiting Room state
  const [isInWaitingRoom, setIsInWaitingRoom] = useState(false);
  const [waitingRoomNotice, setWaitingRoomNotice] = useState('Please wait, the meeting host will let you in soon.');
  const [waitingHostName, setWaitingHostName] = useState('Host');

  // Floating reaction animations
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: string; emoji: string; x: number }[]>([]);

  // Copied link toast
  const [copiedLink, setCopiedLink] = useState(false);

  // Local media stream refs
  const localStreamRef = useRef<MediaStream | null>(null);
  const rawCameraStreamRef = useRef<MediaStream | null>(null);
  const inMeetingFileInputRef = useRef<HTMLInputElement>(null);

  const cleanupAndLeave = () => {
    setShowEndModal(false);
    signaling.send({ type: 'leave' });
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    webrtc.cleanup();
    speechService.stop();
    recorder.stopRecording();
    onLeaveMeeting();
  };

  // Initialize Local Media & WebRTC Connection
  useEffect(() => {
    let active = true;

    async function setupMediaAndSignaling() {
      // 1. Get user media
      const stream = await webrtc.getLocalStream(!isAudioMuted, !isVideoMuted);
      if (!active) return;
      rawCameraStreamRef.current = stream;
      localStreamRef.current = stream;

      // Apply initial virtual background if selected in preview
      if (initialVirtualBg !== 'none') {
        try {
          const processed = await virtualBackground.start(stream, initialVirtualBg);
          localStreamRef.current = processed;
          webrtc.setLocalStream(processed);
        } catch (e) {
          console.warn('Initial virtual bg error', e);
        }
      }

      // 2. Setup callback for remote streams
      webrtc.setCallbacks(
        (remoteUserId: string, remoteStream: MediaStream) => {
          setParticipants((prev) =>
            prev.map((p) => (p.id === remoteUserId ? { ...p, stream: remoteStream } : p))
          );
        },
        (isSpeaking: boolean) => {
          if (isSpeaking) {
            setActiveSpeakerId(localUserId);
            signaling.send({
              type: 'status-update',
              status: { isSpeaking: true },
            });
          }
        }
      );

      // 3. Connect to signaling server
      signaling.connect(roomId, localUserId, userName);

      // 4. If asked to start with screen share
      if (startWithScreenShare) {
        handleToggleScreenShare();
      }
    }

    setupMediaAndSignaling();

    // 5. Setup signaling event listeners
    const unsubRoomJoined = signaling.on('room-joined', (data: any) => {
      setIsInWaitingRoom(false);
      setIsHost(data.isHost);
      if (data.settings) {
        setSettings((prev) => ({ ...prev, ...data.settings }));
      }

      // Add local user to participants list
      const localP: Participant = {
        id: localUserId,
        name: userName,
        isLocal: true,
        isHost: data.isHost,
        isAudioMuted,
        isVideoMuted,
        isScreenSharing: false,
        isHandRaised: false,
        stream: localStreamRef.current || undefined,
        avatarColor: '#3b82f6',
      };

      // Map remote participants
      const remoteList: Participant[] = (data.participants || [])
        .filter((p: any) => p.id !== localUserId)
        .map((p: any, idx: number) => ({
          id: p.id,
          name: p.name,
          isLocal: false,
          isHost: p.isHost,
          isAudioMuted: false,
          isVideoMuted: false,
          isScreenSharing: false,
          isHandRaised: false,
          avatarColor: ['#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'][idx % 5],
        }));

      setParticipants([localP, ...remoteList]);

      // Initiate WebRTC peer connection to all existing participants
      remoteList.forEach((remote) => {
        webrtc.initiatePeerConnection(remote.id, true);
      });
    });

    const unsubUserJoined = signaling.on('user-joined', (data: any) => {
      if (data.user && data.user.id !== localUserId) {
        const newUser: Participant = {
          id: data.user.id,
          name: data.user.name,
          isLocal: false,
          isHost: data.user.isHost,
          isAudioMuted: false,
          isVideoMuted: false,
          isScreenSharing: false,
          isHandRaised: false,
          avatarColor: '#8b5cf6',
        };

        setParticipants((prev) => {
          if (prev.some((p) => p.id === newUser.id)) return prev;
          return [...prev, newUser];
        });

        // The joined user creates offer or wait for incoming offer
        webrtc.initiatePeerConnection(newUser.id, false);
      }
    });

    const unsubUserLeft = signaling.on('user-left', (data: any) => {
      setParticipants((prev) => prev.filter((p) => p.id !== data.userId));
      webrtc.removePeer(data.userId);
    });

    const unsubSignal = signaling.on('signal', (data: any) => {
      if (data.senderId && data.signalData) {
        webrtc.handleSignal(data.senderId, data.signalData);
      }
    });

    const unsubChat = signaling.on('chat', (data: any) => {
      if (data.message) {
        setChatMessages((prev) => [...prev, data.message]);
        if (!showChat) {
          setUnreadChatCount((prev) => prev + 1);
        }
      }
    });

    const unsubReaction = signaling.on('reaction', (data: any) => {
      triggerFloatingEmoji(data.emoji);
      setParticipants((prev) =>
        prev.map((p) =>
          p.id === data.userId
            ? { ...p, reaction: { emoji: data.emoji, timestamp: Date.now() } }
            : p
        )
      );
    });

    const unsubHandRaise = signaling.on('hand-raise', (data: any) => {
      setParticipants((prev) =>
        prev.map((p) =>
          p.id === data.userId ? { ...p, isHandRaised: data.isHandRaised } : p
        )
      );
    });

    const unsubStatus = signaling.on('status-update', (data: any) => {
      setParticipants((prev) =>
        prev.map((p) => (p.id === data.userId ? { ...p, ...data.status } : p))
      );
      if (data.status?.isSpeaking) {
        setActiveSpeakerId(data.userId);
      }
    });

    const unsubMuteRequest = signaling.on('mute-request', () => {
      setIsAudioMuted(true);
      webrtc.toggleAudio(false);
      setParticipants((prev) =>
        prev.map((p) => (p.id === localUserId ? { ...p, isAudioMuted: true } : p))
      );
    });

    const unsubKicked = signaling.on('kicked', () => {
      setToastNotification('You have been removed from the meeting by the host.');
      setTimeout(() => {
        cleanupAndLeave();
      }, 1500);
    });

    const unsubMeetingEnded = signaling.on('meeting-ended', (data: any) => {
      setToastNotification(data?.reason || 'The meeting has been ended by the host.');
      setTimeout(() => {
        cleanupAndLeave();
      }, 1500);
    });

    const unsubSettingsUpdated = signaling.on('room-settings-updated', (data: any) => {
      if (data.settings) setSettings(data.settings);
    });

    const unsubBreakout = signaling.on('breakout-update', (data: any) => {
      setBreakoutRooms(data.rooms || []);
    });

    // Waiting Room event listeners
    const unsubWaitingRoomStatus = signaling.on('waiting-room-status', (data: any) => {
      setIsInWaitingRoom(true);
      if (data.message) setWaitingRoomNotice(data.message);
      if (data.hostName) setWaitingHostName(data.hostName);
    });

    const unsubWaitingRoomJoined = signaling.on('waiting-room-joined', (data: any) => {
      if (data.participant) {
        const newWaiting: Participant = {
          id: data.participant.id,
          name: data.participant.name,
          isLocal: false,
          isHost: false,
          isAudioMuted: false,
          isVideoMuted: false,
          isScreenSharing: false,
          isHandRaised: false,
          avatarColor: '#f59e0b',
        };
        setWaitingParticipants((prev) => {
          if (prev.some((p) => p.id === newWaiting.id)) return prev;
          return [...prev, newWaiting];
        });
        setToastNotification(`${data.participant.name} is in the Waiting Room`);
      }
    });

    const unsubWaitingRoomUpdated = signaling.on('waiting-room-updated', (data: any) => {
      if (data.waitingList) {
        const list: Participant[] = data.waitingList.map((w: any) => ({
          id: w.id,
          name: w.name,
          isLocal: false,
          isHost: false,
          isAudioMuted: false,
          isVideoMuted: false,
          isScreenSharing: false,
          isHandRaised: false,
          avatarColor: '#f59e0b',
        }));
        setWaitingParticipants(list);
      }
    });

    const unsubWaitingRoomDenied = signaling.on('waiting-room-denied', (data: any) => {
      setToastNotification(data?.reason || 'The host has declined your entry.');
      setTimeout(() => {
        cleanupAndLeave();
      }, 2000);
    });

    return () => {
      active = false;
      unsubRoomJoined();
      unsubUserJoined();
      unsubUserLeft();
      unsubSignal();
      unsubChat();
      unsubReaction();
      unsubHandRaise();
      unsubStatus();
      unsubMuteRequest();
      unsubKicked();
      unsubMeetingEnded();
      unsubSettingsUpdated();
      unsubBreakout();
      unsubWaitingRoomStatus();
      unsubWaitingRoomJoined();
      unsubWaitingRoomUpdated();
      unsubWaitingRoomDenied();
      signaling.disconnect();
      webrtc.cleanup();
      speechService.stop();
      recorder.stopRecording();
    };
  }, [roomId, localUserId, userName]);

  // Audio mute toggle
  const handleToggleAudio = () => {
    const nextState = !isAudioMuted;
    setIsAudioMuted(nextState);
    webrtc.toggleAudio(!nextState);

    setParticipants((prev) =>
      prev.map((p) => (p.id === localUserId ? { ...p, isAudioMuted: nextState } : p))
    );

    signaling.send({
      type: 'status-update',
      status: { isAudioMuted: nextState },
    });
  };

  // Video mute toggle
  const handleToggleVideo = () => {
    const nextState = !isVideoMuted;
    setIsVideoMuted(nextState);
    webrtc.toggleVideo(!nextState);

    setParticipants((prev) =>
      prev.map((p) => (p.id === localUserId ? { ...p, isVideoMuted: nextState } : p))
    );

    if (recorder.isRecording()) {
      recorder.updateSources({
        cameraStream: nextState ? null : localStreamRef.current,
      });
    }

    signaling.send({
      type: 'status-update',
      status: { isVideoMuted: nextState },
    });
  };

  // Screen share toggle
  const handleToggleScreenShare = async () => {
    if (!settings.allowScreenShare && !isHost) {
      setToastNotification('Screen sharing has been disabled by the meeting host.');
      setTimeout(() => setToastNotification(null), 4000);
      return;
    }

    if (isScreenSharing) {
      webrtc.stopScreenShare();
      setIsScreenSharing(false);
      if (recorder.isRecording()) {
        recorder.updateSources({
          cameraStream: isVideoMuted ? null : localStreamRef.current,
          screenStream: null,
        });
      }
      setParticipants((prev) =>
        prev.map((p) =>
          p.id === localUserId ? { ...p, isScreenSharing: false, screenStream: undefined } : p
        )
      );
      signaling.send({
        type: 'status-update',
        status: { isScreenSharing: false },
      });
      if (viewMode === 'screen-share') setViewMode('gallery');
    } else {
      const screenStream = await webrtc.startScreenShare();
      if (screenStream) {
        setIsScreenSharing(true);
        setViewMode('screen-share');
        if (recorder.isRecording()) {
          recorder.updateSources({
            cameraStream: isVideoMuted ? null : localStreamRef.current,
            screenStream,
          });
        }
        setParticipants((prev) =>
          prev.map((p) =>
            p.id === localUserId ? { ...p, isScreenSharing: true, screenStream } : p
          )
        );
        signaling.send({
          type: 'status-update',
          status: { isScreenSharing: true },
        });

        screenStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          if (recorder.isRecording()) {
            recorder.updateSources({
              cameraStream: isVideoMuted ? null : localStreamRef.current,
              screenStream: null,
            });
          }
          setParticipants((prev) =>
            prev.map((p) =>
              p.id === localUserId ? { ...p, isScreenSharing: false, screenStream: undefined } : p
            )
          );
          signaling.send({
            type: 'status-update',
            status: { isScreenSharing: false },
          });
        };
      }
    }
  };

  // Virtual Background Change
  const handleChangeBg = async (bgType: VirtualBackgroundType) => {
    setVirtualBg(bgType);
    const raw = rawCameraStreamRef.current || localStreamRef.current;
    if (!raw) return;

    if (bgType === 'none') {
      virtualBackground.stop();
      localStreamRef.current = raw;
      webrtc.setLocalStream(raw);
      setParticipants((prev) =>
        prev.map((p) => (p.id === localUserId ? { ...p, stream: raw } : p))
      );
      if (recorder.isRecording()) {
        recorder.updateSources({
          cameraStream: isVideoMuted ? null : raw,
        });
      }
    } else {
      const processed = await virtualBackground.start(raw, bgType);
      localStreamRef.current = processed;
      webrtc.setLocalStream(processed);
      setParticipants((prev) =>
        prev.map((p) => (p.id === localUserId ? { ...p, stream: processed } : p))
      );
      if (recorder.isRecording()) {
        recorder.updateSources({
          cameraStream: isVideoMuted ? null : processed,
        });
      }
    }
  };

  const handleInMeetingBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const optimized = await optimizeImageForBackground(file);
        await virtualBackground.setCustomImage(optimized);
        await handleChangeBg('custom');
      } catch (err) {
        console.warn('In-meeting background upload error', err);
      }
      if (inMeetingFileInputRef.current) inMeetingFileInputRef.current.value = '';
    }
  };

  // Hand raise toggle
  const handleToggleHandRaise = () => {
    const next = !isHandRaised;
    setIsHandRaised(next);
    setParticipants((prev) =>
      prev.map((p) => (p.id === localUserId ? { ...p, isHandRaised: next } : p))
    );
    signaling.send({
      type: 'hand-raise',
      isHandRaised: next,
    });
  };

  // Floating emoji reaction
  const triggerFloatingEmoji = (emoji: string) => {
    const newEmoji = {
      id: Math.random().toString(),
      emoji,
      x: 30 + Math.random() * 40, // 30-70% width
    };
    setFloatingEmojis((prev) => [...prev, newEmoji]);
    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((e) => e.id !== newEmoji.id));
    }, 2500);
  };

  const handleSendReaction = (emoji: string) => {
    triggerFloatingEmoji(emoji);
    setShowReactionsMenu(false);

    setParticipants((prev) =>
      prev.map((p) =>
        p.id === localUserId
          ? { ...p, reaction: { emoji, timestamp: Date.now() } }
          : p
      )
    );

    signaling.send({
      type: 'reaction',
      emoji,
    });
  };

  // Chat message send
  const handleSendMessage = (text: string, recipientId?: string, attachment?: any) => {
    const recipient = recipientId
      ? participants.find((p) => p.id === recipientId)
      : undefined;

    const newMsg: ChatMessage = {
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      senderId: localUserId,
      senderName: userName,
      text,
      timestamp: Date.now(),
      isPrivate: !!recipientId,
      recipientId,
      recipientName: recipient?.name,
      attachment,
    };

    setChatMessages((prev) => [...prev, newMsg]);

    signaling.send({
      type: 'chat',
      message: newMsg,
    });
  };

  // Recording Controls
  const handleToggleRecording = () => {
    if (isRecording) {
      recorder.stopRecording();
      setIsRecording(false);
      setIsRecordingPaused(false);
      setRecordingSeconds(0);
    } else {
      const activeScreenStream =
        participants.find((p) => p.isScreenSharing)?.screenStream ||
        (isScreenSharing ? webrtc.screenStream : null);

      if (localStreamRef.current || activeScreenStream) {
        const success = recorder.startRecording(
          {
            cameraStream: isVideoMuted ? null : localStreamRef.current,
            screenStream: activeScreenStream,
            audioStreams: localStreamRef.current ? [localStreamRef.current] : [],
          },
          (seconds) => {
            setRecordingSeconds(seconds);
          }
        );
        if (success) {
          setIsRecording(true);
        }
      }
    }
  };

  const handlePauseResumeRecording = () => {
    if (isRecordingPaused) {
      recorder.resumeRecording();
      setIsRecordingPaused(false);
    } else {
      recorder.pauseRecording();
      setIsRecordingPaused(true);
    }
  };

  // Sync recorder sources whenever screen share or mute states change
  useEffect(() => {
    if (isRecording) {
      const activeScreenStream =
        participants.find((p) => p.isScreenSharing)?.screenStream ||
        (isScreenSharing ? webrtc.screenStream : null);

      recorder.updateSources({
        cameraStream: isVideoMuted ? null : localStreamRef.current,
        screenStream: activeScreenStream,
      });
    }
  }, [isRecording, isScreenSharing, participants, isVideoMuted]);

  // Live Captions (Speech Recognition)
  const handleToggleCaptions = () => {
    const next = !captionsEnabled;
    setCaptionsEnabled(next);
    if (next) {
      speechService.setSpeaker(userName);
      speechService.start((caption) => {
        setActiveCaption(caption);
        // Clear active caption after 4 seconds if no new words
        setTimeout(() => {
          setActiveCaption((curr) => (curr?.id === caption.id ? null : curr));
        }, 4000);
      });
    } else {
      speechService.stop();
      setActiveCaption(null);
    }
  };

  // Host Actions
  const handleMuteAll = () => {
    signaling.send({
      type: 'host-action',
      action: 'mute-all',
    });
  };

  const handleMuteUser = (targetId: string) => {
    signaling.send({
      type: 'host-action',
      action: 'mute-user',
      targetId,
    });
  };

  const handleKickUser = (targetId: string) => {
    signaling.send({
      type: 'host-action',
      action: 'kick-user',
      targetId,
    });
  };

  const handleMakeHost = (targetId: string) => {
    setParticipants((prev) =>
      prev.map((p) => ({ ...p, isHost: p.id === targetId }))
    );
    setIsHost(targetId === localUserId);
  };

  const handleLowerAllHands = () => {
    setParticipants((prev) => prev.map((p) => ({ ...p, isHandRaised: false })));
  };

  const handleUpdateSettings = (newSettings: Partial<MeetingSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    if (newSettings.isLocked !== undefined) {
      signaling.send({
        type: 'host-action',
        action: 'lock',
        value: updated.isLocked,
      });
    }
    if (newSettings.waitingRoomEnabled !== undefined) {
      signaling.send({
        type: 'host-action',
        action: 'waiting-room-toggle',
        value: updated.waitingRoomEnabled,
      });
    }
  };

  const handleAdmitWaitingUser = (userId: string) => {
    signaling.send({
      type: 'host-action',
      action: 'admit-user',
      targetId: userId,
    });
    setWaitingParticipants((prev) => prev.filter((p) => p.id !== userId));
  };

  const handleDenyWaitingUser = (userId: string) => {
    signaling.send({
      type: 'host-action',
      action: 'deny-user',
      targetId: userId,
    });
    setWaitingParticipants((prev) => prev.filter((p) => p.id !== userId));
  };

  const handleAdmitAllWaiting = () => {
    signaling.send({
      type: 'host-action',
      action: 'admit-all',
    });
    setWaitingParticipants([]);
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/?room=${roomId}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Local participant
  const localParticipant = participants.find((p) => p.isLocal) || {
    id: localUserId,
    name: userName,
    isLocal: true,
    isHost,
    isAudioMuted,
    isVideoMuted,
    isScreenSharing,
    isHandRaised,
    stream: localStreamRef.current || undefined,
  };

  // Identify active speaker or pinned participant
  const displaySpeakerParticipant =
    participants.find((p) => p.id === pinnedParticipantId) ||
    participants.find((p) => p.id === activeSpeakerId) ||
    localParticipant;

  return (
    <div className="relative w-screen h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden select-none">
      {/* Top Header Bar */}
      <header className="h-12 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur px-4 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          {/* OpenRoom Brand */}
          <div className="flex items-center gap-2 pr-2 border-r border-slate-800">
            <OpenDoorIcon className="w-5 h-5" />
            <span className="font-semibold text-xs tracking-tight text-white hidden sm:inline">OpenRoom</span>
          </div>

          {/* Meeting ID & Security Badge */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSecurity(true)}
              className="p-1 rounded-lg hover:bg-slate-800 text-emerald-400 flex items-center gap-1 text-xs font-medium"
              title="Meeting Security Settings"
            >
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Secure</span>
            </button>

            <span className="text-slate-600">|</span>

            <div className="flex items-center gap-1.5 text-xs text-slate-300">
              <span className="font-semibold text-white">Room:</span>
              <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-200">
                {roomId}
              </span>
              <button
                onClick={handleCopyLink}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                title="Copy Meeting Link"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {settings.isLocked && (
              <span className="flex items-center gap-1 text-[11px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full">
                <Lock className="w-3 h-3" />
                Locked
              </span>
            )}
          </div>

          {/* Recording Status Banner */}
          {isRecording && (
            <div className="flex items-center gap-2 bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs px-2.5 py-0.5 rounded-full shadow-sm">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span className="font-semibold font-mono tracking-wider">
                REC {formatTimer(recordingSeconds)}
              </span>
              <button
                onClick={handlePauseResumeRecording}
                className="hover:text-white transition-colors"
                title={isRecordingPaused ? 'Resume Recording' : 'Pause Recording'}
              >
                {isRecordingPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
              </button>
            </div>
          )}
        </div>

        {/* Top Right Controls (View Modes & Fullscreen) */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* View Modes */}
          <div className="bg-slate-800/80 p-0.5 rounded-xl border border-slate-700/60 flex items-center gap-0.5">
            <button
              onClick={() => setViewMode('gallery')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                viewMode === 'gallery'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Gallery</span>
            </button>

            <button
              onClick={() => setViewMode('speaker')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                viewMode === 'speaker'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Speaker</span>
            </button>

            <button
              onClick={() => setViewMode('whiteboard')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                viewMode === 'whiteboard'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Whiteboard</span>
            </button>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Content Area (Video Canvas / Whiteboard + Sidebars) */}
      {isInWaitingRoom ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-950 text-center select-none overflow-y-auto">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin" />
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Please wait, the meeting host will let you in soon
              </h2>
              <p className="text-xs text-slate-400">
                You are currently in the waiting room for Room <span className="font-mono text-slate-200">#{roomId}</span>.
              </p>
            </div>

            {/* Room Review Self-Check */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 text-left">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <span>Room Review & Self Check</span>
                <span className="text-emerald-400 font-mono normal-case">Ready to enter</span>
              </div>
              <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center">
                <video
                  ref={(v) => {
                    if (v && localStreamRef.current && v.srcObject !== localStreamRef.current) {
                      v.srcObject = localStreamRef.current;
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${isVideoMuted ? 'hidden' : 'block'} scale-x-[-1]`}
                />
                {isVideoMuted && (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-1.5">
                    <VideoOff className="w-6 h-6" />
                    <span>Camera is turned off</span>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded text-[11px] text-slate-200">
                  {isAudioMuted ? <MicOff className="w-3 h-3 text-rose-400" /> : <Mic className="w-3 h-3 text-emerald-400" />}
                  <span>{userName} (You)</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  onClick={handleToggleAudio}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isAudioMuted ? 'bg-rose-600/90 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  {isAudioMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  <span>{isAudioMuted ? 'Unmute' : 'Mute'}</span>
                </button>
                <button
                  onClick={handleToggleVideo}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isVideoMuted ? 'bg-rose-600/90 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  {isVideoMuted ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
                  <span>{isVideoMuted ? 'Start Video' : 'Stop Video'}</span>
                </button>
              </div>
            </div>

            <button
              onClick={cleanupAndLeave}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span>Leave Waiting Room</span>
            </button>
          </div>
        </div>
      ) : (
      <div className="flex-1 flex overflow-hidden relative">
        {/* Central Stage */}
        <div className="flex-1 relative flex flex-col p-3 sm:p-4 overflow-hidden bg-slate-950">
          {/* View Mode: Whiteboard */}
          {viewMode === 'whiteboard' ? (
            <div className="w-full h-full rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
              <WhiteboardView onClose={() => setViewMode('gallery')} />
            </div>
          ) : viewMode === 'speaker' || viewMode === 'screen-share' ? (
            /* View Mode: Speaker / Screen Share */
            <div className="w-full h-full flex flex-col gap-3">
              {/* Top/Side Thumbnail Strip */}
              <div className="h-28 sm:h-32 flex gap-2.5 overflow-x-auto pb-1 shrink-0 scrollbar-none">
                {participants.map((p) => (
                  <div key={p.id} className="w-44 h-full shrink-0">
                    <VideoTile
                      participant={p}
                      isPinned={pinnedParticipantId === p.id}
                      onTogglePin={(id) =>
                        setPinnedParticipantId(pinnedParticipantId === id ? null : id)
                      }
                    />
                  </div>
                ))}
              </div>

              {/* Main Spotlighted Speaker */}
              <div className="flex-1 rounded-2xl overflow-hidden shadow-2xl border border-slate-800 bg-slate-900">
                <VideoTile
                  participant={displaySpeakerParticipant}
                  isSpeakerView
                  isPinned={pinnedParticipantId === displaySpeakerParticipant.id}
                  onTogglePin={(id) =>
                    setPinnedParticipantId(pinnedParticipantId === id ? null : id)
                  }
                />
              </div>
            </div>
          ) : (
            /* View Mode: Dynamic Responsive Gallery Grid */
            <div
              className={`w-full h-full grid gap-3 sm:gap-4 p-1 auto-rows-fr ${
                participants.length <= 1
                  ? 'grid-cols-1'
                  : participants.length === 2
                  ? 'grid-cols-1 md:grid-cols-2'
                  : participants.length <= 4
                  ? 'grid-cols-2'
                  : participants.length <= 6
                  ? 'grid-cols-2 md:grid-cols-3'
                  : 'grid-cols-3 md:grid-cols-4'
              }`}
            >
              {participants.map((p) => (
                <div key={p.id} className="w-full h-full min-h-[140px]">
                  <VideoTile
                    participant={p}
                    isPinned={pinnedParticipantId === p.id}
                    onTogglePin={(id) =>
                      setPinnedParticipantId(pinnedParticipantId === id ? null : id)
                    }
                  />
                </div>
              ))}
            </div>
          )}

          {/* Floating Emoji Particles Layer */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
            {floatingEmojis.map((item) => (
              <div
                key={item.id}
                style={{ left: `${item.x}%` }}
                className="absolute bottom-16 text-5xl sm:text-6xl animate-float-up drop-shadow-2xl"
              >
                {item.emoji}
              </div>
            ))}
          </div>

          {/* Live Subtitles / Closed Captions Over-Video Overlay */}
          {captionsEnabled && activeCaption && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 max-w-2xl w-[90%] bg-slate-950/85 backdrop-blur-md border border-slate-800 rounded-2xl p-3 text-center shadow-2xl pointer-events-none z-30 animate-fade-in">
              <span className="text-xs font-semibold text-blue-400 block mb-0.5">
                {activeCaption.speakerName}
              </span>
              <p className="text-sm font-medium text-slate-100 leading-snug">
                {activeCaption.text}
              </p>
            </div>
          )}
        </div>

        {/* Sidebars */}
        {showParticipants && (
          <ParticipantsSidebar
            participants={participants}
            localParticipant={localParticipant}
            isHost={isHost}
            waitingCount={waitingParticipants.length}
            onOpenWaitingRoom={() => setShowWaitingRoom(true)}
            onClose={() => setShowParticipants(false)}
            onMuteAll={handleMuteAll}
            onLowerAllHands={handleLowerAllHands}
            onMuteParticipant={handleMuteUser}
            onKickParticipant={handleKickUser}
            onMakeHost={handleMakeHost}
            onInvite={() => setShowInvite(true)}
          />
        )}

        {showChat && (
          <ChatSidebar
            messages={chatMessages}
            participants={participants}
            localParticipant={localParticipant}
            onSendMessage={handleSendMessage}
            onClose={() => setShowChat(false)}
          />
        )}
      </div>
      )}

      {/* Host Floating Alert when participants are waiting in the waiting room */}
      {isHost && waitingParticipants.length > 0 && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 bg-amber-950/90 border border-amber-600/60 text-amber-100 text-xs px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md animate-fade-in">
          <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
          <span>
            <strong>{waitingParticipants[0].name}</strong>
            {waitingParticipants.length > 1
              ? ` and ${waitingParticipants.length - 1} other(s) are in the Waiting Room`
              : ' is waiting to join the meeting'}
          </span>
          <div className="flex items-center gap-1.5 ml-2">
            <button
              onClick={() => handleAdmitWaitingUser(waitingParticipants[0].id)}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow transition-colors cursor-pointer"
            >
              Admit
            </button>
            <button
              onClick={() => setShowWaitingRoom(true)}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition-colors cursor-pointer"
            >
              Review ({waitingParticipants.length})
            </button>
          </div>
        </div>
      )}

      {/* Bottom Meeting Controls Toolbar (Signature Zoom Dark Polished Style) */}
      <footer className="h-18 bg-slate-900 border-t border-slate-800/90 px-3 sm:px-6 flex items-center justify-between z-40 shrink-0 shadow-2xl">
        {/* Left Side: Audio & Video Buttons with Carets */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Microphone Mute/Unmute */}
          <div className="relative flex items-center">
            <button
              onClick={handleToggleAudio}
              className={`flex flex-col items-center justify-center w-14 sm:w-16 h-14 rounded-xl transition-all ${
                isAudioMuted
                  ? 'text-rose-500 hover:bg-slate-800'
                  : 'text-slate-200 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {isAudioMuted ? <MicOff className="w-5 h-5 text-rose-500" /> : <Mic className="w-5 h-5" />}
              <span className="text-[10px] mt-1 font-medium">
                {isAudioMuted ? 'Unmute' : 'Mute'}
              </span>
            </button>
            <button
              onClick={() => setShowAudioMenu(!showAudioMenu)}
              className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>

            {/* Audio Popup Menu */}
            {showAudioMenu && (
              <div className="absolute bottom-16 left-0 w-60 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-2 z-50 text-xs space-y-1">
                <span className="px-2 py-1 text-slate-400 font-semibold block uppercase text-[10px]">
                  Select a Microphone
                </span>
                <button
                  onClick={() => setShowAudioMenu(false)}
                  className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-700 text-slate-200 flex items-center justify-between"
                >
                  <span>Default Microphone (Built-in)</span>
                  <Check className="w-3.5 h-3.5 text-blue-400" />
                </button>
                <div className="border-t border-slate-700 my-1" />
                <button
                  onClick={() => {
                    setShowAudioMenu(false);
                    setShowSettings(true);
                  }}
                  className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-700 text-blue-400"
                >
                  Audio Settings...
                </button>
              </div>
            )}
          </div>

          {/* Camera Start/Stop Video */}
          <div className="relative flex items-center">
            <button
              onClick={handleToggleVideo}
              className={`flex flex-col items-center justify-center w-14 sm:w-16 h-14 rounded-xl transition-all ${
                isVideoMuted
                  ? 'text-rose-500 hover:bg-slate-800'
                  : 'text-slate-200 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {isVideoMuted ? <VideoOff className="w-5 h-5 text-rose-500" /> : <Video className="w-5 h-5" />}
              <span className="text-[10px] mt-1 font-medium">
                {isVideoMuted ? 'Start Video' : 'Stop Video'}
              </span>
            </button>
            <button
              onClick={() => setShowVideoMenu(!showVideoMenu)}
              className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>

            {/* Video Popup Menu (Virtual Backgrounds) */}
            {showVideoMenu && (
              <div className="absolute bottom-16 left-0 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-2 z-50 text-xs space-y-1">
                <span className="px-2 py-1 text-slate-400 font-semibold block uppercase text-[10px]">
                  Virtual Background
                </span>
                {(
                  [
                    'none',
                    'half-blur',
                    'blur',
                    'heavy-blur',
                    'office',
                    'space',
                    'studio',
                  ] as VirtualBackgroundType[]
                ).map((bg) => (
                  <button
                    key={bg}
                    onClick={() => {
                      handleChangeBg(bg);
                      setShowVideoMenu(false);
                    }}
                    className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-700 text-slate-200 flex items-center justify-between capitalize"
                  >
                    <span>{bg.replace('-', ' ')}</span>
                    {virtualBg === bg && <Check className="w-3.5 h-3.5 text-blue-400" />}
                  </button>
                ))}

                {virtualBackground.getCustomImage() && (
                  <button
                    onClick={() => {
                      handleChangeBg('custom');
                      setShowVideoMenu(false);
                    }}
                    className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-700 text-slate-200 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <img
                        src={virtualBackground.getCustomImage()!}
                        alt="Custom thumbnail"
                        className="w-3.5 h-3.5 rounded object-cover"
                      />
                      <span>Custom Image</span>
                    </div>
                    {virtualBg === 'custom' && <Check className="w-3.5 h-3.5 text-blue-400" />}
                  </button>
                )}

                <button
                  onClick={() => inMeetingFileInputRef.current?.click()}
                  className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-700 text-emerald-400 flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Upload Background Image</span>
                </button>

                <input
                  ref={inMeetingFileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  onChange={handleInMeetingBgUpload}
                  className="hidden"
                />

                <div className="border-t border-slate-700 my-1" />
                <button
                  onClick={() => {
                    setShowVideoMenu(false);
                    setShowSettings(true);
                  }}
                  className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-700 text-blue-400"
                >
                  Video Settings...
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Center: Meeting Collaboration Tools */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Security (Host only) */}
          <button
            onClick={() => setShowSecurity(true)}
            className="flex flex-col items-center justify-center w-12 sm:w-16 h-14 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Shield className="w-5 h-5" />
            <span className="text-[10px] mt-1 font-medium hidden sm:inline">Security</span>
          </button>

          {/* Participants */}
          <button
            onClick={() => setShowParticipants(!showParticipants)}
            className={`flex flex-col items-center justify-center w-12 sm:w-16 h-14 rounded-xl relative transition-colors ${
              showParticipants ? 'bg-slate-800 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="text-[10px] mt-1 font-medium hidden sm:inline">Participants</span>
            <span className="absolute top-2 right-2 sm:right-3 bg-blue-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              {participants.length}
            </span>
          </button>

          {/* Chat */}
          <button
            onClick={() => {
              setShowChat(!showChat);
              setUnreadChatCount(0);
            }}
            className={`flex flex-col items-center justify-center w-12 sm:w-16 h-14 rounded-xl relative transition-colors ${
              showChat ? 'bg-slate-800 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-[10px] mt-1 font-medium hidden sm:inline">Chat</span>
            {unreadChatCount > 0 && (
              <span className="absolute top-2 right-2 sm:right-3 bg-emerald-500 text-slate-950 text-[10px] px-1.5 py-0.2 rounded-full font-bold animate-pulse">
                {unreadChatCount}
              </span>
            )}
          </button>

          {/* Share Screen (Zoom signature green button) */}
          <button
            onClick={handleToggleScreenShare}
            className={`flex flex-col items-center justify-center w-14 sm:w-18 h-14 rounded-xl transition-all shadow-md ${
              isScreenSharing
                ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                : 'text-emerald-400 hover:text-emerald-300 hover:bg-slate-800'
            }`}
          >
            <ScreenShare className="w-5 h-5 text-emerald-400" />
            <span className="text-[10px] mt-1 font-bold text-emerald-400">
              {isScreenSharing ? 'Stop Share' : 'Share Screen'}
            </span>
          </button>

          {/* Whiteboard */}
          <button
            onClick={() =>
              setViewMode(viewMode === 'whiteboard' ? 'gallery' : 'whiteboard')
            }
            className={`flex flex-col items-center justify-center w-12 sm:w-16 h-14 rounded-xl transition-colors ${
              viewMode === 'whiteboard'
                ? 'bg-slate-800 text-blue-400'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <PenTool className="w-5 h-5" />
            <span className="text-[10px] mt-1 font-medium hidden sm:inline">Whiteboard</span>
          </button>

          {/* Record */}
          <button
            onClick={handleToggleRecording}
            className={`flex flex-col items-center justify-center w-12 sm:w-16 h-14 rounded-xl transition-colors ${
              isRecording
                ? 'text-rose-500 bg-rose-950/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            {isRecording ? <Square className="w-5 h-5 fill-rose-500 text-rose-500" /> : <Circle className="w-5 h-5" />}
            <span className="text-[10px] mt-1 font-medium hidden sm:inline">
              {isRecording ? 'Stop Rec' : 'Record'}
            </span>
          </button>

          {/* Breakout Rooms */}
          <button
            onClick={() => setShowBreakout(true)}
            className="flex flex-col items-center justify-center w-12 sm:w-16 h-14 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <DoorOpen className="w-5 h-5 text-indigo-400" />
            <span className="text-[10px] mt-1 font-medium hidden sm:inline">Breakout</span>
          </button>

          {/* Reactions Popover */}
          <div className="relative">
            <button
              onClick={() => setShowReactionsMenu(!showReactionsMenu)}
              className="flex flex-col items-center justify-center w-12 sm:w-16 h-14 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <Smile className="w-5 h-5" />
              <span className="text-[10px] mt-1 font-medium hidden sm:inline">Reactions</span>
            </button>

            {showReactionsMenu && (
              <div className="absolute bottom-16 right-0 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-3 z-50 flex flex-col gap-2 w-56">
                <div className="flex items-center justify-between">
                  {EMOJI_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleSendReaction(emoji)}
                      className="text-2xl hover:scale-125 transition-transform p-1"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                <div className="border-t border-slate-700 pt-2">
                  <button
                    onClick={() => {
                      handleToggleHandRaise();
                      setShowReactionsMenu(false);
                    }}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                      isHandRaised
                        ? 'bg-amber-500 text-slate-950 shadow-md'
                        : 'bg-slate-700/80 hover:bg-slate-700 text-slate-200'
                    }`}
                  >
                    <Hand className="w-4 h-4" />
                    <span>{isHandRaised ? 'Lower Hand' : 'Raise Hand'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Captions (CC) */}
          <button
            onClick={handleToggleCaptions}
            className={`flex flex-col items-center justify-center w-12 sm:w-16 h-14 rounded-xl transition-colors ${
              captionsEnabled
                ? 'text-emerald-400 bg-slate-800'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Live Closed Captions"
          >
            <Subtitles className="w-5 h-5" />
            <span className="text-[10px] mt-1 font-medium hidden sm:inline">Captions</span>
          </button>
        </div>

        {/* Right Side: End / Leave Meeting Button (Zoom signature red button) */}
        <div>
          <button
            onClick={() => setShowEndModal(true)}
            className="px-4 sm:px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-rose-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <PhoneOff className="w-4 h-4" />
            <span>End</span>
          </button>
        </div>
      </footer>

      {/* End / Leave Meeting Modal */}
      {showEndModal && (
        <EndMeetingModal
          isHost={isHost}
          participantCount={participants.length}
          onEndForAll={() => {
            signaling.send({
              type: 'host-action',
              action: 'end-meeting-for-all',
            });
            cleanupAndLeave();
          }}
          onLeave={() => {
            cleanupAndLeave();
          }}
          onCancel={() => setShowEndModal(false)}
        />
      )}

      {/* In-Meeting Toast Notification */}
      {toastNotification && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border border-slate-700 text-slate-100 text-xs px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2.5 backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
          <span>{toastNotification}</span>
        </div>
      )}

      {/* Breakout Rooms Modal */}
      {showBreakout && (
        <BreakoutRoomsModal
          participants={participants}
          breakoutRooms={breakoutRooms}
          onUpdateRooms={(rooms) => {
            setBreakoutRooms(rooms);
            signaling.send({ type: 'breakout-update', rooms });
          }}
          onBroadcastMessage={(msg) => {
            setActiveBreakoutNotice(msg);
            setTimeout(() => setActiveBreakoutNotice(null), 5000);
          }}
          onClose={() => setShowBreakout(false)}
        />
      )}

      {/* Security Modal */}
      {showSecurity && (
        <SecurityModal
          settings={settings}
          waitingCount={waitingParticipants.length}
          onOpenWaitingRoom={() => {
            setShowSecurity(false);
            setShowWaitingRoom(true);
          }}
          onUpdateSettings={handleUpdateSettings}
          onClose={() => setShowSecurity(false)}
        />
      )}

      {/* Invite Modal */}
      {showInvite && (
        <InviteModal
          roomId={roomId}
          passcode="123456"
          onClose={() => setShowInvite(false)}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          currentBg={virtualBg}
          onChangeBg={handleChangeBg}
          mirrorVideo={mirrorVideo}
          onToggleMirror={setMirrorVideo}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Waiting Room Modal (Host review & admit queue) */}
      {showWaitingRoom && (
        <WaitingRoomModal
          waitingParticipants={waitingParticipants}
          onAdmit={handleAdmitWaitingUser}
          onDeny={handleDenyWaitingUser}
          onAdmitAll={handleAdmitAllWaiting}
          onClose={() => setShowWaitingRoom(false)}
        />
      )}
    </div>
  );
};
