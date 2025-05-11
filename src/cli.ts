#!/usr/bin/env node

import {Command} from 'commander';
import dotenv from 'dotenv';
import {showMainMenu} from './menu';

const program = new Command();

program
    .name('copy-paist')
    .description('An AI coding assistant which generates, explains, and refactors code for you')
    .version('0.0.1')
    .option('-d, --dir <directory>', 'Project directory', process.cwd());

// Define the main action for the program
program.action(async (options) => {
    await showMainMenu(options);
});

// Parse command line arguments
program.parse(process.argv);

// Load environment variables from .env file
dotenv.config();