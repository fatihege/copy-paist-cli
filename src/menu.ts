import chalk from 'chalk';
import inquirer from 'inquirer';
import {handleExplain, handleGenerate, handleRefactor} from './commands';
import {ApiClient} from './services/api-client';
import {FileManager} from './services/file-manager';
import {UI} from './ui/ui';

export async function showMainMenu(options: any) {
    console.log(chalk.bold.green('🧠 Copy Paist - AI Coding Assistant'));

    const {command} = await inquirer.prompt([
        {
            type: 'list',
            name: 'command',
            message: 'What would you like to do?',
            choices: [
                {name: 'Generate code', value: 'generate'},
                {name: 'Refactor code', value: 'refactor'},
                {name: 'Explain code', value: 'explain'},
                {name: 'Exit', value: 'exit'}
            ]
        }
    ]);

    if (command === 'exit') {
        console.log(chalk.blue('Goodbye! 👋'));
        process.exit(0);
    }

    const apiClient = new ApiClient();
    const fileManager = new FileManager(options.dir);
    const ui = new UI(fileManager);

    let result; // Placeholder for the result of the command
    if (command === 'generate')
        result = await handleGenerate(apiClient, fileManager, ui, options);
    else if (command === 'refactor')
        result = await handleRefactor(apiClient, fileManager, ui, options);
    else if (command === 'explain')
        result = await handleExplain(apiClient, fileManager, ui, options);

    if (result !== 'EXIT') return showMainMenu(options);

    process.exit(0);
}