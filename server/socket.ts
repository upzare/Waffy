import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { /* options */ });

io.on("connection", (socket) => {
    const client = socket.handshake.auth.token;
    const server = socket.handshake.auth.server;

    if (client) {
        console.log("A user connected");
        socket.join(client);
    }

    if (server) {
        console.log("A server connected");
        socket.on("highlight_client", ({ client_id, data }) => {
            if (!client_id || !data) {
                console.error("Missing data");
                return;
            }
            console.log("Highlight client:", client_id);
            io.to(client_id).emit("highlight", data);
        });
    }

    socket.on("disconnect", () => {
        if (client) {
            console.log("A user disconnected");
            socket.leave(client);
        }
        if (server) {
            console.log("A server disconnected");
        }
    });
});

httpServer.listen(8000);