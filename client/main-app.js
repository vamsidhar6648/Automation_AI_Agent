// client/main-app.js

// 🚫 Prevent running from file:// directly
if (location.protocol === 'file:') {
    alert('🚫 Please run the app using: npm start\n\nOpen it via http://localhost:3000 — not by double-clicking index.html');
    document.body.innerHTML = '<h2 style="color:red;text-align:center;margin-top:50px;">❌ App must be run from http://localhost:3000</h2>';
    throw new Error('Blocked usage from file://');
}

// Ensure utils are loaded before main-app (handled by script tag order in index.html)
// window.toCamelCase and window.toShortFeatureName are set in utils.js

// --- Global Elements (Declared as const, then exposed to window) ---
const statusDiv = document.getElementById('status');
const excelUploadInput = document.getElementById('excelUpload');
const uploadBtn = document.getElementById('uploadBtn');
const actionButtonsDiv = document.getElementById('actionButtons'); 
const generateCodeBtn = document.getElementById('generateCodeBtn');
const openInVsCodeBtn = document.getElementById('openInVsCodeBtn');
const downloadUpdatedExcelBtn = document.getElementById('downloadUpdatedExcelBtn'); 

const projectNameInput = document.getElementById('projectName');
const toolSelect = document.getElementById('toolSelect'); 
const languageSelect = document.getElementById('languageSelect'); 
const outputPathInput = document.getElementById('outputPath'); 

// Expose core elements to global scope for other modules (like ai-suggestions-ui.js)
window.statusDiv = statusDiv; 
window.excelUploadInput = excelUploadInput; 
window.uploadBtn = uploadBtn; 
window.actionButtonsDiv = actionButtonsDiv; 
window.generateCodeBtn = generateCodeBtn; 
window.openInVsCodeBtn = openInVsCodeBtn; 
window.downloadUpdatedExcelBtn = downloadUpdatedExcelBtn; 
window.projectNameInput = projectNameInput; 
window.toolSelect = toolSelect; 
window.languageSelect = languageSelect; 
window.outputPathInput = outputPathInput; 


// --- Global State Variables ---
let currentSelectedFile = null; 
let currentParsedExcelData = []; 
window.currentParsedExcelData = currentParsedExcelData; 


/**
 * Disables or enables all interactive buttons and inputs on the main page.
 * (Modal-specific buttons handled by ai-suggestions-ui.js)
 * @param {boolean} disabled - True to disable, false to enable.
 */
function setButtonsDisabled(disabled) {
    const elementsToDisable = [
        window.uploadBtn, window.generateCodeBtn, window.openInVsCodeBtn, 
        window.downloadUpdatedExcelBtn, window.aiSuggestionsBtn, 
        window.excelUploadInput, window.projectNameInput, window.outputPathInput, 
        window.toolSelect, window.languageSelect
    ];
    elementsToDisable.forEach(el => {
        if (el) el.disabled = disabled;
    });
}
window.setButtonsDisabled = setButtonsDisabled; 


/**
 * Updates the status message displayed on the main page.
 * @param {string} label - The message to display.
 * @param {boolean} [isIndeterminate=false] - True for an ongoing process message.
 */
function updateStatusMessage(label, isIndeterminate = false) {
    window.statusDiv.textContent = `Status: ${label}${isIndeterminate ? ' ⏳' : ''}`; 
}
window.updateStatusMessage = updateStatusMessage; 


/**
 * Resets the main UI elements to their initial state for a new upload.
 */
function resetStatus(statusMessage = 'Ready', isError = false) {
    window.statusDiv.innerHTML = `Status: ${isError ? '<p style="color:red;">' : ''}${statusMessage}${isError ? '</p>' : ''}`; 
}
window.resetStatus = resetStatus; 


/**
 * Resets the entire UI to its initial state, clearing stored data.
 * (Called on page load and when initiating a new upload flow)
 */
function resetUIForNewUpload() {
    window.actionButtonsDiv.style.display = 'none'; 
    window.openInVsCodeBtn.style.display = 'none'; 
    window.downloadUpdatedExcelBtn.style.display = 'none'; 

    window.resetStatus('Ready', false); 
    localStorage.removeItem('parsedExcelData');
    localStorage.removeItem('projectFullPath'); 
    window.excelUploadInput.value = ''; 
    currentSelectedFile = null; 
    window.currentParsedExcelData = []; 
    
    if (window.hideSuggestionsModal) { 
        window.hideSuggestionsModal(); 
    }
    window.setButtonsDisabled(false); 
}
window.resetUIForNewUpload = resetUIForNewUpload; 


/**
 * Initializes the main UI state on page load.
 */
function initializeUI() {
    window.actionButtonsDiv.style.display = 'none'; 
    window.openInVsCodeBtn.style.display = 'none'; 
    window.downloadUpdatedExcelBtn.style.display = 'none'; 
    
    if (window.suggestionsModal) { 
      window.suggestionsModal.style.display = 'none';
    }


    window.resetStatus('Ready', false); 
    window.projectNameInput.value = localStorage.getItem('projectName') || 'generated-tests';
    window.toolSelect.value = localStorage.getItem('selectedTool') || 'playwright';
    window.languageSelect.value = localStorage.getItem('selectedLanguage') || 'javascript';
    window.outputPathInput.value = localStorage.getItem('outputPath') || ''; 

    window.setButtonsDisabled(false); 
}

/**
 * Adds a ripple effect to clicked buttons.
 * @param {Event} event - The click event.
 */
function addRippleEffect(event) {
    const button = event.currentTarget;
    const ripple = document.createElement('span');
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;

    ripple.style.width = ripple.style.height = `${diameter}px`;
    ripple.style.left = `${event.clientX - button.getBoundingClientRect().left - radius}px`;
    ripple.style.top = `${event.clientY - button.getBoundingClientRect().top - radius}px`;
    ripple.classList.add('ripple');

    const existingRipple = button.querySelector('.ripple');
    if (existingRipple) {
        existingRipple.remove(); 
    }

    button.appendChild(ripple);
}
window.addRippleEffect = addRippleEffect; 


// --- Initialization on page load ---
initializeUI(); 

// --- Event Listeners for Main App Flow ---

window.excelUploadInput.addEventListener('change', (event) => {
    if (event.target.files.length > 0) {
        currentSelectedFile = event.target.files[0];
        window.updateStatusMessage(`File chosen: ${currentSelectedFile.name}. Click Upload Excel to parse.`);
        window.actionButtonsDiv.style.display = 'none'; 
        window.openInVsCodeBtn.style.display = 'none'; 
        window.downloadUpdatedExcelBtn.style.display = 'none'; 
        window.resetStatus('File selected. Ready for upload.');
    } else {
        currentSelectedFile = null;
        window.updateStatusMessage('No file chosen.');
        window.resetUIForNewUpload(); // FIX: Corrected typo from resetUIForNewNewUpload to resetUIForNewUpload
    }
});


window.uploadBtn.addEventListener('click', async () => {
    window.setButtonsDisabled(true); 
    window.updateStatusMessage('Uploading Excel file...');

    const projectName = window.projectNameInput.value.trim();
    const selectedTool = window.toolSelect.value;
    const selectedLanguage = window.languageSelect.value;
    const outputPath = window.outputPathInput.value.trim(); 

    localStorage.setItem('projectName', projectName);
    localStorage.setItem('selectedTool', selectedTool);
    localStorage.setItem('selectedLanguage', selectedLanguage);
    localStorage.setItem('outputPath', outputPath); 

    if (!currentSelectedFile) { 
        window.resetStatus('Please choose an Excel file to upload.', true);
        window.setButtonsDisabled(false);
        return;
    }
    if (!projectName) {
        window.resetStatus('Please enter a project name before uploading.', true);
        window.setButtonsDisabled(false);
        return;
    }
    if (!outputPath) { 
        window.resetStatus('Please enter an Output Directory. This field is now required.', true);
        window.setButtonsDisabled(false);
        return;
    }


    const formData = new FormData();
    formData.append('excel', currentSelectedFile);
    formData.append('projectName', projectName);
    formData.append('tool', selectedTool);
    formData.append('language', selectedLanguage);
    formData.append('outputPath', outputPath); 

    try {
        const res = await fetch('/upload-excel', { 
            method: 'POST',
            body: formData
        });

        const { success, data, error } = await window.handleApiResponse(res, 'Excel parsed successfully. Ready for AI generation. 🎉', 'Excel upload failed'); 

        if (success) { 
            window.currentParsedExcelData = data.parsedExcelData; 
            localStorage.setItem('parsedExcelData', JSON.stringify(window.currentParsedExcelData)); 
            
            window.actionButtonsDiv.style.display = 'block'; 
            window.updateStatusMessage('Excel parsed successfully. Ready for AI generation or suggestions.');
        } else {
            console.error("Upload failed with error:", error);
            window.resetUIForNewUpload(); 
        }

    } catch (err) {
        console.error('🔥 Client-side fetch error during Excel upload:', err);
        window.resetStatus(`Network error during Excel upload: ${err.message}. Ensure the backend server is running and accessible.`, true);
        window.resetUIForNewUpload(); 
    } finally {
        window.setButtonsDisabled(false); 
    }
});


window.generateCodeBtn.addEventListener('click', async () => {
    window.setButtonsDisabled(true); 
    window.updateStatusMessage("Chill bro, it's generating... 🤖 This might take a moment!", true); 

    const projectName = localStorage.getItem('projectName'); 
    const selectedTool = localStorage.getItem('selectedTool');
    const selectedLanguage = localStorage.getItem('selectedLanguage');
    const outputPath = localStorage.getItem('outputPath'); 

    if (!outputPath) { 
        window.resetStatus('Output Directory is missing. Please provide it and re-upload Excel.', true);
        window.setButtonsDisabled(false);
        return;
    }

    if (!projectName || !window.currentParsedExcelData || !selectedTool || !selectedLanguage) { 
        window.resetStatus('Missing necessary data. Please upload an Excel file first.', true);
        window.setButtonsDisabled(false);
        return;
    }

    console.log('📡 Sending request to /generate-from-json');

    try {
        const res = await fetch('/generate-from-json', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                testData: window.currentParsedExcelData, 
                projectName,
                tool: selectedTool,
                language: selectedLanguage,
                outputPath 
            })
        });

        const { success, data, error } = await window.handleApiResponse(res, 'Code generated and saved to server! ✨', 'Code generation failed'); 

        if (success) {
            if (data.projectFullPath) {
                localStorage.setItem('projectFullPath', data.projectFullPath); 
                console.log('DEBUG: projectFullPath stored in localStorage:', data.projectFullPath);
            } else {
                console.warn('WARNING: Server did not return projectFullPath after generation.');
                window.resetStatus('Code generated, but project path not returned. Please check server logs.', true);
            }
            
            window.openInVsCodeBtn.style.display = 'inline-block'; 
            window.downloadUpdatedExcelBtn.style.display = 'inline-block'; 
            window.resetStatus('Code generated and saved to server! ✨', false); 
        } else {
            console.error("Code generation failed with error:", error);
            window.resetUIForNewUpload(); 
        }
    } catch (err) {
        console.error('🔥 Client-side fetch error during code generation:', err);
        window.resetStatus(`Network error during code generation: ${err.message}. Ensure the backend server is running.`, true);
        window.resetUIForNewUpload(); 
    } finally {
        window.setButtonsDisabled(false); 
    }
});


window.openInVsCodeBtn.addEventListener('click', async () => {
    window.setButtonsDisabled(true); 
    window.updateStatusMessage('Attempting to open VS Code... (Check your OS for security prompts) 🚀', true);

    const projectName = localStorage.getItem('projectName'); 
    const projectFullPath = localStorage.getItem('projectFullPath'); 
    
    if (!projectName || !projectFullPath) { 
        window.resetStatus('Project path or name not found. Generate code first.', true);
        window.setButtonsDisabled(false);
        return;
    }

    try {
        const res = await fetch('/open-in-vscode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectName, projectFullPath }) 
        });

        const { success, error } = await window.handleApiResponse(res, `VS Code open command sent for project '${projectName}'. Check your desktop.`, 'Failed to open VS Code'); 

        if (success) {
            window.resetStatus(`VS Code open command sent for project '${projectName}'. Check your desktop.`, false);
        } else {
            console.error("Open VS Code failed with error:", error);
        }

    } catch (err) {
        console.error('🔥 Client-side error opening VS Code:', err);
        window.resetStatus(`Network error opening VS Code: ${err.message}. Ensure the backend server is running.`, true);
    } finally {
        window.setButtonsDisabled(false); 
    }
});


// NEW: Download Updated Excel button listener
window.downloadUpdatedExcelBtn.addEventListener('click', async () => {
    window.setButtonsDisabled(true);
    window.updateStatusMessage('Preparing updated Excel for download... 📊');

    const projectName = window.projectNameInput.value.trim();
    const parsedExcelData = window.currentParsedExcelData; 

    if (!projectName || !parsedExcelData || parsedExcelData.length === 0) {
        window.resetStatus('No test data to download. Please upload an Excel and/or add suggestions.', true);
        window.setButtonsDisabled(false);
        return;
    }

    try {
        const res = await fetch('/download-excel', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectName: projectName,
                testData: parsedExcelData 
            })
        });

        if (!res.ok) {
            const msg = await res.text();
            console.error('❌ Excel download failed on server:', msg);
            window.resetStatus(`Excel creation failed: ${msg.substring(0, 100)}${msg.length > 100 ? '...' : ''}`, true);
            return;
        }

        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${projectName}_updated_testcases.xlsx`; 
        document.body.appendChild(a);

        a.click();

        window.updateStatusMessage('Updated Excel download initiated! ✅', false);

        a.remove();
        URL.revokeObjectURL(a.href);

    } catch (err) {
        console.error('🔥 Client-side Excel Download Error:', err);
        window.resetStatus(`Excel download failed: ${err.message}.`, true);
    } finally {
        window.setButtonsDisabled(false);
    }
});


// Attach ripple effect to all relevant buttons
[window.uploadBtn, window.generateCodeBtn, window.openInVsCodeBtn, window.downloadUpdatedExcelBtn].forEach(button => { 
    if (button) {
        button.addEventListener('click', window.addRippleEffect); 
    }
});

// The following elements and their event listeners are now in ai-suggestions-ui.js
// aiSuggestionsBtn, suggestionsModal, closeModalButton, addSelectedBtn, leavePageBtn, suggestionsListDiv

// The following global functions were moved from here but are used by ai-suggestions-ui.js:
// showSuggestionsModal, hideSuggestionsModal, displaySuggestionsInModal, renderSingleScenarioSuggestions, recheckSelectedCheckboxes
// window.toCamelCase, window.toShortFeatureName (these are in utils.js)

initializeUI(); // Initialize the UI when the script runs