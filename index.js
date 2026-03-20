const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname)));
app.get('/room/:id', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const roomPeers = new Map();

io.on('connection', (socket) => {
  socket.on('join', (roomId) => {
    socket.join(roomId);
    if (!roomPeers.has(roomId)) roomPeers.set(roomId, new Set());
    const peers = Array.from(roomPeers.get(roomId));
    roomPeers.get(roomId).add(socket.id);
    socket.emit('peers', peers);
    socket.to(roomId).emit('peerJoined', socket.id);
  });

  socket.on('signal', ({ target, signal }) => {
    io.to(target).emit('signal', { sender: socket.id, signal });
  });

  socket.on('disconnect', () => {
    roomPeers.forEach((peers, rid) => {
        if (peers.delete(socket.id)) socket.to(rid).emit('peerLeft', socket.id);
    });
  });
});

const PORT = 3001;
server.listen(PORT, () => console.log(`Pure 4K P2P Engine Ready on Port ${PORT}`));
