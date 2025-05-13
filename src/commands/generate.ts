import {ApiClient} from '../services/api-client';
import {FileManager} from '../services/file-manager';
import {UI} from '../ui/ui';
import chalk from 'chalk';
import inquirer from 'inquirer';
import path from 'path';
import {FileRequest, GenerationAnalysis, GenerationComplete, GenerationProgress} from '../types';
import {processStreamingResponse} from '../utils/process-streaming-response';

export async function handleGenerate(
    apiClient: ApiClient,
    fileManager: FileManager,
    ui: UI,
    options: any
): Promise<string> {
    try {
        console.log(chalk.bold.green('✨ Generate Code'));

        // 1. Request prompt from the user
        const {prompt} = await inquirer.prompt([
            {
                type: 'editor',
                name: 'prompt',
                message: 'Describe the code you want to generate:',
                validate: (input) => input.trim().length > 0 || 'Prompt cannot be empty',
            },
        ]);

        // 2. Ask if user wants to select reference files for context
        const {wantReferenceFiles} = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'wantReferenceFiles',
                message: 'Do you want to select reference files for context?',
                default: false,
            },
        ]);

        let selectedFiles = [];
        if (wantReferenceFiles) {
            let selectingFiles = true;
            while (selectingFiles) {
                const filePath = await ui.selectFileWithExplorer();
                if (filePath === 'BACK') break;

                console.log(chalk.blue(`Selected file: ${filePath}`));
                const fileContent = await fileManager.getFileContent(filePath);
                selectedFiles.push({
                    path: path.relative(options.dir, path.join(options.dir, filePath)),
                    content: fileContent,
                });

                const {selectMore} = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'selectMore',
                        message: 'Do you want to select more files?',
                        default: false,
                    },
                ]);

                if (!selectMore) selectingFiles = false;
            }
        }

        // 3. Get available project files for context
        let spinner = ui.showSpinner('Scanning project files...');
        const projectFilePaths = await fileManager.listFiles();
        spinner.succeed('Project scanned');

        // 4. Start the generation session
        spinner.start('Starting generation session...');

        const {sessionId} = await apiClient.startGenerationSessionStreaming({
            prompt,
            selectedFiles,
            projectFilePaths,
            model: 'deepseek-chat' // Default model
        });

        spinner.succeed('Generation session started');

        // 5. Process the generation session
        let isComplete = false;
        let finalResult: GenerationComplete | null = null;

        while (!isComplete) {
            // Process a single round of AI response
            spinner = ui.showSpinner('Processing next step...');
            const result = await processStreamingResponse(sessionId);

            // Handle different response types
            switch (result.type) {
                case 'ANALYSIS':
                    const analysisResult = result.data as GenerationAnalysis;
                    spinner.succeed('Analysis complete');
                    console.log(chalk.bold.blue('\n🔍 Understanding your request:'));
                    console.log(analysisResult.understanding);

                    console.log(chalk.bold.blue('\n🛠️ Planned approach:'));
                    console.log(analysisResult.approach);
                    console.log();

                    const {continueAction} = await inquirer.prompt([
                        {
                            type: 'list',
                            name: 'continueAction',
                            message: 'How would you like to proceed?',
                            choices: [
                                {name: 'Continue with generation', value: 'CONTINUE'},
                                {name: '⬅️ Go back to file selection', value: 'BACK'},
                                {name: 'Return to main menu', value: 'MAIN_MENU'}
                            ]
                        }
                    ]);

                    if (continueAction === 'BACK') return handleGenerate(apiClient, fileManager, ui, options);
                    else if (continueAction === 'MAIN_MENU') return 'BACK_TO_MAIN';

                    // Continue without providing additional files
                    await apiClient.continueGenerationSessionStreaming({
                        sessionId,
                        fileContents: {}
                    });
                    break;

                case 'REQUEST_FILES':
                    const fileRequest = result.data as FileRequest;
                    spinner.succeed('Step processed, needing additional files');
                    const fileContents = await ui.handleFileRequest(fileRequest);

                    // Continue with the requested files
                    await apiClient.continueGenerationSessionStreaming({
                        sessionId,
                        fileContents
                    });
                    break;

                case 'GENERATION_PROGRESS':
                    spinner.succeed('Step processed');
                    ui.displayGenerationProgress(result.data as GenerationProgress);
                    // Continue to get the next update
                    await apiClient.continueGenerationSessionStreaming({
                        sessionId,
                        fileContents: {}
                    });
                    break;

                case 'GENERATION_COMPLETE':
                    spinner.succeed('Generation complete');
                    ui.displayGenerationCompletionSummary(result.data as GenerationComplete);
                    isComplete = true;
                    finalResult = result.data as GenerationComplete;
                    break;

                case 'ERROR':
                    spinner.fail('Error processing generation');
                    console.error(chalk.red('Error in AI response:'), result.message);
                    return ui.askNavigation('An error occurred. Would you like to try again?');
            }
        }

        // 6. After generation is complete
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