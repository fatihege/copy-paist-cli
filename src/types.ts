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

export interface RefactorAnalysis {
    type: string; // Type of analysis performed (e.g., "ANALYSIS", "PROGRESS")
    issues: Array<{ // List of issues found during analysis
        description: string; // Description of the issue
        severity: string; // Severity level of the issue (e.g., "high", "medium", "low")
        location: string; // Location of the issue in the code (e.g., line numbers or code reference)
    }>;
    potentialRefactorings: string[]; // List of potential refactorings suggested
}

export interface RefactorProgress {
    type: string; // Type of progress update (e.g., "REFACTOR_PROGRESS")
    changes: RefactorChange[]; // List of changes made during refactoring
    progress: number; // Percentage of completion as an integer (0-100)
    nextStep: string | null; // Description of what will be done next or null if complete
}

export interface RefactorChange {
    filePath: string; // Path to the file being modified
    type: string; // Type of change (e.g., "edit", "add", "delete")
    location: string; // Location of the change in the code (e.g., line numbers affected)
    originalCode: string; // Code before the change
    newCode: string; // Refactored code
    explanation: string; // Explanation of why this improves the code
}

export interface RefactorComplete {
    type: string; // Type of completion update (e.g., "REFACTOR_COMPLETE")
    summary: string; // Summary of all changes made
    improvements: string[]; // List of specific improvements made
    testingRecommendations: string[]; // Suggestions for testing the refactored code
    changes: FileChange[]; // List of file changes made during refactoring
}

export interface FileRequest {
    type: string; // Type of request (e.g., "REQUEST_FILES")
    reason: string; // Reason for the request (e.g., "Need additional context")
    requestedFiles: Array<{ // List of files requested for further analysis or refactoring
        path: string; // Relative path to the file
        reason: string; // Reason why this file is needed (e.g., "To understand the context better")
    }>;
}
