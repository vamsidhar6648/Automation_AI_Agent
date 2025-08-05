// server/nlp-data-processor.js

const fetch = require('node-fetch');
require('dotenv').config();

// Configuration for NLP API (which is also Gemini)
const NLP_API_KEY = process.env.NLP_API_KEY;
const NLP_MODEL = process.env.NLP_MODEL || 'gemini-1.5-flash-latest';
const NLP_GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${NLP_MODEL}:generateContent?key=${NLP_API_KEY}`;


/**
 * Calls the Gemini API (configured for NLP purposes) to process a given text.
 * We instruct Gemini to return a JSON object with 'action', 'entities', etc.
 * @param {string} textToProcess - The natural language text to send to the NLP API.
 * @returns {Promise<Object|null>} A promise that resolves to the NLP API's structured JSON response,
 * or null if NLP processing is skipped/fails.
 */
async function callNlpApi(textToProcess) {
    if (!NLP_API_KEY || textToProcess.trim() === '') {
        console.warn('⚠️ NLP_API_KEY is not configured or text is empty. Skipping NLP processing for:', textToProcess.substring(0, Math.min(textToProcess.length, 50)));
        return null; // Skip if no API key or no text to process
    }
    
    try {
        const headers = { 'Content-Type': 'application/json' };

        // Construct a specific prompt for the NLP task (e.g., extracting action/entities)
        const nlpPrompt = `Analyze the following natural language text for automation steps, user actions, and entities. Respond ONLY with a JSON object.

Text: "${textToProcess}"

Expected JSON format:
{
  "action": "identified_verb_or_main_action (e.g., click, fill, navigate, verify)",
  "target": "identified_element_description_or_value (e.g., login button, username field, dashboard page)",
  "entities": [
    {"type": "field", "name": "username", "value": "value"},
    {"type": "button", "name": "Login"},
    // ... more entities as appropriate
  ],
  "originalText": "${textToProcess}",
  "confidence": "high/medium/low"
}

If it's an assertion, include 'validationType' and 'expectedValue'.
Example for 'Verify successful login':
{
  "action": "verify",
  "target": "login status",
  "validationType": "status",
  "expectedValue": "successful login",
  "originalText": "Verify successful login",
  "confidence": "high"
}

Example for 'Navigate to XYZ URL':
{
  "action": "navigate",
  "target": "URL",
  "url": "the_extracted_url",
  "originalText": "Navigate to XYZ URL",
  "confidence": "high"
}

Provide just the JSON.`;


        console.log(`DEBUG: Sending text to NLP Gemini for analysis: "${textToProcess.substring(0, Math.min(textToProcess.length, 50))}..."`);
        const response = await fetch(NLP_GEMINI_API_URL, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                contents: [{ parts: [{ text: nlpPrompt }] }],
                generationConfig: { temperature: 0.2 }, // Lower temperature for more consistent NLP output
            }),
            timeout: 30000 // 30 seconds timeout for NLP API call
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`NLP Gemini API returned ${response.status}: ${errorBody.substring(0, Math.min(errorBody.length, 200))}...`);
        }

        const geminiJson = await response.json();
        if (!geminiJson.candidates || geminiJson.candidates.length === 0 || !geminiJson.candidates[0].content) {
            throw new Error(`NLP Gemini API response missing content. Response: ${JSON.stringify(geminiJson).substring(0, Math.min(JSON.stringify(geminiJson).length, 200))}`);
        }
        
        const rawNlpResponse = geminiJson.candidates[0].content.parts[0].text;
        
        // Attempt to parse the response as JSON
        let nlpResult = {};
        try {
            // Trim and try to extract JSON from markdown block if present
            const jsonBlockMatch = rawNlpResponse.trim().match(/```json\n([\s\S]*?)\n```/);
            if (jsonBlockMatch && jsonBlockMatch[1]) {
                nlpResult = JSON.parse(jsonBlockMatch[1]);
            } else {
                // Fallback to direct parse if no markdown block (less robust but might be needed)
                nlpResult = JSON.parse(rawNlpResponse.trim());
            }
        } catch (jsonParseError) {
            console.warn(`⚠️ Could not parse NLP Gemini response as JSON for "${textToProcess.substring(0, Math.min(textToProcess.length, 50))}...": ${jsonParseError.message}. Raw response: ${rawNlpResponse.substring(0, Math.min(rawNlpResponse.length, 200))}`);
            // Return a minimal structure or null if parsing fails, so main generation can continue
            return { rawResponse: rawNlpResponse, error: "JSON parse failed" }; 
        }

        console.log(`DEBUG: NLP Gemini analysis for "${textToProcess.substring(0, Math.min(textToProcess.length, 20))}...":`, JSON.stringify(nlpResult).substring(0, Math.min(JSON.stringify(nlpResult).length, 100)));
        return nlpResult;
    } catch (error) {
        console.error(`❌ Error calling NLP Gemini API for text "${textToProcess.substring(0, Math.min(textToProcess.length, 50))}...":`, error.message);
        return null; // Return null to allow main AI processing to continue without NLP results
    }
}

/**
 * Processes the raw parsed Excel test data with the NLP API, enriching it with NLP insights.
 * @param {Array<Object>} testData - The structured test data from Excel (Map converted to Array of scenario objects).
 * @returns {Promise<Object>} A promise that resolves to an object containing NLP-enriched test data and unique actions.
 */
async function processDataWithNlp(testData) {
    console.log("DEBUG: Starting NLP processing on parsed Excel test data...");
    const processedData = [];
    const uniqueActions = new Set(); // NEW: To collect all unique actions identified

    const testDataArray = Array.isArray(testData) ? testData : Object.values(testData);

    for (const scenarioGroup of testDataArray) {
        const newScenarioGroup = { ...scenarioGroup, tests: [] }; 
        for (const tc of scenarioGroup.tests) {
            const newTc = { ...tc, nlpAnalysis: {} }; 

            // Process 'Detail Steps' array
            const nlpResultsForSteps = [];
            for (const step of tc.steps) {
                const stepNlpResult = await callNlpApi(step);
                if (stepNlpResult) {
                    nlpResultsForSteps.push({ originalText: step, analysis: stepNlpResult });
                    // Collect action from NLP analysis
                    if (stepNlpResult.action && typeof stepNlpResult.action === 'string' && stepNlpResult.action.trim() !== '') {
                        uniqueActions.add(stepNlpResult.action.trim().toLowerCase());
                    }
                }
            }
            if (nlpResultsForSteps.length > 0) {
                newTc.nlpAnalysis.steps = nlpResultsForSteps;
            }

            // Process 'Test Case Description'
            const descriptionNlpResult = await callNlpApi(tc.description);
            if (descriptionNlpResult) {
                newTc.nlpAnalysis.description = { originalText: tc.description, analysis: descriptionNlpResult };
                 // Collect action from description analysis if applicable
                if (descriptionNlpResult.action && typeof descriptionNlpResult.action === 'string' && descriptionNlpResult.action.trim() !== '') {
                    uniqueActions.add(descriptionNlpResult.action.trim().toLowerCase());
                }
            }

            // Process 'Expected Result'
            const expectedNlpResult = await callNlpApi(tc.expected);
            if (expectedNlpResult) {
                newTc.nlpAnalysis.expectedResult = { originalText: tc.expected, analysis: expectedNlpResult };
                // Collect action from expected result analysis if applicable
                if (expectedNlpResult.action && typeof expectedNlpResult.action === 'string' && expectedNlpResult.action.trim() !== '') {
                    uniqueActions.add(expectedNlpResult.action.trim().toLowerCase());
                }
            }

            newScenarioGroup.tests.push(newTc);
        }
        processedData.push(newScenarioGroup);
    }
    console.log("DEBUG: NLP data processing complete.");
    console.log("DEBUG: Identified unique actions for WebActions:", Array.from(uniqueActions)); // Log identified actions

    // Return an object containing both processedData and uniqueActions
    return {
        processedData: processedData,
        uniqueActions: Array.from(uniqueActions) // Convert Set to Array for easier use
    };
}

module.exports = { processDataWithNlp };