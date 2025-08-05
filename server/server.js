const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const open = require('open').default; 
require('dotenv').config();

const uploadExcelRouter = require('./uploadExcel'); 
const generateFromJSONRouter = require('./generateFromJSON'); 
const { toCamelCase } = require('./utils/normalizer'); 
const { getSuggestionsFromOllama } = require('./ai_suggestor'); // NEW: Import the AI Suggestor module

const app = express();

// Directories for temp files and reports (these remain internal to the server)
const tempDir = path.join(__dirname, '../temp');
const testsOutputDir = path.join(__dirname, '../tests-output'); 

// --- Ensure internal directories exist on server startup ---
const ensureDirs = () => {
    try {
        [tempDir, testsOutputDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                console.log(`INFO: Creating directory: ${dir}`);
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    } catch (err) {
        console.error('CRITICAL ERROR: Failed to create necessary internal directories on startup:', err);
        process.exit(1); 
    }
};
ensureDirs();

// --- Clear internal temp on server start for a clean slate ---
const clearTempDirs = () => {
    console.log('DEBUG: Attempting to clear internal temp and tests-output directories on server startup...');
    try {
        [tempDir, testsOutputDir].forEach(dir => {
            if (fs.existsSync(dir)) {
                fs.rmSync(dir, { recursive: true, force: true });
                console.log(`DEBUG: Cleared existing directory: ${dir}`);
            }
            fs.mkdirSync(dir, { recursive: true }); 
        });
        console.log('DEBUG: Internal temporary directories recreated for a clean start.');
    } catch (err) {
        console.error('ERROR: Could not clear and recreate internal temporary directories:', err);
    }
};
clearTempDirs();

// Helper for validating incoming project paths from client for security
function validateIncomingProjectPath(projectPath) {
    if (!projectPath || projectPath.trim() === '') {
        throw new Error('Project path is required.');
    }

    const normalizedPath = path.normalize(projectPath);

    if (!path.isAbsolute(normalizedPath)) {
        throw new Error(`Invalid project path: '${projectPath}'. Path must be absolute.`);
    }

    const resolvedPath = path.resolve(normalizedPath);
    if (normalizedPath.includes('..')) { 
        if (!resolvedPath.startsWith(path.parse(resolvedPath).root)) {
             throw new Error(`Suspicious project path: '${projectPath}'. Path traversal attempt detected with '..' segments.`);
        }
    }
    
    const forbiddenSystemRoots = [
        path.normalize('/etc'),       
        path.normalize('/usr'),       
        path.normalize('/var'),       
        path.normalize('/bin'),       
        path.normalize('/sbin'),      
        path.normalize('/lib'),       
        path.normalize('/dev'),       
        path.normalize('/proc'),      
        path.normalize('/sys'),       
        path.normalize('/root'),      
        path.normalize(path.join(process.env.HOMEDRIVE || 'C:', 'Windows')), 
        path.normalize(path.join(process.env.HOMEDRIVE || 'C:', 'Program Files')), 
        path.normalize(path.join(process.env.HOMEDRIVE || 'C:', 'Program Files (x86)')),
        path.normalize(path.join(process.env.HOME || process.env.USERPROFILE || '~', '.ssh')),
        path.normalize(path.join(process.env.HOME || process.env.USERPROFILE || '~', '.aws')),
        path.normalize(path.resolve(__dirname, '..')) 
    ].map(p => p.toLowerCase()); 

    const lowerResolvedPath = resolvedPath.toLowerCase();

    for (const forbiddenPath of forbiddenSystemRoots) {
        if (lowerResolvedPath.startsWith(forbiddenPath)) {
            throw new Error(`Forbidden project path: '${projectPath}'. Cannot target system-critical or application-internal directories.`);
        }
    }
    
    return resolvedPath; 
}


app.use(cors());
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 

// --- API Endpoints ---

app.use('/upload-excel', uploadExcelRouter);
app.use('/generate-from-json', generateFromJSONRouter); 


// Endpoint for executing a single test script (Playwright-specific)
app.post('/execute', async (req, res) => {
    const { testScript, projectName, tool, projectFullPath: clientProjectFullPath } = req.body; 

    if (!testScript || !projectName || !tool || !clientProjectFullPath) { 
        return res.status(400).json({ result: 'Error: Missing test script, project name, tool, or project path for execution.' });
    }

    if (tool !== 'playwright') {
        return res.status(400).json({ result: `Error: Server-side execution currently only supported for Playwright. Tool "${tool}" is not supported.` });
    }

    let projectDir;
    try {
        projectDir = validateIncomingProjectPath(clientProjectFullPath); 
    } catch (validationError) {
        return res.status(400).json({ result: `Error validating project path: ${validationError.message}` });
    }

    if (!fs.existsSync(projectDir)) { 
        return res.status(404).json({ result: `Error: Project directory not found: ${projectDir}. Please generate code first.` });
    }

    const fileName = `manual-${Date.now()}.spec.js`;
    const tempTestFilePath = path.join(projectDir, 'tests', fileName); 

    try {
        fs.mkdirSync(path.dirname(tempTestFilePath), { recursive: true }); 
        fs.writeFileSync(tempTestFilePath, testScript);

        const commandToExecute = `npx playwright test ${path.join('tests', fileName)} --project=chromium --headed`; 
        console.log(`DEBUG: Executing command in ${projectDir}: ${commandToExecute}`); 

        exec(commandToExecute, { cwd: projectDir }, (error, stdout, stderr) => { 
            const fullOutput = stdout + stderr;
            console.log(`DEBUG: Playwright execution output for ${fileName}:\n${fullOutput}`);

            const keywords = [
                'Error', 'Failed', 'Exception', 'Test File:', 'not defined', 'Command failed',
                'at Object.<anonymous>', 'Error: expect', 'tests failed', 'success', 'passed'
            ];
            const lines = fullOutput.split('\n') || [];
            const important = lines.filter(line => keywords.some(k => line.toLowerCase().includes(k.toLowerCase())) || line.startsWith('Running') || line.startsWith('   ✖') || line.startsWith('   ✓') || line.includes('tests failed') || line.includes('All tests passed'));

            const finalOutput = important.length > 0 ? important.join('\n') : lines.slice(-20).join('\n') + '\n... (truncated for brevity)'; 

            fs.unlink(tempTestFilePath, (unlinkErr) => {
                if (unlinkErr) console.error(`Error deleting temporary test file ${tempTestFilePath}:`, unlinkErr);
                else console.log(`DEBUG: Deleted temporary test file: ${tempTestFilePath}`);
            });

            if (error) {
                console.error(`ERROR: Playwright test execution failed for ${fileName}.`, error);
                return res.status(500).json({ result: `❌ Test run failed.\n\n${finalOutput}` });
            }

            res.json({ result: finalOutput });
        });
    } catch (err) {
        console.error(`⚠️ Unexpected server error during test execution for ${fileName}:\n`, err);
        if (fs.existsSync(tempTestFilePath)) {
            fs.unlink(tempTestFilePath, (unlinkErr) => {
                if (unlinkErr) console.error(`Error deleting temporary test file on error ${tempTestFilePath}:`, unlinkErr);
            });
        }
        res.status(500).json({ result: `⚠️ Unexpected server error:\n${err.message}` });
    }
});


// Endpoint for opening VS Code with the generated project
app.post('/open-in-vscode', (req, res) => {
    const { projectName, projectFullPath: clientProjectFullPath } = req.body; 

    if (!projectName || !clientProjectFullPath) { 
        console.error('VS Code Open Error: Project name or project path is required.');
        return res.status(400).json({ success: false, error: 'Project name or project path is required.' });
    }

    let projectDir;
    try {
        projectDir = validateIncomingProjectPath(clientProjectFullPath); 
    } catch (validationError) {
        return res.status(400).json({ success: false, error: `Invalid project path received: ${validationError.message}` });
    }

    if (!fs.existsSync(projectDir)) { 
        console.error(`VS Code Open Error: Project directory not found: ${projectDir}`);
        return res.status(404).json({ success: false, error: `Project directory not found: ${projectDir}. Please generate code first.` });
    }

    const vscodeAppName = 'code'; 

    open(projectDir, { app: { name: vscodeAppName, arguments: [] } }) 
        .then(() => {
            res.json({ success: true, message: `Attempted to open project '${projectName}' in VS Code at '${projectDir}'.` });
        })
        .catch(err => {
            console.error(`🔥 Error opening VS Code via 'open' library for project '${projectName}' at '${projectDir}':`, err);
            
            let errorMessage = `Failed to open VS Code automatically: ${err.message}.`;
            errorMessage += `\n\nEnsure VS Code is installed and its 'code' command is added to your system's PATH.`;
            errorMessage += `\nAlternatively, you may need to manually open the project folder:\n${projectDir}`;

            res.status(500).json({ success: false, error: errorMessage });
        });
});

// NEW: API Endpoint for AI Test Case Suggestions
app.post('/suggest-testcases', async (req, res) => {
    const { testData, projectName, tool, language, requestedScenarioTitle, requestedCount } = req.body;

    // Basic validation
    if (!testData || testData.length === 0 || !projectName || !tool || !language) {
        return res.status(400).json({ success: false, error: 'Missing test data or project details for suggestions.' });
    }

    console.log(`DEBUG: Received request for AI suggestions for project '${projectName}' (${tool}/${language}). ` +
                `Scenario: '${requestedScenarioTitle || "ALL"}', Count: ${requestedCount || "default"}.`);
    
    try {
        const suggestions = await getSuggestionsFromOllama(testData, projectName, requestedScenarioTitle, requestedCount); 
        return res.json({ success: true, suggestions: suggestions });
    } catch (error) {
        console.error("ERROR: Failed to get AI suggestions from Ollama/Gemini:", error);
        return res.status(500).json({ success: false, error: error.message || 'Unknown error during suggestion generation.' });
    }
});


app.get('/view-report', (req, res) => {
    const reportPath = path.join(__dirname, '../playwright-report/index.html');

    if (fs.existsSync(reportPath)) {
        res.sendFile(reportPath);
    }
    else {
        res.status(404).send('⚠️ No Playwright HTML report found. Run tests to generate one, then check the `playwright-report` folder.');
    }
});

app.use(express.static(path.join(__dirname, '../client')));

app.get('*', (req, res) => {
    const apiRoutes = ['/upload-excel', '/generate-from-json', '/execute', '/create-zip', '/open-in-vscode', '/view-report', '/suggest-testcases', '/download-excel']; // NEW: Include new route
    if (apiRoutes.some(p => req.originalUrl.startsWith(p) && req.method !== 'POST')) {
        return res.status(404).send('Invalid API route or method not allowed.');
    }
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// NEW: API Endpoint for Downloading Updated Excel
app.post('/download-excel', async (req, res) => {
    const { projectName, testData } = req.body;

    if (!testData || testData.length === 0 || !projectName) {
        return res.status(400).json({ success: false, error: 'No test data or project name provided for Excel download.' });
    }

    console.log(`DEBUG: Received request to download updated Excel for project '${projectName}'.`);

    try {
        // Dynamically import xlsx on demand as it's a heavier dependency
        const XLSX = require('xlsx'); 

        // Convert the structured JSON data back to a flat array of arrays for Excel
        const dataForSheet = [];
        const headers = ['Test Scenario', 'Test Case ID', 'Test Case Description', 'Detail Steps', 'Test Data', 'Expected Result', 'Testcase Priority'];
        dataForSheet.push(headers); // Add headers as the first row

        testData.forEach(scenarioGroup => {
            scenarioGroup.tests.forEach(tc => {
                const row = [
                    scenarioGroup.scenario, // Test Scenario (from the group)
                    tc.id || '',
                    tc.title || '',
                    tc.steps ? tc.steps.join('\n') : '', // Join steps with newline
                    tc.data || '',
                    tc.expected || '',
                    tc.priority || ''
                ];
                dataForSheet.push(row);
            });
        });

        const ws = XLSX.utils.aoa_to_sheet(dataForSheet);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Test Cases"); // Sheet name "Test Cases"

        // Write the workbook to a buffer
        const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        // Set headers for file download
        res.setHeader('Content-Disposition', `attachment; filename="${toCamelCase(projectName)}_updated_testcases.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(excelBuffer);

        console.log(`DEBUG: Successfully generated and sent updated Excel for '${projectName}'.`);

    } catch (error) {
        console.error("ERROR: Failed to generate or send updated Excel file:", error);
        return res.status(500).json({ success: false, error: error.message || 'Unknown error during Excel generation.' });
    }
});


app.get('/view-report', (req, res) => {
    const reportPath = path.join(__dirname, '../playwright-report/index.html');

    if (fs.existsSync(reportPath)) {
        res.sendFile(reportPath);
    }
    else {
        res.status(404).send('⚠️ No Playwright HTML report found. Run tests to generate one, then check the `playwright-report` folder.');
    }
});

app.use(express.static(path.join(__dirname, '../client')));

app.get('*', (req, res) => {
    const apiRoutes = ['/upload-excel', '/generate-from-json', '/execute', '/create-zip', '/open-in-vscode', '/view-report', '/suggest-testcases', '/download-excel']; 
    if (apiRoutes.some(p => req.originalUrl.startsWith(p) && p !== '/download-excel' && req.method !== 'POST')) { // Adjust to allow GET for /download-excel if needed
        return res.status(404).send('Invalid API route or method not allowed.');
    }
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});