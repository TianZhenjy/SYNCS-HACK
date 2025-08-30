// server.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure folders exist
const uploadsDir = path.join(__dirname, 'uploads');
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);

app.use(express.json());

// Multer storage & file filtering
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9-_]/gi, '_');
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${base}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const ok = ['video/mp4', 'video/webm'];
    if (ok.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only MP4 or WebM videos are allowed'));
  }
});

// --- DB helpers
const listStmt = db.prepare(`
  SELECT id, title, filename, likes, created_at
  FROM videos
  WHERE (? IS NULL OR id < ?)
  ORDER BY id DESC
  LIMIT ?
`);

const insertStmt = db.prepare(`
  INSERT INTO videos (title, filename) VALUES (?, ?)
`);

const likeStmt = db.prepare(`
  UPDATE videos SET likes = likes + 1 WHERE id = ?
`);

const getStmt = db.prepare(`
  SELECT id, title, filename, likes, created_at FROM videos WHERE id = ?
`);

// --- Routes
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/videos', (req, res) => {
  const limit = Math.max(1, Math.min(20, parseInt(req.query.limit) || 5));
  const cursor = req.query.cursor ? parseInt(req.query.cursor) : null;

  const rows = listStmt.all(cursor, cursor, limit);
  const videos = rows.map(v => ({
    id: v.id,
    title: v.title,
    url: `/uploads/${v.filename}`,
    likes: v.likes,
    created_at: v.created_at
  }));

  const nextCursor = videos.length === limit ? videos[videos.length - 1].id : null;
  res.json({ videos, nextCursor });
});

app.post('/api/upload', upload.single('video'), (req, res) => {
  try {
    const title = (req.body.title || '').trim();
    if (!title) return res.status(400).json({ error: 'Title is required' });
    if (!req.file) return res.status(400).json({ error: 'No video uploaded' });

    const info = insertStmt.run(title, req.file.filename);
    const saved = getStmt.get(info.lastInsertRowid);

    res.status(201).json({
      id: saved.id,
      title: saved.title,
      url: `/uploads/${saved.filename}`,
      likes: saved.likes,
      created_at: saved.created_at
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.post('/api/videos/:id/like', (req, res) => {
  const id = parseInt(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad id' });
  likeStmt.run(id);
  const row = getStmt.get(id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json({ id: row.id, likes: row.likes });
});

// Static hosting
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(publicDir));

app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ CVG running at http://localhost:${PORT}`);
});