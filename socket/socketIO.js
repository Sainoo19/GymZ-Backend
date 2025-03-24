const { Server } = require("socket.io");

let io = null; // Đảm bảo `io` khởi tạo là null ban đầu

module.exports = {
  init: (server) => {
    if (!io) {
      io = new Server(server, {
        cors: {
          origin: "*", // Thay đổi thành URL frontend nếu cần
          methods: ["GET", "POST"]
        }
      });

      io.on("connection", (socket) => {
        console.log("✅ A user connected");

        socket.on("disconnect", () => {
          console.log("❌ A user disconnected");
        });
      });

      console.log("✅ Socket.IO initialized");
    } else {
      console.warn("⚠️ Socket.IO đã được khởi tạo trước đó.");
    }
    return io;
  },

  getIO: () => {
    if (!io) {
      console.warn("⚠️ Socket.io chưa khởi tạo. Hãy gọi `init(server)` trước.");
      return null;
    }
    return io;
  }
};
