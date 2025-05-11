import fs from 'fs-extra';
import path from 'path';
import {glob} from 'glob';
import {FileChange} from '../types';

/**
 * FileManager class to handle file operations in a project directory.
 * It provides methods to read, write, list files and directories, and manage recent files.
 */
export class FileManager {
    private readonly projectRoot: string; // The root directory of the project
    private recentFiles: string[] = []; // Array to keep track of recently accessed files
    private readonly languagePatterns: Record<string, string> = { // Patterns for different programming languages
        all: '**/*.*',
        web: '**/*.{js,ts,jsx,tsx,html,css,scss,json}',
        javascript: '**/*.{js,jsx,mjs,cjs}',
        typescript: '**/*.{ts,tsx}',
        python: '**/*.py',
        java: '**/*.java',
        csharp: '**/*.cs',
        go: '**/*.go',
        rust: '**/*.rs',
        cpp: '**/*.{cpp,cc,cxx,h,hpp}',
        ruby: '**/*.rb',
        php: '**/*.php',
        swift: '**/*.swift',
        kotlin: '**/*.kt',
    };
    private readonly ignoredPaths: string[] = [ // Default ignored paths for file operations
        '**/node_modules/**',
        '**/dist/**',
        '**/.git/**',
        '**/bin/**',
        '**/obj/**',
        '**/build/**',
        '**/.idea/**',
        '**/.vscode/**',
        '**/vendor/**',
        '**/__pycache__/**',
        '**/.DS_Store',
    ];

    constructor(projectRoot: string) {
        this.projectRoot = projectRoot;
    }

    /**
     * Reads the content of a file and adds it to the recent files list.
     * @param filePath - The path of the file to read.
     * @returns The content of the file.
     */
    async getFileContent(filePath: string): Promise<string> {
        const fullPath = path.join(this.projectRoot, filePath); // Construct the full path of the file
        try {
            const content = await fs.promises.readFile(fullPath, 'utf8');
            this.addToRecentFiles(filePath);
            return content;
        } catch (error) {
            console.error(`Error reading file ${fullPath}:`, error);
            throw error;
        }
    }

    /**
     * Writes content to a file and adds it to the recent files list.
     * @param filePath - The path of the file to write.
     * @param content - The content to write to the file.
     */
    async writeFile(filePath: string, content: string): Promise<void> {
        const fullPath = path.join(this.projectRoot, filePath); // Construct the full path of the file
        try {
            await fs.ensureDir(path.dirname(fullPath)); // Ensure the directory exists
            await fs.writeFile(fullPath, content); // Write the content to the file
            this.addToRecentFiles(filePath); // Add the file to recent files
        } catch (error) {
            console.error(`Error writing file ${fullPath}:`, error);
            throw error;
        }
    }

    /**
     * Returns the list of recently accessed files.
     * @returns An array of recently accessed file paths.
     */
    getRecentFiles(): string[] {
        return this.recentFiles;
    }

    /**
     * Lists files in the project directory based on a given pattern and ignored paths.
     * @param pattern - The pattern to match files against.
     * @param ignoredPaths - Additional paths to ignore.
     * @returns An array of file paths that match the pattern.
     */
    async listFiles(pattern: string = 'all', ignoredPaths: string[] = []): Promise<string[]> {
        const actualPattern = this.languagePatterns[pattern] || pattern; // Get the actual pattern based on the provided pattern

        const allIgnore = [...this.ignoredPaths, ...ignoredPaths]; // Combine default ignored paths with additional ignored paths

        try {
            const normalizedPattern = actualPattern.split(path.sep).join('/'); // Normalize the pattern for cross-platform compatibility

            // Use glob to find files matching the pattern
            return await glob(normalizedPattern, {
                cwd: this.projectRoot, // Set the current working directory to the project root
                ignore: allIgnore, // Ignore specified paths
                nodir: true, // Ignore directories
                windowsPathsNoEscape: true // Prevent Windows path escaping
            });
        } catch (error) {
            console.error(`Error listing files with pattern ${pattern}:`, error);
            throw error;
        }
    }

    /**
     * Lists files in a specific directory, ignoring certain paths.
     * @param directory - The directory to list files from.
     * @param ignoredPaths - Additional paths to ignore.
     * @returns An array of file paths in the specified directory.
     */
    async listFilesInDirectory(directory: string, ignoredPaths: string[] = []): Promise<string[]> {
        const normalizedDir = directory.split(path.sep).join('/'); // Normalize the directory path for cross-platform compatibility
        const allIgnore = [...this.ignoredPaths, ...ignoredPaths]; // Combine default ignored paths with additional ignored paths
        const fullPath = path.join(this.projectRoot, normalizedDir); // Construct the full path of the directory

        try {
            const items = await fs.promises.readdir(fullPath, {withFileTypes: true}); // Read the directory contents

            return items
                .filter(item => item.isFile()) // Filter for files only
                .map(item => path.join(normalizedDir, item.name)) // Map to full file paths
                .filter(filePath => { // Filter out ignored paths
                    return !allIgnore.some(pattern => {
                        const regexPattern = pattern
                            .replace(/\./g, '\\.')
                            .replace(/\*\*/g, '.*')
                            .replace(/\*/g, '[^/]*');
                        const regex = new RegExp(regexPattern);
                        return regex.test(filePath);
                    });
                });
        } catch (error) {
            console.error(`Error listing files in directory ${fullPath}:`, error);
            throw error;
        }
    }

    /**
     * Lists directories in the project directory, ignoring certain paths.
     * @param parentDir - The parent directory to list subdirectories from.
     * @returns An array of subdirectory paths.
     */
    async listDirectories(parentDir: string = ''): Promise<string[]> {
        const fullPath = path.join(this.projectRoot, parentDir); // Construct the full path of the parent directory

        try {
            const items = await fs.promises.readdir(fullPath, {withFileTypes: true}); // Read the directory contents
            return items
                .filter(item => item.isDirectory()) // Filter for directories only
                .filter(item => !item.name.startsWith('.')) // Ignore hidden directories
                .filter(item => !['node_modules', 'dist', 'build', '.git'].includes(item.name)) // Ignore specific directories for now
                .map(item => path.join(parentDir, item.name)); // Map to full directory paths
        } catch (error) {
            console.error(`Error listing directories in ${fullPath}:`, error);
            throw error;
        }
    }

    /**
     * Generates a project tree based on the specified file pattern and ignored paths.
     * @param ignoredPaths - Additional paths to ignore.
     * @param filePattern - The pattern to match files against.
     * @returns An array of file paths that match the pattern.
     */
    async getProjectTree(ignoredPaths: string[] = [], filePattern: string = '**/*.*'): Promise<string[]> {
        const allIgnore = [...this.ignoredPaths, ...ignoredPaths]; // Combine default ignored paths with additional ignored paths

        try {
            // Use glob to find files matching the pattern
            const files = await glob(filePattern, {
                cwd: this.projectRoot, // Set the current working directory to the project root
                ignore: allIgnore, // Ignore specified paths
                nodir: true, // Ignore directories
                dot: false, // Ignore dot files
            });

            return files.sort(); // Sort the files alphabetically
        } catch (error) {
            console.error('Error generating project tree:', error);
            throw error;
        }
    }

    /**
     * Applies changes to files based on the provided changes array.
     * @param changes - An array of file changes to apply.
     */
    async applyChanges(changes: FileChange[]): Promise<void> {
        for (const change of changes) { // Iterate through each change
            await this.writeFile(change.filePath, change.fullContent); // Write the changes to the file
        }
    }

    /**
     * Creates a backup of a file by copying it to a new location with a .bak extension.
     * @param filePath - The path of the file to back up.
     * @returns The path of the backup file.
     */
    async createBackup(filePath: string): Promise<string> {
        const fullPath = path.join(this.projectRoot, filePath); // Construct the full path of the file
        const backupPath = `${fullPath}.bak`; // Define the backup path with a .bak extension
        await fs.copy(fullPath, backupPath); // Copy the file to the backup path
        return backupPath;
    }

    /**
     * Adds a file path to the recent files list, ensuring it is unique and limited to a maximum of 10 entries.
     * @param filePath - The path of the file to add to recent files.
     */
    private addToRecentFiles(filePath: string): void {
        this.recentFiles = this.recentFiles.filter(f => f !== filePath); // Remove duplicates
        this.recentFiles.unshift(filePath); // Add to the front of the list
        if (this.recentFiles.length > 10) // Limit to 10 recent files
            this.recentFiles.pop();
    }
}
