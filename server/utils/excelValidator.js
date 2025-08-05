// server/utils/excelValidator.js

/**
 * Validates the structure and essential content of the parsed Excel data.
 * Ensures all mandatory columns are present and critical fields are not empty.
 * @param {Array<string>} headers - The array of header names from the Excel sheet.
 * @param {Array<Array<string>>} dataRows - The array of data rows from the Excel sheet.
 * @throws {Error} If the schema validation fails.
 */
function validateExcelSchema(headers, dataRows) {
    const MANDATORY_HEADERS = [
        'Test Scenario',
        'Test Case Description',
        'Detail Steps',
        'Test Data',
        'Expected Result',
        'Testcase Priority'
    ];

    const trimmedHeaders = headers.map(h => typeof h === 'string' ? h.trim() : '');

    // 1. Check for all mandatory headers
    for (const mandatoryHeader of MANDATORY_HEADERS) {
        if (!trimmedHeaders.includes(mandatoryHeader)) {
            throw new Error(`❌ Excel schema error: Mandatory column '${mandatoryHeader}' not found in the header row. Please ensure all required headers are present and spelled correctly.`);
        }
    }

    const testScenarioColIndex = trimmedHeaders.indexOf('Test Scenario');
    const testCaseDescriptionColIndex = trimmedHeaders.indexOf('Test Case Description');
    const detailStepsColIndex = trimmedHeaders.indexOf('Detail Steps');
    const expectedResultColIndex = trimmedHeaders.indexOf('Expected Result');
    const testcasePriorityColIndex = trimmedHeaders.indexOf('Testcase Priority');

    // 2. Perform basic row-level validation for critical fields
    let hasAtLeastOneValidScenario = false;
    let lastValidScenarioTitle = null;

    for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const excelRowNumber = i + 2; // +1 for 0-indexed array, +1 for header row

        const rawScenarioTitle = row[testScenarioColIndex];
        const scenarioTitle = typeof rawScenarioTitle === 'string' ? rawScenarioTitle.trim() : '';

        // Determine current scenario title (handles merged cells or repeated values)
        let currentScenarioTitle = '';
        if (scenarioTitle !== '') {
            currentScenarioTitle = scenarioTitle;
            lastValidScenarioTitle = scenarioTitle;
        } else if (lastValidScenarioTitle !== null) {
            currentScenarioTitle = lastValidScenarioTitle;
        }

        // If after propagation, the scenario is still empty for a row, it's an issue for subsequent rows
        if (currentScenarioTitle === '') {
            console.warn(`⚠️ Warning: Excel Row ${excelRowNumber}: 'Test Scenario' column is empty and no preceding scenario was found. This row might be skipped or cause grouping issues if it's the start of a new scenario group.`);
        } else {
            hasAtLeastOneValidScenario = true;
        }

        const testCaseDescription = typeof row[testCaseDescriptionColIndex] === 'string' ? row[testCaseDescriptionColIndex].trim() : '';
        const detailSteps = typeof row[detailStepsColIndex] === 'string' ? row[detailStepsColIndex].trim() : '';
        const expectedResult = typeof row[expectedResultColIndex] === 'string' ? row[expectedResultColIndex].trim() : '';
        const testcasePriority = typeof row[testcasePriorityColIndex] === 'string' ? row[testcasePriorityColIndex].trim().toUpperCase() : '';

        // Validate crucial fields for each test case row
        if (testCaseDescription === '' && detailSteps === '' && expectedResult === '') {
            console.warn(`⚠️ Warning: Excel Row ${excelRowNumber}: All of 'Test Case Description', 'Detail Steps', and 'Expected Result' are empty. This row appears to be incomplete and may be ignored.`);
        }
        
        // Validate Testcase Priority value
        if (testcasePriority !== '' && !['P1', 'P2', 'P3'].includes(testcasePriority)) {
            throw new Error(`❌ Excel schema error: Row ${excelRowNumber}: 'Testcase Priority' column contains an invalid value '${testcasePriority}'. Accepted values are P1, P2, or P3.`);
        }
    }

    if (!hasAtLeastOneValidScenario && dataRows.length > 0) {
        throw new Error("❌ Excel schema error: No valid 'Test Scenario' titles were found in the Excel file. At least one scenario title must be present.");
    }

    console.log('✅ Excel schema validation passed successfully.');
    return true;
}

module.exports = { validateExcelSchema };