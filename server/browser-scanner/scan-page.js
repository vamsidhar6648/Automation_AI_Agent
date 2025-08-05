// server/browser-scanner/scan-page.js

const playwright = require('playwright');

/**
 * Scans a given URL for interactive UI elements (buttons, inputs, links, etc.)
 * using Playwright and returns a structured list of their attributes.
 *
 * @param {string} url The URL to scan.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of found elements.
 */
async function scanPage(url) {
    let browser;
    try {
        console.log(`DEBUG: Launching Playwright browser for scanning: ${url}`);
        browser = await playwright.chromium.launch({ headless: true }); // Use headless for performance
        const page = await browser.newPage();
        
        // Listen for all console messages
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.error(`Browser Console Error on ${url}:`, msg.text());
            } else if (msg.type() === 'warning') {
                console.warn(`Browser Console Warning on ${url}:`, msg.text());
            }
        });

        // Set a default timeout for navigation
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }); // 30 seconds timeout
        console.log(`DEBUG: Navigated to ${url}. Beginning element extraction.`);

        const elements = await page.evaluate(() => {
            const interactiveElements = [];
            const selectors = 'button, input, select, textarea, a, [role="button"], [role="link"], [role="textbox"], [tabindex]:not([tabindex="-1"])';

            document.querySelectorAll(selectors).forEach(el => {
                const tag = el.tagName.toLowerCase();
                const elementData = {
                    tag: tag,
                    id: el.id || null,
                    name: el.name || null,
                    type: el.type || null,
                    placeholder: el.placeholder || null,
                    ariaLabel: el.getAttribute('aria-label') || null,
                    text: (tag === 'button' || tag === 'a') ? el.textContent.trim().replace(/\s+/g, ' ') : null,
                    role: el.getAttribute('role') || null,
                    className: el.className ? el.className.split(/\s+/).filter(c => c.length > 0).join('.') : null, // Clean up class names
                };

                // Filter out elements that are likely not interactive or are hidden
                if (el.offsetParent === null && !['input', 'textarea'].includes(tag)) { // If offsetParent is null, it's hidden or not rendered, unless it's an input/textarea that might be initially hidden.
                    return; // Skip hidden elements that are not inputs/textareas
                }
                if (el.hasAttribute('disabled')) {
                    return; // Skip disabled elements
                }
                
                // Further refine to capture unique and meaningful attributes
                const meaningfulAttributes = {};
                for (const key in elementData) {
                    if (elementData[key]) {
                        // For text, ensure it's not empty for buttons/links
                        if ((key === 'text' && elementData[key].length > 0) || key !== 'text') {
                            meaningfulAttributes[key] = elementData[key];
                        }
                    }
                }

                if (Object.keys(meaningfulAttributes).length > 1 || (Object.keys(meaningfulAttributes).length === 1 && (meaningfulAttributes.id || meaningfulAttributes.name || meaningfulAttributes.text))) {
                    interactiveElements.push(meaningfulAttributes);
                }
            });
            return interactiveElements;
        });

        console.log(`DEBUG: Finished element extraction for ${url}. Found ${elements.length} elements.`);
        return elements;

    } catch (error) {
        console.error(`ERROR: Failed to scan page ${url}:`, error);
        // Return an empty array or re-throw based on desired error handling
        return []; 
    } finally {
        if (browser) {
            await browser.close();
            console.log(`DEBUG: Playwright browser closed for ${url}.`);
        }
    }
}

module.exports = scanPage;