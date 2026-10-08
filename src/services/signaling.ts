type MessageHandler = (data: any) => void;

export class SignalingService {
  private ws: WebSocket | null = null;
  private channel: BroadcastChannel | null = null;
  private listeners: Map<string, Set<MessageHandler>> = new Map();
  private roomId: string = '';
  private userId: string = '';
  private userName: string = '';
  private isConnected: boolean = false;
  private reconnectTimer: any = null;

  constructor() {
    // Also use BroadcastChannel for local cross-tab communication as fallback/mesh
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('openroom-broadcast-channel');
        this.channel.onmessage = (event) => {
          this.handleIncoming(event.data, true);
        };
      } catch (e) {
        console.warn('BroadcastChannel not supported', e);
      }
    }
  }

  public connect(roomId: string, userId: string, userName: string) {
    this.roomId = roomId;
    this.userId = userId;
    this.userName = userName;

    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.send({
          type: 'join',
          roomId: this.roomId,
          userId: this.userId,
          userName: this.userName,
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleIncoming(data, false);
        } catch (err) {
          console.error('Failed to parse WS message', err);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('Signaling WS error (using BroadcastChannel fallback):', err);
      };

      this.ws.onclose = () => {
        this.isConnected = false;
      };
    } catch (e) {
      console.warn('WebSocket init failed, relying on BroadcastChannel fallback', e);
    }

    // Also broadcast on BroadcastChannel for multi-tab
    if (this.channel) {
      this.channel.postMessage({
        type: 'tab-join',
        roomId: this.roomId,
        userId: this.userId,
        userName: this.userName,
      });
    }
  }

  private handleIncoming(data: any, fromBroadcast: boolean) {
    if (!data || !data.type) return;

    // Handle cross-tab join
    if (fromBroadcast && data.type === 'tab-join' && data.roomId === this.roomId) {
      if (data.userId !== this.userId) {
        // Broadcast back current existence to the joining tab
        this.channel?.postMessage({
          type: 'tab-presence',
          roomId: this.roomId,
          userId: this.userId,
          userName: this.userName,
        });

        // Trigger user-joined
        this.emit('user-joined', {
          user: {
            id: data.userId,
            name: data.userName,
            isHost: false,
          },
        });
      }
      return;
    }

    if (fromBroadcast && data.type === 'tab-presence' && data.roomId === this.roomId) {
      if (data.userId !== this.userId) {
        this.emit('user-joined', {
          user: {
            id: data.userId,
            name: data.userName,
            isHost: false,
          },
        });
      }
      return;
    }

    this.emit(data.type, data);
  }

  public send(data: any) {
    const payload = {
      ...data,
      roomId: this.roomId,
      userId: this.userId,
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }

    // Also send through BroadcastChannel
    if (this.channel) {
      try {
        this.channel.postMessage(payload);
      } catch (e) {
        console.warn('BroadcastChannel send error', e);
      }
    }
  }

  public on(event: string, handler: MessageHandler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  public off(event: string, handler: MessageHandler) {
    this.listeners.get(event)?.delete(handler);
  }

  private emit(event: string, data: any) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((h) => {
        try {
          h(data);
        } catch (e) {
          console.error(`Error in event listener for ${event}:`, e);
        }
      });
    }
  }

  public disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({ type: 'leave' });
      this.ws.close();
    }
    if (this.channel) {
      this.channel.postMessage({
        type: 'user-left',
        roomId: this.roomId,
        userId: this.userId,
      });
    }
    this.listeners.clear();
    this.isConnected = false;
  }
}

export const signaling = new SignalingService();
