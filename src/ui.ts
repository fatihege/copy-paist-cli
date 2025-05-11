import inquirer from 'inquirer';
import chalk from 'chalk';
import ora, {Ora} from 'ora';
import {diffLines} from 'diff';
import path from 'path';
import {FileManager} from './file-manager';
import {FileRequest, RefactorAnalysis, RefactorChange, RefactorComplete, RefactorProgress} from './types';

/**
 * UI class for handling user interactions and displaying information.
 * This class provides methods for selecting files, displaying analysis,
 * confirming refactoring, and showing progress.
 */
export class UI {
    private fileManager: FileManager; // FileManager instance for file operations

    constructor(fileManager: FileManager) {
        this.fileManager = fileManager;
    }

    /**
     * Selects a file using an interactive file explorer.
     * Allows the user to navigate directories and select files.
     * @returns {Promise<string>} - The selected file path or 'BACK' to go back.
     */
    async selectFileWithExplorer(): Promise<string> {
        let selectedFile: string | null | 'BACK' = null; // Initialize selectedFile to null
        let currentDir = '.'; // Start in the current directory

        const languageChoices = [
            {name: 'All Files', value: 'all'},
            {name: 'Web (JS/TS/HTML/CSS)', value: 'web'},
            {name: 'JavaScript', value: 'javascript'},
            {name: 'TypeScript', value: 'typescript'},
            {name: 'Python', value: 'python'},
            {name: 'Java', value: 'java'},
            {name: 'C#', value: 'csharp'},
            {name: 'Go', value: 'go'},
            {name: 'Rust', value: 'rust'},
            {name: 'C/C++', value: 'cpp'},
            {name: 'Ruby', value: 'ruby'},
            {name: 'PHP', value: 'php'},
            {name: 'Swift', value: 'swift'},
            {name: 'Kotlin', value: 'kotlin'},
            // Add more languages as needed
            {name: 'Custom Pattern', value: 'custom'},
            {name: '⬅️ Go back', value: 'BACK'}
        ];

        console.clear();
        const {pattern} = await inquirer.prompt([
            {
                type: 'list',
                name: 'pattern',
                message: 'What type of files are you looking for?',
                choices: languageChoices
            }
        ]);

        if (pattern === 'BACK') return 'BACK';

        let filePattern = pattern;

        if (pattern === 'custom') {
            console.clear();
            const {customPattern} = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'customPattern',
                    message: 'Enter custom file pattern (e.g. "**/*.sql"):',
                    validate: (input) => input.trim().length > 0 || 'Pattern cannot be empty'
                }
            ]);
            filePattern = customPattern;
        }

        while (selectedFile === null) {
            console.clear();
            const choices = [];

            if (currentDir !== '.') {
                choices.push({
                    name: '⬆️ ../ (Go up a directory)',
                    value: 'GO_UP'
                });
            }

            const recentFiles = this.fileManager.getRecentFiles();
            if (recentFiles.length > 0) {
                choices.push({
                    name: '📋 Recent Files',
                    value: 'RECENT_FILES'
                });
            }

            const directories = await this.fileManager.listDirectories(currentDir);
            directories.forEach(dir => {
                const relativePath = path.relative(currentDir, dir).split(path.sep).join('/');
                choices.push({
                    name: `📁 ${relativePath}/`,
                    value: {type: 'DIRECTORY', path: dir}
                });
            });

            const normalizedCurrentDir = currentDir.split(path.sep).join('/');
            const patternInDir = normalizedCurrentDir ? // TODO: Implement this
                path.join(currentDir, filePattern === 'all' ? '**/*.*' : filePattern) :
                filePattern === 'all' ? '**/*.*' : filePattern;

            const files = await this.fileManager.listFilesInDirectory(normalizedCurrentDir);
            files
                .sort()
                .forEach(file => {
                    const relativePath = path.relative(currentDir, file).split(path.sep).join('/');
                    choices.push({
                        name: `📄 ${relativePath}`,
                        value: {type: 'FILE', path: file}
                    });
                });

            choices.push({
                name: '🔍 Search for files by name',
                value: 'SEARCH'
            });

            choices.push({
                name: '🔄 Change file type filter',
                value: 'CHANGE_PATTERN'
            });

            choices.push({
                name: '⬅️ Go back to main menu',
                value: 'BACK'
            });

            const {selection} = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'selection',
                    message: currentDir ? `Browsing ${normalizedCurrentDir}:` : 'Select a file:',
                    pageSize: 15,
                    choices
                }
            ]);

            if (selection === 'BACK') {
                return 'BACK';
            } else if (selection === 'GO_UP') {
                currentDir = path.dirname(currentDir);
            } else if (selection === 'RECENT_FILES') {
                const recentChoices: {
                    name: string,
                    value: { type: string, path: string } | string
                }[] = recentFiles.map(file => ({
                    name: file,
                    value: {type: 'FILE', path: file}
                }));

                recentChoices.push({
                    name: '⬅️ Back to file browser',
                    value: 'BACK_TO_BROWSER'
                });

                const {recentFile} = await inquirer.prompt([
                    {
                        type: 'list',
                        name: 'recentFile',
                        message: 'Select a recent file:',
                        choices: recentChoices
                    }
                ]);

                if (recentFile === 'BACK_TO_BROWSER') {
                    continue;
                }
                if (recentFile.type === 'FILE') {
                    selectedFile = recentFile.path;
                }
            } else if (selection === 'SEARCH') {
                const {searchQuery} = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'searchQuery',
                        message: 'Enter a file name to search for:',
                        validate: (input) => input.trim().length > 0 || 'Search query cannot be empty'
                    }
                ]);

                const searchPattern = `**/*${searchQuery}*`.split(path.sep).join('/');
                const searchResults = await this.fileManager.listFiles(searchPattern);

                if (searchResults.length === 0) {
                    console.log(chalk.yellow('\nNo files found matching your search.'));
                    continue;
                }

                const searchChoices: {
                    name: string,
                    value: { type: string, path: string } | string
                }[] = searchResults.map(file => ({
                    name: file,
                    value: {type: 'FILE', path: file}
                }));

                searchChoices.push({
                    name: '⬅️ Back to file browser',
                    value: 'BACK_TO_BROWSER'
                });

                const {selectedSearchResult} = await inquirer.prompt([
                    {
                        type: 'list',
                        name: 'selectedSearchResult',
                        message: 'Search results:',
                        choices: searchChoices
                    }
                ]);

                if (selectedSearchResult === 'BACK_TO_BROWSER') {
                    continue;
                }

                if (selectedSearchResult.type === 'FILE') {
                    selectedFile = selectedSearchResult.path;
                }
            } else if (selection === 'CHANGE_PATTERN') {
                const {newPattern} = await inquirer.prompt([
                    {
                        type: 'list',
                        name: 'newPattern',
                        message: 'Select file type filter:',
                        choices: languageChoices
                    }
                ]);

                if (newPattern === 'BACK') {
                    continue;
                }

                filePattern = newPattern;

                if (newPattern === 'custom') {
                    const {customPattern} = await inquirer.prompt([
                        {
                            type: 'input',
                            name: 'customPattern',
                            message: 'Enter custom file pattern (e.g. "**/*.sql"):',
                            validate: (input) => input.trim().length > 0 || 'Pattern cannot be empty'
                        }
                    ]);
                    filePattern = customPattern;
                }
            } else if (selection && typeof selection === 'object') {
                if (selection.type === 'DIRECTORY') {
                    currentDir = selection.path;
                } else if (selection.type === 'FILE') {
                    selectedFile = selection.path;
                }
            }
        }

        return selectedFile;
    }

    /**
     * Selects lines from a file using an interactive line selection interface.
     * Allows the user to navigate through lines, select a range, or select the entire file.
     * @param {string} filePath - The path of the file to select lines from.
     * @returns {Promise<{code: string, startLine: number, endLine: number} | 'BACK'>} - The selected lines or 'BACK' to go back.
     */
    async selectLines(filePath: string): Promise<{
        code: string;
        startLine: number;
        endLine: number;
    } | 'BACK'> {
        const content = await this.fileManager.getFileContent(filePath);
        const lines = content.split('\n');

        let startDisplay = 0;
        let endDisplay = Math.min(lines.length, 20);

        while (true) {
            console.clear();
            console.log(chalk.bold.blue(`File: ${filePath}`));
            console.log(chalk.gray(`Showing lines ${startDisplay + 1}-${endDisplay} of ${lines.length}`));

            lines.slice(startDisplay, endDisplay).forEach((line, index) => {
                console.log(chalk.gray(`${startDisplay + index + 1}:`), line);
            });

            console.log();

            const navigateOptions = [
                {name: 'Select custom range', value: 'SELECT'},
                {name: 'Show next 20 lines', value: 'NEXT'},
                {name: 'Show previous 20 lines', value: 'PREV'},
                {name: 'Jump to line...', value: 'JUMP'},
                {name: 'Select entire file', value: 'ALL'},
                {name: '⬅️ Go back to file selection', value: 'BACK'}
            ];

            const {navigation} = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'navigation',
                    message: 'Navigation:',
                    choices: navigateOptions
                }
            ]);

            if (navigation === 'BACK') {
                return 'BACK';
            } else if (navigation === 'SELECT') {
                break;
            } else if (navigation === 'NEXT') {
                if (endDisplay < lines.length) {
                    startDisplay = endDisplay;
                    endDisplay = Math.min(lines.length, startDisplay + 20);
                }
            } else if (navigation === 'PREV') {
                if (startDisplay > 0) {
                    endDisplay = startDisplay;
                    startDisplay = Math.max(0, startDisplay - 20);
                }
            } else if (navigation === 'JUMP') {
                const {jumpLine} = await inquirer.prompt([
                    {
                        type: 'number',
                        name: 'jumpLine',
                        message: `Enter line number (1-${lines.length}):`,
                        validate: (value) =>
                            value > 0 && value <= lines.length ? true : 'Invalid line number'
                    }
                ]);

                startDisplay = Math.max(0, jumpLine - 11);
                endDisplay = Math.min(lines.length, startDisplay + 20);
            } else if (navigation === 'ALL') {
                return {
                    code: content,
                    startLine: 1,
                    endLine: lines.length
                };
            }
        }

        const lineChoices = [
            {
                type: 'number',
                name: 'startLine',
                message: 'Enter start line:',
                default: startDisplay + 1,
                validate: (value: number) =>
                    value > 0 && value <= lines.length
                        ? true
                        : 'Line number out of range',
            },
            {
                type: 'number',
                name: 'endLine',
                message: 'Enter end line:',
                default: (answers: any) => Math.min(answers.startLine + 20, lines.length),
                validate: (value: number, answers: any) =>
                    value >= answers.startLine && value <= lines.length
                        ? true
                        : 'Line number out of range',
            }
        ];

        const {action} = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'Proceed with line selection?',
                choices: [
                    {name: 'Select line range', value: 'SELECT'},
                    {name: '⬅️ Go back', value: 'BACK'}
                ]
            }
        ]);

        if (action === 'BACK') {
            return 'BACK';
        }

        const {startLine, endLine} = await inquirer.prompt(lineChoices);

        const code = lines.slice(startLine - 1, endLine).join('\n');
        return {code, startLine, endLine};
    }

    /**
     * Confirms the refactoring action with the user.
     * Displays the changes and asks for confirmation to apply or discard them.
     * @returns {Promise<boolean>} - True if the user confirms, false otherwise.
     */
    async confirmRefactoring(): Promise<boolean> {
        const {confirm} = await inquirer.prompt([
            {
                type: 'list',
                name: 'confirm',
                message: 'What would you like to do with these changes?',
                choices: [
                    {name: 'Apply changes', value: true},
                    {name: 'Discard changes', value: false},
                ]
            },
        ]);

        return confirm;
    }

    /**
     * Displays the analysis of the code, including issues and potential refactorings.
     * @param {RefactorAnalysis} analysis - The analysis object containing issues and refactorings.
     */
    displayAnalysis(analysis: RefactorAnalysis): void {
        console.log(chalk.bold.blue('\n🔍 Code Analysis:'));

        if (analysis.issues.length === 0) {
            console.log(chalk.green('  No major issues found in the selected code.'));
        } else {
            console.log(chalk.yellow('  Issues found:'));
            analysis.issues.forEach((issue) => {
                const severityColor =
                    issue.severity === 'high'
                        ? chalk.red
                        : issue.severity === 'medium'
                            ? chalk.yellow
                            : chalk.blue;
                console.log(
                    `  - ${severityColor(issue.severity.toUpperCase())}: ${
                        issue.description
                    } ${chalk.gray(`(at ${issue.location})`)}`
                );
            });
        }

        console.log(chalk.bold.blue('\n🔄 Potential Refactorings:'));
        analysis.potentialRefactorings.forEach((refactoring, index) => {
            console.log(`  ${index + 1}. ${refactoring}`);
        });
        console.log();
    }

    /**
     * Handles file requests from the AI assistant.
     * Displays the reason for the request and fetches the requested files.
     * @param {FileRequest} request - The file request object containing requested files and reason.
     * @returns {Promise<Record<string, string>>} - A promise that resolves to an object containing file contents.
     */
    async handleFileRequest(
        request: FileRequest
    ): Promise<Record<string, string>> {
        console.log(
            chalk.blue('\n📂 The AI assistant needs additional files:')
        );
        console.log(`  Reason: ${request.reason}\n`);

        const fileContents: Record<string, string> = {};

        for (const file of request.requestedFiles) {
            console.log(
                chalk.yellow(`  Fetching: ${file.path} (${file.reason || 'needed'})`)
            );
            try {
                fileContents[file.path] = await this.fileManager.getFileContent(file.path);
                console.log(chalk.green(`  ✓ Found file: ${file.path}`));
            } catch (error) {
                console.log(chalk.red(`  ✗ Could not find file: ${file.path}`));
                const {manualContent} = await inquirer.prompt([
                    {
                        type: 'editor',
                        name: 'manualContent',
                        message: `Please enter the content for ${file.path} manually:`,
                    },
                ]);
                fileContents[file.path] = manualContent;
            }
        }

        return fileContents;
    }

    /**
     * Displays the progress of the refactoring process.
     * Shows the percentage of completion and details of each change.
     * @param {RefactorProgress} progress - The progress object containing changes and next steps.
     */
    displayRefactorProgress(progress: RefactorProgress): void {
        console.log(
            chalk.bold.blue(`\n🔄 Refactoring Progress: ${progress.progress}%`)
        );

        progress.changes.forEach((change, index) => {
            console.log(
                chalk.yellow(`\nChange #${index + 1}: ${change.type} at ${change.location}`)
            );
            console.log(`File: ${change.filePath}`);
            console.log(`Reason: ${change.explanation}`);

            this.displayDifference(change);
        });

        if (progress.nextStep) {
            console.log(chalk.blue(`\nNext step: ${progress.nextStep}`));
        }
    }

    /**
     * Displays the summary of the refactoring process.
     * Shows the summary, improvements, testing recommendations, and files changed.
     * @param {RefactorComplete} result - The result object containing summary and changes.
     */
    displayRefactorCompletionSummary(result: RefactorComplete): void {
        console.log(chalk.bold.green('\n✅ Refactoring Complete!'));
        console.log(chalk.bold('\nSummary:'));
        console.log(result.summary);

        console.log(chalk.bold('\nImprovements:'));
        result.improvements.forEach((improvement, index) => {
            console.log(`  ${index + 1}. ${improvement}`);
        });

        console.log(chalk.bold('\nTesting Recommendations:'));
        result.testingRecommendations.forEach((recommendation, index) => {
            console.log(`  ${index + 1}. ${recommendation}`);
        });

        console.log(chalk.bold('\nFiles Changed:'));
        result.changes.forEach((change) => {
            console.log(`  - ${change.filePath}`);
        });
    }

    /**
     * Displays a message indicating that the refactoring process is in progress.
     * @param {string} message - The message to display.
     * @returns {Ora} - The spinner instance for further control.
     */
    showSpinner(message: string): Ora {
        return ora(message).start();
    }

    /**
     * Asks the user for navigation options after a task is completed.
     * Provides options to return to the main menu or exit the program.
     * @param {string} message - The message to display to the user.
     * @returns {Promise<string>} - The user's choice (MAIN_MENU or EXIT).
     */
    async askNavigation(message: string = 'What would you like to do next?'): Promise<string> {
        const {action} = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message,
                choices: [
                    {name: 'Return to main menu', value: 'MAIN_MENU'},
                    {name: 'Exit program', value: 'EXIT'}
                ]
            }
        ]);
        return action;
    }

    /**
     * Displays the difference between the original and new code.
     * Uses color coding to indicate additions, removals, and context.
     * @param {RefactorChange} change - The change object containing original and new code.
     */
    private displayDifference(change: RefactorChange) {
        console.log('\nDiff:');
        const parts = diffLines(change.originalCode || '', change.newCode);
        parts.forEach((part: any) => {
            const color = part.added
                ? chalk.green
                : part.removed
                    ? chalk.red
                    : chalk.gray;
            if (part.added) {
                console.log(color(`+ ${part.value}`));
            } else if (part.removed) {
                console.log(color(`- ${part.value}`));
            } else {
                const context = part.value
                    .split('\n')
                    .slice(0, 2)
                    .join('\n')
                    .trim();
                if (context) {
                    console.log(color(`  ${context}${part.value.split('\n').length > 2 ? '...' : ''}`));
                }
            }
        });
    }
}
