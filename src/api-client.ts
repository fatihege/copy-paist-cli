import axios from 'axios';
import {
    ContinueRefactorRequest,
    ContinueRefactorResponse,
    RefactorRequest,
    RefactorResponse
} from './types';
import {SocketClient} from './socket-client';

/**
 * ApiClient class to handle API requests and socket connections.
 */
export class ApiClient {
    /**
     * The base URL for the API.
     */
    private readonly baseUrl: string = `${process.env.API_URL}/api`;

    /**
     * The socket instance used for real-time communication.
     */
    private socket = SocketClient.getInstance().getSocket();

    /**
     * Start a refactor session
     * @param request - The refactor request object
     * @returns - The refactor response object
     */
    async startRefactorSessionStreaming(request: RefactorRequest): Promise<{ sessionId: string }> {
        await SocketClient.getInstance().ready(); // Ensure the socket is ready
        const response = await axios.post<RefactorResponse>(
            `${this.baseUrl}/ai/refactor/start`,
            {
                ...request,
                socketId: this.socket.id,
            }
        );
        return {sessionId: response.data.sessionId};
    }

    /**
     * Continue a refactor session
     * @param request - The refactor request object for continuation
     * @returns - The refactor response object
     */
    async continueRefactorSessionStreaming(request: ContinueRefactorRequest): Promise<ContinueRefactorResponse> {
        await SocketClient.getInstance().ready();
        const response = await axios.post<ContinueRefactorResponse>(
            `${this.baseUrl}/ai/refactor/continue`,
            {
                ...request,
                socketId: this.socket.id,
            }
        );
        return response.data;
    }
}
