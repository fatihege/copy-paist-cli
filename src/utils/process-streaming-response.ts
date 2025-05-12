import {SocketClient} from '../services/socket-client';

/**
 * Process a single streaming response from the AI
 * @param sessionId - The current session ID
 * @returns The parsed response with type and data
 */
export async function processStreamingResponse(sessionId: string): Promise<{
    type: string;
    data?: any;
    message?: string;
}> {
    return new Promise((resolve) => {
        const socket = SocketClient.getInstance().getSocket();
        let accumulatedJson = '';

        // Handle chunks of the response
        function handleChunk(data: any) {
            if (data.sessionId !== sessionId) return;
            accumulatedJson += data.chunk;
        }

        // Handle completion of the stream
        function handleComplete(data: any) {
            if (data.sessionId !== sessionId) return;

            cleanupListeners();

            try {
                const jsonMatch = accumulatedJson.match(/```(?:json)?\n([\s\S]*?)\n```/);
                const parsed = JSON.parse(jsonMatch ? jsonMatch[1] : accumulatedJson);
                resolve({type: parsed.type, data: parsed});
            } catch (error) {
                // If parsing fails, return an error
                resolve({
                    type: 'ERROR',
                    message: `Failed to parse response: ${error}`
                });
            }
        }

        // Clean up socket listeners
        function cleanupListeners() {
            socket.off('stream-chunk', handleChunk);
            socket.off('stream-complete', handleComplete);
        }

        // Set up listeners
        socket.on('stream-chunk', handleChunk);
        socket.on('stream-complete', handleComplete);
    });
}
