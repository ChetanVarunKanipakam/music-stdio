const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- SETUP ---
const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); 

// Serve uploaded audio files statically so the frontend can play them
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- MONGODB CONNECTION ---
// Ensure MongoDB is running on your machine or use a Cloud URL
mongoose.connect('mongodb://127.0.0.1:27017/music-studio')
  .then(() => console.log("🍃 Connected to MongoDB"))
  .catch(err => console.error("❌ MongoDB Error:", err));

// --- SCHEMAS ---
const ProjectSchema = new mongoose.Schema({
  name: String,
  tempo: Number,
  totalSteps: Number,
  tracks: Array, 
  createdAt: { type: Date, default: Date.now }
});
const Project = mongoose.model('Project', ProjectSchema);

// --- FILE UPLOAD CONFIG (Multer) ---
// 1. Configure Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Ensure folder exists (optional safety check)
    const dir = 'uploads/';
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});

// 2. Initialize Multer (This was the missing step)
const upload = multer({ storage: storage });

// --- ROUTES ---

// 1. UPLOAD AUDIO
// We use 'upload.single' as a middleware wrapper to handle errors gracefully
app.post('/api/upload', (req, res) => {
  const uploadMiddleware = upload.single('audioFile');
  
  uploadMiddleware(req, res, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    // Return the URL accessible by the browser
    const fileUrl = `http://localhost:3004/uploads/${req.file.filename}`;
    res.json({ url: fileUrl, filename: req.file.originalname });
  });
});

// 2. SAVE PROJECT (Create or Update)
app.post('/api/projects', async (req, res) => {
  try {
    const { name, tempo, totalSteps, tracks, _id } = req.body;
    
    if (_id) {
      // Update existing
      await Project.findByIdAndUpdate(_id, { name, tempo, totalSteps, tracks });
      res.json({ success: true, _id });
    } else {
      // Create new
      const newProject = new Project({ name: name || 'Untitled Project', tempo, totalSteps, tracks });
      const saved = await newProject.save();
      res.json({ success: true, _id: saved._id });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 3. GET ALL PROJECTS
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await Project.find({}, 'name createdAt'); // Return only names/dates
    res.json(projects);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 4. GET SINGLE PROJECT
app.get('/api/projects/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    res.json(project);
  } catch (e) {
    res.status(404).json({ error: "Project not found" });
  }
});

// --- SOCKET SERVER ---
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  console.log(`👤 User Connected: ${socket.id}`);
  socket.on("SYNC_EVENT", (data) => socket.broadcast.emit("SYNC_EVENT", data));
});

server.listen(3004, () => {
  console.log("🚀 Server running on http://localhost:3004 (API + Sockets)");
});