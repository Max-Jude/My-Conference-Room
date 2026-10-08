export interface RecorderStreamConfig {
  cameraStream?: MediaStream | null;
  screenStream?: MediaStream | null;
  audioStreams?: MediaStream[];
}

export class MeetingRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private startTime: number = 0;
  private elapsedSeconds: number = 0;
  private timerInterval: any = null;
  private onTimeUpdateCallback?: (seconds: number) => void;
  private isPaused: boolean = false;

  // Compositor elements
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private cameraVideo: HTMLVideoElement | null = null;
  private screenVideo: HTMLVideoElement | null = null;
  private animFrameId: number | null = null;

  // Audio mixer
  private audioContext: AudioContext | null = null;
  private audioDestination: MediaStreamAudioDestinationNode | null = null;
  private connectedAudioNodes: MediaStreamAudioSourceNode[] = [];

  // Active sources
  private cameraStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;

  public isRecording(): boolean {
    return this.mediaRecorder !== null && this.mediaRecorder.state !== 'inactive';
  }

  public getIsPaused(): boolean {
    return this.isPaused;
  }

  public startRecording(
    streamOrConfig: MediaStream | RecorderStreamConfig,
    onTimeUpdate?: (seconds: number) => void
  ): boolean {
    try {
      this.stopRecording(); // ensure clean state

      this.recordedChunks = [];
      this.onTimeUpdateCallback = onTimeUpdate;
      this.elapsedSeconds = 0;
      this.isPaused = false;

      let config: RecorderStreamConfig;
      if (streamOrConfig instanceof MediaStream) {
        config = {
          cameraStream: streamOrConfig,
          audioStreams: [streamOrConfig],
        };
      } else {
        config = streamOrConfig;
      }

      this.cameraStream = config.cameraStream || null;
      this.screenStream = config.screenStream || null;

      // 1. Setup Compositor Canvas (1280x720 standard 720p HD @ 30fps)
      this.canvas = document.createElement('canvas');
      this.canvas.width = 1280;
      this.canvas.height = 720;
      this.ctx = this.canvas.getContext('2d', { alpha: false });

      // 2. Setup Hidden Video Players for rendering frames
      this.cameraVideo = document.createElement('video');
      this.cameraVideo.muted = true;
      this.cameraVideo.playsInline = true;
      this.cameraVideo.autoplay = true;

      this.screenVideo = document.createElement('video');
      this.screenVideo.muted = true;
      this.screenVideo.playsInline = true;
      this.screenVideo.autoplay = true;

      this.bindVideoStreams();

      // 3. Setup Web Audio Mixer (merges mic audio + presentation/system audio)
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.audioContext = new AudioCtx();
          if (this.audioContext.state === 'suspended') {
            this.audioContext.resume().catch(() => {});
          }
          this.audioDestination = this.audioContext.createMediaStreamDestination();
          this.setupAudioTracks(config);
        }
      } catch (audioErr) {
        console.warn('Audio mixer initialization notice:', audioErr);
      }

      // 4. Start Compositor Animation Loop
      this.startCompositorLoop();

      // 5. Build Final MediaStream for MediaRecorder
      const canvasStream = this.canvas.captureStream(30);
      const outputTracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];

      if (this.audioDestination && this.audioDestination.stream.getAudioTracks().length > 0) {
        outputTracks.push(...this.audioDestination.stream.getAudioTracks());
      } else if (this.cameraStream && this.cameraStream.getAudioTracks().length > 0) {
        outputTracks.push(...this.cameraStream.getAudioTracks());
      }

      const compositeStream = new MediaStream(outputTracks);

      // Select best supported MIME type
      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4',
      ];
      const selectedMime = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) || '';

      this.mediaRecorder = new MediaRecorder(
        compositeStream,
        selectedMime ? { mimeType: selectedMime } : undefined
      );

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.saveRecording();
        this.cleanup();
      };

      this.mediaRecorder.start(1000); // 1-second timeslices
      this.startTime = Date.now();

      this.timerInterval = setInterval(() => {
        if (!this.isPaused) {
          this.elapsedSeconds++;
          if (this.onTimeUpdateCallback) {
            this.onTimeUpdateCallback(this.elapsedSeconds);
          }
        }
      }, 1000);

      return true;
    } catch (err) {
      console.error('Failed to start recording:', err);
      this.cleanup();
      return false;
    }
  }

  public updateSources(config: RecorderStreamConfig) {
    if (config.cameraStream !== undefined) {
      this.cameraStream = config.cameraStream;
    }
    if (config.screenStream !== undefined) {
      this.screenStream = config.screenStream;
    }
    this.bindVideoStreams();
    this.setupAudioTracks(config);
  }

  private bindVideoStreams() {
    if (this.cameraVideo) {
      if (this.cameraStream && this.cameraStream.getVideoTracks().length > 0) {
        if (this.cameraVideo.srcObject !== this.cameraStream) {
          this.cameraVideo.srcObject = this.cameraStream;
          this.cameraVideo.play().catch(() => {});
        }
      } else {
        this.cameraVideo.srcObject = null;
      }
    }

    if (this.screenVideo) {
      if (this.screenStream && this.screenStream.getVideoTracks().length > 0) {
        if (this.screenVideo.srcObject !== this.screenStream) {
          this.screenVideo.srcObject = this.screenStream;
          this.screenVideo.play().catch(() => {});
        }
      } else {
        this.screenVideo.srcObject = null;
      }
    }
  }

  private setupAudioTracks(config: RecorderStreamConfig) {
    if (!this.audioContext || !this.audioDestination) return;

    // Disconnect old sources
    this.connectedAudioNodes.forEach((node) => {
      try {
        node.disconnect();
      } catch {}
    });
    this.connectedAudioNodes = [];

    const streamsToMix: MediaStream[] = [];

    if (config.audioStreams && config.audioStreams.length > 0) {
      streamsToMix.push(...config.audioStreams);
    } else {
      if (this.cameraStream) streamsToMix.push(this.cameraStream);
      if (this.screenStream) streamsToMix.push(this.screenStream);
    }

    // Connect audio tracks
    streamsToMix.forEach((st) => {
      if (st && st.getAudioTracks().some((t) => t.readyState === 'live')) {
        try {
          const sourceNode = this.audioContext!.createMediaStreamSource(st);
          sourceNode.connect(this.audioDestination!);
          this.connectedAudioNodes.push(sourceNode);
        } catch (err) {
          console.warn('Could not mix stream audio:', err);
        }
      }
    });
  }

  private startCompositorLoop() {
    const render = () => {
      if (!this.canvas || !this.ctx) return;
      const ctx = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;

      const hasScreen =
        this.screenStream &&
        this.screenStream.getVideoTracks().some((t) => t.readyState === 'live') &&
        this.screenVideo &&
        this.screenVideo.videoWidth > 0 &&
        !this.screenVideo.paused;

      const hasCamera =
        this.cameraStream &&
        this.cameraStream.getVideoTracks().some((t) => t.readyState === 'live') &&
        this.cameraVideo &&
        this.cameraVideo.videoWidth > 0;

      // Dark background
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, w, h);

      if (hasScreen && this.screenVideo) {
        // --- SCREEN SHARING ACTIVE MODE ---
        // Render Screen Share fitted into 1280x720 canvas
        const sW = this.screenVideo.videoWidth;
        const sH = this.screenVideo.videoHeight;
        const screenAspect = sW / sH;
        const canvasAspect = w / h;

        let drawW = w;
        let drawH = h;
        let drawX = 0;
        let drawY = 0;

        if (screenAspect > canvasAspect) {
          drawH = w / screenAspect;
          drawY = (h - drawH) / 2;
        } else {
          drawW = h * screenAspect;
          drawX = (w - drawW) / 2;
        }

        ctx.drawImage(this.screenVideo, drawX, drawY, drawW, drawH);

        // Picture-in-Picture Presenter Camera in bottom-right corner (Zoom / Loom style)
        if (hasCamera && this.cameraVideo) {
          const pipW = 240;
          const pipH = 135;
          const pipX = w - pipW - 24;
          const pipY = h - pipH - 24;

          ctx.save();
          // Drop shadow for PiP overlay
          ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
          ctx.shadowBlur = 12;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 4;

          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(pipX, pipY, pipW, pipH, 10);
          } else {
            ctx.rect(pipX, pipY, pipW, pipH);
          }
          ctx.fill();
          ctx.clip();

          // Draw camera in PiP window
          ctx.drawImage(this.cameraVideo, pipX, pipY, pipW, pipH);
          ctx.restore();

          // Crisp glowing border around presenter PiP
          ctx.save();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(pipX, pipY, pipW, pipH, 10);
          } else {
            ctx.rect(pipX, pipY, pipW, pipH);
          }
          ctx.stroke();

          // Small "Presenter" pill
          ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
          ctx.fillRect(pipX + 8, pipY + pipH - 24, 70, 18);
          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 10px sans-serif';
          ctx.fillText('PRESENTER', pipX + 13, pipY + pipH - 11);
          ctx.restore();
        }
      } else if (hasCamera && this.cameraVideo) {
        // --- CAMERA-ONLY MODE (NO SCREEN SHARE) ---
        const cW = this.cameraVideo.videoWidth;
        const cH = this.cameraVideo.videoHeight;
        const camAspect = cW / cH;
        const canvasAspect = w / h;

        let drawW = w;
        let drawH = h;
        let drawX = 0;
        let drawY = 0;

        if (camAspect > canvasAspect) {
          drawW = h * camAspect;
          drawX = (w - drawW) / 2;
        } else {
          drawH = w / camAspect;
          drawY = (h - drawH) / 2;
        }

        ctx.drawImage(this.cameraVideo, drawX, drawY, drawW, drawH);
      } else {
        // --- NO ACTIVE VIDEO (IDLE / MUTED) ---
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, w, h);

        // Center meeting icon / placeholder
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(w / 2, h / 2 - 20, 48, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('OpenRoom Meeting Recording', w / 2, h / 2 + 56);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px sans-serif';
        ctx.fillText('Audio is actively recording', w / 2, h / 2 + 82);
      }

      this.animFrameId = requestAnimationFrame(render);
    };

    this.animFrameId = requestAnimationFrame(render);
  }

  public pauseRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      this.isPaused = true;
    }
  }

  public resumeRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      this.isPaused = false;
    }
  }

  public stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    } else {
      this.cleanup();
    }
  }

  private cleanup() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.cameraVideo) {
      this.cameraVideo.srcObject = null;
      this.cameraVideo = null;
    }
    if (this.screenVideo) {
      this.screenVideo.srcObject = null;
      this.screenVideo = null;
    }

    this.connectedAudioNodes.forEach((node) => {
      try {
        node.disconnect();
      } catch {}
    });
    this.connectedAudioNodes = [];

    if (this.audioContext) {
      try {
        this.audioContext.close().catch(() => {});
      } catch {}
      this.audioContext = null;
      this.audioDestination = null;
    }

    this.canvas = null;
    this.ctx = null;
    this.cameraStream = null;
    this.screenStream = null;
    this.mediaRecorder = null;
    this.isPaused = false;
  }

  private saveRecording() {
    if (this.recordedChunks.length === 0) return;
    const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.download = `openroom-recording-${timestamp}.webm`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  }
}

export const recorder = new MeetingRecorder();
