import {ApiClient} from '../services/api-client';
import {FileManager} from '../services/file-manager';
import {UI} from '../ui/ui';
import {SocketClient} from '../services/socket-client';
import {FileRequest, RefactorAnalysis, RefactorComplete, RefactorProgress} from '../types';
import inquirer from 'inquirer';
import chalk from 'chalk';

export async function handleRefactor(
    apiClient: ApiClient,
    fileManager: FileManager,
    ui: UI,
    options: any
): Promise<string> {
    // 1. Select file
    const selectedFile = await ui.selectFileWithExplorer();
    if (selectedFile === 'BACK') return 'MAIN_MENU';

    // 2. Select lines from file
    const lineSelection = await ui.selectLines(selectedFile);
    if (lineSelection === 'BACK') return handleRefactor(apiClient, fileManager, ui, options);

    // 3. Get available project files for context
    let spinner = ui.showSpinner('Scanning project files...');
    const projectFiles = await fileManager.listFiles();
    spinner.succeed('Project scanned');

    try {
        // 4. Start the refactoring session
        spinner.start('Starting refactoring session...');

        const {sessionId} = await apiClient.startRefactorSessionStreaming({
            code: lineSelection.code,
            filePath: selectedFile,
            projectFilePaths: projectFiles,
            model: 'deepseek-chat' // Default model
        });

        spinner.succeed('Refactoring session started');

        // 5. Process the refactoring session
        let isComplete = false;
        let finalResult: RefactorComplete | null = null;

        while (!isComplete) {
            // Process a single round of AI response
            spinner = ui.showSpinner('Processing next step...');
            const result = await processStreamingResponse(sessionId);

            // Handle different response types
            switch (result.type) {
                case 'ANALYSIS':
                    spinner.succeed('Analysis complete');
                    ui.displayAnalysis(result.data as RefactorAnalysis);

                    const {continueAction} = await inquirer.prompt([
                        {
                            type: 'list',
                            name: 'continueAction',
                            message: 'How would you like to proceed?',
                            choices: [
                                {name: 'Continue with refactoring', value: 'CONTINUE'},
                                {name: '⬅️ Go back to file selection', value: 'BACK'},
                                {name: 'Return to main menu', value: 'MAIN_MENU'}
                            ]
                        }
                    ]);

                    if (continueAction === 'BACK') return handleRefactor(apiClient, fileManager, ui, options);
                    else if (continueAction === 'MAIN_MENU') return 'BACK_TO_MAIN';

                    // Continue without providing additional files
                    await apiClient.continueRefactorSessionStreaming({
                        sessionId,
                        fileContents: {}
                    });
                    break;

                case 'REQUEST_FILES':
                    const fileRequest = result.data as FileRequest;
                    spinner.succeed('Step processed, needing additional files');
                    const fileContents = await ui.handleFileRequest(fileRequest);

                    // Continue with the requested files
                    await apiClient.continueRefactorSessionStreaming({
                        sessionId,
                        fileContents
                    });
                    break;

                case 'REFACTOR_PROGRESS':
                    spinner.succeed('Step processed');
                    ui.displayRefactorProgress(result.data as RefactorProgress);
                    // Continue to get the next update
                    await apiClient.continueRefactorSessionStreaming({
                        sessionId,
                        fileContents: {}
                    });
                    break;

                case 'REFACTOR_COMPLETE':
                    spinner.succeed('Refactoring complete');
                    ui.displayRefactorCompletionSummary(result.data as RefactorComplete);
                    isComplete = true;
                    finalResult = result.data as RefactorComplete;
                    break;

                case 'ERROR':
                    spinner.fail('Error processing refactoring');
                    console.error(chalk.red('Error in AI response:'), result.message);
                    return ui.askNavigation('An error occurred. Would you like to try again?');
            }
        }

        // 6. After refactoring is complete
        if (finalResult) {
            const confirm = await ui.confirmRefactoring();

            if (confirm) {
                spinner.start('Applying changes...');

                // Create backups before applying changes
                for (const change of finalResult.changes)
                    await fileManager.createBackup(change.filePath);

                // Apply changes to the files
                await fileManager.applyChanges(finalResult.changes);

                spinner.succeed('Changes applied successfully!');
            } else
                console.log(chalk.yellow('Changes were not applied.'));
        }

        return ui.askNavigation();
    } catch (error) {
        spinner.fail(`Error during refactoring: ${error}`);
        console.error(chalk.red('Error:'), error);

        return ui.askNavigation('Would you like to try again or return to the main menu?');
    }
}

/**
 * Process a single streaming response from the AI
 * @param sessionId - The current session ID
 * @returns The parsed response with type and data
 */
async function processStreamingResponse(sessionId: string): Promise<{
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
