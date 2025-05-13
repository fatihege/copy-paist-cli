import {ApiClient} from '../services/api-client';
import {FileManager} from '../services/file-manager';
import {UI} from '../ui/ui';
import {Explanation} from '../types';
import chalk from 'chalk';
import {processStreamingResponse} from '../utils/process-streaming-response';

export async function handleExplain(
    apiClient: ApiClient,
    fileManager: FileManager,
    ui: UI,
    options: any
): Promise<string> {
    try {
        console.log(chalk.bold.green('📚 Explain Code'));

        // 1. Select file
        const selectedFile = await ui.selectFileWithExplorer();
        if (selectedFile === 'BACK') return 'BACK_TO_MAIN';

        // 2. Select lines from file
        const lineSelection = await ui.selectLines(selectedFile);
        if (lineSelection === 'BACK') return handleExplain(apiClient, fileManager, ui, options);

        // 3. Start the explanation session
        let spinner = ui.showSpinner('Starting explanation session...');

        const {sessionId} = await apiClient.explainCodeStream({
            code: lineSelection.code,
            model: 'deepseek-chat' // Default model
        });

        spinner.succeed('Explanation session started');

        // 4. Process explanation response
        spinner.start('Generating explanation...');
        const result = await processStreamingResponse(sessionId);
        spinner.succeed('Explanation generated');

        // 5. Display explanation
        ui.displayExplanation(result.data as Explanation);

        return ui.askNavigation();
    } catch (error) {
        console.error(chalk.red('Error:'), error);
        return ui.askNavigation('Would you like to try again or return to the main menu?');
    }
}

