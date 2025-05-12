import {ApiClient} from '../services/api-client';
import {FileManager} from '../services/file-manager';
import {UI} from '../ui/ui';
import {FileRequest, RefactorAnalysis, RefactorComplete, RefactorProgress} from '../types';
import inquirer from 'inquirer';
import chalk from 'chalk';
import {processStreamingResponse} from '../utils/process-streaming-response';

export async function handleRefactor(
    apiClient: ApiClient,
    fileManager: FileManager,
    ui: UI,
    options: any
): Promise<string> {
    try {
        console.log(chalk.bold.green('🔧 Refactor Code'));

        // 1. Select file
        const selectedFile = await ui.selectFileWithExplorer();
        if (selectedFile === 'BACK') return 'BACK_TO_MAIN';

        // 2. Select lines from file
        const lineSelection = await ui.selectLines(selectedFile);
        if (lineSelection === 'BACK') return handleRefactor(apiClient, fileManager, ui, options);

        // 3. Get available project files for context
        let spinner = ui.showSpinner('Scanning project files...');
        const projectFiles = await fileManager.listFiles();
        spinner.succeed('Project scanned');

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
            const confirm = await ui.confirmCodeChanges();

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
        console.error(chalk.red('Error:'), error);
        return ui.askNavigation('Would you like to try again or return to the main menu?');
    }
}

