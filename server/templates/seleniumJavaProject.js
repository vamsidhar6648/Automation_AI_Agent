// server/templates/seleniumJavaProject.js
// This file contains the static, boilerplate content for a Selenium Java project (JUnit 5, Maven).

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
    <artifactId>${normalizedProjectName}-selenium-java</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>

    <properties>
        <maven.compiler.source>11</maven.compiler.source>
        <maven.compiler.target>11</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
        <selenium.version>4.20.0</selenium.version>
        <junit.version>5.10.0</junit.version>
        <webdrivermanager.version>5.8.0</webdrivermanager.version>
        <maven-surefire-plugin.version>3.2.5</maven-surefire-plugin.version>
    </properties>

    <dependencies>
        <dependency>
            <groupId>org.seleniumhq.selenium</groupId>
            <artifactId>selenium-java</artifactId>
            <version>\${selenium.version}</version>
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
            <groupId>io.github.bonigarcia</groupId>
            <artifactId>webdrivermanager</artifactId>
            <version>\${webdrivermanager.version}</version>
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
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>`,

        "src/main/java/base/BaseTest.java": `package base;

import io.github.cdimascio.dotenv.Dotenv;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.openqa.selenium.WebDriver;
import utils.WebDriverSetup;

public class BaseTest {
    protected WebDriver driver;
    protected Dotenv dotenv; // For reading .env variables

    @BeforeEach
    public void setup() {
        dotenv = Dotenv.load(); // Load .env file
        String baseUrl = dotenv.get("BASE_URL");
        if (baseUrl == null || baseUrl.isEmpty()) {
            baseUrl = "${dynamicBaseUrl}"; // Fallback to provided base URL from generator
            System.out.println("WARNING: BASE_URL not found in .env. Falling back to default: " + baseUrl);
        }

        driver = WebDriverSetup.getDriver();
        driver.manage().window().maximize();
        driver.get(baseUrl); // Navigate to base URL
    }

    @AfterEach
    public void tearDown() {
        if (driver != null) {
            driver.quit();
        }
    }
}
`,
        "src/main/java/utils/WebDriverSetup.java": `package utils;

import io.github.bonigarcia.wdm.WebDriverManager;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.firefox.FirefoxDriver;
import org.openqa.selenium.edge.EdgeDriver;
import org.openqa.selenium.safari.SafariDriver; // For macOS

import java.util.Objects; // For Objects.requireNonNullElse

public class WebDriverSetup {

    private static WebDriver driver; // Use static to manage single driver instance

    // Prevents instantiation
    private WebDriverSetup() {}

    public static WebDriver getDriver() {
        if (driver == null) {
            String browser = Objects.requireNonNullElse(System.getenv("BROWSER"), "chrome").toLowerCase();

            switch (browser) {
                case "firefox":
                    WebDriverManager.firefoxdriver().setup();
                    driver = new FirefoxDriver();
                    break;
                case "edge":
                    WebDriverManager.edgedriver().setup();
                    driver = new EdgeDriver();
                    break;
                case "safari": // Safari does not need WebDriverManager
                    driver = new SafariDriver();
                    break;
                case "chrome":
                default:
                    WebDriverManager.chromedriver().setup();
                    driver = new ChromeDriver();
                    break;
            }
        }
        return driver;
    }

    public static void quitDriver() {
        if (driver != null) {
            driver.quit();
            driver = null; // Reset driver instance
        }
    }
}
`,
        ".env": `BASE_URL=${dynamicBaseUrl}
# Define the browser to use (chrome, firefox, edge, safari). Defaults to chrome.
# BROWSER=chrome
# You can add other environment variables here, e.g.,
# USERNAME=your_app_username
# PASSWORD=your_app_password`,

        ".gitignore": `target/
.idea/
.project/
.classpath
.settings/
*.iml
*.iws
*.ipr
.env`,

        "README.md": `
# ${normalizedProjectName} - AI Generated Automation Tests (Selenium Java)

This project contains AI-generated Selenium WebDriver tests written in Java using JUnit 5 and Maven, based on the test scenarios you provided.

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

### 3. Configure Base URL and Browser (Optional but Recommended)

If your application's URL changes, or if you want to run tests against different environments or use a different browser, update the \`.env\` file:

\`\`\`dotenv
BASE_URL=${dynamicBaseUrl}
BROWSER=chrome # or firefox, edge, safari
\`\`\`

### 4. Run Your Tests

Navigate to the project root directory in your terminal (where \`pom.xml\` is located) and run the tests using Maven.
WebDriverManager will automatically download the necessary browser drivers.

* **Run all tests:**
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
        \`\`\`\`bash
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

### 5. View Test Reports

Maven Surefire Plugin generates reports in \`target/surefire-reports/\`. You can open the \`.html\` or \`.xml\` reports in your browser to view detailed results.

Happy Testing!
`
    };
};