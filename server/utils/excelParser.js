// server/utils/excelParser.js
const XLSX = require('xlsx');
const { toCamelCase, toShortFeatureName } = require('./normalizer');
const { validateExcelSchema } = require('./excelValidator');

/**
 * Parses an Excel file into a structured JSON format, grouping test cases by scenario.
 * It expects a 'Test Scenario' column to group test cases.
 *
 * @param {string} filePath - The path to the Excel file (.xlsx, .xls).
 * @returns {Promise<Map<string, Object>>} A promise that resolves to a Map of scenario objects, keyed by shortFeatureName.
 * @throws {Error} If the Excel file cannot be read, schema validation fails, or processing encounters issues.
 */
async function parseExcelToJSON(filePath) {
    let workbook;
    try {
        workbook = XLSX.readFile(filePath);
    } catch (readError) {
        throw new Error(`❌ Excel parsing error: Could not read file at ${filePath}. Ensure it's a valid Excel file and not corrupted. Details: ${readError.message}`);
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
        throw new Error("❌ Excel parsing error: No sheets found in the Excel file.");
    }
    const sheet = workbook.Sheets[sheetName];

    // Read as array of arrays, assuming first row is headers
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

    if (rows.length === 0) {
        console.warn('⚠️ Excel file is empty.');
        return new Map(); // Return empty Map
    }

    const headers = rows[0];
    if (!headers || headers.length === 0) {
        throw new Error("❌ Excel parsing error: Header row is empty. Please ensure your Excel has headers.");
    }

    const dataRows = rows.slice(1);

    // --- Validate schema before processing data ---
    validateExcelSchema(headers, dataRows);
    // --- END NEW ---

    const trimmedHeaders = headers.map(h => typeof h === 'string' ? h.trim() : '');

    const testScenarioColIndex = trimmedHeaders.findIndex(header => header === 'Test Scenario');
    // Find index of the new 'Testcase Priority' column
    const testcasePriorityColIndex = trimmedHeaders.findIndex(header => header === 'Testcase Priority');


    const groupedMap = new Map(); // Use a Map for direct lookup by shortFeatureName
    let lastValidScenarioTitle = null;

    for (const [rowIndex, rowArray] of dataRows.entries()) {
        const excelRowNumber = rowIndex + 2;

        const rawScenarioTitleCellContent = rowArray[testScenarioColIndex];
        let determinedScenarioTitle = '';

        if (typeof rawScenarioTitleCellContent === 'string' && rawScenarioTitleCellContent.trim() !== '') {
            determinedScenarioTitle = rawScenarioTitleCellContent.trim();
            lastValidScenarioTitle = determinedScenarioTitle;
        } else if (lastValidScenarioTitle !== null) {
            determinedScenarioTitle = lastValidScenarioTitle;
        } else {
            console.warn(`⚠️ Skipping Excel Row ${excelRowNumber}: 'Test Scenario' column is empty and no preceding scenario was defined. This row cannot be grouped.`);
            continue;
        }

        if (determinedScenarioTitle === '') {
            console.error(`❌ CRITICAL ERROR: Excel Row ${excelRowNumber}: Determined scenario title is empty after propagation/determination. This row will be skipped.`);
            continue;
        }

        const pageCamelCaseName = toCamelCase(determinedScenarioTitle);
        const shortFeatureName = toShortFeatureName(determinedScenarioTitle);

        if (pageCamelCaseName === '') {
            console.error(`❌ CRITICAL ERROR: Excel Row ${excelRowNumber}: Failed to generate a valid camelCase page name from scenario title "${determinedScenarioTitle}". This row will be skipped.`);
            continue;
        }

        if (!groupedMap.has(shortFeatureName)) {
            groupedMap.set(shortFeatureName, {
                page: pageCamelCaseName,
                scenario: determinedScenarioTitle,
                shortFeatureName: shortFeatureName,
                tests: [],
            });
        }

        const rowObject = {};
        trimmedHeaders.forEach((header, index) => {
            rowObject[header] = rowArray[index] !== undefined && rowArray[index] !== null ? String(rowArray[index]).trim() : '';
        });

        // Add the new 'Testcase Priority' field to the test case object
        const testcasePriority = rowObject['Testcase Priority'] ? rowObject['Testcase Priority'].toUpperCase() : '';

        groupedMap.get(shortFeatureName).tests.push({
            id: rowObject['Test Case ID'] || '',
            title: rowObject['Test Case Description'] || `Test for ${determinedScenarioTitle} - Case ${groupedMap.get(shortFeatureName).tests.length + 1}`,
            description: rowObject['Test Case Description'] || '',
            steps: (rowObject['Detail Steps'] || '').split('\n').map(s => s.trim()).filter(Boolean),
            data: rowObject['Test Data'] || '',
            expected: rowObject['Expected Result'] || '',
            priority: testcasePriority
        });
    }

    if (groupedMap.size === 0) {
        console.warn('No scenarios were successfully parsed and grouped from the Excel file. Please ensure data is correctly formatted and the "Test Scenario" column is populated.');
    }

    return groupedMap;
}

module.exports = { parseExcelToJSON };