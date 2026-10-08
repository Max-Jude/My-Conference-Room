import { signaling } from './signaling';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export class WebRTCService {
  private localStream: MediaStream | null = null;
  public screenStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private audioLevelCheckInterval: any = null;
  private onRemoteStreamCallback?: (userId: string, stream: MediaStream) => void;
  private onSpeakingChangeCallback?: (isSpeaking: boolean) => void;

  public async getLocalStream(audio = true, video = true): Promise<MediaStream> {
    if (this.localStream) {
      return this.localStream;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audio
          ? {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            }
          : false,
        video: video
          ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 },
            }
          : false,
      });

      this.localStream = stream;
      this.setupAudioAnalysis(stream);
      return stream;
    } catch (err) {
      console.warn('Could not acquire user media directly:', err);
      // Create empty/synthetic fallback stream if permissions are denied or in testing
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, 640, 360);
      }
      const stream = canvas.captureStream(10);
      this.localStream = stream;
      return stream;
    }
  }

  public setCallbacks(
    onRemoteStream: (userId: string, stream: MediaStream) => void,
    onSpeakingChange?: (isSpeaking: boolean) => void
  ) {
    this.onRemoteStreamCallback = onRemoteStream;
    this.onSpeakingChangeCallback = onSpeakingChange;
  }

  private setupAudioAnalysis(stream: MediaStream) {
    try {
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) return;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let speakingCount = 0;

      if (this.audioLevelCheckInterval) clearInterval(this.audioLevelCheckInterval);

      this.audioLevelCheckInterval = setInterval(() => {
        if (!this.analyser) return;
        this.analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;

        // Threshold for speaking
        const isSpeaking = avg > 20;
        if (isSpeaking) {
          speakingCount++;
          if (speakingCount >= 2 && this.onSpeakingChangeCallback) {
            this.onSpeakingChangeCallback(true);
          }
        } else {
          speakingCount = 0;
          if (this.onSpeakingChangeCallback) {
            this.onSpeakingChangeCallback(false);
          }
        }
      }, 200);
    } catch (e) {
      console.warn('Audio analysis setup error:', e);
    }
  }

  public toggleAudio(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  public toggleVideo(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  public async startScreenShare(): Promise<MediaStream | null> {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      this.screenStream = stream;

      // Replace video tracks in peer connections with screen share track
      const screenTrack = stream.getVideoTracks()[0];
      for (const [_, pc] of this.peerConnections.entries()) {
        const senders = pc.getSenders();
        const videoSender = senders.find((s) => s.track?.kind === 'video');
        if (videoSender && screenTrack) {
          videoSender.replaceTrack(screenTrack);
        }
      }

      screenTrack.onended = () => {
        this.stopScreenShare();
      };

      return stream;
    } catch (err) {
      console.warn('Screen share cancelled or failed:', err);
      return null;
    }
  }

  public stopScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => track.stop());
      this.screenStream = null;

      // Revert back to local webcam video track
      const localVideoTrack = this.localStream?.getVideoTracks()[0] || null;
      for (const [_, pc] of this.peerConnections.entries()) {
        const senders = pc.getSenders();
        const videoSender = senders.find((s) => s.track?.kind === 'video');
        if (videoSender && localVideoTrack) {
          videoSender.replaceTrack(localVideoTrack);
        }
      }
    }
  }

  public replaceVideoTrack(newTrack: MediaStreamTrack) {
    for (const [_, pc] of this.peerConnections.entries()) {
      const senders = pc.getSenders();
      const videoSender = senders.find((s) => s.track?.kind === 'video');
      if (videoSender) {
        videoSender.replaceTrack(newTrack).catch((err) => {
          console.warn('replaceTrack error', err);
        });
      }
    }
  }

  public setLocalStream(stream: MediaStream) {
    this.localStream = stream;
    const track = stream.getVideoTracks()[0];
    if (track) {
      this.replaceVideoTrack(track);
    }
  }

  public async initiatePeerConnection(targetUserId: string, isInitiator: boolean) {
    if (this.peerConnections.has(targetUserId)) {
      return this.peerConnections.get(targetUserId)!;
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    this.peerConnections.set(targetUserId, pc);

    // Add local tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // ICE Candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        signaling.send({
          type: 'signal',
          targetId: targetUserId,
          signalData: {
            type: 'candidate',
            candidate: event.candidate,
          },
        });
      }
    };

    // Remote track handler
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        if (this.onRemoteStreamCallback) {
          this.onRemoteStreamCallback(targetUserId, event.streams[0]);
        }
      }
    };

    if (isInitiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        signaling.send({
          type: 'signal',
          targetId: targetUserId,
          signalData: {
            type: 'offer',
            sdp: offer,
          },
        });
      } catch (err) {
        console.error('Failed to create offer:', err);
      }
    }

    return pc;
  }

  public async handleSignal(senderId: string, signalData: any) {
    let pc = this.peerConnections.get(senderId);

    if (!pc) {
      pc = await this.initiatePeerConnection(senderId, false);
    }

    try {
      if (signalData.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        signaling.send({
          type: 'signal',
          targetId: senderId,
          signalData: {
            type: 'answer',
            sdp: answer,
          },
        });
      } else if (signalData.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
      } else if (signalData.type === 'candidate' && signalData.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
      }
    } catch (err) {
      console.error('Error handling WebRTC signal:', err);
    }
  }

  public removePeer(userId: string) {
    const pc = this.peerConnections.get(userId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(userId);
    }
  }

  public cleanup() {
    if (this.audioLevelCheckInterval) {
      clearInterval(this.audioLevelCheckInterval);
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    this.stopScreenShare();

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    for (const [_, pc] of this.peerConnections.entries()) {
      pc.close();
    }
    this.peerConnections.clear();
  }
}

export const webrtc = new WebRTCService();
