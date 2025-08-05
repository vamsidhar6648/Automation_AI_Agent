// server/templates/seleniumPythonProject.js
// This file contains the static, boilerplate content for a Selenium Python project (pytest).

const { toCamelCase } = require('../utils/normalizer'); 

module.exports = (projectName, dynamicBaseUrl) => {
    const normalizedProjectName = toCamelCase(projectName || 'generated-tests');

    return {
        "requirements.txt": `selenium
pytest
python-dotenv
webdriver-manager
# Add other Python packages as needed`,

        "conftest.py": `import pytest
from selenium.webdriver.remote.webdriver import WebDriver
from utils.driver_setup import get_driver, quit_driver

@pytest.fixture(scope="function")
def driver():
    """
    Sets up and tears down the Selenium WebDriver for each test function.
    """
    _driver: WebDriver = get_driver()
    yield _driver
    quit_driver(_driver)

# You can add more fixtures here if needed (e.g., for test data, logging)
`,
        "utils/driver_setup.py": `import os
from selenium import webdriver
from selenium.webdriver.remote.webdriver import WebDriver
from webdriver_manager.chrome import ChromeDriverManager
from webdriver_manager.firefox import GeckoDriverManager
from webdriver_manager.microsoft import EdgeChromiumDriverManager # For Edge
from webdriver_manager.core.utils import ChromeType # For Brave/Opera/Chromium specific drivers

def get_driver(browser_name: str = None) -> WebDriver:
    """
    Initializes and returns a WebDriver instance based on browser_name or BROWSER environment variable.
    """
    if browser_name is None:
        browser_name = os.getenv('BROWSER', 'chrome').lower()

    driver: WebDriver
    if browser_name == 'firefox':
        driver = webdriver.Firefox(service=webdriver.FirefoxService(GeckoDriverManager().install()))
    elif browser_name == 'edge':
        driver = webdriver.Edge(service=webdriver.EdgeService(EdgeChromiumDriverManager().install()))
    elif browser_name == 'chrome':
        driver = webdriver.Chrome(service=webdriver.ChromeService(ChromeDriverManager().install()))
    elif browser_name == 'safari': # Safari doesn't need WebDriverManager
        driver = webdriver.Safari()
    else:
        raise ValueError(f"Unsupported browser: {browser_name}")
    
    driver.maximize_window()
    return driver

def quit_driver(driver: WebDriver):
    """
    Quits the WebDriver instance.
    """
    if driver:
        driver.quit()

# Add other utility functions here if needed
`,
        ".env": `BASE_URL=${dynamicBaseUrl}
# Define the browser to use (chrome, firefox, edge, safari). Defaults to chrome.
# BROWSER=chrome
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
results/`,

        "README.md": `
# ${normalizedProjectName} - AI Generated Automation Tests (Selenium Python - Pytest)

This project contains AI-generated Selenium WebDriver tests written in Python using Pytest, based on the test scenarios you provided.

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

With the virtual environment activated, install Selenium, Pytest, and other necessary libraries:

\`\`\`bash
pip install -r requirements.txt
\`\`\`

### 5. Configure Base URL and Browser (Optional but Recommended)

If your application's URL changes, or if you want to run tests against different environments or use a different browser, update the \`.env\` file:

\`\`\`dotenv
BASE_URL=${dynamicBaseUrl}
BROWSER=chrome # or firefox, edge, safari
\`\`\`

### 6. Run Your Tests

Navigate to the project root directory in your terminal (ensure your virtual environment is active) and run tests using Pytest.
WebDriver-Manager will automatically download the necessary browser drivers.

* **Run all tests:**
    \`\`\`bash
    pytest
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

### 7. View Test Reports

By default, Pytest output is in the console. You can generate various report formats using plugins:
* **JUnit XML report:**
    \`\`\`bash
    pytest --junitxml=results/report.xml
    \`\`\`
* **HTML report (requires \`pytest-html\` plugin):**
    First, install: \`pip install pytest-html\`
    Then run:
    \`\`\`bash
    pytest --html=results/report.html --self-contained-html
    \`\`\`
    Open \`results/report.html\` in your browser.

Happy Testing!
`
    };
};