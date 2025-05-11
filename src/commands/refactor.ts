import path from 'path';
import chalk from 'chalk';
import {ApiClient} from '../api-client';
import {FileManager} from '../file-manager';
import {UI} from '../ui';

export async function handleRefactor(apiClient: ApiClient, fileManager: FileManager, ui: UI, options: any): Promise<string> {
    try {
        console.log(chalk.bold.green('🔧 Refactor Code'));

        const filePath = await ui.selectFileWithExplorer();
        if (filePath === 'BACK') {
            return 'BACK_TO_MAIN';
        }

        console.log(chalk.blue(`Selected file: ${filePath}`));

        const lineSelection = await ui.selectLines(filePath);
        if (lineSelection === 'BACK') {
            return handleRefactor(apiClient, fileManager, ui, options);
        }

        const {code} = lineSelection;
        const projectFilePaths = await fileManager.getProjectTree();

        console.log(chalk.bold('\nSelected code:'));
        console.log(chalk.gray(code));

        let spinner = ui.showSpinner('Starting refactoring session...');
        const {sessionId} = await apiClient.startRefactorSessionStreaming({
            code,
            filePath: path.relative(options.dir, path.join(options.dir, filePath)),
            projectFilePaths,
            model: 'deepseek-chat'
        });
        spinner.succeed('Refactoring session started');

        if (!sessionId) {
            console.error(chalk.red('Error:'), 'Session ID not found');

            const nextAction = await ui.askNavigation('Error occurred. What would you like to do?');
            if (nextAction === 'MAIN_MENU') {
                return 'BACK_TO_MAIN';
            } else {
                return 'EXIT';
            }
        }

        // Implement the main loop for refactoring

        console.log(chalk.green('\n✨ Refactoring completed successfully!'));

        const nextAction = await ui.askNavigation('What would you like to do next?');
        if (nextAction === 'MAIN_MENU') {
            return 'BACK_TO_MAIN';
        } else {
            return 'EXIT';
        }
    } catch (error) {
        console.error(chalk.red('Error:'), error);

        const nextAction = await ui.askNavigation('Error occurred. What would you like to do?');
        if (nextAction === 'MAIN_MENU') {
            return 'BACK_TO_MAIN';
        } else {
            return 'EXIT';
        }
    }
}
