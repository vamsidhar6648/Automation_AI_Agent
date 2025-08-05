// server/templates/playwrightPythonProject.js
// This file contains the static, boilerplate content for a Playwright Python project (pytest).

const { toCamelCase } = require('../utils/normalizer'); 

module.exports = (projectName, dynamicBaseUrl) => {
    const normalizedProjectName = toCamelCase(projectName || 'generated-tests');

    return {
        "requirements.txt": `pytest
pytest-playwright
python-dotenv
# Add other Python packages as needed`,

        "conftest.py": `import pytest
import os
from playwright.sync_api import Page, Playwright, sync_playwright, expect
from dotenv import load_dotenv

load_dotenv() # Load environment variables from .env

@pytest.fixture(scope="session")
def playwright_instance():
    """Provides a Playwright instance for the session."""
    with sync_playwright() as p:
        yield p

@pytest.fixture(scope="function")
def page(playwright_instance: Playwright) -> Page:
    """Provides a Page object for each test function."""
    browser_name = os.getenv('BROWSER_NAME', 'chromium').lower()
    headless = os.getenv('HEADLESS', 'true').lower() == 'true'

    if browser_name == "chromium":
        browser = playwright_instance.chromium.launch(headless=headless)
    elif browser_name == "firefox":
        browser = playwright_instance.firefox.launch(headless=headless)
    elif browser_name == "webkit":
        browser = playwright_instance.webkit.launch(headless=headless)
    else:
        raise ValueError(f"Unsupported browser: {browser_name}")

    context = browser.new_context()
    page = context.new_page()
    page.goto(os.getenv('BASE_URL', '${dynamicBaseUrl}')) # Navigate to base URL from .env or fallback
    yield page
    
    # Teardown: Close browser and context
    page.close()
    context.close()
    browser.close()

# You can add more custom fixtures here if needed (e.g., login fixture)
`,
        "pytest.ini": `[pytest]
addopts = --html=results/report.html --self-contained-html --browser=${os.getenv('BROWSER_NAME', 'chromium')} --headless=${os.getenv('HEADLESS', 'true')}
python_files = test_*.py
python_classes = Test*
python_functions = test_*
log_cli = true
log_cli_level = INFO
log_file = results/pytest.log
log_file_level = INFO
log_file_date_format = %Y-%m-%d %H:%M:%S
log_file_format = %(asctime)s [%(levelname)s] %(message)s
testpaths = tests/`,

        ".env": `BASE_URL=${dynamicBaseUrl}
# Define the browser to use (chromium, firefox, webkit). Defaults to chromium.
# BROWSER_NAME=chromium 
# Run in headless mode (true/false). Defaults to true.
# HEADLESS=true
# You can add other environment variables here, e.g.,
# USERNAME=your_app_username
# PASSWORD=your_app_password`,

        ".gitignore": `__pycache__/
.pytest_cache/
venv/
*.pyc
*.log
*.html
*.xml
*.png
.env
results/
playwright-report/ # Playwright's default report dir if run directly (this is now a .gitignore comment)
`,

        "README.md": `
# ${normalizedProjectName} - AI Generated Automation Tests (Playwright Python - Pytest)

This project contains AI-generated Playwright tests written in Python using Pytest, based on the test scenarios you provided.

## Getting Started

Follow these steps to set up and run your tests:

### 1. Open in VS Code

This project should have opened automatically in VS Code. If not, navigate to the project directory you specified and open it manually.

### 2. Set up Python Virtual Environment (Recommended)

Python automation projects benefit greatly from virtual environments to manage dependencies.

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

With the virtual environment activated, install Playwright, Pytest, and other necessary libraries:

\`\`\`bash
pip install -r requirements.txt
\`\`\`

### 5. Install Playwright Browsers

Playwright needs its browser binaries. Run this command in the terminal (ensure your virtual environment is active):

\`\`\`bash
playwright install
\`\`\`
This will install Chromium, Firefox, and WebKit browsers.

### 6. Configure Base URL and Browser (Optional but Recommended)

If your application's URL changes, or if you want to run tests against different environments or use a different browser (e.g., headless/headed mode), update the \`.env\` file:

\`\`\`dotenv
BASE_URL=${dynamicBaseUrl}
BROWSER_NAME=chromium # or firefox, webkit
HEADLESS=true # set to false for headed mode
\`\`\`
These environment variables are used by \`conftest.py\` to configure the browser for your tests.

### 7. Run Your Tests

Navigate to the project root directory in your terminal (ensure your virtual environment is active) and run tests using Pytest.

* **Run all tests (headless by default):**
    \`\`\`bash
    pytest
    \`\`\`

* **Run all tests (headed):**
    \`\`\`bash
    pytest --headed
    \`\`\`

* **Run tests with specific tags:**
    Pytest uses \`@pytest.mark.<tagname>\` for tagging. You can filter tests using the \`-m\` flag.

    * **Run Smoke tests:**
        \`\`\`bash
        pytest -m smoke
        \`\`\`
    * **Run Regression tests:**
        \`\`\`bash
        pytest -m reg
        \`\`\`
    * **Run Sanity tests:**
        \`\`\`bash
        pytest -m sanity
        \`\`\`
    * **Run tests with multiple tags (AND logic):**
        \`\`\`bash
        pytest -m "smoke and reg"
        \`\`\`
    * **Run tests with multiple tags (OR logic):**
        \`\`\`bash
        pytest -m "smoke or sanity"
        \`\`\`

### 8. View Test Reports

Pytest can generate various report formats using command-line flags, as configured in \`pytest.ini\`. After running tests:
* **HTML report:** Open \`results/report.html\` in your browser.
* **Console logs:** Check \`results/pytest.log\` for detailed test run logs.

Happy Testing!
`
    };
};