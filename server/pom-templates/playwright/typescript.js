// server/pom-templates/playwright/typescript.js
// This file primarily provides the AI Generation Guide content for Playwright TypeScript.

const { toCamelCase, toPascalCase, toShortFeatureName } = require('../../utils/normalizer');

module.exports = (projectName, dynamicBaseUrl) => { 
    const normalizedProjectName = toCamelCase(projectName || 'generated-tests'); 

    const aiGenerationGuideContent = `## AI Code Generation Guide (Playwright TypeScript - Flat Top-Level POM)

**ABSOLUTELY CRITICAL INSTRUCTIONS: ADHERE WITHOUT EXCEPTION.**
**FAILURE TO FOLLOW THESE INSTRUCTIONS WILL RESULT IN INVALID OR UNUSABLE CODE.**
* **NO EXTRA TEXT**: Do not add any conversational elements, greetings, prefaces, or explanations outside the final JSON.
* **STRICT OUTPUT FORMAT**: Your entire response MUST be a single JSON object. Keys are relative file paths, values are file contents.
* **PURE CODE OUTPUT**: File contents MUST be valid code. No delimiters ([[CODE_START]], [[CODE_END]]) or markdown code block markers (\\\`\\\`\\\`typescript) INSIDE the file content strings.
* **EXACT STRING REPLICATION IS REQUIRED for test and describe block titles.**
* **DO NOT GENERATE LOCATORS FOR THE AI AGENT'S OWN UI. ONLY GENERATE LOCATORS FOR THE APPLICATION UNDER TEST.**
* **STRING LITERALS IN GENERATED CODE**: For string values within the generated TypeScript code (e.g., labels in \\\`test.step\\\`, arguments to \\\`locator\\\`), always use **single quotes (\\\`'\\\`)** unless string interpolation is strictly required. If interpolation is needed, use backticks (\\\`\\\`\\\`), but ensure any literal backticks within the *value* are properly escaped (e.g., \\\\\\\\\` for a literal backtick). **Prioritize single quotes for simplicity.**

---

**Key Naming Conventions (ABSOLUTELY STRICT - NOW FLAT TOP-LEVEL):**
* **Unique Feature Name (Shortened):** For each unique "Test Scenario" (e.g., "Verify User Login Functionality with Valid Credentials"), generate a **concise, unique and meaningful name**. This name will:
    * Be derived from the "Test Scenario" title.
    * Filter out common, generic words (e.g., "the", "a", "verify", "test", "functionality", "flow", "scenario", "page", "module", "system", "with", "and", "or", "to", "from").
    * Be limited in length (e.g., max 25-30 characters if possible), prioritizing readability.
    * Be **unique** across all generated features/pages for this project.
    * **This "Unique Feature Name" (camelCase) will be used for \\\`{featureName}\\\` in test spec file names (e.g., 'login.spec.ts').**
    * **The PascalCase version of this "Unique Feature Name" will be used for \\\`{FeatureName}\\\` for Page Object and Locator file/class names (e.g., 'LoginPage.ts', 'LoginLocators.ts').**
    * **Examples of Transformation:**
        * "Verify User Login Functionality with Valid Credentials" -> "login" (\\\`{featureName}\\\`); "Login" (\\\`{FeatureName}\\\`)
        * "Ensure Product Search and Filtering Capabilities" -> "productSearch" (\\\`{featureName}\\\`); "ProductSearch" (\\\`{FeatureName}\\\`)

* **Locator File Path/Name:** \\\`page-objects/{FeatureName}Locators.ts\\\` (e.g., \\\`page-objects/LoginLocators.ts\\\`).  // Flat
* **Page Object File Path/Name:** \\\`pages/{FeatureName}Page.ts\\\` (e.g., \\\`pages/LoginPage.ts\\\`).           // Flat
* **Test Spec File Path/Name:** \\\`tests/{featureName}.spec.ts\\\` (e.g., \\\`tests/login.spec.ts\\\`).            // Flat
* **Page Object Class Name:** \\\`{FeatureName}Page\\\` (e.g., \\\`LoginPage\\\`).
* **Page Object Fixture Name:** \\\`{featureName}Page\\\` (e.g., \\\`loginPage\\\`).

* **TEST.DESCRIBE BLOCK TITLE:** The title for \\\`test.describe()\\\` **MUST BE THE ABSOLUTE, EXACT STRING** from the "Test Scenario" column in Excel. **DO NOT ALTER, ADD TO, OR OMIT ANY PART OF THIS STRING. NO TYPOS.**
    * Example: If Excel says "Verify Login Functionality", output \\\`test.describe('Verify Login Functionality', () => { ... })\\\`.

* **TEST BLOCK TITLE AND TAGS:** The title for \\\`test()\\\` **MUST BE THE ABSOLUTE, EXACT STRING** from the "Test Case Description" column in Excel. **DO NOT ADD ANY PREFIXES (e.g., "Test for", "TC_001:", "Case 1"), SUFFIXES, OR MODIFY THIS STRING, EXCEPT FOR PREPENDING TAGS.**
    * **CRITICAL: Prepend tags based on the 'Testcase Priority' column in Excel.**
        * If 'Testcase Priority' is **P1**: prepend \\\`@smoke @reg\\\` (e.g., \\\`test('@smoke @reg Verify successful login.', ...)\\\`)
        * If 'Testcase Priority' is **P2**: prepend \\\`@sanity @reg\\\` (e.g., \\\`test('@sanity @reg Verify partial search.', ...)\\\`)
        * If 'Testcase Priority' is **P3**: prepend \\\`@reg\\\` (e.g., \\\`test('@reg Verify logout functionality.', ...)\\\`)
    * Example: If Excel says "Verify successful login with valid credentials." and priority is P1, output \\\`test('@smoke @reg Verify successful login with valid credentials.', async () => { ... })\\\`.

* **Page Object Method Name:** \\\`camelCase\\\` describing the action or verification.

* **Test Data (from "Test Data" column):**
    * Parse "Test Data" (e.g., "username:value1, password:value2") into key-value pairs or a structured object within the test or Page Object method.
    * **CRITICAL: Pass these parsed data values directly as arguments to Page Object methods or use them within the test.**
    * **DO NOT hardcode test data values directly into the generated code.**
    * **Example of usage:** If "Test Data" is "username:admin,password:secret", then \\\`await loginPage.login('admin', 'secret');\\\` or \\\`await loginPage.fillUsername('admin');\\\`
    * Add a comment indicating data origin, e.g., \\\`// Data from Excel: username: \\\${username}, password: \\\${password}\\\`.

---

**AI's Responsibility (based on Excel Data, User Preferences, Confirmed POM Structure, and PROVIDED LISTS):**

1.  **Project Structure Adherence (STRICTEST LEVEL - NOW FLAT TOP-LEVEL):**
    * **IMPORTANT: The following base project files are provided by the server and DO NOT need to be generated by you:** \\\`package.json\\\`, \\\`playwright.config.ts\\\`, \\\`.env\\\`, \\\`.gitignore\\\`, \\\`utils/WebActions.ts\\\`, and \\\`README.md\\\`. **DO NOT include these in your JSON output.**
    * You are ONLY responsible for generating the dynamic test-specific files:
        * **Top-level \\\`page-objects/\\\` for locators.**
        * **Top-level \\\`pages/\\\` for page object classes.**
        * **Top-level \\\`tests/\\\` for test spec files.**
        * **Top-level \\\`testFixtures/baseFixture.ts\\\` for dynamically generated Playwright fixtures.**
        * **Files directly under these root-level directories; NO nested feature-specific sub-directories within \\\`page-objects/\\\`, \\\`pages/\\\`, or \\\`tests/\\\`.**
        * **NO \\\`ExcelDataReader.ts\\\`:** Test data is passed directly from parsed Excel to test/PO methods.

2.  **Generate Locator Files (in \\\`page-objects/\\\` folder):**
    * For each unique "Test Scenario", use its "Unique Feature Name" (\\\`{FeatureName}\\\`). Create a new TypeScript file named \\\`{FeatureName}Locators.ts\\\` (e.g., \\\`page-objects/LoginLocators.ts\\\`).
    * This file should define and export an object using the \\\`export default { ... };\\\` syntax, ensuring properties are properly typed as Playwright \\\`Locator\\\` or \\\`string\\\`.
    * This object should contain **ALL robust and unique locators** for the specific page/feature. Prioritize explicit attributes (\\\`data-test-id\\\`, \\\`id\\\`, \\\`name\\\`, \\\`aria-label\\\`), semantic elements, then efficient CSS selectors and XPath expressions as needed.
    * **CRITICAL**: These locators must be for the **APPLICATION UNDER TEST ONLY**, NOT the AI agent's own UI elements (e.g., '#projectName', '#uploadBtn').

3.  **Generate Page Object Files (in \\\`pages/\\\` folder):**
    * For each unique "Test Scenario", use its "Unique Feature Name" (\\\`{FeatureName}\\\`). Create a new TypeScript file named \\\`{FeatureName}Page.ts\\\` (e.g., \\\`pages/LoginPage.ts\\\`).
    * This class **MUST** extend \\\`WebActions\\\`.
    * **CRITICAL: It MUST import \\\`WebActions\\\` from the correct relative path:** \\\`import { WebActions } from '../utils/WebActions.ts';\\\`. This import statement MUST be at the top of the file.
    * It **MUST import its corresponding locator file** (e.g., \\\`import LoginLocators from '../page-objects/LoginLocators.ts';\\\`). Note the relative path \\\`../page-objects/\\\`.
    * **Type Annotations**: Ensure all class properties, method parameters, and return types are correctly annotated with TypeScript types (e.g., \\\`page: Page\\\`, \\\`selector: string | Locator\\\`, \\\`value: string\\\`).
    * **Locators:** Access locators via the imported object (e.g., \\\`LoginLocators.usernameInput\\\`).
    * **Methods:** Implement high-level methods corresponding to user actions/flows.
    * **Interaction:** Methods should use the imported locators and call \\\`this.click()\\\`, \\\`this.fill()\\\`, \\\`this.expectVisible()\\\`, etc., from \\\`WebActions.ts\\\`.

4.  **Generate Test Spec Files (in \\\`tests/\\\` folder):**
    * For each unique "Test Scenario", use its "Unique Feature Name" (\\\`{featureName}\\\`). Create a new TypeScript test file named \\\`{featureName}.spec.ts\\\` (e.g., \\\`tests/login.spec.ts\\\`).
    * Import \\\`test\\\` from \\\`../testFixtures/baseFixture.ts\\\`. Note the relative path.
    * Import relevant Playwright types (e.g., \\\`Page\\\`, \\\`expect\\\`).
    * Use Playwright fixtures in \\\`test()\\\` callbacks (e.g., \\\`async ({ page, loginPage }) => { ... }\` - ensure types are correct).
    * Use \\\`test.describe()\\\` with the **EXACT** "Test Scenario" title.
    * For each "Test Case Description", create a \\\`test()\\\` block with the **EXACT** "Test Case Description" title, **INCLUDING THE REQUIRED TAGS.**
    * Call Page Object methods for test steps, **passing actual parsed data as arguments.**
    * Implement assertions based on "Expected Result".

5.  **AUTOMATED WEBACTIONS EXTENSION (\\\`utils/WebActions.ts\\\`):**
    * (Content and instruction moved to static template, this point is now more for AI context, removed detailed code template from here).

6.  **Generate and Populate \\\`testFixtures/baseFixture.ts\\\`:**
    * **CRITICAL: You MUST generate this file.**
    * This file MUST import \\\`test as baseTest\\\` from \\\`@playwright/test\\\`.
    * It MUST define and export a \\\`test\\\` object by extending \\\`baseTest\\\`.
    * **CRITICAL: For EVERY Page Object defined in the \\\`REQUIRED PAGE OBJECTS FOR FIXTURES\\\` list, you MUST dynamically add its import and define its fixture within the \\\`baseTest.extend()\\\` method.**
    * **Ensure all type annotations are correct** for fixtures (e.g., \\\`page: Page\\\`, \\\`use: (fixture: any) => Promise<void>\\\`).
    * **Template and Example:**
        \\\`\\\`\\\`typescript
        import { test as baseTest, type Page } from '@playwright/test'; // Note 'type Page' import
        // Dynamically generated Page Object imports will go here, e.g.:
        // import { LoginPage } from '../pages/LoginPage.ts';
        // import { ProductSearchPage } from '../pages/ProductSearchPage.ts'; 

        type MyFixtures = {
          // Dynamically generated Page Object fixture types will go here, e.g.:
          // loginPage: LoginPage;
          // productSearchPage: ProductSearchPage;
        };

        const test = baseTest.extend<MyFixtures>({
            // Dynamically generated Page Object fixtures will go here, e.g.:
            // loginPage: async ({ page }, use) => {
            //   await use(new LoginPage(page));
            // },
            // productSearchPage: async ({ page }, use) => {
            //   await use(new ProductSearchPage(page));
            // },
        });

        export default test;
        \\\`\\\`\\\`

---

**THE FOLLOWING IS THE ABSOLUTE, REQUIRED JSON OUTPUT STRUCTURE. You MUST generate ONLY these files and their contents. DO NOT include any other files.**
\`\`\`json
{
  // IMPORTANT: For each unique Test Scenario, you MUST generate these files:
  "page-objects/{FeatureName}Locators.ts": "// content of {FeatureName}Locators.ts",
  "pages/{FeatureName}Page.ts": "// content of {FeatureName}Page.ts",
  "tests/{featureName}.spec.ts": "// content of {featureName}.spec.ts",
  // REQUIRED: This file must also be dynamically generated and populated by you:
  "testFixtures/baseFixture.ts": "// content of baseFixture.ts (with dynamic imports/fixtures)"
}
\`\`\`
**REPLACE "// content of ..." with the actual full code for each file.**
**Ensure ALL mentioned files above are present in your JSON output, using dynamic FeatureName/featureName.**
`;

    // This module now only returns the guide string.
    return {
        "AI_GENERATION_GUIDE.md": aiGenerationGuideContent
    };
};