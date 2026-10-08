import { VirtualBackgroundType } from '../types';

export function optimizeImageForBackground(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const maxW = 1920;
        const maxH = 1080;
        let w = img.width;
        let h = img.height;
        if (w > maxW || h > maxH) {
          const ratio = Math.min(maxW / w, maxH / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const optimized = canvas.toDataURL('image/jpeg', 0.88);
        resolve(optimized);
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

type MediaPipeResults = {
  image: CanvasImageSource;
  segmentationMask: CanvasImageSource;
};

export class VirtualBackgroundService {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private maskCanvas: HTMLCanvasElement;
  private maskCtx: CanvasRenderingContext2D | null;
  private videoElement: HTMLVideoElement;
  private isProcessing: boolean = false;
  private currentType: VirtualBackgroundType = 'none';
  private processedStream: MediaStream | null = null;
  private animationFrameId: number | null = null;
  private customImageElement: HTMLImageElement | null = null;
  private customImageUrl: string | null = null;
  private rawStream: MediaStream | null = null;

  // MediaPipe SelfieSegmentation AI engine
  private segmenter: any = null;
  private isSegmenterInitialized: boolean = false;
  private isSegmenterLoading: boolean = false;
  private isSegmentingFrame: boolean = false;
  private latestResults: MediaPipeResults | null = null;

  // Cached pre-rendered background canvases for maximum 60 FPS performance
  private cachedOfficeCanvas: HTMLCanvasElement | null = null;
  private cachedSpaceCanvas: HTMLCanvasElement | null = null;
  private cachedStudioCanvas: HTMLCanvasElement | null = null;

  // Target preview canvases for zero-latency direct screen rendering
  private previewCanvases: Set<HTMLCanvasElement> = new Set();

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1280;
    this.canvas.height = 720;
    this.ctx = this.canvas.getContext('2d', { alpha: false, desynchronized: true });

    this.maskCanvas = document.createElement('canvas');
    this.maskCanvas.width = 1280;
    this.maskCanvas.height = 720;
    this.maskCtx = this.maskCanvas.getContext('2d');

    this.videoElement = document.createElement('video');
    this.videoElement.autoplay = true;
    this.videoElement.playsInline = true;
    this.videoElement.muted = true;
    this.videoElement.setAttribute('muted', 'true');
    this.videoElement.setAttribute('playsinline', 'true');

    // Pre-initialize background cache
    this.updateBackgroundCaches(1280, 720);

    // Initialize MediaPipe AI model in the background
    this.initSegmenter();

    // Load persisted custom image if available
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('openroom_custom_bg') || localStorage.getItem('openzoom_custom_bg');
        if (saved) {
          this.setCustomImage(saved);
        }
      } catch (e) {
        console.warn('Could not read saved background image', e);
      }
    }
  }

  private async initSegmenter() {
    if (this.isSegmenterInitialized || this.isSegmenterLoading) return;
    if (typeof window === 'undefined') return;

    this.isSegmenterLoading = true;
    try {
      const SelfieSegmentationClass =
        (window as any).SelfieSegmentation ||
        (await import('@mediapipe/selfie_segmentation').then((m) => m.SelfieSegmentation).catch(() => null));

      if (SelfieSegmentationClass) {
        const segmenter = new SelfieSegmentationClass({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
        });

        segmenter.setOptions({
          modelSelection: 1, // 1 = landscape model: ultra-fast (~5-8ms), specialized for video calls
          selfieMode: false,
        });

        segmenter.onResults((results: MediaPipeResults) => {
          this.latestResults = results;
        });

        await segmenter.initialize();
        this.segmenter = segmenter;
        this.isSegmenterInitialized = true;
      }
    } catch (e) {
      console.warn('MediaPipe initialization warning (will use high-speed fallback if needed):', e);
    } finally {
      this.isSegmenterLoading = false;
    }
  }

  public registerPreviewCanvas(canvas: HTMLCanvasElement) {
    this.previewCanvases.add(canvas);
  }

  public unregisterPreviewCanvas(canvas: HTMLCanvasElement) {
    this.previewCanvases.delete(canvas);
  }

  public isActive(): boolean {
    return this.isProcessing && this.currentType !== 'none';
  }

  public getOutputCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  public setCustomImage(dataUrl: string): Promise<void> {
    this.customImageUrl = dataUrl;
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.customImageElement = img;
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('openroom_custom_bg', dataUrl);
          } catch (e) {
            console.warn('Could not persist custom image to localStorage', e);
          }
        }
        resolve();
      };
      img.onerror = () => {
        console.warn('Failed to load custom background image');
        resolve();
      };
      img.src = dataUrl;
    });
  }

  public getCustomImage(): string | null {
    return this.customImageUrl;
  }

  public setType(type: VirtualBackgroundType) {
    this.currentType = type;
  }

  public getType(): VirtualBackgroundType {
    return this.currentType;
  }

  public async start(rawStream: MediaStream, type: VirtualBackgroundType): Promise<MediaStream> {
    this.currentType = type;
    this.rawStream = rawStream;

    if (type === 'none') {
      this.stop();
      return rawStream;
    }

    if (!this.segmenter && !this.isSegmenterLoading) {
      this.initSegmenter();
    }

    if (this.videoElement.srcObject !== rawStream) {
      this.videoElement.srcObject = rawStream;
      try {
        await this.videoElement.play();
      } catch (e) {
        console.warn('Video play in virtual background:', e);
      }
    }

    if (!this.isProcessing) {
      this.isProcessing = true;
      this.processFrame();
    }

    if (!this.processedStream || !this.processedStream.active) {
      // 30 FPS stream for WebRTC transmission
      this.processedStream = this.canvas.captureStream(30);
    }

    // Retain audio tracks from the original stream
    this.processedStream.getAudioTracks().forEach((t) => this.processedStream?.removeTrack(t));
    rawStream.getAudioTracks().forEach((track) => {
      this.processedStream?.addTrack(track);
    });

    return this.processedStream;
  }

  private updateBackgroundCaches(width: number, height: number) {
    this.cachedOfficeCanvas = this.renderOfficeBackground(width, height);
    this.cachedSpaceCanvas = this.renderSpaceBackground(width, height);
    this.cachedStudioCanvas = this.renderStudioBackground(width, height);
  }

  private renderOfficeBackground(width: number, height: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const ctx = c.getContext('2d');
    if (!ctx) return c;

    // Room wall gradient
    const roomGrad = ctx.createLinearGradient(0, 0, width, height);
    roomGrad.addColorStop(0, '#172033');
    roomGrad.addColorStop(0.5, '#1e293b');
    roomGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = roomGrad;
    ctx.fillRect(0, 0, width, height);

    // Architectural floor-to-ceiling glass window
    const winX = width * 0.44;
    const winY = height * 0.04;
    const winW = width * 0.52;
    const winH = height * 0.88;

    // Daylight sky gradient
    const skyGrad = ctx.createLinearGradient(winX, winY, winX, winY + winH);
    skyGrad.addColorStop(0, '#38bdf8');
    skyGrad.addColorStop(0.55, '#bae6fd');
    skyGrad.addColorStop(1, '#e0f2fe');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(winX, winY, winW, winH);

    // Downtown skyline silhouette (depth layers)
    ctx.fillStyle = 'rgba(71, 85, 105, 0.4)';
    ctx.fillRect(winX + winW * 0.08, winY + winH * 0.38, winW * 0.16, winH * 0.62);
    ctx.fillStyle = 'rgba(51, 65, 85, 0.55)';
    ctx.fillRect(winX + winW * 0.28, winY + winH * 0.24, winW * 0.2, winH * 0.76);
    ctx.fillStyle = 'rgba(30, 41, 59, 0.65)';
    ctx.fillRect(winX + winW * 0.52, winY + winH * 0.35, winW * 0.18, winH * 0.65);
    ctx.fillStyle = 'rgba(100, 116, 139, 0.48)';
    ctx.fillRect(winX + winW * 0.72, winY + winH * 0.26, winW * 0.24, winH * 0.74);

    // Window frame mullions (matte dark iron)
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 6;
    ctx.strokeRect(winX, winY, winW, winH);
    ctx.beginPath();
    ctx.moveTo(winX + winW * 0.5, winY);
    ctx.lineTo(winX + winW * 0.5, winY + winH);
    ctx.moveTo(winX, winY + winH * 0.42);
    ctx.lineTo(winX + winW, winY + winH * 0.42);
    ctx.stroke();

    // Warm walnut wood acoustic slat paneling on left wall
    const panelX = width * 0.03;
    const panelW = width * 0.38;
    const woodGrad = ctx.createLinearGradient(panelX, 0, panelX + panelW, 0);
    woodGrad.addColorStop(0, '#2b1810');
    woodGrad.addColorStop(0.5, '#452a1e');
    woodGrad.addColorStop(1, '#321c13');
    ctx.fillStyle = woodGrad;
    ctx.fillRect(panelX, height * 0.08, panelW, height * 0.88);

    // Bookshelf horizontal accents
    ctx.fillStyle = '#1c0f0a';
    for (let y = height * 0.22; y < height * 0.85; y += height * 0.15) {
      ctx.fillRect(panelX, y, panelW, 8);
    }

    // Warm accent light wash
    const lampGlow = ctx.createRadialGradient(
      width * 0.22,
      height * 0.12,
      10,
      width * 0.22,
      height * 0.12,
      260
    );
    lampGlow.addColorStop(0, 'rgba(254, 240, 138, 0.4)');
    lampGlow.addColorStop(0.6, 'rgba(251, 191, 36, 0.12)');
    lampGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = lampGlow;
    ctx.fillRect(0, 0, width, height);

    // Architectural monstera plant silhouette
    ctx.fillStyle = '#064e3b';
    ctx.beginPath();
    ctx.ellipse(width * 0.42, height * 0.82, 24, 65, -0.2, 0, Math.PI * 2);
    ctx.ellipse(width * 0.45, height * 0.74, 18, 55, 0.3, 0, Math.PI * 2);
    ctx.ellipse(width * 0.39, height * 0.72, 20, 50, -0.4, 0, Math.PI * 2);
    ctx.fill();

    return c;
  }

  private renderSpaceBackground(width: number, height: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const ctx = c.getContext('2d');
    if (!ctx) return c;

    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, width, height);

    // Purple / Indigo cosmic nebula
    const neb1 = ctx.createRadialGradient(
      width * 0.76,
      height * 0.28,
      25,
      width * 0.76,
      height * 0.28,
      width * 0.45
    );
    neb1.addColorStop(0, 'rgba(168, 85, 247, 0.6)');
    neb1.addColorStop(0.4, 'rgba(99, 102, 241, 0.38)');
    neb1.addColorStop(0.8, 'rgba(14, 165, 233, 0.16)');
    neb1.addColorStop(1, 'transparent');
    ctx.fillStyle = neb1;
    ctx.fillRect(0, 0, width, height);

    // Magenta / Violet lower nebula
    const neb2 = ctx.createRadialGradient(
      width * 0.18,
      height * 0.68,
      20,
      width * 0.18,
      height * 0.68,
      width * 0.36
    );
    neb2.addColorStop(0, 'rgba(236, 72, 153, 0.45)');
    neb2.addColorStop(0.5, 'rgba(139, 92, 246, 0.22)');
    neb2.addColorStop(1, 'transparent');
    ctx.fillStyle = neb2;
    ctx.fillRect(0, 0, width, height);

    // Stars
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 90; i++) {
      const x = (i * 97) % width;
      const y = (i * 137) % height;
      const s = (i % 3 === 0 ? 2 : 1) + (i % 5 === 0 ? 1 : 0);
      ctx.globalAlpha = 0.5 + (i % 5) * 0.1;
      ctx.fillRect(x, y, s, s);
    }
    ctx.globalAlpha = 1;

    // Distant glowing blue crescent planet
    const pX = width * 0.82;
    const pY = height * 0.22;
    const pR = 46;
    const planetGrad = ctx.createRadialGradient(pX - 10, pY - 10, 5, pX, pY, pR);
    planetGrad.addColorStop(0, '#38bdf8');
    planetGrad.addColorStop(0.65, '#1e40af');
    planetGrad.addColorStop(1, '#020617');
    ctx.fillStyle = planetGrad;
    ctx.beginPath();
    ctx.arc(pX, pY, pR, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(pX, pY, pR + 2, 0, Math.PI * 2);
    ctx.stroke();

    return c;
  }

  private renderStudioBackground(width: number, height: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const ctx = c.getContext('2d');
    if (!ctx) return c;

    ctx.fillStyle = '#080c14';
    ctx.fillRect(0, 0, width, height);

    // Dark acoustic wall slats
    ctx.fillStyle = '#0f172a';
    for (let x = 0; x < width; x += 32) {
      ctx.fillRect(x, 0, 22, height);
    }

    // Vertical cyan neon light
    const neon1 = ctx.createLinearGradient(width * 0.15, 0, width * 0.15 + 16, 0);
    neon1.addColorStop(0, 'rgba(6, 182, 212, 0)');
    neon1.addColorStop(0.5, '#06b6d4');
    neon1.addColorStop(1, 'rgba(6, 182, 212, 0)');
    ctx.fillStyle = neon1;
    ctx.fillRect(width * 0.15 - 15, 0, 38, height);

    // Vertical magenta neon light
    const neon2 = ctx.createLinearGradient(width * 0.85, 0, width * 0.85 + 16, 0);
    neon2.addColorStop(0, 'rgba(168, 85, 247, 0)');
    neon2.addColorStop(0.5, '#a855f7');
    neon2.addColorStop(1, 'rgba(168, 85, 247, 0)');
    ctx.fillStyle = neon2;
    ctx.fillRect(width * 0.85 - 15, 0, 38, height);

    // Studio ambient lighting wash
    const wash = ctx.createRadialGradient(
      width / 2,
      height * 0.45,
      width * 0.08,
      width / 2,
      height * 0.45,
      width * 0.58
    );
    wash.addColorStop(0, 'rgba(30, 41, 59, 0.45)');
    wash.addColorStop(1, 'transparent');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, width, height);

    return c;
  }

  private drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
    if (this.currentType === 'half-blur') {
      ctx.save();
      ctx.filter = 'blur(8px) brightness(0.98)';
      ctx.drawImage(this.videoElement, -12, -12, width + 24, height + 24);
      ctx.restore();
    } else if (this.currentType === 'blur') {
      ctx.save();
      ctx.filter = 'blur(16px) brightness(0.95)';
      ctx.drawImage(this.videoElement, -20, -20, width + 40, height + 40);
      ctx.restore();
    } else if (this.currentType === 'heavy-blur') {
      ctx.save();
      ctx.filter = 'blur(28px) brightness(0.92)';
      ctx.drawImage(this.videoElement, -35, -35, width + 70, height + 70);
      ctx.restore();
    } else if (this.currentType === 'custom' && this.customImageElement) {
      const img = this.customImageElement;
      const hRatio = width / img.width;
      const vRatio = height / img.height;
      const ratio = Math.max(hRatio, vRatio);
      const centerShiftX = (width - img.width * ratio) / 2;
      const centerShiftY = (height - img.height * ratio) / 2;

      ctx.save();
      ctx.drawImage(
        img,
        0,
        0,
        img.width,
        img.height,
        centerShiftX,
        centerShiftY,
        img.width * ratio,
        img.height * ratio
      );
      // Soft vignette for studio polish
      const vignette = ctx.createRadialGradient(
        width / 2,
        height / 2,
        width * 0.35,
        width / 2,
        height / 2,
        width * 0.75
      );
      vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vignette.addColorStop(1, 'rgba(0, 0, 0, 0.22)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    } else if (this.currentType === 'office') {
      if (this.cachedOfficeCanvas) {
        ctx.drawImage(this.cachedOfficeCanvas, 0, 0, width, height);
      }
    } else if (this.currentType === 'space') {
      if (this.cachedSpaceCanvas) {
        ctx.drawImage(this.cachedSpaceCanvas, 0, 0, width, height);
      }
    } else if (this.currentType === 'studio') {
      if (this.cachedStudioCanvas) {
        ctx.drawImage(this.cachedStudioCanvas, 0, 0, width, height);
      }
    } else {
      ctx.drawImage(this.videoElement, 0, 0, width, height);
    }
  }

  private processFrame = () => {
    if (!this.isProcessing || !this.ctx || !this.maskCtx) return;

    const vid = this.videoElement;

    // Adapt canvas size once when video dimensions are known
    if (vid.videoWidth > 0 && (this.canvas.width !== vid.videoWidth || this.canvas.height !== vid.videoHeight)) {
      this.canvas.width = vid.videoWidth;
      this.canvas.height = vid.videoHeight;
      this.maskCanvas.width = vid.videoWidth;
      this.maskCanvas.height = vid.videoHeight;
      this.updateBackgroundCaches(vid.videoWidth, vid.videoHeight);
    }

    const { width, height } = this.canvas;
    const ctx = this.ctx;
    const maskCtx = this.maskCtx;

    if (vid.readyState >= 2) {
      if (this.currentType === 'none') {
        ctx.drawImage(vid, 0, 0, width, height);
      } else {
        // Step 1: Send current frame to MediaPipe AI Model if ready and idle
        if (this.segmenter && this.isSegmenterInitialized && !this.isSegmentingFrame) {
          this.isSegmentingFrame = true;
          this.segmenter
            .send({ image: vid })
            .catch((err: any) => {
              console.warn('MediaPipe send frame notice:', err);
            })
            .finally(() => {
              this.isSegmentingFrame = false;
            });
        }

        // Step 2: Render chosen virtual background onto output canvas
        this.drawBackground(ctx, width, height);

        // Step 3: Composite human subject cleanly over the background using AI mask
        if (this.latestResults && this.latestResults.segmentationMask) {
          maskCtx.clearRect(0, 0, width, height);
          maskCtx.save();
          // Subtle edge feathering creates smooth anti-aliased hair and body outlines
          maskCtx.filter = 'blur(2px)';
          maskCtx.drawImage(this.latestResults.segmentationMask, 0, 0, width, height);
          maskCtx.filter = 'none';
          // Cut out the real camera person inside the mask
          maskCtx.globalCompositeOperation = 'source-in';
          maskCtx.drawImage(vid, 0, 0, width, height);
          maskCtx.restore();

          // Overlay the crisp subject on top of the virtual background
          ctx.drawImage(this.maskCanvas, 0, 0, width, height);
        } else {
          // Model warming up: show direct camera feed smoothly with zero lag
          ctx.drawImage(vid, 0, 0, width, height);
        }
      }

      // Step 4: Instantly render directly to registered on-screen preview canvases
      // This completely bypasses captureStream buffering and guarantees 0ms latency for the user!
      if (this.previewCanvases.size > 0) {
        for (const pCanvas of this.previewCanvases) {
          if (pCanvas.width !== width || pCanvas.height !== height) {
            pCanvas.width = width;
            pCanvas.height = height;
          }
          const pCtx = pCanvas.getContext('2d');
          if (pCtx) {
            pCtx.drawImage(this.canvas, 0, 0);
          }
        }
      }
    }

    this.animationFrameId = requestAnimationFrame(this.processFrame);
  };

  public stop() {
    this.isProcessing = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
    this.processedStream = null;
    this.latestResults = null;
  }
}

export const virtualBackground = new VirtualBackgroundService();
