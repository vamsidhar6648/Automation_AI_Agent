// server/ai_suggestor.js
const fetch = require('node-fetch');
require('dotenv').config(); // Ensure dotenv is loaded to access .env variables

// Configuration for Gemini API for Suggestions
const SUGGESTION_GEMINI_API_KEY = process.env.SUGGESTION_GEMINI_API_KEY || process.env.GEMINI_API_KEY; // Fallback to main API key
const SUGGESTION_GEMINI_MODEL = process.env.SUGGESTION_GEMINI_MODEL || process.env.GEMINI_MODEL || 'gemini-1.5-flash-latest';
const SUGGESTION_GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${SUGGESTION_GEMINI_MODEL}:generateContent?key=${SUGGESTION_GEMINI_API_KEY}`;

/**
 * Format test data into a human-readable prompt for the LLM.
 * @param {Array<Object>} testData - The existing parsed test data (scenarios and test cases).
 * @param {string} projectName - The name of the project.
 * @param {string} [requestedScenarioTitle=null] - Optional: Title of the specific scenario to generate suggestions for.
 * @param {number} [requestedCount=4] - Optional: Number of suggestions to provide for the requested scenario.
 * @returns {string} The formatted prompt string.
 */
function formatTestDataForPrompt(testData, projectName, requestedScenarioTitle = null, requestedCount = 4) {
    let formattedExistingTestCases = '';
    let targetScenarioExists = false;

    if (requestedScenarioTitle) {
        // Find the specific scenario and format only that one
        const scenarioToSuggestFor = testData.find(s => s.scenario === requestedScenarioTitle);
        if (scenarioToSuggestFor) {
            targetScenarioExists = true;
            const cases = scenarioToSuggestFor.tests.map(tc => `    - Title: ${tc.title}\n      Description: ${tc.description}`).join('\n');
            formattedExistingTestCases = `Scenario: ${scenarioToSuggestFor.scenario}\nTests:\n${cases}`;
        } else {
            // If requestedScenarioTitle is provided but not found, AI should know.
            formattedExistingTestCases = `Scenario: ${requestedScenarioTitle} (No existing test cases provided for this scenario).`;
        }
    } else {
        // If no specific scenario requested, format all existing test data
        formattedExistingTestCases = testData.map(group => {
            const cases = group.tests.map(tc => `    - Title: ${tc.title}\n      Description: ${tc.description}`).join('\n');
            return `Scenario: ${group.scenario}\nTests:\n${cases}`;
        }).join('\n\n');
    }

    // Determine the suggestion quantity instruction
    let quantityInstruction = '';
    if (requestedScenarioTitle && targetScenarioExists) {
        quantityInstruction = `* Suggest exactly ${requestedCount} *missing* test cases for the scenario "**${requestedScenarioTitle}**".`;
    } else if (requestedScenarioTitle && !targetScenarioExists) {
        quantityInstruction = `* Suggest exactly ${requestedCount} *initial* test cases for the new scenario "**${requestedScenarioTitle}**".`;
    } else {
        quantityInstruction = `* Suggest 2-4 (or more if relevant based on complexity) *missing* test cases for the *existing scenarios*.`; // Default for initial bulk request
    }


    return `You are an expert QA automation engineer. Your task is to analyze the provided test scenarios and existing test cases, and then suggest new, missing test cases to improve test coverage.

**Current Project:** "${projectName}"

**Existing Test Scenarios and Test Cases (from Excel):**
${formattedExistingTestCases}

**Instructions for Suggestions:**
${quantityInstruction}
* Focus on common and comprehensive testing types, such as:
    * **Positive/Happy Path Variations** (e.g., different valid data formats)
    * **Negative Scenarios** (e.g., invalid input, incorrect credentials, missing required data, unauthorized access attempts)
    * **Boundary Value Analysis** (e.g., minimum/maximum allowed values, just inside/outside boundaries)
    * **Edge Cases** (e.g., empty fields, special characters, very long/short inputs, concurrent actions)
    * **Error Handling & Messaging** (e.g., verifying correct error messages for invalid actions)
    * **Performance/Load** (conceptual test ideas, if implied by scenario)
    * **Security** (e.g., basic injection attempts, cross-site scripting prevention, if implied)
    * **Usability/Accessibility** (e.g., tab order, keyboard navigation, clear error states)
    * **Data Integrity** (e.g., verifying data persistence or correct updates)
    * **UI States & Transitions** (e.g., disabled buttons, loading spinners, proper page redirects)
* **DO NOT duplicate** existing test cases.
* **Maintain the structure of existing scenarios.** Group suggestions under the correct \`scenario\` title.
* **Provide a Test Case ID for suggestions (e.g., AI_001, AI_NegativeLogin_001).**
* **Use single quotes (\\\`'\\\`) for string literals.**

**Output Format (STRICTLY JSON ONLY):**
Respond ONLY with a JSON object. The structure MUST be an array of scenario objects. Each scenario object must contain:
- \`scenario\` (string): The exact title of the existing test scenario it belongs to.
- \`tests\` (array of objects): A list of suggested test cases. Each test case object must contain:
    - \`id\` (string): A unique ID (e.g., AI_001, AI_NegativeLogin_001).
    - \`title\` (string): A concise title for the test case.
    - \`description\` (string): A brief description of the test case.
    - \`steps\` (array of strings): Detailed steps for the test case.
    - \`data\` (string): Any required test data (e.g., "username:value, password:value").
    - \`expected\` (string): The expected result.
    - \`priority\` (string): P1, P2, or P3 (default to P3 if not obvious).

**Example of desired JSON output:**
\`\`\`json
[
  {
    "scenario": "Verify User Login Functionality with Valid Credentials",
    "tests": [
      {
        "id": "AI_Login_001",
        "title": "Verify login with invalid username and valid password.",
        "description": "User attempts to log in with an incorrect username but correct password.",
        "steps": ["1. Navigate to login page.", "2. Enter invalid username.", "3. Enter valid password.", "4. Click login button.", "5. Verify error message for invalid username."],
        "data": "username: invalidUser, password: validPassword",
        "expected": "An error message 'Invalid username' or similar is displayed.",
        "priority": "P2"
      }
    ]
  },
  {
    "scenario": "Another Scenario Title From Excel",
    "tests": [
      {
        "id": "AI_AnotherScenario_001",
        "title": "Suggest a missing test for this scenario.",
        "description": "Description of the suggested test.",
        "steps": ["Step 1.", "Step 2."],
        "data": "key:value",
        "expected": "Expected result.",
        "priority": "P3"
      }
    ]
  }
]
\`\`\`
Provide ONLY the JSON output.
`;
}

/**
 * Extract and clean JSON from the LLM response.
 * @param {string} responseText - The raw text response from the LLM.
 * @returns {string} A clean JSON string, or the original text if no JSON found.
 */
function extractJsonFromResponse(responseText) {
    const trimmed = responseText.trim();

    // 1. Try to parse directly (most common if LLM is strictly following instructions)
    try {
        JSON.parse(trimmed); 
        return trimmed; 
    } catch (e) {
        // Not direct JSON, proceed to try extraction patterns
    }

    // 2. Try extracting from markdown-style block (```json ... ```)
    const matchBlock = trimmed.match(/```json\n([\s\S]*?)\n```/);
    if (matchBlock && matchBlock[1]) {
        return matchBlock[1].trim(); 
    }

    // 3. Try extracting a standalone JSON array (our target output format [ ... ])
    const matchArray = trimmed.match(/(\[[{:,}\s\S]*?\])/); 
    if (matchArray && matchArray[1]) {
        return matchArray[1].trim(); 
    }

    // Fallback: If no valid JSON or recognizable pattern found, return the original text.
    // JSON.parse will likely fail on this outside this function, leading to an error.
    return trimmed;
}

/**
 * Main function to get test suggestions from Gemini LLM for suggestions.
 * @param {Array<Object>} testData - The existing parsed test data (scenarios and test cases).
 * @param {string} projectName - The name of the project.
 * @param {string} [requestedScenarioTitle=null] - Optional: Title of the specific scenario to get suggestions for.
 * @param {number} [requestedCount=4] - Optional: Number of suggestions to provide.
 * @returns {Promise<Array<Object>>} - A promise that resolves to an array of suggested test scenarios/cases.
 * @throws {Error} If the Gemini API call fails or returns an unparsable response.
 */
async function getSuggestionsFromOllama(testData, projectName, requestedScenarioTitle = null, requestedCount = 4) { 
    const prompt = formatTestDataForPrompt(testData, projectName, requestedScenarioTitle, requestedCount);

    if (!SUGGESTION_GEMINI_API_KEY) {
        throw new Error("SUGGESTION_GEMINI_API_KEY not configured in .env. Cannot fetch AI suggestions.");
    }

    console.log(`DEBUG: Requesting suggestions from Gemini model '${SUGGESTION_GEMINI_MODEL}' using suggestion API key...`);

    try {
        const response = await fetch(SUGGESTION_GEMINI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.7 }, 
            }),
            timeout: 120000 
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API error for suggestions: ${response.status} - ${errorText}`);
        }

        const rawGeminiResponse = await response.json();
        
        if (!rawGeminiResponse.candidates || rawGeminiResponse.candidates.length === 0 || !rawGeminiResponse.candidates[0].content) {
            throw new Error("Gemini response missing content or candidates for suggestions.");
        }

        const aiTextResponse = rawGeminiResponse.candidates[0].content.parts[0].text.trim();

        // --- NEW JSON CLEANUP LOGIC ---
        let cleanJsonText = aiTextResponse;

        // 1. Aggressively remove common preamble/postamble text that often surrounds JSON
        // This regex tries to find text outside the first '[' and last ']' for arrays, or '{' and '}' for objects.
        const arrayStart = cleanJsonText.indexOf('[');
        const arrayEnd = cleanJsonText.lastIndexOf(']');
        const objStart = cleanJsonText.indexOf('{');
        const objEnd = cleanJsonText.lastIndexOf('}');

        if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
            cleanJsonText = cleanJsonText.substring(arrayStart, arrayEnd + 1);
        } else if (objStart !== -1 && objEnd !== -1 && objEnd > objStart) {
            cleanJsonText = cleanJsonText.substring(objStart, objEnd + 1);
        }
        
        // 2. Attempt to extract from markdown-style block (```json ... ```) first
        const matchBlock = cleanJsonText.match(/```json\n([\s\S]*?)\n```/);
        if (matchBlock && matchBlock[1]) {
            cleanJsonText = matchBlock[1].trim(); 
        }

        // 3. Robustly fix common JSON parsing issues like bad escapes and trailing commas
        // This is crucial for LLMs
        cleanJsonText = cleanJsonText
            .replace(/\\(?!["\\/bfnrtu])/g, '\\\\') // Replace single backslashes not part of valid escape sequence
            .replace(/,\s*([\]}])/g, '$1'); // Remove trailing commas before ] or }

        // --- END NEW JSON CLEANUP LOGIC ---

        let parsedSuggestions;
        try {
            parsedSuggestions = JSON.parse(cleanJsonText);
        } catch (parseError) {
            console.error("ERROR: Failed to parse cleanJsonText as JSON after cleanup:", parseError); // Added "after cleanup"
            throw new Error(`AI returned malformed JSON for suggestions even after cleanup: ${parseError.message}. Raw AI text: ${aiTextResponse.substring(0, 500)}... Cleaned text: ${cleanJsonText.substring(0, 500)}...`); 
        }

        if (!Array.isArray(parsedSuggestions)) {
            throw new Error("Gemini returned non-array JSON for suggestions.");
        }
        
        console.log(`DEBUG: Successfully received and parsed suggestions from Gemini. Found ${parsedSuggestions.length} scenario group(s).`);
        return parsedSuggestions;

    } catch (err) {
        console.error("ERROR: Failed to retrieve AI suggestions:", err);
        let specificError = err.message;
        if (err.message.includes('Failed to fetch')) {
            specificError = `Network connection error. Check internet or API URL.`;
        } else if (err.message.includes('400') || err.message.includes('403') || err.message.includes('429')) {
            specificError = `Gemini API access error. Check API key, billing, or quota limits.`;
        } else if (err.message.includes('malformed JSON') || err.message.includes('Unexpected token')) {
            specificError = `AI returned malformed JSON. Ensure prompt instructions are strict.`;
        } else if (err.message.includes('Gemini API error')) {
            specificError = `Gemini API responded with an error.`;
        }
        throw new Error(`Suggestion generation failed: ${specificError}`);
    }
}

module.exports = { getSuggestionsFromOllama };