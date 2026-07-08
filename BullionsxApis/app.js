const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, 'config', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const error = require('./middleware/error');
const router = require('./router/router');

const app = express();

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000', 'http://localhost:3001'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
  exposedHeaders: ['x-auth-token'],
}));
app.use(express.json());

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.set('io', io);
app.use('/', router);
app.use(error);

const { ensureStakingSchema } = require('./database/autoMigrate');
const { startPriceFeed } = require('./services/priceFeed');
const { startStakingPayout } = require('./services/stakingPayout');

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('subscribe_market', (market_symbol) => {
    socket.join(market_symbol);
  });

  socket.on('unsubscribe_market', (market_symbol) => {
    socket.leave(market_symbol);
  });

  socket.on('subscribe_user', (user_id) => {
    socket.join(`user_${user_id}`);
  });

  socket.on('unsubscribe_user', (user_id) => {
    socket.leave(`user_${user_id}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;

ensureStakingSchema().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Your application is running on PORT ${PORT}`);
    startPriceFeed(io, parseInt(process.env.PRICE_FEED_INTERVAL_MS || '5000'));
    startStakingPayout(io, parseInt(process.env.STAKING_PAYOUT_INTERVAL_MS || '60000'));
  });
});
