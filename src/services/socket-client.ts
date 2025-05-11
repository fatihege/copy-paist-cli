import {io, Socket} from 'socket.io-client';

export class SocketClient {
    private static instance: SocketClient;
    private readonly socket: Socket;

    private constructor() {
        // Set the socket connection to the server
        this.socket = io(process.env.API_URL || 'http://localhost:3001', {
            transports: ['websocket'],
        });
    }

    static getInstance(): SocketClient {
        if (!SocketClient.instance)
            SocketClient.instance = new SocketClient();
        return SocketClient.instance;
    }

    getSocket(): Socket {
        return this.socket;
    }

    async ready(): Promise<void> {
        if (this.socket.connected) return; // If already connected, resolve immediately
        await new Promise<void>((resolve) => {
            // Wait for the socket to connect
            this.socket.once('connect', () => resolve());
        });
    }
}
