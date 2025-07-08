const socket = io();

// Add connection debugging
socket.on("connect_error", (error) => {
  console.error("Connection error:", error);
  showNotification("Failed to connect to server. Please check if the server is running.", "error");
  updateConnectionStatus("error", "Connection Failed");
  joinBtn.disabled = false;
  joinBtn.innerHTML = '<span class="btn-text">Join Room</span><span class="btn-icon">🚀</span>';
});

const editor = document.getElementById("editor");
const roomInput = document.getElementById("roomInput");
const passwordInput = document.getElementById("passwordInput");
const privateToggle = document.getElementById("privateToggle");
const joinBtn = document.getElementById("joinBtn");
const connectionType = document.getElementById("connectionType");
const uploadForm = document.getElementById("uploadForm");
const fileInput = document.getElementById("fileInput");
const fileList = document.getElementById("fileList");
const dropArea = document.getElementById("dropArea");
const connectionStatus = document.getElementById("connectionStatus");
const fileCount = document.getElementById("fileCount");

let currentRoom = "";
let isConnected = false;
let fileCountNum = 0;

// Connection status management
function updateConnectionStatus(status, message) {
  connectionStatus.textContent = message;
  connectionStatus.className = `status-indicator ${status}`;
  isConnected = status === "connected";
}

function updateFileCount() {
  fileCountNum = fileList.children.length;
  fileCount.textContent = `${fileCountNum} file${fileCountNum !== 1 ? "s" : ""}`;
}

function updateDefaultRoom() {
  const isPrivate = privateToggle.checked;
  const isLAN = connectionType.value === "lan";

  if (!isPrivate) {
    roomInput.value = isLAN ? "lan_world" : "world";
    roomInput.disabled = true;
    passwordInput.disabled = true;
    passwordInput.value = "";
  } else {
    roomInput.value = "";
    roomInput.disabled = false;
    passwordInput.disabled = false;
  }
  currentRoom = roomInput.value;
}

function joinRoom() {
  const roomName = roomInput.value.trim();
  const password = passwordInput.value;
  const isPrivate = privateToggle.checked;
  const isLAN = connectionType.value === "lan";

  console.log("Joining room:", { roomName, isPrivate, isLAN, socketConnected: socket.connected });

  if (!roomName) {
    showNotification("Please enter a room name", "error");
    return;
  }

  const finalRoom = !isPrivate && isLAN ? "lan_world" : !isPrivate ? "world" : roomName;
  currentRoom = finalRoom;

  console.log("Final room name:", finalRoom);

  // Update button state
  joinBtn.disabled = true;
  joinBtn.innerHTML = '<span class="btn-text">Connecting...</span><span class="btn-icon">⏳</span>';
  updateConnectionStatus("connecting", "Connecting...");

  // Set a timeout for connection
  const connectionTimeout = setTimeout(() => {
    if (joinBtn.disabled) {
      console.log("Connection timeout reached");
      showNotification("Connection timeout. Please try again.", "error");
      updateConnectionStatus("error", "Connection Timeout");
      joinBtn.disabled = false;
      joinBtn.innerHTML = '<span class="btn-text">Join Room</span><span class="btn-icon">🚀</span>';
    }
  }, 10000); // 10 second timeout

  console.log("Emitting join event for room:", finalRoom);
  socket.emit("join", {
    room: finalRoom,
    password,
    private: isPrivate,
  });

  // Store the timeout ID to clear it when connection succeeds
  socket.connectionTimeout = connectionTimeout;
}

function showNotification(message, type = "info") {
  // Create notification element
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-icon">${type === "error" ? "❌" : type === "success" ? "✅" : "ℹ️"}</span>
      <span class="notification-message">${message}</span>
    </div>
  `;

  // Add to page
  document.body.appendChild(notification);

  // Animate in
  setTimeout(() => notification.classList.add("show"), 100);

  // Remove after 5 seconds
  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}

// Event Listeners
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded, initializing...");
  console.log("Socket.IO available:", typeof io !== "undefined");
  console.log("Socket connected:", socket.connected);

  updateDefaultRoom();

  // Wait a bit for socket to connect before joining
  if (socket.connected) {
    joinRoom();
  } else {
    socket.on("connect", () => {
      console.log("Socket connected, joining room...");
      joinRoom();
    });
  }

  // Add keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    // Ctrl/Cmd + Enter to join room
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      joinRoom();
    }

    // Ctrl/Cmd + S to save (just focus editor for now)
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      editor.focus();
    }
  });
});

connectionType.addEventListener("change", updateDefaultRoom);
privateToggle.addEventListener("change", updateDefaultRoom);
joinBtn.addEventListener("click", joinRoom);

// Editor events
editor.addEventListener("input", () => {
  if (currentRoom && isConnected) {
    socket.emit("text", { text: editor.value, user: "You" });
    socket.emit("typing", "You");
  }
});

// Show who is typing
const typingIndicator = document.createElement("div");
typingIndicator.id = "typingIndicator";
typingIndicator.style.marginTop = "4px";
typingIndicator.style.fontStyle = "italic";
typingIndicator.style.color = "#555";
editor.parentNode.insertBefore(typingIndicator, editor.nextSibling);

let typingTimeout;
socket.on("typing", (user) => {
  if (user === "You") return; // Don't show your own typing
  typingIndicator.textContent = `${user} is typing...`;
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    typingIndicator.textContent = "";
  }, 2000);
});

// Socket events
socket.on("connect", () => {
  updateConnectionStatus("connected", "Connected to Server");
  if (currentRoom) {
    joinRoom();
  }
});

socket.on("disconnect", () => {
  updateConnectionStatus("disconnected", "Disconnected");
  isConnected = false;
});

socket.on("unauthorized", () => {
  if (socket.connectionTimeout) {
    clearTimeout(socket.connectionTimeout);
    socket.connectionTimeout = null;
  }

  showNotification("Incorrect password. Please try again.", "error");
  updateConnectionStatus("error", "Authentication Failed");
  joinBtn.disabled = false;
  joinBtn.innerHTML = '<span class="btn-text">Join Room</span><span class="btn-icon">🚀</span>';
});

socket.on("text", ({ text, user }) => {
  console.log("Received text message:", text ? "has content" : "empty", "from user:", user);
  editor.value = text;
  if (joinBtn.disabled) {
    if (socket.connectionTimeout) {
      clearTimeout(socket.connectionTimeout);
      socket.connectionTimeout = null;
    }
    showNotification(`Successfully joined room: ${currentRoom}`, "success");
    updateConnectionStatus("connected", "Connected");
    joinBtn.disabled = false;
    joinBtn.innerHTML = '<span class="btn-text">Connected</span><span class="btn-icon">✅</span>';
  }
});

dropArea.addEventListener("click", () => fileInput.click());

dropArea.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});

dropArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropArea.classList.add("drag-over");
});

dropArea.addEventListener("dragleave", () => {
  dropArea.classList.remove("drag-over");
});

dropArea.addEventListener("drop", (e) => {
  e.preventDefault();
  dropArea.classList.remove("drag-over");
  if (e.dataTransfer.files.length) {
    uploadFile(e.dataTransfer.files[0]);
  }
});

fileInput.addEventListener("change", () => {
  if (fileInput.files.length) {
    uploadFile(fileInput.files[0]);
  }
});

function uploadFile(file) {
  if (!currentRoom) {
    showNotification("Please join a room first", "error");
    return;
  }

  if (!isConnected) {
    showNotification("Not connected to server", "error");
    return;
  }

  // Show upload progress
  const originalText = dropArea.querySelector("p").textContent;
  dropArea.querySelector("p").textContent = `Uploading ${file.name}...`;
  dropArea.classList.add("uploading");

  const formData = new FormData();
  formData.append("file", file);

  fetch("/upload", { method: "POST", body: formData })
    .then((res) => res.json())
    .then((data) => {
      if (data.success) {
        socket.emit("file-uploaded", {
          filename: data.filename,
          originalName: data.originalName,
          room: currentRoom,
        });
        showNotification(`File "${data.originalName}" uploaded successfully!`, "success");
        fileInput.value = "";
      } else {
        showNotification("Upload failed. Please try again.", "error");
      }
    })
    .catch((error) => {
      console.error("Upload error:", error);
      showNotification("Upload failed. Please try again.", "error");
    })
    .finally(() => {
      dropArea.querySelector("p").textContent = originalText;
      dropArea.classList.remove("uploading");
    });
}

socket.on("file-uploaded", (file) => {
  const li = document.createElement("li");
  li.innerHTML = `<a href="${file.link}" target="_blank" rel="noopener noreferrer">${file.name}</a>`;
  fileList.appendChild(li);
  updateFileCount();
});

socket.on("file-list", (files) => {
  fileList.innerHTML = "";
  files.forEach((file) => {
    const li = document.createElement("li");
    li.innerHTML = `<a href="${file.link}" target="_blank" rel="noopener noreferrer">${file.name}</a>`;
    fileList.appendChild(li);
  });
  updateFileCount();
});

// Add CSS for notifications
const notificationStyles = `
.notification {
  position: fixed;
  top: 20px;
  right: 20px;
  background: white;
  border-radius: 12px;
  padding: 16px 20px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  border: 1px solid #e2e8f0;
  transform: translateX(100%);
  transition: transform 0.3s ease;
  z-index: 1000;
  max-width: 300px;
}

.notification.show {
  transform: translateX(0);
}

.notification-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.notification-icon {
  font-size: 18px;
}

.notification-message {
  font-size: 14px;
  font-weight: 500;
  color: #1e293b;
}

.notification.error {
  border-left: 4px solid #ef4444;
}

.notification.success {
  border-left: 4px solid #10b981;
}

.notification.info {
  border-left: 4px solid #3b82f6;
}

.drag-over {
  border-color: #667eea !important;
  background: linear-gradient(135deg, #f0f4ff 0%, #e0e7ff 100%) !important;
  transform: scale(1.02);
}

.uploading {
  opacity: 0.7;
  pointer-events: none;
  position: relative;
}

.uploading::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 20px;
  height: 20px;
  margin: -10px 0 0 -10px;
  border: 2px solid #667eea;
  border-top: 2px solid transparent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
`;

// Inject notification styles
const styleSheet = document.createElement("style");
styleSheet.textContent = notificationStyles;
document.head.appendChild(styleSheet);
