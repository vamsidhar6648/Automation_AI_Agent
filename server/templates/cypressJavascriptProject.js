// server/templates/cypressJavascriptProject.js
// This file contains the static, boilerplate content for a Cypress JavaScript project.

const { toCamelCase } = require('../utils/normalizer'); 

module.exports = (projectName, dynamicBaseUrl) => {
    const normalizedProjectName = toCamelCase(projectName || 'generated-tests');

    return {
        "package.json": `{
    "name": "${normalizedProjectName}",
    "version": "1.0.0",
    "description": "AI Generated Cypress Tests for ${projectName} (JavaScript)",
    "main": "index.js",
    "scripts": {
        "cypress:open": "cypress open",
        "cypress:run": "cypress run",
        "test": "cypress run",
        "test:headed": "cypress run --headed",
        "smoke": "cypress run --env TAGS='@smoke'",
        "reg": "cypress run --env TAGS='@reg'",
        "sanity": "cypress run --env TAGS='@sanity'"
    },
    "keywords": [
        "ai",
        "automation",
        "testing",
        "cypress",
        "javascript",
        "pom",
        "generated"
    ],
    "author": "AI Testflow Agent",
    "license": "ISC",
    "devDependencies": {
        "cypress": "^13.8.1",
        "dotenv": "^16.4.5"
    }
}`,
        "cypress.config.js": `const { defineConfig } = require("cypress");
require('dotenv').config();

module.exports = defineConfig({
  e2e: {
    baseUrl: process.env.BASE_URL || '${dynamicBaseUrl}',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: false, // You can create a support file if needed
    setupNodeEvents(on, config) {
      // implement node event listeners here
      // For filtering tests by tags, you might need a plugin like cypress-grep
      // e.g. require('cypress-grep/src/plugin')(config);
      return config;
    },
  },
});`,
        ".env": `BASE_URL=${dynamicBaseUrl}
# You can add other environment variables here, e.g.,
# USERNAME=your_app_username
# PASSWORD=your_app_password`,
        ".gitignore": `node_modules/
cypress/videos/
cypress/screenshots/
cypress/reports/
.env`,

        // No WebActions or baseFixture for Cypress, as commands are global (cy.*)
        // and Page Objects are imported directly.

        "README.md": `
# ${normalizedProjectName} - AI Generated Automation Tests (Cypress JavaScript)

This project contains AI-generated Cypress tests for your application, based on the test scenarios you provided.

## Getting Started

Follow these steps to set up and run your tests:

### 1. Open in VS Code

This project should have opened automatically in VS Code. If not, navigate to the project directory you specified (e.g., \`${dynamicBaseUrl.substring(0, dynamicBaseUrl.lastIndexOf('/')) + '/' + normalizedProjectName}\`) and open it manually.

### 2. Install Dependencies

Open the Integrated Terminal in VS Code (Terminal > New Terminal) and run the following command to install the necessary Node.js packages:

\`\`\`bash
npm install
\`\`\`

### 3. Run Your Tests

Cypress tests can be run in two modes: interactive (opening the Cypress Test Runner UI) or headless (running in the command line).

* **Open Cypress Test Runner (interactive):**
    \`\`\`bash
    npm run cypress:open
    \`\`\`
    This will open the Cypress Test Runner, where you can select and run tests, and see them execute in a browser.

* **Run all tests (headless):**
    \`\`\`bash
    npm run cypress:run
    \`\`\`
    or simply:
    \`\`\`bash
    npm test
    \`\`\`
    This will execute all tests in a headless browser and provide results in the terminal.

* **Run all tests (with browser UI - headed):**
    \`\`\`bash
    npm run test:headed
    \`\`\`

* **Run specific test tags:**
    * **Note:** For Cypress to filter by tags (like \`@smoke\`, \`@reg\`, \`@sanity\`), you typically need a plugin like \`cypress-grep\`. You might need to install it (\`npm install -D cypress-grep\`) and configure it in \`cypress.config.js\` and \`cypress/support/e2e.js\`. The commands below assume you've set up such a plugin, usually by setting an environment variable \`TAGS\`.
    * **Smoke tests:**
        \`\`\`bash
        npm run smoke
        \`\`\`
    * **Regression tests:**
        \`\`\`bash
        npm run reg
        \`\`\`
    * **Sanity tests:**
        \`\`\`bash
        npm run sanity
        \`\`\`

Happy Testing!
`
    };
};