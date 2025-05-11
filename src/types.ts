export interface RefactorRequest {
    code: string; // The code to be refactored
    filePath: string; // Path to the file being refactored
    projectFilePaths?: string[]; // List of all files in the project for context
    model: string; // Model name to use for generation
}

export interface RefactorResponse {
    success: boolean; // Indicates if the refactoring was successful
    sessionId: string; // Unique identifier for the refactoring session
    result: any; // The result of the refactoring operation
    status: string; // Status of the refactoring operation
    requestedFiles?: Array<{ // List of files requested for further analysis or refactoring
        path: string;
        reason: string;
    }>;
}

export interface ContinueRefactorRequest {
    sessionId: string; // Unique identifier for the refactoring session
    fileContents: Record<string, string>; // Contents of the files requested for further analysis
}

export interface ContinueRefactorResponse {
    success: boolean; // Indicates if the continuation was successful
    result: any; // The result of the continuation operation
    status: string; // Status of the continuation operation
    requestedFiles?: Array<{ // List of files requested for further analysis or refactoring
        path: string;
        reason: string;
    }>;
}

export interface FileChange {
    filePath: string; // Path to the file being changed
    fullContent: string; // Full content of the file after refactoring
}
