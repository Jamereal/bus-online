const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = process.env.PORT || 3000;
const SEATS_FILE = path.join(__dirname, 'seats.json');
const TOTAL_SEATS = 40; // จำนวนที่นั่งทั้งหมด

app.use(cors());
app.use(express.json());

// ---------- HTTP + Socket.io ----------
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// เสิร์ฟไฟล์ static (หน้าเว็บ)
app.use(express.static(path.join(__dirname, 'public')));

// socket.io connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// ---------- จัดการที่นั่ง ----------
function createEmptySeats() {
  const seats = [];
  for (let i = 1; i <= TOTAL_SEATS; i++) {
    seats.push({
      number: i,
      name: '',
      checked: false
    });
  }
  return seats;
}

function loadSeats() {
  if (!fs.existsSync(SEATS_FILE)) {
    const seats = createEmptySeats();
    fs.writeFileSync(SEATS_FILE, JSON.stringify(seats, null, 2), 'utf-8');
    return seats;
  }

  const data = fs.readFileSync(SEATS_FILE, 'utf-8');
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error('อ่านไฟล์ seats.json ไม่ได้ รีเซ็ตใหม่', e);
    const seats = createEmptySeats();
    fs.writeFileSync(SEATS_FILE, JSON.stringify(seats, null, 2), 'utf-8');
    return seats;
  }
}

function saveSeats(seats) {
  fs.writeFileSync(SEATS_FILE, JSON.stringify(seats, null, 2), 'utf-8');
}

// API: ดูทุกที่นั่ง
app.get('/api/seats', (req, res) => {
  const seats = loadSeats();
  res.json(seats);
});

// API: เช็คชื่อ / ยกเลิกเช็คชื่อ
app.post('/api/seats/:number/check', (req, res) => {
  const seatNumber = parseInt(req.params.number, 10);
  const { name, checked } = req.body;

  if (isNaN(seatNumber)) {
    return res.status(400).json({ message: 'เลขที่นั่งไม่ถูกต้อง' });
  }

  let seats = loadSeats();
  const index = seats.findIndex((s) => s.number === seatNumber);

  if (index === -1) {
    return res.status(404).json({ message: 'ไม่พบที่นั่งนี้' });
  }

  seats[index].checked = !!checked;
  seats[index].name = checked ? (name || '') : '';

  saveSeats(seats);

  // ส่งให้ทุก client ทันที
  io.emit('seatsUpdated', seats);

  res.json(seats[index]);
});

// API: รีเซ็ตทั้งหมด
app.post('/api/seats/reset', (req, res) => {
  const seats = createEmptySeats();
  saveSeats(seats);
  io.emit('seatsUpdated', seats);
  res.json({ message: 'รีเซ็ตข้อมูลสำเร็จ', seats });
});

// เสิร์ฟ index.html สำหรับ route อื่นๆ
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`Server + Socket.io is running on port ${PORT}`);
});
