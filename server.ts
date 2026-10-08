import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const port = process.env.PORT || 3000;

app.use(express.json());

interface ClientInfo {
  ws: WebSocket;
  userId: string;
  userName: string;
  roomId: string;
  isHost: boolean;
}

// In-memory rooms: roomId -> Map<userId, ClientInfo>
const rooms = new Map<string, Map<string, ClientInfo>>();
// In-memory waiting rooms: roomId -> Map<userId, ClientInfo>
const waitingRooms = new Map<string, Map<string, ClientInfo>>();
// Room metadata: roomId -> settings
const roomSettings = new Map<string, {
  isLocked: boolean;
  waitingRoomEnabled: boolean;
  passcode?: string;
  hostId?: string;
  createdAt: number;
}>();

// WebSocket server attached to HTTP server
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcastToRoom(roomId: string, message: any, excludeUserId?: string) {
  const room = rooms.get(roomId);
  if (!room) return;
  const payload = JSON.stringify(message);
  for (const [userId, client] of room.entries()) {
    if (excludeUserId && userId === excludeUserId) continue;
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

wss.on('connection', (ws: WebSocket) => {
  let currentUserId: string | null = null;
  let currentRoomId: string | null = null;

  ws.on('message', (data: string) => {
    try {
      const msg = JSON.parse(data.toString());
      const { type, roomId, userId, userName } = msg;

      switch (type) {
        case 'join': {
          currentUserId = userId;
          currentRoomId = roomId;

          if (!rooms.has(roomId)) {
            rooms.set(roomId, new Map());
            roomSettings.set(roomId, {
              isLocked: false,
              waitingRoomEnabled: false,
              hostId: userId,
              createdAt: Date.now(),
            });
          }

          const room = rooms.get(roomId)!;
          const settings = roomSettings.get(roomId)!;
          const isHost = room.size === 0 || settings.hostId === userId;
          if (room.size === 0) {
            settings.hostId = userId;
          }

          // Check if meeting is locked
          if (settings.isLocked && !isHost) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'This meeting is locked by the host.',
            }));
            return;
          }

          // Check if waiting room is enabled and user is not host
          if (settings.waitingRoomEnabled && !isHost) {
            if (!waitingRooms.has(roomId)) {
              waitingRooms.set(roomId, new Map());
            }
            const wr = waitingRooms.get(roomId)!;
            wr.set(userId, {
              ws,
              userId,
              userName: userName || 'Participant',
              roomId,
              isHost: false,
            });

            // Inform participant they are in the waiting room
            ws.send(JSON.stringify({
              type: 'waiting-room-status',
              status: 'waiting',
              roomId,
              hostName: room.get(settings.hostId || '')?.userName || 'Host',
              message: 'Please wait, the meeting host will let you in soon.',
            }));

            // Notify the host immediately
            const hostClient = room.get(settings.hostId || '');
            if (hostClient && hostClient.ws.readyState === WebSocket.OPEN) {
              hostClient.ws.send(JSON.stringify({
                type: 'waiting-room-joined',
                participant: {
                  id: userId,
                  name: userName || 'Participant',
                },
              }));
            }
            return;
          }

          // Register client
          room.set(userId, {
            ws,
            userId,
            userName: userName || 'Participant',
            roomId,
            isHost,
          });

          // Send current participants list to joined user
          const existingParticipants = Array.from(room.values()).map(c => ({
            id: c.userId,
            name: c.userName,
            isHost: c.isHost,
          }));

          ws.send(JSON.stringify({
            type: 'room-joined',
            roomId,
            userId,
            isHost,
            participants: existingParticipants,
            settings: {
              isLocked: settings.isLocked,
              waitingRoomEnabled: settings.waitingRoomEnabled,
            },
          }));

          // Broadcast to existing peers that new participant joined
          broadcastToRoom(roomId, {
            type: 'user-joined',
            user: {
              id: userId,
              name: userName,
              isHost,
            },
          }, userId);
          break;
        }

        // WebRTC Signaling: offer, answer, ice-candidate
        case 'signal': {
          const { targetId, signalData } = msg;
          const room = rooms.get(roomId);
          if (room && targetId) {
            const targetClient = room.get(targetId);
            if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
              targetClient.ws.send(JSON.stringify({
                type: 'signal',
                senderId: userId,
                signalData,
              }));
            }
          }
          break;
        }

        // Chat message
        case 'chat': {
          const { message } = msg;
          if (message.recipientId) {
            // Private message
            const room = rooms.get(roomId);
            const targetClient = room?.get(message.recipientId);
            if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
              targetClient.ws.send(JSON.stringify({
                type: 'chat',
                message,
              }));
            }
            // Send back to sender for confirmation
            ws.send(JSON.stringify({
              type: 'chat',
              message,
            }));
          } else {
            // Public to everyone
            broadcastToRoom(roomId, {
              type: 'chat',
              message,
            });
          }
          break;
        }

        // Reactions (emojis floating)
        case 'reaction': {
          broadcastToRoom(roomId, {
            type: 'reaction',
            userId,
            emoji: msg.emoji,
          });
          break;
        }

        // Hand raise/lower
        case 'hand-raise': {
          broadcastToRoom(roomId, {
            type: 'hand-raise',
            userId,
            isHandRaised: msg.isHandRaised,
          });
          break;
        }

        // Real-time collaborative whiteboard drawing
        case 'whiteboard': {
          broadcastToRoom(roomId, {
            type: 'whiteboard',
            drawData: msg.drawData,
          }, userId);
          break;
        }

        // Breakout rooms sync
        case 'breakout-update': {
          broadcastToRoom(roomId, {
            type: 'breakout-update',
            rooms: msg.rooms,
          });
          break;
        }

        // Host security action (mute all, lock, kick)
        case 'host-action': {
          const { action, targetId } = msg;
          const room = rooms.get(roomId);
          const settings = roomSettings.get(roomId);

          if (action === 'lock') {
            if (settings) settings.isLocked = msg.value;
            broadcastToRoom(roomId, { type: 'room-settings-updated', settings });
          } else if (action === 'waiting-room-toggle') {
            if (settings) settings.waitingRoomEnabled = msg.value;
            broadcastToRoom(roomId, { type: 'room-settings-updated', settings });
          } else if (action === 'admit-user' && targetId) {
            const wr = waitingRooms.get(roomId);
            const targetClient = wr?.get(targetId);
            if (targetClient && room && wr) {
              wr.delete(targetId);
              room.set(targetId, targetClient);

              const existingParticipants = Array.from(room.values()).map(c => ({
                id: c.userId,
                name: c.userName,
                isHost: c.isHost,
              }));

              targetClient.ws.send(JSON.stringify({
                type: 'room-joined',
                roomId,
                userId: targetId,
                isHost: false,
                participants: existingParticipants,
                settings: {
                  isLocked: settings?.isLocked || false,
                  waitingRoomEnabled: settings?.waitingRoomEnabled || false,
                },
              }));

              broadcastToRoom(roomId, {
                type: 'user-joined',
                user: {
                  id: targetId,
                  name: targetClient.userName,
                  isHost: false,
                },
              }, targetId);

              ws.send(JSON.stringify({
                type: 'waiting-room-updated',
                waitingList: Array.from(wr.values()).map(w => ({ id: w.userId, name: w.userName })),
              }));
            }
          } else if (action === 'deny-user' && targetId) {
            const wr = waitingRooms.get(roomId);
            const targetClient = wr?.get(targetId);
            if (targetClient && wr) {
              targetClient.ws.send(JSON.stringify({
                type: 'waiting-room-denied',
                reason: 'The host has declined your entry into the meeting.',
              }));
              wr.delete(targetId);
              ws.send(JSON.stringify({
                type: 'waiting-room-updated',
                waitingList: Array.from(wr.values()).map(w => ({ id: w.userId, name: w.userName })),
              }));
            }
          } else if (action === 'admit-all' && room) {
            const wr = waitingRooms.get(roomId);
            if (wr) {
              for (const [wId, targetClient] of wr.entries()) {
                room.set(wId, targetClient);
                const existingParticipants = Array.from(room.values()).map(c => ({
                  id: c.userId,
                  name: c.userName,
                  isHost: c.isHost,
                }));
                targetClient.ws.send(JSON.stringify({
                  type: 'room-joined',
                  roomId,
                  userId: wId,
                  isHost: false,
                  participants: existingParticipants,
                  settings: {
                    isLocked: settings?.isLocked || false,
                    waitingRoomEnabled: settings?.waitingRoomEnabled || false,
                  },
                }));
                broadcastToRoom(roomId, {
                  type: 'user-joined',
                  user: {
                    id: wId,
                    name: targetClient.userName,
                    isHost: false,
                  },
                }, wId);
              }
              wr.clear();
              ws.send(JSON.stringify({
                type: 'waiting-room-updated',
                waitingList: [],
              }));
            }
          } else if (action === 'mute-all') {
            broadcastToRoom(roomId, { type: 'mute-request', all: true }, userId);
          } else if (action === 'mute-user' && targetId) {
            const targetClient = room?.get(targetId);
            targetClient?.ws.send(JSON.stringify({ type: 'mute-request', all: false }));
          } else if (action === 'kick-user' && targetId) {
            const targetClient = room?.get(targetId);
            if (targetClient) {
              targetClient.ws.send(JSON.stringify({ type: 'kicked', reason: 'Removed by host' }));
              room?.delete(targetId);
              broadcastToRoom(roomId, { type: 'user-left', userId: targetId });
            }
          } else if (action === 'end-meeting-for-all') {
            broadcastToRoom(roomId, { type: 'meeting-ended', reason: 'Meeting has been ended by the host' }, userId);
            rooms.delete(roomId);
            roomSettings.delete(roomId);
          }
          break;
        }

        // Participant status updates (audio/video mute status, screen share status)
        case 'status-update': {
          broadcastToRoom(roomId, {
            type: 'status-update',
            userId,
            status: msg.status,
          }, userId);
          break;
        }

        // Leaving room explicitly
        case 'leave': {
          handleLeave(roomId, userId);
          currentUserId = null;
          currentRoomId = null;
          break;
        }
      }
    } catch (err) {
      console.error('Error handling WS message:', err);
    }
  });

  const handleLeave = (roomId: string, userId: string) => {
    // Check if user was in waiting room
    const wr = waitingRooms.get(roomId);
    if (wr && wr.has(userId)) {
      wr.delete(userId);
      const hostClient = rooms.get(roomId)?.get(roomSettings.get(roomId)?.hostId || '');
      hostClient?.ws.send(JSON.stringify({
        type: 'waiting-room-updated',
        waitingList: Array.from(wr.values()).map(w => ({ id: w.userId, name: w.userName })),
      }));
    }

    const room = rooms.get(roomId);
    if (room) {
      const client = room.get(userId);
      room.delete(userId);
      broadcastToRoom(roomId, {
        type: 'user-left',
        userId,
      });

      // If room is empty, clean up
      if (room.size === 0) {
        rooms.delete(roomId);
        roomSettings.delete(roomId);
      } else if (client?.isHost) {
        // Elect new host
        const nextClient = room.values().next().value;
        if (nextClient) {
          nextClient.isHost = true;
          broadcastToRoom(roomId, {
            type: 'new-host',
            userId: nextClient.userId,
          });
        }
      }
    }
  };

  ws.on('close', () => {
    if (currentRoomId && currentUserId) {
      handleLeave(currentRoomId, currentUserId);
    }
  });

  ws.on('error', (err) => {
    console.error('WS client error:', err);
  });
});

// REST API endpoints
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    name: 'OpenZoom',
    version: '1.0.0',
    openSource: true,
    license: 'MIT',
    activeRooms: rooms.size,
  });
});

app.get('/api/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);
  const settings = roomSettings.get(roomId);
  res.json({
    exists: !!room,
    participantCount: room ? room.size : 0,
    isLocked: settings?.isLocked || false,
    waitingRoomEnabled: settings?.waitingRoomEnabled || false,
  });
});

// Setup Vite dev server middlewares or static dist serving
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(port, () => {
    console.log(`OpenZoom server listening on port ${port} (${isDev ? 'development' : 'production'})`);
  });
}

startServer();
