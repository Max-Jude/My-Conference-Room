import React, { useState, useEffect } from 'react';
import { Lobby } from './components/Lobby';
import { MeetingRoom } from './components/MeetingRoom';
import { VirtualBackgroundType } from './types';

export default function App() {
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('Guest User');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [startWithScreenShare, setStartWithScreenShare] = useState(false);
  const [initialVirtualBg, setInitialVirtualBg] = useState<VirtualBackgroundType>('none');
  const [initialRoomFromUrl, setInitialRoomFromUrl] = useState<string | undefined>(undefined);

  // Check URL query parameters for direct invite link (?room=xyz)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      if (roomParam) {
        setInitialRoomFromUrl(roomParam);
      }
    }
  }, []);

  const handleStartMeeting = (
    roomId: string,
    name: string,
    audio: boolean,
    video: boolean,
    screenShare: boolean = false,
    virtualBg: VirtualBackgroundType = 'none'
  ) => {
    setCurrentRoomId(roomId);
    setUserName(name);
    setAudioEnabled(audio);
    setVideoEnabled(video);
    setStartWithScreenShare(screenShare);
    setInitialVirtualBg(virtualBg);

    // Update browser URL without reloading
    const newUrl = `${window.location.pathname}?room=${encodeURIComponent(roomId)}`;
    window.history.pushState({ roomId }, '', newUrl);
  };

  const handleLeaveMeeting = () => {
    setCurrentRoomId(null);
    setStartWithScreenShare(false);

    // Revert URL to home
    window.history.pushState({}, '', window.location.pathname);
  };

  return (
    <div className="w-full h-full min-h-screen bg-slate-950 text-slate-100">
      {currentRoomId ? (
        <MeetingRoom
          roomId={currentRoomId}
          userName={userName}
          initialAudioEnabled={audioEnabled}
          initialVideoEnabled={videoEnabled}
          startWithScreenShare={startWithScreenShare}
          initialVirtualBg={initialVirtualBg}
          onLeaveMeeting={handleLeaveMeeting}
        />
      ) : (
        <Lobby
          onStartMeeting={handleStartMeeting}
          initialRoomId={initialRoomFromUrl}
        />
      )}
    </div>
  );
}
