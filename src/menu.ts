import chalk from 'chalk';
import inquirer from 'inquirer';
import {handleRefactor} from './commands';
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
                {name: 'Refactor code', value: 'refactor'},
                {name: 'Explain code', value: 'explain'},
                {name: 'Generate code', value: 'generate'},
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
    if (command === 'refactor')
        result = await handleRefactor(apiClient, fileManager, ui, options);
    else if (command === 'explain')
        console.log(chalk.bold.green('📚 Explain Code'));
    else if (command === 'generate')
        console.log(chalk.bold.green('✨ Generate Code'));

    if (result !== 'EXIT') {
        return showMainMenu(options);
    }
}