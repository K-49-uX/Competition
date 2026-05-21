import { Server } from 'socket.io';
import { verifyToken } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { config } from '../config.js';

let io = null;

export function initIo(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: config.corsOrigin, credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('unauthenticated'));
      const payload = verifyToken(token);
      const user = await User.findById(payload.sub).lean();
      if (!user) return next(new Error('user not found'));
      socket.data.user = user;
      next();
    } catch {
      next(new Error('unauthenticated'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    socket.join(`user:${user._id}`);
    socket.join(`role:${user.role}`);
    if (user.role === 'clinician' && user.clinicId) {
      socket.join(`clinic:${user.clinicId}`);
    }

    socket.on('clinic:join', (clinicId) => {
      if (typeof clinicId === 'string') socket.join(`clinic:${clinicId}`);
    });

    socket.on('disconnect', () => {});
  });

  return io;
}

export function getIo() {
  if (!io) throw new Error('io not initialized');
  return io;
}
