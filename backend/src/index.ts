import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { initSocket } from './socket';
import { verifyFirebaseToken, isFirebaseInitialized } from './firebaseAdmin';
import { logger } from './utils/logger';


const app = express();

// Parse allowed origins from env (comma-separated)
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS', `Blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

const server = http.createServer(app);

// Health check
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    firebaseInitialized: isFirebaseInitialized(),
    uptime: process.uptime(),
  });
});

// Auth verification endpoint
app.get('/api/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const token = authHeader.split(' ')[1]!;
    const decodedToken = await verifyFirebaseToken(token);
    res.json({
      uid: decodedToken.uid,
      name: decodedToken.name,
      email: decodedToken.email,
      picture: decodedToken.picture,
    });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Initialize Socket.IO with all allowed origins
initSocket(server, allowedOrigins);

const PORT = parseInt(process.env.PORT || '8080', 10);
server.listen(PORT, () => {
  logger.info('Server', `Backend running on port ${PORT}`);
  logger.info('Server', `Allowed origins: ${allowedOrigins.join(', ')}`);
});
