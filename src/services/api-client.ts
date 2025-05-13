import axios from 'axios';
import {
    ContinueGenerationRequest, ContinueGenerationResponse,
    ContinueRefactorRequest,
    ContinueRefactorResponse,
    GenerationRequest, GenerationResponse,
    RefactorRequest,
    RefactorResponse
} from '../types';
import {SocketClient} from './socket-client';
import {config} from '../config';

/**
 * ApiClient class to handle API requests and socket connections.
 */
export class ApiClient {
    /**
     * The base URL for the API.
     */
    private readonly baseUrl: string = `${config.API_URL}/api`;

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

    /**
     * Start a generation session
     * @param request - The generation request object
     * @returns - The generation response object
     */
    async startGenerationSessionStreaming(request: GenerationRequest): Promise<{ sessionId: string }> {
        await SocketClient.getInstance().ready(); // Ensure the socket is ready
        const response = await axios.post<GenerationResponse>(
            `${this.baseUrl}/ai/generate/start`,
            {
                ...request,
                socketId: this.socket.id,
            }
        );
        return {sessionId: response.data.sessionId};
    }

    /**
     * Continue a generation session
     * @param request - The generation request object for continuation
     * @returns - The generation response object
     */
    async continueGenerationSessionStreaming(request: ContinueGenerationRequest): Promise<ContinueGenerationResponse> {
        await SocketClient.getInstance().ready();
        const response = await axios.post<ContinueGenerationResponse>(
            `${this.baseUrl}/ai/generate/continue`,
            {
                ...request,
                socketId: this.socket.id,
            }
        );
        return response.data;
    }
}
