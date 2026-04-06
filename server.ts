import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";

const PORT = 3000;

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  app.use(express.json());

  // Socket.IO logic for real-time sync
  io.on("connection", (socket) => {
    console.log("Socket: User connected", socket.id);

    socket.on("join-group", (groupId) => {
      console.log(`Socket: User ${socket.id} joined group ${groupId}`);
      socket.join(groupId);
      // Request state from other users in the group
      socket.to(groupId).emit("request-state");
    });

    socket.on("update-state", ({ groupId, state }) => {
      console.log(`Socket: State update for group ${groupId}`);
      socket.to(groupId).emit("sync-state", state);
    });

    socket.on("disconnect", () => {
      console.log("Socket: User disconnected", socket.id);
    });
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
