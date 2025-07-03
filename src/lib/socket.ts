import { io } from 'socket.io-client';

const URL = 'ws://localhost:8000';

export const socket = io(URL, {
    auth: {
        session: "",
        clientId: ""
    }
});