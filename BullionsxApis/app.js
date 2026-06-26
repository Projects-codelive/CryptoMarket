const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'config', '.env') });
const error = require('./middleware/error');
const router = require('./router/router');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
    credentials: true,
  },
});

const PORT = process.env.PORT || 3000;

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'], credentials: true }));
app.use(express.json());
app.use('/', router);
app.use(error);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('subscribe_market', (market_symbol) => {
    socket.join(market_symbol);
  });

  socket.on('unsubscribe_market', (market_symbol) => {
    socket.leave(market_symbol);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

app.set('io', io);

setInterval(() => {
  const mockPrices = [
    { pair: 'SOL-INR', price: 5741.94 + (Math.random() - 0.5) * 50, change: (Math.random() - 0.5) * 5 },
    { pair: 'BTC-INR', price: 5380218.77 + (Math.random() - 0.5) * 5000, change: (Math.random() - 0.5) * 3 },
    { pair: 'ETH-INR', price: 295872.35 + (Math.random() - 0.5) * 2000, change: (Math.random() - 0.5) * 4 },
  ];
  mockPrices.forEach(p => io.emit('price_update', p));
}, 1000);

server.listen(PORT, () => {
     console.log(`Your application is running on PORT ${PORT}`);
});
