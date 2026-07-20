const express = require('express');
const http = require('http');
const fs = require('fs');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const { initSocket } = require('./socket/socketHandler');
const { getAllowedOrigins } = require('./utils/clientUrl');

dotenv.config();

if (process.argv.includes('--prod')) {
  process.env.NODE_ENV = 'production';
}

const app = express();
const server = http.createServer(app);
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = getAllowedOrigins();

app.set('trust proxy', 1);

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

connectDB();

const io = new Server(server, {
  path: '/socket.io',
  cors: {
    origin: allowedOrigins.length ? allowedOrigins : true,
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowUpgrades: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

initSocket(io);

app.use(cors({
  origin(origin, callback) {
    if (!origin || !isProduction || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(null, allowedOrigins[0] || true);
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(uploadDir));

// API Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const tableRoutes = require('./routes/tableRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const menuRoutes = require('./routes/menuRoutes');
const orderRoutes = require('./routes/orderRoutes');
const publicRoutes = require('./routes/publicRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const reportRoutes = require('./routes/reportRoutes');
const settingRoutes = require('./routes/settingRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const superAdminRoutes = require('./routes/superAdminRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/super-admin', superAdminRoutes);

app.get('/api/health', (req, res) => {
  const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    status: 'ok',
    time: new Date(),
    env: process.env.NODE_ENV || 'development',
    db: dbStates[mongoose.connection.readyState] || 'unknown'
  });
});

// Unknown API routes — before SPA fallback
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: 'API route not found' });
});

// Production — serve React build (single-server live deploy)
if (isProduction) {
  const clientDist = path.join(__dirname, '../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^(?!\/api|\/uploads|\/socket\.io).*/, (req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  } else {
    console.warn('Warning: client/dist not found. Run: cd client && npm run build');
  }
}

app.use((err, req, res, next) => {
  console.error('API Error:', err.stack || err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on http://${HOST}:${PORT}`);
  if (isProduction) {
    console.log(`Live URL (set CLIENT_URL): ${process.env.CLIENT_URL || 'not set'}`);
  }
});
