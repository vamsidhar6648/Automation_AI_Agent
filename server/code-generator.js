// server/code-generator.js

const fetch = require('node-fetch');
const scanPage = require('./browser-scanner/scan-page');
const { toPascalCase, toCamelCase, toShortFeatureName } = require('./utils/normalizer');
require('dotenv').config();

// Configuration for Gemini
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash-latest';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

/**
 * Dynamically loads the POM template function for the specified tool and language.
 * Now primarily loads the AI_GENERATION_GUIDE content.
 * @param {string} tool - The automation tool.
 * @param {string} language - The programming language.
 * @returns {Function} A function that, when called with projectName and dynamicBaseUrl, returns an object containing "AI_GENERATION_GUIDE.md".
 * @throws {Error} If the template is not found.
 */
const loadPomTemplate = (tool, language) => {
    const templatePath = `./pom-templates/${tool}/${language}.js`;
    try {
        let templateModule = require(templatePath);
        // Support both CJS and ESM exports:
        return templateModule.default || templateModule;
    } catch (error) {
        console.error(`Error loading POM template for tool '${tool}' and language '${language}':`, error.message);
        if (error.code === 'MODULE_NOT_FOUND') {
            throw new Error(`Unsupported tool/language combination or missing template file: ${templatePath}`);
        }
        throw new Error(`Failed to load template for ${tool}/${language}: ${error.message}`);
    }
};

/**
 * Generates dynamic project files (Locators, Pages, Test Specs, Base Fixture) using the Gemini AI model.
 *
 * @param {Object} projectData - Contains NLP-enriched test data, project name, tool, language, and uniqueActions.
 * @returns {Promise<Object>} - A promise that resolves to a structured object of dynamically generated files.
 * @throws {Error} If AI generation fails or returns an unparsable response.
 */
async function generateCode(projectData) {
    // IMPORTANT: testData here is ALREADY NLP-enriched and comes as 'processedTestData'
    const { testData: processedTestData, projectName, tool, language, uniqueActions } = projectData; 

    console.log("DEBUG: Starting AI code generation for dynamic files (post-NLP processing).");

    if (!GEMINI_API_KEY) {
        throw new Error("❌ GEMINI_API_KEY is not set in .env. Please configure your API key to use Gemini.");
    }

    let domContext = '';
    let appUrlToScan = '';

    // Convert processedTestData object back to an array of scenarios for consistent iteration
    const testDataArray = Array.isArray(processedTestData) ? processedTestData : Object.values(processedTestData);

    // Find a URL to scan from test steps or data
    for (const scenarioGroup of testDataArray) {
        for (const tc of scenarioGroup.tests) {
            const navStep = tc.steps.find(step => (step.toLowerCase().includes('navigate to') || step.toLowerCase().includes('go to')) && step.toLowerCase().includes('http'));
            if (navStep) {
                const urlMatch = navStep.match(/(https?:\/\/(?:www\.)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}(?::\d+)?(?:\/[^\s,"']*)?)/);
                if (urlMatch) {
                    appUrlToScan = urlMatch[1];
                    break;
                }
            }
            const urlDataMatch = (tc.data || '').match(/url:\s*(https?:\/\/(?:www\.)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}(?::\d+)?(?:\/[^\s,"']*)?)/i);
            if (urlDataMatch) {
                appUrlToScan = urlDataMatch[1];
                break;
            }
        }
        if (appUrlToScan) break;
    }

    // Default to a placeholder if no URL found and not specifically Playwright/local agent URL
    const dynamicBaseUrl = appUrlToScan || 'http://localhost:3000'; // Keep this for Playwright config within the generated project

    console.log(`DEBUG: Determined application URL to scan: ${dynamicBaseUrl}`);

    // Perform DOM scan if applicable (currently Playwright only)
    if (dynamicBaseUrl && tool === 'playwright' && dynamicBaseUrl !== 'http://localhost:3000') {
        try {
            console.log(`DEBUG: Attempting DOM scan for URL: ${dynamicBaseUrl}`);
            const elements = await scanPage(dynamicBaseUrl);
            console.log("DEBUG: scanPage completed. Number of elements found:", elements ? elements.length : 0);

            if (elements && elements.length > 0) {
                const lines = elements.map(el => {
                    const parts = [];
                    if (el.tag) parts.push(`tag='${el.tag}'`);
                    if (el.placeholder) parts.push(`placeholder='${el.placeholder}'`);
                    if (el.name) parts.push(`name='${el.name}'`);
                    if (el.ariaLabel) parts.push(`aria-label='${el.ariaLabel}'`);
                    if (el.type) parts.push(`type='${el.type}'`);
                    if ((el.tag === 'button' || el.tag === 'a') && el.text) parts.push(`text='${el.text}'`);
                    if (el.role) parts.push(`role='${el.role}'`);
                    if (el.id) parts.push(`id='${el.id}'`);
                    if (el.className) parts.push(`className='${el.className}'`);
                    return `- ${parts.join(', ')}`;
                });
                domContext = `\n**Relevant Interactive UI Elements on Page (from live scan of ${dynamicBaseUrl}):**\n${lines.join('\n')}\n`;
                console.log(`📄 DOM Context Generated (First 5 lines): \n${domContext.split('\n').slice(0, 5).join('\n')}...`);
            } else {
                domContext = `\n**Note**: Live DOM scan for ${dynamicBaseUrl} returned no significant interactive elements. This might impact locator suggestions.\n`;
                console.log("DEBUG: No significant interactive elements found during DOM scan.");
            }
        } catch (err) {
            console.warn(`⚠️ Failed to scan live page DOM for project "${projectName}":`, err.message);
            domContext = `\n**Note**: Live DOM scan for ${dynamicBaseUrl} failed: ${err.message}\n`;
        }
    } else if (dynamicBaseUrl === 'http://localhost:3000') {
        domContext = `\n**Note**: Skipping live DOM scan as no application URL was found in Excel data. Defaulting to local agent URL.\n`;
        console.log("DEBUG: DOM scan skipped because no application URL found in Excel.");
    } else if (tool !== 'playwright') {
        domContext = `\n**Note**: Live DOM scan not currently supported for tool: ${tool}. Only Playwright is supported for live scanning.\n`;
        console.log("DEBUG: DOM scan skipped as tool is not Playwright.");
    }

    console.log("DEBUG: DOM context preparation complete.");

    // Collect unique Page Object names for fixture generation
    const uniquePageObjectInfo = new Map(); // Map to store { pascalCaseName: 'Original Scenario Title' }
    for (const scenarioGroup of testDataArray) {
        const pascalCaseName = toPascalCase(scenarioGroup.scenario);
        if (pascalCaseName) { // Ensure a valid PascalCase name is generated
            uniquePageObjectInfo.set(pascalCaseName, scenarioGroup.scenario);
        }
    }
    const pageObjectNames = Array.from(uniquePageObjectInfo.keys()); // e.g., ['LoginPage', 'ProductSearchPage']

    console.log("DEBUG: Identified unique Page Objects for fixtures:", pageObjectNames);


    // Format Test Data for AI, INCLUDING NLP ANALYSIS
    const formattedTestCases = testDataArray.map(scenarioGroup => {
        const tests = scenarioGroup.tests.map(tc => {
            let stepsContent = tc.steps.map(step => `        - ${step}`).join('\n');
            // Include NLP analysis in the prompt if available
            if (tc.nlpAnalysis) {
                if (tc.nlpAnalysis.steps && tc.nlpAnalysis.steps.length > 0) {
                    stepsContent += '\n          (NLP Analysis for Steps):\n';
                    tc.nlpAnalysis.steps.forEach(nlp => {
                        stepsContent += `            - Original: "${nlp.originalText}"\n`;
                        // Stringify the analysis object cleanly for the AI to parse
                        stepsContent += `              Analysis: ${JSON.stringify(nlp.analysis).replace(/\n/g, '\n              ')}\n`; 
                    });
                }
                if (tc.nlpAnalysis.description && Object.keys(tc.nlpAnalysis.description.analysis).length > 0) {
                    stepsContent += `\n          (NLP Analysis for Test Case Description): ${JSON.stringify(tc.nlpAnalysis.description.analysis).replace(/\n/g, '\n              ')}\n`;
                }
                if (tc.nlpAnalysis.expectedResult && Object.keys(tc.nlpAnalysis.expectedResult.analysis).length > 0) {
                    stepsContent += `\n          (NLP Analysis for Expected Result): ${JSON.stringify(tc.nlpAnalysis.expectedResult.analysis).replace(/\n/g, '\n              ')}\n`;
                }
            }

            return `
    - Test Case ID: ${tc.id || 'N/A'}
      Title: ${tc.title}
      Description: ${tc.description || 'N/A'}
      Steps:
      ${stepsContent}
      Data: ${tc.data || 'N/A'}
      Expected Result: ${tc.expected || 'N/A'}
      Priority: ${tc.priority || 'N/A'}`;
        }).join('\n'); // Include priority in prompt to AI

        return `
Scenario: ${scenarioGroup.scenario}
  Short Feature Name: ${scenarioGroup.shortFeatureName}
  Page Object Pascal Case: ${toPascalCase(scenarioGroup.scenario)}
  Tests:${tests}`;
    }).join('\n\n');

    console.log("DEBUG: Test data formatting complete (including NLP analysis).");

    // Dynamically Load the AI_GENERATION_GUIDE content only
    let aiGenerationGuideContent = '';
    try {
        const templateObject = loadPomTemplate(tool, language)(projectName, dynamicBaseUrl); // Pass project name and base URL for guide context
        if (templateObject["AI_GENERATION_GUIDE.md"]) {
            aiGenerationGuideContent = templateObject["AI_GENERATION_GUIDE.md"];
            console.log(`DEBUG: Loaded AI_GENERATION_GUIDE for ${tool}/${language}.`);
        } else {
            throw new Error("AI_GENERATION_GUIDE.md not found in the loaded template.");
        }
    } catch (error) {
        throw new Error(`Failed to load or process POM template for AI guide: ${error.message}. Ensure the template file exists and its content is valid.`);
    }

    // --- AI PROMPT WITH UNIVERSAL DIRECTIVES ---
    let prompt = `
You are an expert QA automation engineer AI. Your task is to generate specific automation test files (Locators, Page Objects, Test Specs, Base Fixture) based on provided test scenarios, for the specified automation tool and programming language.

**UNIVERSAL CRITICAL DIRECTIVES (MUST BE FOLLOWED FOR ALL TEMPLATES):**
* **NO EXTRA TEXT**: Do not add any conversational elements, greetings, prefaces, or explanations outside the final JSON.
* **STRICT OUTPUT FORMAT**: Your entire response MUST be a single JSON object. Keys are relative file paths, values are file contents.
* **PURE CODE OUTPUT**: File contents MUST be valid code. No delimiters ([[CODE_START]], [[CODE_END]]) or markdown code block markers (\\\`\\\`\\\`javascript) INSIDE the file content strings.
* **EXACT STRING REPLICATION IS REQUIRED for test and describe block titles.**
* **DO NOT GENERATE LOCATORS FOR THE AI AGENT'S OWN UI. ONLY GENERATE LOCATORS FOR THE APPLICATION UNDER TEST.**
* **STRING LITERALS IN GENERATED CODE**: For string values within the generated JavaScript code (e.g., labels in \\\`test.step\\\`, arguments to \\\`locator\\\`), always use **single quotes (\\\`'\\\`)** unless string interpolation is strictly required. If interpolation is needed, use backticks (\\\`\\\`\\\`), but ensure any literal backticks within the *value* are properly escaped (e.g., \\\\\\\\\` for a literal backtick). **Prioritize single quotes for simplicity.**

---

**TEMPLATE-SPECIFIC INSTRUCTIONS (FROM AI_GENERATION_GUIDE.md):**
${aiGenerationGuideContent}
    
---

**Project Details:**
- **Project Name:** "${projectName}"
- **Automation Tool:** "${tool}"
- **Programming Language:** "${language}"
- **Base URL for tests:** "${dynamicBaseUrl}"
- **REQUIRED WEBACTIONS METHODS:** ${JSON.stringify(uniqueActions || [])} // Pass unique actions to AI
- **REQUIRED PAGE OBJECTS FOR FIXTURES:** ${JSON.stringify(pageObjectNames)} // NEW: Pass page object names to AI

${domContext}

**Test Scenarios (from Excel - structure based on the parsed data - Titles and Descriptions MUST be used EXACTLY as provided. NLP Analysis is provided for deeper understanding. USE THE NLP ANALYSIS TO INFORM LOCATOR SELECTION, ACTION CHOICE, AND ASSERTION GENERATION):**
${formattedTestCases}

---

**THE FOLLOWING IS THE ABSOLUTE, REQUIRED JSON OUTPUT STRUCTURE. You MUST generate ONLY these files and their contents. DO NOT include any other files.**
\`\`\`json
{
  // IMPORTANT: For each unique Test Scenario, you MUST generate these files:
  "page-objects/{FeatureName}Locators.js": "// content of {FeatureName}Locators.js",
  "pages/{FeatureName}Page.js": "// content of {FeatureName}Page.js",
  "tests/{featureName}.spec.js": "// content of {featureName}.spec.js",
  // REQUIRED: This file must also be dynamically generated and populated by you:
  "testFixtures/baseFixture.js": "// content of baseFixture.js (with dynamic imports/fixtures)"
}
\`\`\`
**REPLACE "// content of ..." with the actual full code for each file.**
**Ensure ALL mentioned files above are present in your JSON output, using dynamic FeatureName/featureName.**
`;

    console.log("DEBUG: Prompt construction complete for dynamic files (with NLP and Page Object context).");

    let rawResponse;
    const requestTimeout = 600000; // 10 minutes for generation

    try {
        console.log(`DEBUG: Using Gemini API (${GEMINI_MODEL})...`);
        const geminiResponse = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.1 },
            }),
            timeout: requestTimeout,
        });

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            throw new Error(`❌ Gemini API returned ${geminiResponse.status}: ${errorText}`);
        }

        const geminiJson = await geminiResponse.json();
        if (!geminiJson.candidates || geminiJson.candidates.length === 0 || !geminiJson.candidates[0].content) {
            throw new Error(`Gemini API response missing content. Response: ${JSON.stringify(geminiJson).substring(0, Math.min(JSON.stringify(geminiJson).length, 200))}`);
        }
        rawResponse = geminiJson.candidates[0].content.parts[0].text;
        console.log("DEBUG: Full Raw AI Response received (truncated):\n" + rawResponse.substring(0, Math.min(rawResponse.length, 500)) + '...'); 
        console.log("DEBUG: Gemini API response received.");

        let aiGeneratedStructure;
        try {
            let trimmedResponse = rawResponse.trim();
            let jsonContent;
            
            // Attempt to extract JSON from a markdown code block if present
            const jsonBlockMatch = trimmedResponse.match(/```json\n([\s\S]*?)\n```/);
            if (jsonBlockMatch && jsonBlockMatch[1]) {
                jsonContent = jsonBlockMatch[1];
            } else {
                // Fallback: try to find a standalone JSON object
                const potentialJsonMatch = trimmedResponse.match(/(\{[\s\S]*\})/);
                if (potentialJsonMatch && potentialJsonMatch[1]) {
                    jsonContent = potentialJsonMatch[1];
                } else {
                    throw new Error(`AI response is not valid JSON and does not contain a JSON code block. Raw: ${rawResponse.substring(0, Math.min(rawResponse.length, 500))}...`);
                }
            }

            aiGeneratedStructure = JSON.parse(jsonContent);

            // --- POST-PROCESSING FOR TEST FILES (ASSERTIONS & BASEFIXTURE IMPORT) ---
            for (const filePath in aiGeneratedStructure) {
                // Apply post-processing only to test spec files
                if (filePath.startsWith('tests/') && (filePath.endsWith('.spec.js') || filePath.endsWith('.test.js') || filePath.endsWith('.cy.js'))) {
                    let fileContent = aiGeneratedStructure[filePath];
                    const lines = fileContent.split('\n');
                    let newLines = [];
                    let testCaseCounter = 0;

                    // FIX: Ensure 'test' import from baseFixture.js is a default import
                    const importBaseFixtureRegex = /import\s+\{\s*test\s*\}\s+from\s+['"]\.\.\/testFixtures\/baseFixture\.js['"];?/;
                    if (importBaseFixtureRegex.test(lines[0])) {
                        lines[0] = lines[0].replace(importBaseFixtureRegex, `import test from '../testFixtures/baseFixture.js';`);
                        console.log(`DEBUG: Corrected baseFixture import to default in ${filePath}.`);
                    }


                    const generatedFileNameWithoutExt = filePath.split('/').pop().replace(/\.spec\.js$/, '').replace(/\.test\.js$/, '').replace(/\.cy\.js$/, '');
                    // Find the corresponding scenario group using the normalized short feature name
                    const correspondingScenario = testDataArray.find(s => s.shortFeatureName === generatedFileNameWithoutExt); 
                    
                    if (correspondingScenario) {
                        for (let i = 0; i < lines.length; i++) {
                            let line = lines[i];

                            const describeMatch = line.match(/(test\.describe\()(['"`])(.*?)\2(\s*,\s*?\(\s*?\)\s*?=>\s*?\{)/);
                            if (describeMatch) {
                                const exactDescribeTitle = correspondingScenario.scenario;
                                const generatedTitle = describeMatch[3];
                                if (generatedTitle.trim() !== exactDescribeTitle.trim()) {
                                    console.log(`DEBUG: Post-processing: Correcting describe title for ${filePath} from '${generatedTitle}' to '${exactDescribeTitle}'`);
                                    line = line.replace(generatedTitle, exactDescribeTitle);
                                }
                            }

                            const testMatch = line.match(/(test\(['"`])(.*?)(['"`]\s*,\s*async\s*\(\s*{.*?}\s*\)\s*=>\s*\{)/);
                            if (testMatch && testCaseCounter < correspondingScenario.tests.length) {
                                const currentTestCase = correspondingScenario.tests[testCaseCounter];
                                let exactTestTitle = currentTestCase.title; // Get the exact title first
                                const generatedTitle = testMatch[2];
                                
                                // --- Add priority tags to the test title ---
                                if (currentTestCase.priority) {
                                    let tags = '';
                                    switch (currentTestCase.priority) {
                                        case 'P1':
                                            tags = '@smoke @reg ';
                                            break;
                                        case 'P2':
                                            tags = '@sanity @reg ';
                                            break;
                                        case 'P3':
                                            tags = '@reg ';
                                            break;
                                    }
                                    exactTestTitle = `${tags}${exactTestTitle}`; // Prepend tags
                                }

                                if (generatedTitle.trim() !== exactTestTitle.trim() || 
                                    generatedTitle.includes('Test for') || generatedTitle.includes('Case') || 
                                    generatedTitle.includes('Funcitonality') || generatedTitle.includes('Scenario')) { 
                                    console.log(`DEBUG: Post-processing: Correcting test title for ${filePath} from '${generatedTitle}' to '${exactTestTitle}' (with tags)`);
                                    line = line.replace(generatedTitle, exactTestTitle);
                                }

                                const expectedResult = currentTestCase.expected;
                                if (expectedResult && expectedResult.trim() !== '') {
                                    let assertionCode = '';
                                    const lowerExpected = expectedResult.toLowerCase();
                                    
                                    // Check if AI already added an assertion based on common patterns
                                    // Look for expect(), page.waitForURL(), or await page.toBe/toHave assertions
                                    const codeBlockAfterTest = lines.slice(i + 1, i + 10).join('\n'); // Look in next 10 lines
                                    const hasExistingAssertion = /(?:expect\(|page\.waitForURL\(|await\s+(?:page|browser)\.(?:toBe|toHave|isVisible|title)\()/.test(codeBlockAfterTest);


                                    if (!hasExistingAssertion) { // Only try to infer if AI hasn't already added one
                                        // --- NLP-DRIVEN ASSERTION INFERENCE (GENERIC) ---
                                        if (currentTestCase.nlpAnalysis && currentTestCase.nlpAnalysis.expectedResult && currentTestCase.nlpAnalysis.expectedResult.analysis) {
                                            const nlpAnalysis = currentTestCase.nlpAnalysis.expectedResult.analysis;
                                            
                                            // Generic URL verification
                                            if (nlpAnalysis.action === 'navigate' && nlpAnalysis.url) {
                                                assertionCode = `await page.waitForURL('${nlpAnalysis.url}'); // NLP-inferred: Page URL verification`;
                                            } 
                                            // Generic text content verification (e.g., for messages, titles)
                                            else if (nlpAnalysis.action === 'verify' && nlpAnalysis.validationType === 'text' && nlpAnalysis.expectedValue) {
                                                assertionCode = `// Assertion: Verify text content '${nlpAnalysis.expectedValue}'\n        // You may need to refine the locator based on context.\n        await expect(page.locator('text=${nlpAnalysis.expectedValue}')).toContainText('${nlpAnalysis.expectedValue}');`;
                                            }
                                            // Generic visibility verification
                                            else if (nlpAnalysis.action === 'verify' && nlpAnalysis.validationType === 'visibility' && nlpAnalysis.target) {
                                                assertionCode = `// Assertion: Verify element visibility for '${nlpAnalysis.target}'\n        // You may need to refine the locator based on context.\n        await expect(page.locator('text=${nlpAnalysis.target}')).toBeVisible();`;
                                            }
                                            // Fallback for general verification action without specific type
                                            else if (nlpAnalysis.action === 'verify' && nlpAnalysis.target && nlpAnalysis.expectedValue) {
                                                assertionCode = `// Assertion: Verify \${nlpAnalysis.target} is \${nlpAnalysis.expectedValue}. Please add specific assertion.`;
                                            }
                                            // Fallback to simple comment if NLP gives nothing actionable
                                            else {
                                                assertionCode = `// Verify: ${expectedResult}`;
                                            }
                                        } else { // Original keyword-based inference (if no NLP analysis)
                                            if (lowerExpected.includes('url')) {
                                                const urlMatch = lowerExpected.match(/(https?:\/\/(?:www\.)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}(?::\d+)?(?:\/[^\s,"']*)?)/);
                                                if (urlMatch) {
                                                    assertionCode = `await page.waitForURL('${urlMatch[0]}'); // Keyword inferred: URL verification`;
                                                }
                                            } else if (lowerExpected.includes('visible') || lowerExpected.includes('displayed')) {
                                                assertionCode = `// Verify element is visible: ${expectedResult}`;
                                            } else if (lowerExpected.includes('text') || lowerExpected.includes('message') || lowerExpected.includes('value')) {
                                                assertionCode = `// Verify text content: ${expectedResult}`;
                                            } else {
                                                assertionCode = `// Verify: ${expectedResult}`;
                                            }
                                        }
                                    }
                                    
                                    // Inject assertion code just before the closing brace of the test block
                                    if (assertionCode) {
                                        let j = i + 1;
                                        let braceCount = 1; // Count the opening brace of the test block ({)
                                        let foundClosingBrace = false;
                                        while (j < lines.length && !foundClosingBrace) {
                                            const currentLine = lines[j];
                                            if (currentLine.includes('{')) braceCount++;
                                            if (currentLine.includes('}')) braceCount--;
                                            if (braceCount === 0) { // Found the matching closing brace
                                                foundClosingBrace = true;
                                            }
                                            j++;
                                        }
                                        // j is now the line *after* the matching closing brace of the test block
                                        // We want to insert just before it (at j-1)
                                        if (foundClosingBrace) {
                                            lines.splice(j - 1, 0, `      ${assertionCode}`); // Insert before the closing brace
                                            i = j - 1; // Adjust loop counter as we modified the array
                                        } else {
                                            console.warn(`WARNING: Could not find closing brace for test block in ${filePath} at line ${i+1}. Assertion not injected.`);
                                        }
                                    }
                                }
                                newLines.push(line);
                                testCaseCounter++;
                            } else {
                                newLines.push(line);
                            }
                        }
                    } else {
                        console.warn(`WARNING: Post-processing: Could not find corresponding scenario for file ${filePath}. Test titles and assertions may not be corrected.`);
                        newLines = lines;
                    }
                    aiGeneratedStructure[filePath] = newLines.join('\n');
                }
            }

            // --- NEW POST-PROCESSING FOR testFixtures/baseFixture.js ---
            // This is the failsafe to ensure baseFixture.js is correctly populated
            // with dynamic Page Object imports and fixture definitions.
            if (aiGeneratedStructure["testFixtures/baseFixture.js"]) { // Only process if AI generated this file
                if (pageObjectNames.length > 0) { // Only generate fixtures if there are page objects
                    console.log("DEBUG: Forcibly rebuilding testFixtures/baseFixture.js with dynamic imports and fixtures.");
                    const importStatements = pageObjectNames.map(name => `import { ${name}Page } from '../pages/${name}Page.js';`).join('\n');
                    const fixtureDefinitions = pageObjectNames.map(name => {
                        const camelCaseName = toCamelCase(name); // Convert PascalCase to camelCase for fixture name
                        return `    ${camelCaseName}Page: async ({ page }, use) => { await use(new ${name}Page(page)); },`;
                    }).join('\n');

                    let finalContent = `import { test as baseTest } from '@playwright/test';\n`;
                    if (importStatements.length > 0) { // Only add imports if there are actual Page Objects
                        finalContent += importStatements + `\n`;
                    }
                    finalContent += `\nconst test = baseTest.extend({\n`;
                    if (fixtureDefinitions.length > 0) { // Only add fixtures if there are actual definitions
                        finalContent += fixtureDefinitions + `\n`;
                    }
                    finalContent += `});\n\nexport default test;\n`;
                    aiGeneratedStructure["testFixtures/baseFixture.js"] = finalContent;
                    console.log("DEBUG: Successfully rebuilt testFixtures/baseFixture.js.");
                } else {
                    // If no page objects, ensure baseFixture is minimal but valid (no dynamic content)
                    aiGeneratedStructure["testFixtures/baseFixture.js"] = `import { test as baseTest } from '@playwright/test';\n\nconst test = baseTest.extend({});\n\nexport default test;\n`;
                    console.log("DEBUG: Ensured minimal baseFixtures.js as no page objects were identified.");
                }
            }


            console.log("DEBUG: AI response successfully parsed and post-processed for dynamic files.");
        } catch (jsonParseError) {
            console.error('ERROR: JSON Parsing or Post-processing failed:', jsonParseError);
            throw new Error(`Failed to parse AI response as JSON or during post-processing: ${jsonParseError.message}. Raw AI output start: ${rawResponse.substring(0, Math.min(rawResponse.length, 500))}...`);
        }

        if (typeof aiGeneratedStructure !== 'object' || Array.isArray(aiGeneratedStructure)) {
            throw new Error('AI response was not a valid JSON object of file paths and content for dynamic files.');
        }

        return aiGeneratedStructure;
    } catch (err) {
        console.error(`🔥 AI call failed for project "${projectName}" during dynamic file generation:`, err.message);
        throw err;
    }
}

module.exports = generateCode;