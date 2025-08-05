// server/templates/playwrightJavaProject.js
// This file contains the static, boilerplate content for a Playwright Java project (JUnit 5, Maven).

const { toCamelCase } = require('../utils/normalizer'); 

module.exports = (projectName, dynamicBaseUrl) => {
    const normalizedProjectName = toCamelCase(projectName || 'generated-tests');

    return {
        "pom.xml": `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>ai.generated</groupId>
    <artifactId>${normalizedProjectName}-playwright-java</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>

    <properties>
        <maven.compiler.source>11</maven.compiler.source>
        <maven.compiler.target>11</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
        <playwright.version>1.45.0</playwright.version>
        <junit.version>5.10.0</junit.version>
        <maven-surefire-plugin.version>3.2.5</maven-surefire-plugin.version>
    </properties>

    <dependencies>
        <dependency>
            <groupId>com.microsoft.playwright</groupId>
            <artifactId>playwright</artifactId>
            <version>\${playwright.version}</version>
        </dependency>

        <dependency>
            <groupId>org.junit.jupiter</groupId>
            <artifactId>junit-jupiter-api</artifactId>
            <version>\${junit.version}</version>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.junit.jupiter</groupId>
            <artifactId>junit-jupiter-engine</artifactId>
            <version>\${junit.version}</version>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.junit.jupiter</groupId>
            <artifactId>junit-jupiter-params</artifactId>
            <version>\${junit.version}</version>
            <scope>test</scope>
        </dependency>
        
        <dependency>
            <groupId>com.microsoft.playwright</groupId>
            <artifactId>playwright-junit5</artifactId>
            <version>\${playwright.version}</version>
            <scope>test</scope>
        </dependency>

        <dependency>
            <groupId>io.github.cdimascio</groupId>
            <artifactId>dotenv-java</artifactId>
            <version>3.0.0</version>
            <scope>compile</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <version>3.11.0</version>
                <configuration>
                    <source>\${maven.compiler.source}</source>
                    <target>\${maven.compiler.target}</target>
                </configuration>
            </plugin>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-surefire-plugin</artifactId>
                <version>\${maven-surefire-plugin.version}</version>
                <configuration>
                    <properties>
                        <includeTags>\${tags}</includeTags>
                    </properties>
                    <systemPropertyVariables>
                        <playwright.screenshot.on.failure>true</playwright.screenshot.on.failure>
                        <playwright.browser>chromium</playwright.browser> <playwright.headless>true</playwright.headless> </systemPropertyVariables>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>`,

        "src/main/java/base/BaseTest.java": `package base;

import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import io.github.cdimascio.dotenv.Dotenv;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import utils.BrowserManager;

public class BaseTest {
    protected Playwright playwright;
    protected Browser browser;
    protected BrowserContext context;
    protected Page page;
    protected Dotenv dotenv;

    @BeforeEach
    public void setup() {
        dotenv = Dotenv.load(); // Load .env file
        String baseUrl = dotenv.get("BASE_URL");
        if (baseUrl == null || baseUrl.isEmpty()) {
            baseUrl = "${dynamicBaseUrl}"; // Fallback to provided base URL from generator
            System.out.println("WARNING: BASE_URL not found in .env. Falling back to default: " + baseUrl);
        }

        String browserName = dotenv.get("BROWSER_NAME", "chromium"); // Default to chromium
        boolean headless = Boolean.parseBoolean(dotenv.get("HEADLESS", "true")); // Default to true

        playwright = Playwright.create();
        browser = BrowserManager.launchBrowser(playwright, browserName, headless);
        context = browser.newContext();
        page = context.newPage();
        
        page.navigate(baseUrl); // Navigate to base URL
    }

    @AfterEach
    public void tearDown() {
        if (context != null) {
            context.close();
        }
        if (browser != null) {
            browser.close();
        }
        if (playwright != null) {
            playwright.close();
        }
    }
}
`,
        "src/main/java/utils/BrowserManager.java": `package utils;

import com.microsoft.playwright.Browser;
import com.microsoft.playwright.Playwright;

public class BrowserManager {

    private BrowserManager() {} // Private constructor to prevent instantiation

    public static Browser launchBrowser(Playwright playwright, String browserName, boolean headless) {
        switch (browserName.toLowerCase()) {
            case "chromium":
                return playwright.chromium().launch(new Browser.LaunchOptions().setHeadless(headless));
            case "firefox":
                return playwright.firefox().launch(new Browser.LaunchOptions().setHeadless(headless));
            case "webkit": // Safari equivalent
                return playwright.webkit().launch(new Browser.LaunchOptions().setHeadless(headless));
            case "chrome": // Google Chrome (requires playwright install chromium --with-chrome)
                return playwright.chromium().launch(new Browser.LaunchOptions().setChannel("chrome").setHeadless(headless));
            case "msedge": // Microsoft Edge (requires playwright install chromium --with-msedge)
                return playwright.chromium().launch(new Browser.LaunchOptions().setChannel("msedge").setHeadless(headless));
            default:
                throw new IllegalArgumentException("Unsupported browser: " + browserName);
        }
    }
}
`,
        ".env": `BASE_URL=${dynamicBaseUrl}
# Define the browser to use (chromium, firefox, webkit, chrome, msedge). Defaults to chromium.
# BROWSER_NAME=chromium
# Run in headless mode (true/false). Defaults to true.
# HEADLESS=true
# You can add other environment variables here, e.g.,
# USERNAME=your_app_username
# PASSWORD=your_app_password`,

        "README.md": `
# ${normalizedProjectName} - AI Generated Automation Tests (Playwright Java)

This project contains AI-generated Playwright tests written in Java using JUnit 5 and Maven, based on the test scenarios you provided.

## Getting Started

Follow these steps to set up and run your tests:

### 1. Open in VS Code

This project should have opened automatically in VS Code. If not, navigate to the project directory you specified and open it manually.

### 2. Install Java and Maven

Ensure you have:
* **Java Development Kit (JDK) 11 or higher** installed.
* **Apache Maven** installed and configured in your system's PATH.

You can verify their installation by running:
\`\`\`bash
java -version
mvn -version
\`\`\`

### 3. Install Playwright Browsers

Playwright needs its browser binaries. Navigate to the project root directory in your terminal (where \`pom.xml\` is located) and run:

\`\`\`bash
mvn exec:java -Dexec.mainClass="com.microsoft.playwright.CLI" -Dexec.args="install"
\`\`\`
This will install Chromium, Firefox, and WebKit browsers.

### 4. Configure Base URL and Browser (Optional but Recommended)

If your application's URL changes, or if you want to run tests against different environments or use a different browser, update the \`.env\` file:

\`\`\`dotenv
BASE_URL=${dynamicBaseUrl}
BROWSER_NAME=chromium # or firefox, webkit, chrome, msedge
HEADLESS=true # set to false for headed mode
\`\`\`

### 5. Run Your Tests

Navigate to the project root directory in your terminal (where \`pom.xml\` is located) and run the tests using Maven.

* **Run all tests (headless by default):**
    \`\`\`bash
    mvn clean test
    \`\`\`

* **Run tests with specific tags:**
    Use the \`-Dtags\` argument with Maven Surefire Plugin. Remember that tags are defined in your test methods (e.g., \`@Tag("smoke")\`, \`@Tag("reg")\`, \`@Tag("sanity")\`).

    * **Run Smoke and Regression tests:**
        \`\`\`bash
        mvn clean test -Dtags="smoke & reg"
        \`\`\`
    * **Run all Regression tests:**
        \`\`\`bash
        mvn clean test -Dtags="reg"
        \`\`\`
    * **Run Sanity and Regression tests:**
        \`\`\`bash
        mvn clean test -Dtags="sanity & reg"
        \`\`\`
    * **Run tests with OR logic (e.g., smoke OR sanity):**
        \`\`\`bash
        mvn clean test -Dtags="smoke | sanity"
        \`\`\`

### 6. View Test Reports

Maven Surefire Plugin generates reports in \`target/surefire-reports/\`. You can open the \`.html\` or \`.xml\` reports in your browser to view detailed results. Playwright also generates traces and screenshots in \`test-results/\` directory.

Happy Testing!
`
    };
};