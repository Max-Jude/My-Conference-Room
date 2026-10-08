export interface Participant {
  id: string;
  name: string;
  isLocal: boolean;
  isHost: boolean;
  isCoHost?: boolean;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  isSpeaking?: boolean;
  avatarColor?: string;
  inWaitingRoom?: boolean;
  breakoutRoomId?: string | null;
  stream?: MediaStream;
  screenStream?: MediaStream;
  reaction?: {
    emoji: string;
    timestamp: number;
  };
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isPrivate?: boolean;
  recipientId?: string;
  recipientName?: string;
  attachment?: {
    name: string;
    size: string;
    type: string;
  };
}

export interface WhiteboardElement {
  id: string;
  type: 'draw' | 'line' | 'rect' | 'circle' | 'text' | 'note';
  points?: { x: number; y: number }[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  color: string;
  strokeWidth: number;
  text?: string;
}

export interface MeetingSettings {
  isLocked: boolean;
  waitingRoomEnabled: boolean;
  allowScreenShare: boolean;
  allowChat: boolean;
  allowUnmute: boolean;
  allowWhiteboard: boolean;
  passcode?: string;
}

export interface ScheduledMeeting {
  id: string;
  title: string;
  scheduledTime: string;
  durationMinutes: number;
  passcode: string;
  waitingRoom: boolean;
  createdAt: number;
}

export interface BreakoutRoom {
  id: string;
  name: string;
  participantIds: string[];
}

export interface Caption {
  id: string;
  speakerName: string;
  text: string;
  timestamp: number;
  isFinal: boolean;
}

export type ViewMode = 'gallery' | 'speaker' | 'whiteboard' | 'screen-share';

export type VirtualBackgroundType =
  | 'none'
  | 'half-blur'
  | 'blur'
  | 'heavy-blur'
  | 'office'
  | 'studio'
  | 'space'
  | 'custom';
