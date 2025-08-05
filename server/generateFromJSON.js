// server/generateFromJSON.js

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { toPascalCase, toCamelCase } = require('./utils/normalizer');

// Import the NLP data processor
const { processDataWithNlp } = require('./nlp-data-processor'); 
// Import the new code generator (for dynamic files)
const generateCode = require('./code-generator'); 

// Import ALL static base project templates
const getPlaywrightJavascriptProjectTemplates = require('./templates/playwrightBaseProject'); 
const getPlaywrightTypescriptProjectTemplates = require('./templates/playwrightTypescriptProject'); 
const getCypressJavascriptProjectTemplates = require('./templates/cypressJavascriptProject');
const getRobotFrameworkProjectTemplates = require('./templates/robotFrameworkProject');
const getSeleniumJavaProjectTemplates = require('./templates/seleniumJavaProject');
const getSeleniumPythonProjectTemplates = require('./templates/seleniumPythonProject');
const getPlaywrightJavaProjectTemplates = require('./templates/playwrightJavaProject');
const getPlaywrightPythonProjectTemplates = require('./templates/playwrightPythonProject');


// Helper function to write files safely, creating directories if needed
function writeFileSafely(baseDir, filePathRelative, content, description = 'file') {
    const fullPath = path.join(baseDir, filePathRelative);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
        console.log(`DEBUG: Creating directory: ${dir}`);
        fs.mkdirSync(dir, { recursive: true });
    }
    try {
        fs.writeFileSync(fullPath, content);
        console.log(`DEBUG: Successfully wrote ${description}: ${fullPath}`);
    } catch (error) {
        console.error(`ERROR: Failed to write ${description}: ${fullPath}`, error);
        throw new Error(`Failed to write file: ${filePathRelative} - ${error.message}`);
    }
}

// Helper function for path validation
function validateAndNormalizePath(inputPath, projectName) { 
    console.log(`DEBUG (validateAndNormalizePath input): inputPath='${inputPath}', projectName='${projectName}'`); // NEW DEBUG
    
    if (!inputPath || inputPath.trim() === '') {
        throw new Error("Output path cannot be empty. Please provide a valid absolute path."); 
    }

    let normalizedPath = path.normalize(inputPath);
    console.log(`DEBUG (validateAndNormalizePath normalized): normalizedPath='${normalizedPath}'`); // NEW DEBUG

    if (!path.isAbsolute(normalizedPath)) {
        throw new Error(`Invalid path: '${inputPath}'. Please provide an absolute path (e.g., C:\\Users\\... or /home/user/...).`);
    }

    const resolvedPath = path.resolve(normalizedPath);
    console.log(`DEBUG (validateAndNormalizePath resolved): resolvedPath='${resolvedPath}'`); // NEW DEBUG

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
    console.log(`DEBUG (validateAndNormalizePath lowerResolvedPath): lowerResolvedPath='${lowerResolvedPath}'`); // NEW DEBUG

    for (const forbiddenPath of forbiddenSystemRoots) {
        if (lowerResolvedPath.startsWith(forbiddenPath)) {
            throw new Error(`Forbidden project path: '${inputPath}'. Cannot target system-critical or application-internal directories.`); // Changed projectPath to inputPath for clearer error
        }
    }
    
    const finalProjectPath = path.join(resolvedPath, projectName); // Use resolvedPath here
    console.log(`DEBUG (validateAndNormalizePath final join): finalProjectPath='${finalProjectPath}'`); // NEW DEBUG
    
    return finalProjectPath;
}


router.post('/', async (req, res) => {
    let { testData, projectName = 'default_project', tool, language, outputPath } = req.body; 

    // --- NEW DEBUG LOGS START ---
    console.log(`DEBUG (Request Input from Client): outputPath='${outputPath}', projectName='${projectName}', tool='${tool}', language='${language}'`);
    // --- NEW DEBUG LOGS END ---

    if (!tool || !language || tool.trim() === '' || language.trim() === '') {
        return res.status(400).json({ success: false, error: 'Tool and language selections are required for code generation.' });
    }

    if (!Array.isArray(testData) || testData.length === 0) {
        return res.status(400).json({ success: false, error: 'No test data provided for generation.' });
    }

    const initialTestDataCount = testData.length;
    testData = testData.filter(group => {
        const scenarioTitle = group.scenario ? group.scenario.trim() : '';
        const camelCaseScenario = toCamelCase(scenarioTitle);
        if (scenarioTitle === 'Generic Feature' || camelCaseScenario === 'genericFeature' || scenarioTitle === '') {
            console.warn(`⚠️ Filtering out scenario group with title '${scenarioTitle || '(empty)'}' from processing. This might indicate an issue with the 'Test Scenario' column in your Excel.`);
            return false;
        }
        return true;
    });

    if (testData.length === 0) {
        let errorMessage = 'No valid test data found after filtering. This might be because all scenarios defaulted to "Generic Feature" or were unidentifiable.';
        if (initialTestDataCount > 0) {
            errorMessage += ' Please check your "Test Scenario" column in Excel for meaningful titles and ensure it\'s not empty.';
        }
        return res.status(400).json({ success: false, error: errorMessage });
    }
    
    let projectDir;
    try {
        projectDir = validateAndNormalizePath(outputPath, projectName); 
        console.log(`DEBUG: Final Project Directory determined by validation: ${projectDir}`); // Updated log message

        // --- NEW DEBUG LOGS START ---
        // Log the exact path that fs.rmSync will be called on
        console.log(`DEBUG (Pre-rmSync): Attempting to remove directory: '${projectDir}'`);
        // --- NEW DEBUG LOGS END ---

    } catch (pathError) {
        return res.status(400).json({ success: false, error: `Invalid output path: ${pathError.message}` });
    }

    // Clear existing project directory for a clean slate
    // Only remove the specific project folder, not the entire base output path.
    if (fs.existsSync(projectDir)) {
        console.log(`DEBUG: Clearing existing project directory: ${projectDir}`);
        fs.rmSync(projectDir, { recursive: true, force: true }); 
    }
    console.log(`DEBUG: Creating fresh project directory: ${projectDir}`);
    fs.mkdirSync(projectDir, { recursive: true });

    let anyMeaningfulCodeGenerated = false;
    
    try {
        let dynamicBaseUrlForStaticTemplates = 'http://localhost:3000'; 
        for (const scenarioGroup of testData) {
            for (const tc of scenarioGroup.tests) {
                const navStep = tc.steps.find(step => (step.toLowerCase().includes('navigate to') || step.toLowerCase().includes('go to')) && step.toLowerCase().includes('http'));
                if (navStep) {
                    const urlMatch = navStep.match(/(https?:\/\/(?:www\.)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}(?::\d+)?(?:\/[^\s,"']*)?)/);
                    if (urlMatch) {
                        dynamicBaseUrlForStaticTemplates = urlMatch[1];
                        break;
                    }
                }
                const urlDataMatch = (tc.data || '').match(/url:\s*(https?:\/\/(?:www\.)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}(?::\d+)?(?:\/[^\s,"']*)?)/i);
                if (urlDataMatch) {
                    dynamicBaseUrlForStaticTemplates = urlDataMatch[1];
                    break;
                }
            }
            if (dynamicBaseUrlForStaticTemplates !== 'http://localhost:3000') break;
        }

        // 1. Dynamically select and write Static Project Files based on tool/language
        console.log(`DEBUG: Dynamically selecting and writing static project files for ${tool}/${language}...`);
        let staticFiles = {};

        switch (`${tool}-${language}`) {
            case 'playwright-javascript':
                staticFiles = getPlaywrightJavascriptProjectTemplates(projectName, dynamicBaseUrlForStaticTemplates);
                break;
            case 'playwright-typescript':
                staticFiles = getPlaywrightTypescriptProjectTemplates(projectName, dynamicBaseUrlForStaticTemplates);
                break;
            case 'cypress-javascript':
                staticFiles = getCypressJavascriptProjectTemplates(projectName, dynamicBaseUrlForStaticTemplates);
                break;
            case 'robotframework-robot': 
                staticFiles = getRobotFrameworkProjectTemplates(projectName, dynamicBaseUrlForStaticTemplates);
                break;
            case 'selenium-java':
                staticFiles = getSeleniumJavaProjectTemplates(projectName, dynamicBaseUrlForStaticTemplates);
                break;
            case 'selenium-python':
                staticFiles = getSeleniumPythonProjectTemplates(projectName, dynamicBaseUrlForStaticTemplates);
                break;
            case 'playwright-java':
                staticFiles = getPlaywrightJavaProjectTemplates(projectName, dynamicBaseUrlForStaticTemplates);
                break;
            case 'playwright-python':
                staticFiles = getPlaywrightPythonProjectTemplates(projectName, dynamicBaseUrlForStaticTemplates);
                break;
            default:
                throw new Error(`Unsupported tool/language combination for static templates: ${tool}-${language}`);
        }

        for (const filePathRelative in staticFiles) {
            if (Object.prototype.hasOwnProperty.call(staticFiles, filePathRelative)) {
                const content = staticFiles[filePathRelative];
                if (content && typeof content === 'string' && content.trim().length > 0) {
                    writeFileSafely(projectDir, filePathRelative, content, `Static file: ${filePathRelative}`);
                    anyMeaningfulCodeGenerated = true; 
                } else {
                    console.warn(`⚠️ Static template for ${filePathRelative} is empty. Skipping file write.`);
                }
            }
        }
        console.log("DEBUG: Finished writing static project files.");

        // Step 2: Process raw testData with NLP
        const { processedData: nlpEnrichedTestData, uniqueActions } = await processDataWithNlp(testData);
        console.log("DEBUG: NLP enrichment complete. Proceeding to AI code generation for dynamic files.");

        // Step 3: Call the code generator (AI) for dynamic files
        console.log(`\n📡 Sending comprehensive prompt to AI for dynamic files for project: "${projectName}" (Tool: ${tool}, Language: ${language})`);
        const aiOutput = await generateCode({
            testData: nlpEnrichedTestData, 
            projectName,
            tool,
            language,
            uniqueActions 
        });

        if (!aiOutput || typeof aiOutput !== 'object' || Object.keys(aiOutput).length === 0) {
            console.warn('⚠️ AI did not return valid structured output for dynamic files or returned an empty response.');
        } else {
            // Step 4: Write Dynamically Generated Files
            console.log("DEBUG: Writing dynamically generated files from AI.");
            for (const filePathRelative in aiOutput) {
                if (Object.prototype.hasOwnProperty.call(aiOutput, filePathRelative)) {
                    const content = aiOutput[filePathRelative];
                    if (content && typeof content === 'string' && content.trim().length > 10) { 
                        writeFileSafely(projectDir, filePathRelative, content, `AI-generated dynamic file: ${filePathRelative}`);
                        anyMeaningfulCodeGenerated = true; 
                    } else {
                        console.warn(`⚠️ AI generated empty or very short content for ${filePathRelative}. Skipping file write.`);
                    }
                }
            }
            console.log("DEBUG: Finished writing dynamically generated files.");
        }

    } catch (err) {
        console.error(`🔥 Failed during project generation (static or dynamic):`, err.message);
        return res.status(500).json({ success: false, error: `Code generation failed: ${err.message}. Please check logs for details.` });
    }

    if (anyMeaningfulCodeGenerated) {
        console.log('DEBUG: Sending success response to client.');
        res.json({ success: true, message: 'Project generated successfully!', projectFullPath: projectDir });
    } else {
        const errorMessage = 'No meaningful code could be generated from the provided test data, or no files were written. Please check your Excel content and server logs.';
        console.error(`DEBUG: Sending error response to client: ${errorMessage}`);
        res.status(500).json({ success: false, error: errorMessage });
    }
});

module.exports = router;