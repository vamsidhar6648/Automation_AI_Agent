// server/templates/robotFrameworkProject.js
// This file contains the static, boilerplate content for a Robot Framework project.

const { toCamelCase } = require('../utils/normalizer'); 

module.exports = (projectName, dynamicBaseUrl) => {
    const normalizedProjectName = toCamelCase(projectName || 'generated-tests');

    return {
        "package.json": `{
    "name": "${normalizedProjectName}-robotframework",
    "version": "1.0.0",
    "description": "AI Generated Robot Framework Tests for ${projectName}",
    "scripts": {
        "robot:run": "robot --outputdir ./results --logtitle 'Test Log' --reporttitle 'Test Report' tests",
        "test": "npm run robot:run",
        "robot:smoke": "robot --include smoke --outputdir ./results --logtitle 'Smoke Test Log' --reporttitle 'Smoke Test Report' tests",
        "robot:reg": "robot --include reg --outputdir ./results --logtitle 'Regression Test Log' --reporttitle 'Regression Test Report' tests",
        "robot:sanity": "robot --include sanity --outputdir ./results --logtitle 'Sanity Test Log' --reporttitle 'Sanity Test Report' tests"
    },
    "keywords": [
        "ai",
        "automation",
        "testing",
        "robotframework",
        "generated"
    ],
    "author": "AI Testflow Agent",
    "license": "ISC",
    "devDependencies": {
        // No direct JS devDependencies for Robot Framework runtime, but you might add tools like 'npm-run-all'
        "dotenv": "^16.4.5"
    }
}`,
        // Robot Framework does not have a central 'robot.config.js' like Playwright or Cypress.
        // Configuration is typically done via command-line arguments or environment variables.
        // Or, if using Python virtual environments, via pyproject.toml / setup.py.

        ".env": `BASE_URL=${dynamicBaseUrl}
# You can add other environment variables here, e.g.,
# USERNAME=your_app_username
# PASSWORD=your_app_password`,
        ".gitignore": `__pycache__/
*.pyc
*.log
*.html
*.xml
*.png
.env
results/
venv/ # Python virtual environment`,

        "requirements.txt": `robotframework
robotframework-seleniumlibrary
# Add other libraries as needed, e.g.,
# robotframework-requests
# robotframework-httplibrary`,

        "README.md": `
# ${normalizedProjectName} - AI Generated Automation Tests (Robot Framework)

This project contains AI-generated Robot Framework tests for your application, based on the test scenarios you provided.

## Getting Started

Follow these steps to set up and run your tests:

### 1. Open in VS Code

This project should have opened automatically in VS Code. If not, navigate to the project directory you specified (e.g., \`${dynamicBaseUrl.substring(0, dynamicBaseUrl.lastIndexOf('/')) + '/' + normalizedProjectName}\`) and open it manually.

### 2. Set up Python Virtual Environment (Recommended)

Robot Framework is based on Python. It's best practice to use a virtual environment.

Open the Integrated Terminal in VS Code (Terminal > New Terminal) and run:

\`\`\`bash
python -m venv venv
\`\`\`

### 3. Activate Virtual Environment

* **On Windows:**
    \`\`\`bash
    .\\venv\\Scripts\\activate
    \`\`\`
* **On macOS / Linux:**
    \`\`\`bash
    source venv/bin/activate
    \`\`\`

### 4. Install Dependencies

With the virtual environment activated, install Robot Framework and its libraries:

\`\`\`bash
pip install -r requirements.txt
\`\`\`

### 5. Configure Base URL (Optional but Recommended)

If your application's URL changes, or if you want to run tests against different environments, update the \`BASE_URL\` in the \`.env\` file:

\`\`\`dotenv
BASE_URL=${dynamicBaseUrl}
\`\`\`
You can access this in your Robot Framework tests using \`\${BASE_URL}\` after loading environment variables (e.g., with a custom keyword or library).

### 6. Run Your Tests

You can now run your tests using the following commands in the VS Code terminal (ensure your virtual environment is active):

* **Run all tests:**
    \`\`\`bash
    npm run robot:run
    \`\`\`
    (This runs: \`robot --outputdir ./results --logtitle 'Test Log' --reporttitle 'Test Report' tests\`)

* **Run specific test tags:**
    * **Smoke tests:**
        \`\`\`bash
        npm run robot:smoke
        \`\`\`
    * **Regression tests:**
        \`\`\`bash
        npm run robot:reg
        \`\`\`
    * **Sanity tests:**
        \`\`\`bash
        npm run robot:sanity
        \`\`\`

### 7. View Test Reports

After running tests, reports (log.html, report.html, output.xml) will be generated in the \`results/\` directory within your project. Open \`report.html\` in your browser to see the detailed report.

Happy Testing!
`
    };
};