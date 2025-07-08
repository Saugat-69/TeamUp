const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

app.use(express.static("public"));
app.use("/uploads", express.static(uploadDir));

let roomData = {}; // Stores { text, files, password, isPrivate }

const CLEAN_INTERVAL = 60 * 1000; // 1 minute
const EXPIRE_PUBLIC = 15 * 60 * 1000; // 15 minutes
const EXPIRE_PRIVATE = 30 * 60 * 1000; // 30 minutes

setInterval(() => {
  const now = Date.now();
  for (const room in roomData) {
    if (!roomData[room].files) continue;
    roomData[room].files = roomData[room].files.filter((file) => {
      const expired =
        now - file.timestamp >
        (roomData[room].isPrivate ? EXPIRE_PRIVATE : EXPIRE_PUBLIC);
      if (expired) {
        fs.unlink(path.join(uploadDir, file.filename), (err) => {
          if (err) console.error("Error deleting file:", err);
        });
      }
      return !expired;
    });
  }
}, CLEAN_INTERVAL);

io.on("connection", (socket) => {
  let joinedRoom = "";

  socket.on("join", ({ room, password, private: isPrivate }) => {
    // Log the join attempt
    console.log(`Socket ${socket.id} attempting to join room: ${room} (private: ${isPrivate})`);

    // Leave previous room if any
    if (joinedRoom) {
      socket.leave(joinedRoom);
      console.log(`Socket ${socket.id} left room: ${joinedRoom}`);
    }

    if (roomData[room]) {
      if (roomData[room].isPrivate && roomData[room].password !== password) {
        socket.emit("unauthorized");
        return;
      }
    } else {
      roomData[room] = {
        text: "",
        files: [],
        password: isPrivate ? password : null,
        isPrivate: isPrivate,
        isLAN: room.startsWith("lan_"),
      };
    }

    joinedRoom = room;
    socket.join(room);
    console.log(`Socket ${socket.id} joined room: ${room}`);

    socket.emit("text", roomData[room].text);
    socket.emit(
      "file-list",
      roomData[room].files.map((f) => ({
        link: `/uploads/${f.filename}`,
        name: f.originalName,
      }))
    );
  });

  socket.on("text", (msg) => {
    if (!joinedRoom) return;
    roomData[joinedRoom].text = msg;
    socket.to(joinedRoom).emit("text", msg);
  });

  socket.on("file-uploaded", ({ filename, originalName, room }) => {
    if (!roomData[room]) return;
    const fileEntry = {
      filename,
      originalName,
      timestamp: Date.now(),
    };
    roomData[room].files.push(fileEntry);

    const payload = {
      link: `/uploads/${filename}`,
      name: originalName,
    };

    io.to(room).emit("file-uploaded", payload);
  });
});

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.json({ success: false });
  res.json({
    success: true,
    filename: req.file.filename,
    originalName: req.file.originalname,
  });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
