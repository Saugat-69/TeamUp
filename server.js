const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Multer config without file type filter (all files allowed)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});

const upload = multer({ storage });

// Serve uploads and public folders
app.use("/uploads", express.static(uploadDir));
app.use(express.static(path.join(__dirname, "public")));

// Upload route
app.post("/upload", (req, res) => {
  upload.single("file")(req, res, function (err) {
    if (err) return res.status(400).json({ success: false, message: err.message });
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded." });

    const fileLink = `/uploads/${req.file.filename}`;
    res.json({ success: true, fileLink });
  });
});

// Socket.io logic
let roomTexts = {};

io.on("connection", (socket) => {
  let room = "";

  socket.on("join", (r) => {
    room = r;
    socket.join(room);
    socket.emit("text", roomTexts[room] || "");
  });

  socket.on("text", (msg) => {
    roomTexts[room] = msg;
    socket.to(room).emit("text", msg);
  });

  socket.on("file-uploaded", (link) => {
    socket.to(room).emit("file-uploaded", link);
  });
});

// Wildcard route last
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
const PORT = 3000;
http.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
