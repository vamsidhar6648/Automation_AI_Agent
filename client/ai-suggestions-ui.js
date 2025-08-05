// client/ai-suggestions-ui.js

// Access globally exposed elements and functions from main-app.js
const aiSuggestionsBtn = document.getElementById('aiSuggestionsBtn');
const suggestionsModal = document.getElementById('suggestionsModal');
const closeModalButton = document.querySelector('#suggestionsModal .close-button');
const addSelectedBtn = document.getElementById('addSelectedBtn');
const leavePageBtn = document.getElementById('leavePageBtn');
const suggestionsListDiv = document.getElementById('suggestionsList');

// Expose elements to global scope for other scripts (like main-app.js's handleApiResponse)
window.aiSuggestionsBtn = aiSuggestionsBtn;
window.suggestionsModal = suggestionsModal;
window.closeModalButton = closeModalButton;
window.addSelectedBtn = addSelectedBtn;
window.leavePageBtn = leavePageBtn;
window.suggestionsListDiv = suggestionsListDiv;


// Global state unique to AI suggestions UI
let currentFetchedSuggestions = []; 


/**
 * Shows the AI Suggestions modal and disables main page controls.
 * @param {string} [loadingMessage='Fetching suggestions from AI... This may take a moment. ⏳']
 */
function showSuggestionsModal(loadingMessage = 'Fetching suggestions from AI... This may take a moment. ⏳') {
    window.suggestionsModal.style.display = 'block'; 
    window.suggestionsListDiv.innerHTML = `<p>${loadingMessage}</p>`; 
    window.setButtonsDisabled(true); 
    window.actionButtonsDiv.style.pointerEvents = 'none'; 
    window.actionButtonsDiv.style.opacity = '0.5'; 

    window.addSelectedBtn.disabled = false; 
    window.leavePageBtn.disabled = false; 
}
window.showSuggestionsModal = showSuggestionsModal; 


/**
 * Hides the AI Suggestions modal and re-enables main page controls.
 */
function hideSuggestionsModal() {
    window.suggestionsModal.style.display = 'none'; 
    window.setButtonsDisabled(false); 
    window.actionButtonsDiv.style.pointerEvents = 'auto'; 
    window.actionButtonsDiv.style.opacity = '1'; 
}
window.hideSuggestionsModal = hideSuggestionsModal; 


/**
 * Helper function to handle API responses consistently.
 * MOVED HERE FROM MAIN-APP.JS.
 * @param {Response} response - The raw fetch API response.
 * @param {string} successMessage - Message to display on success.
 * @param {string} errorMessagePrefix - Prefix for error messages.
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
async function handleApiResponse(response, successMessage, errorMessagePrefix) {
    const clonedResponse = response.clone(); 

    if (!response.ok) { 
        let serverError = 'Unknown error from server.';
        try {
            const errorJson = await clonedResponse.json();
            serverError = errorJson.error || `Server responded with status ${response.status}`;
        } catch (jsonError) {
            serverError = `Server responded with status ${response.status}: ${await clonedResponse.text()}`;
        }
        const fullErrorMessage = `${errorMessagePrefix}: ${serverError.substring(0, 200)}${serverError.length > 200 ? '...' : ''}`;
        console.error('❌ API Error:', fullErrorMessage);
        
        // Use direct references to elements within this file's scope
        if (suggestionsModal.style.display === 'block') { // Access directly as it's in this scope
            suggestionsListDiv.innerHTML = `<p style="color:red;">Error: ${serverError}</p>`; // Access directly
        } else {
            window.resetStatus(fullErrorMessage, true); // Call global function from main-app.js
        }
        return { success: false, error: serverError };
    }

    try {
        const result = await response.json();
        if (suggestionsModal.style.display !== 'block') { // Access directly
             window.resetStatus(successMessage); // Call global function
        }
        return { success: true, data: result };
    } catch (jsonParseError) {
        const rawText = await clonedResponse.text(); 
        const fullErrorMessage = `${errorMessagePrefix}: Invalid or empty JSON response from server. Raw: ${rawText.substring(0, 200)}${rawText.length > 200 ? '...' : ''}`;
        console.error('❌ API Logic Error: Invalid JSON response on success:', fullErrorMessage);
        
        if (suggestionsModal.style.display === 'block') { // Access directly
             suggestionsListDiv.innerHTML = `<p style="color:red;">Error: ${fullErrorMessage}</p>`; // Access directly
        } else {
            window.resetStatus(fullErrorMessage, true); // Call global function
        }
        return { success: false, error: 'Invalid or empty JSON response from server.' };
    }
}
window.handleApiResponse = handleApiResponse; // Expose globally, as main-app.js calls it.


/**
 * Function to display suggestions in the modal (modified to handle per-scenario input/refresh).
 * @param {Array<Object>} suggestionsToDisplay - The array of suggested scenario groups.
 */
function displaySuggestionsInModal(suggestionsToDisplay) { 
    suggestionsListDiv.innerHTML = ''; // Access directly
    if (!suggestionsToDisplay || suggestionsToDisplay.length === 0) {
        suggestionsListDiv.innerHTML = '<p>No new suggestions from AI at this time.</p>'; // Access directly
        return;
    }

    suggestionsToDisplay.forEach(scenarioGroup => {
        const scenarioSection = document.createElement('div');
        scenarioSection.className = 'suggestion-scenario-group';
        scenarioSection.setAttribute('data-scenario-title', scenarioGroup.scenario); 

        const scenarioHeader = document.createElement('h3');
        scenarioHeader.style.cursor = 'pointer'; 
        scenarioHeader.style.userSelect = 'none'; 
        scenarioHeader.innerHTML = `
            <span>${scenarioGroup.scenario} <span class="toggle-icon">▼</span></span>
            <div class="suggestion-controls">
                <input type="number" class="suggestion-quantity-input" value="4" min="1" max="100"> 
                <button class="refresh-suggestions-button" data-scenario="${scenarioGroup.scenario}">Refresh</button>
            </div>
        `;
        
        const testCasesContainer = document.createElement('div');
        testCasesContainer.className = 'suggestion-test-cases-container';
        testCasesContainer.style.display = 'none'; 

        // Initial rendering of test cases for this scenario (default 4)
        const initialCount = parseInt(scenarioHeader.querySelector('.suggestion-quantity-input').value) || 4;
        const testCasesToRender = [...scenarioGroup.tests].sort((a, b) => {
            const idA = parseInt(a.id.replace('AI_', '').split('_')[0]) || 0;
            const idB = parseInt(b.id.replace('AI_', '').split('_')[0]) || 0;
            return idA - idB;
        }).slice(0, initialCount); 

        testCasesToRender.forEach(testCase => { 
            const testCaseDiv = document.createElement('div');
            testCaseDiv.className = 'suggestion-test-case';
            
            // --- FIX FOR SYNTAXERROR: Using createElement and setAttribute for robustness ---
            const labelElem = document.createElement('label');
            const inputElem = document.createElement('input');
            inputElem.type = 'checkbox';
            inputElem.className = 'suggestion-checkbox';
            inputElem.dataset.scenario = scenarioGroup.scenario;
            inputElem.dataset.test = encodeURIComponent(JSON.stringify(testCase)); // Encode for safe storage

            labelElem.appendChild(inputElem);
            
            const strongElem = document.createElement('strong');
            strongElem.textContent = testCase.title;
            labelElem.appendChild(strongElem);
            labelElem.appendChild(document.createElement('br')); 

            const smallElem = document.createElement('small');
            smallElem.textContent = testCase.description || '';
            labelElem.appendChild(smallElem);

            testCaseDiv.appendChild(labelElem);
            // --- END FIX ---
            
            testCasesContainer.appendChild(testCaseDiv);
        });

        // Event listener for the toggle icon/header click
        scenarioHeader.addEventListener('click', (event) => {
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'BUTTON') {
                return;
            }
            const isHidden = testCasesContainer.style.display === 'none';
            testCasesContainer.style.display = isHidden ? 'block' : 'none';
            scenarioHeader.querySelector('.toggle-icon').textContent = isHidden ? '▲' : '▼'; 
        });

        scenarioSection.appendChild(scenarioHeader);
        scenarioSection.appendChild(testCasesContainer);
        suggestionsListDiv.appendChild(scenarioSection); // Access directly
    });

    // Attach event listeners to newly created Refresh buttons
    document.querySelectorAll('.refresh-suggestions-button').forEach(button => {
        button.addEventListener('click', async (event) => {
            const targetScenarioTitle = event.target.dataset.scenario;
            const requestedCount = parseInt(event.target.previousElementSibling.value) || 4; 

            const scenarioSectionElement = event.target.closest('.suggestion-scenario-group');
            const container = scenarioSectionElement.querySelector('.suggestion-test-cases-container');
            container.style.display = 'block'; 
            container.innerHTML = '<p>Fetching more suggestions for this scenario... ⏳</p>';
            scenarioSectionElement.querySelector('.toggle-icon').textContent = '▲'; 

            event.target.disabled = true; 
            window.addSelectedBtn.disabled = true; // Access global addSelectedBtn
            window.leavePageBtn.disabled = true; // Access global leavePageBtn

            try {
                const res = await fetch('/suggest-testcases', { 
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        testData: window.currentParsedExcelData, 
                        projectName: window.projectNameInput.value.trim(), 
                        tool: window.toolSelect.value, 
                        language: window.languageSelect.value, 
                        requestedScenarioTitle: targetScenarioTitle, 
                        requestedCount: requestedCount 
                    })
                });

                const { success, data, error } = await handleApiResponse(res, 'Suggestions fetched successfully.', 'Failed to fetch suggestions'); // Call handleApiResponse (now in this file)

                if (success) {
                    const updatedScenarioGroup = data.suggestions.find(s => s.scenario === targetScenarioTitle);
                    if (updatedScenarioGroup) {
                        currentFetchedSuggestions = currentFetchedSuggestions.map(sg => 
                            sg.scenario === targetScenarioTitle ? updatedScenarioGroup : sg
                        );
                        renderSingleScenarioSuggestions(scenarioSectionElement, updatedScenarioGroup); 
                    } else {
                        container.innerHTML = `<p style="color:red;">No suggestions returned for '${targetScenarioTitle}'.</p>`;
                    }
                } else {
                    container.innerHTML = `<p style="color:red;">Error: ${error}</p>`;
                }
            } catch (err) {
                container.innerHTML = `<p style="color:red;">Network error: ${err.message}.</p>`;
            } finally {
                event.target.disabled = false;
                window.addSelectedBtn.disabled = false; // Access global addSelectedBtn
                window.leavePageBtn.disabled = false; // Access global leavePageBtn
            }
        });
    });
    recheckSelectedCheckboxes(); 
}

// Helper function to render (or re-render) a single scenario's suggestions within its container
function renderSingleScenarioSuggestions(scenarioSectionElement, scenarioGroup) {
    const container = scenarioSectionElement.querySelector('.suggestion-test-cases-container');
    container.innerHTML = ''; 

    container.style.display = 'block';
    scenarioSectionElement.querySelector('.toggle-icon').textContent = '▲'; 

    const sortedTestCases = [...scenarioGroup.tests].sort((a, b) => {
        const idA = parseInt(a.id.replace('AI_', '').split('_')[0]) || 0;
        const idB = parseInt(b.id.replace('AI_', '').split('_')[0]) || 0;
        return idA - idB;
    });

    sortedTestCases.forEach(testCase => { 
        const testCaseDiv = document.createElement('div');
        testCaseDiv.className = 'suggestion-test-case';
        
        // --- FIX FOR SYNTAXERROR: Using createElement and setAttribute for robustness ---
        const labelElem = document.createElement('label');
        const inputElem = document.createElement('input');
        inputElem.type = 'checkbox';
        inputElem.className = 'suggestion-checkbox';
        inputElem.dataset.scenario = scenarioGroup.scenario;
        inputElem.dataset.test = encodeURIComponent(JSON.stringify(testCase)); // Encode here

        labelElem.appendChild(inputElem);
        
        const strongElem = document.createElement('strong');
        strongElem.textContent = testCase.title;
        labelElem.appendChild(strongElem);
        labelElem.appendChild(document.createElement('br')); 

        const smallElem = document.createElement('small');
        smallElem.textContent = testCase.description || '';
        labelElem.appendChild(smallElem);

        testCaseDiv.appendChild(labelElem);
        // --- END FIX ---
        
        container.appendChild(testCaseDiv);
    });
    recheckSelectedCheckboxes(scenarioSectionElement.dataset.scenario); 
}

// Helper function to re-check checkboxes based on currentParsedExcelData
function recheckSelectedCheckboxes(scenarioTitle = null) {
    const checkboxes = scenarioTitle 
        ? document.querySelectorAll(`.suggestion-checkbox[data-scenario="${scenarioTitle}"]`)
        : document.querySelectorAll('.suggestion-checkbox');
    
    checkboxes.forEach(checkbox => {
        const checkboxScenarioTitle = checkbox.dataset.scenario;
        const testCaseData = JSON.parse(decodeURIComponent(checkbox.dataset.test)); 

        const scenarioInCurrentData = window.currentParsedExcelData.find(s => s.scenario === checkboxScenarioTitle); 
        if (scenarioInCurrentData) {
            const isAlreadyAdded = scenarioInCurrentData.tests.some(existingTc => 
                existingTc.id === testCaseData.id || existingTc.title === testCaseData.title
            );
            checkbox.checked = isAlreadyAdded;
        } else {
            checkbox.checked = false;
        }
    });
}

// --- Event Listeners unique to AI Suggestions UI ---
window.aiSuggestionsBtn.addEventListener('click', async () => { 
    window.setButtonsDisabled(true); 
    showSuggestionsModal(); 
    suggestionsListDiv.innerHTML = '<p>Fetching suggestions from AI... This may take a moment. ⏳</p>';

    const projectName = window.projectNameInput.value.trim(); 
    const selectedTool = window.toolSelect.value; 
    const selectedLanguage = window.languageSelect.value; 

    if (!window.currentParsedExcelData || window.currentParsedExcelData.length === 0) { 
        suggestionsListDiv.innerHTML = '<p style="color:red;">No Excel data found. Please upload an Excel file first.</p>';
        window.addSelectedBtn.disabled = true; 
        window.leavePageBtn.disabled = false; 
        return;
    }

    try {
        const res = await fetch('/suggest-testcases', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                testData: window.currentParsedExcelData, 
                projectName,
                tool: selectedTool,
                language: selectedLanguage,
                requestedCount: 4 // Default initial suggestion count
            })
        });

        const { success, data, error } = await handleApiResponse(res, 'Suggestions fetched successfully.', 'Failed to fetch suggestions'); 

        if (success) {
            currentFetchedSuggestions = data.suggestions; 
            displaySuggestionsInModal(currentFetchedSuggestions); 
        } else {
            console.error("Failed to fetch suggestions (handled by handleApiResponse):", error);
        }
    } catch (err) {
        console.error('🔥 Client-side fetch error during suggestion (handled by handleApiResponse):', err);
    } finally {
        if (suggestionsListDiv.innerHTML.includes('<p style="color:red;">') || suggestionsListDiv.innerHTML.includes('No new suggestions')) {
            window.addSelectedBtn.disabled = true;
        } else {
            window.addSelectedBtn.disabled = false;
        }
        window.leavePageBtn.disabled = false; 
    }
});

// Modal close handlers
window.closeModalButton.addEventListener('click', hideSuggestionsModal); 
window.leavePageBtn.addEventListener('click', hideSuggestionsModal); 
window.addEventListener('click', (event) => {
    if (event.target === window.suggestionsModal) { 
        hideSuggestionsModal();
    }
});

// Add Selected Testcases button listener
window.addSelectedBtn.addEventListener('click', () => { 
    window.addSelectedBtn.disabled = true; 

    const selectedCheckboxes = document.querySelectorAll('.suggestion-checkbox:checked');
    if (selectedCheckboxes.length === 0) {
        alert('Please select at least one test case to add.');
        window.addSelectedBtn.disabled = false; 
        return;
    }

    let newlyAddedCount = 0;
    selectedCheckboxes.forEach(checkbox => {
        const scenarioTitle = checkbox.dataset.scenario;
        const testCaseData = JSON.parse(decodeURIComponent(checkbox.dataset.test)); 

        let targetScenario = window.currentParsedExcelData.find(s => s.scenario === scenarioTitle); 
        
        if (!targetScenario) {
            targetScenario = {
                page: window.toCamelCase(scenarioTitle), 
                scenario: scenarioTitle,
                shortFeatureName: window.toShortFeatureName(scenarioTitle), 
                tests: []
            };
            window.currentParsedExcelData.push(targetScenario); 
        }

        const isDuplicate = targetScenario.tests.some(existingTc => existingTc.id === testCaseData.id || existingTc.title === testCaseData.title);
        if (!isDuplicate) {
            targetScenario.tests.push(testCaseData);
            newlyAddedCount++;
        }
    });

    localStorage.setItem('parsedExcelData', JSON.stringify(window.currentParsedExcelData)); 
    window.updateStatusMessage(`Added ${newlyAddedCount} new test cases to your plan! Ready for code generation.`); 
    hideSuggestionsModal(); 
    window.actionButtonsDiv.style.display = 'block'; 
});