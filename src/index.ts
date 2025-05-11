#!/usr/bin/env node

import {Command} from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';

const program = new Command();

program
    .name('copy-paist')
    .description('AI coding assistant for refactoring, explaining, and generating code')
    .version('0.0.1')
    .option('-d, --dir <directory>', 'Project directory', process.cwd());

// Main menu function that can be called recursively
async function showMainMenu(options: any) {
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
        return;
    }

    let result;
    if (command === 'refactor') {
        console.log(chalk.bold.green('🔧 Refactor Code'));
    } else if (command === 'explain') {
        console.log(chalk.bold.green('📚 Explain Code'));
    } else if (command === 'generate') {
        console.log(chalk.bold.green('✨ Generate Code'));
    }

    if (result !== 'EXIT') {
        return showMainMenu(options);
    }
}

program.action(async (options) => {
    await showMainMenu(options);
});

program.parse(process.argv);