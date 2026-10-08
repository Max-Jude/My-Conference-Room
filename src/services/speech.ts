import { Caption } from '../types';

export class SpeechRecognitionService {
  private recognition: any = null;
  private isListening: boolean = false;
  private transcriptHistory: Caption[] = [];
  private onCaptionCallback?: (caption: Caption) => void;
  private currentSpeaker: string = 'You';

  constructor() {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }

          const text = (finalTranscript || interimTranscript).trim();
          if (text) {
            const caption: Caption = {
              id: 'cap-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
              speakerName: this.currentSpeaker,
              text,
              timestamp: Date.now(),
              isFinal: !!finalTranscript,
            };

            if (finalTranscript) {
              this.transcriptHistory.push(caption);
            }

            if (this.onCaptionCallback) {
              this.onCaptionCallback(caption);
            }
          }
        };

        this.recognition.onerror = (event: any) => {
          if (event.error !== 'no-speech') {
            console.warn('Speech recognition status:', event.error);
          }
        };

        this.recognition.onend = () => {
          if (this.isListening) {
            try {
              this.recognition.start();
            } catch (e) {}
          }
        };
      } catch (e) {
        console.warn('Speech recognition not available', e);
      }
    }
  }

  public setSpeaker(name: string) {
    this.currentSpeaker = name;
  }

  public start(onCaption: (caption: Caption) => void) {
    this.onCaptionCallback = onCaption;
    this.isListening = true;
    if (this.recognition) {
      try {
        this.recognition.start();
      } catch (e) {
        console.warn('Recognition already started or error', e);
      }
    }
  }

  public stop() {
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
  }

  public getHistory(): Caption[] {
    return this.transcriptHistory;
  }

  public exportTranscript(): string {
    return this.transcriptHistory
      .map(
        (c) =>
          `[${new Date(c.timestamp).toLocaleTimeString()}] ${c.speakerName}: ${c.text}`
      )
      .join('\n');
  }
}

export const speechService = new SpeechRecognitionService();
