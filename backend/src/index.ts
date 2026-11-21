import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { config, validateProductionConfig } from './config';
import { db } from './database';
import { authRouter } from './modules/auth/auth.controller';
import { usersRouter } from './modules/users/users.controller';
import { roomsRouter } from './modules/rooms/rooms.controller';
import { videoRouter } from './modules/video/video.controller';
import { livekitRouter } from './modules/livekit/livekit.controller';
import { registerSocketGateway } from './realtime/socket.gateway';
import { authService } from './modules/auth/auth.service';
import { roomsService } from './modules/rooms/rooms.service';

const app = express();
const server = http.createServer(app);

export function getCorsOriginOption(): cors.CorsOptions['origin'] {
  if (config.env === 'production') {
    const raw = config.corsOrigin || config.clientUrl;
    const origins = raw.split(',').map((o) => o.trim()).filter(Boolean);
    return (origin, callback) => {
      if (!origin) return callback(null, true);
      if (origins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    };
  }
  return true;
}

// Configure CORS
app.use(
  cors({
    origin: getCorsOriginOption(),
    credentials: true,
  })
);

// Production Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (config.env === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'SYNCTHEATER Realtime Server',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Mount modular REST APIs
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/video', videoRouter);
app.use('/api/livekit', livekitRouter);

// Initialize Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: getCorsOriginOption() as any,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 30000,
  pingInterval: 10000,
});

registerSocketGateway(io);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Global Error]', err);
  res.status(500).json({ error: err.message || 'Internal server error.' });
});

async function seedInitialData() {
  if (config.env === 'production') {
    console.log('[Seed] Production mode: skipping demo account creation.');
    return;
  }
  try {
    const existing = await db.listRoomsForUser('system-demo-host');
    if (existing.length === 0) {
      console.log('[Seed] Seeding demo host and initial cinema rooms...');
      // Create demo host user
      let hostUser;
      try {
        const reg = await authService.register({
          email: 'demo@synctheater.com',
          username: 'CinemaHost',
          password: 'Password123!',
        });
        hostUser = reg.user;
      } catch (e) {
        hostUser = await db.findUserByUsername('CinemaHost');
      }

      if (hostUser) {
        // Room 1: Synthwave & Sci-Fi Cinema (Private)
        await roomsService.createRoom({
          name: 'Classic Sci-Fi & Synthwave Night',
          description: 'Relaxed evening watching iconic sci-fi aesthetics and synchronized ambient cinema.',
          privacy: 'PRIVATE',
          maxCapacity: 50,
          initialVideoUrl: 'https://www.youtube.com/watch?v=4xDzrJKXOOY',
          ownerId: hostUser.id,
        });

        // Room 2: Community Cinema (Private)
        await roomsService.createRoom({
          name: 'Community Cinema Lounge',
          description: 'A private watch party lounge for short films, trailers, and video essays together.',
          privacy: 'PRIVATE',
          maxCapacity: 25,
          initialVideoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          ownerId: hostUser.id,
        });
        console.log('[Seed] Initial private cinema rooms created successfully.');
      }
    }
  } catch (err) {
    console.warn('[Seed] Seed warning:', err);
  }
}

async function startServer() {
  try {
    validateProductionConfig();
    await db.initialize();
    await seedInitialData();

    server.listen(config.port, '0.0.0.0', () => {
      console.log(`====================================================`);
      console.log(`🍿 SYNCTHEATER Server running on port ${config.port}`);
      console.log(`🚀 REST API Base: http://localhost:${config.port}/api`);
      console.log(`⚡ WebSocket Gateway: ws://localhost:${config.port}`);
      console.log(`====================================================`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Start if executed directly
if (require.main === module) {
  startServer();
}

export { app, server, io, startServer };
