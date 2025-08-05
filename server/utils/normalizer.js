// server/utils/normalizer.js

/**
 * Converts a string to PascalCase (e.g., "hello world" -> "HelloWorld").
 * Removes non-alphanumeric characters and capitalizes each word.
 * @param {string} str - The input string.
 * @returns {string} The PascalCase string.
 */
function toPascalCase(str = '') {
  return str
    .replace(/[^a-zA-Z0-9 ]/g, '') // Remove special characters, keep spaces
    .split(' ') // Split by spaces
    .filter(Boolean) // Remove empty strings from split (e.g., multiple spaces)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize first letter of each word
    .join(''); // Join words without spaces
}

/**
 * Converts a string to camelCase (e.g., "Hello World" -> "helloWorld").
 * @param {string} str - The input string.
 * @returns {string} The camelCase string.
 */
function toCamelCase(str = '') {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Extracts a concise and unique feature name from a test scenario title.
 * Prioritizes meaningful keywords and limits length for file naming.
 * @param {string} scenarioTitle - The full "Test Scenario" title from Excel.
 * @returns {string} A short, unique, and descriptive feature name.
 */
function toShortFeatureName(scenarioTitle = '') {
    const commonWords = new Set([
        'a', 'an', 'the', 'of', 'in', 'on', 'at', 'for', 'with', 'and', 'or', 'but', 'is', 'are', 'was', 'were',
        'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'not', 'no', 'this', 'that', 'these',
        'those', 'from', 'to', 'by', 'as', 'it', 'its', 'from', 'into', 'through', 'during', 'before', 'after',
        'above', 'below', 'to', 'from', 'up', 'down', 'out', 'in', 'off', 'on', 'over', 'under', 'again', 'further',
        'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more',
        'most', 'other', 'some', 'such', 'no', 'nor', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't',
        'can', 'will', 'just', 'don', 'should', 'now', // Common stop words
        'verify', 'check', 'ensure', 'manage', 'test', 'scenario', 'flow', 'functionality', 'page', 'module', 'system' // Common automation/testing words
    ]);

    const words = scenarioTitle
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '') // Remove non-alphanumeric except spaces
        .split(' ')
        .filter(word => word.length > 2 && !commonWords.has(word)); // Filter out short and common words

    if (words.length === 0) {
        // Fallback if no significant words remain
        return toCamelCase(scenarioTitle.substring(0, Math.min(scenarioTitle.length, 15))) || 'genericFeature';
    }

    // Attempt to combine the most significant words, limiting total length
    let shortName = '';
    for (let i = 0; i < words.length; i++) {
        const nextWordPascal = toPascalCase(words[i]);
        if ((shortName.length + nextWordPascal.length) < 25) { // Keep it reasonably short
            shortName += nextWordPascal;
        } else {
            if (shortName === '') { // If the first significant word is already too long
                shortName = words[i].substring(0, Math.min(words[i].length, 25));
            }
            break;
        }
    }

    // Ensure it's camelCase for file naming conventions and provide a robust fallback
    return toCamelCase(shortName) || toCamelCase(words[0]) || 'genericFeature';
}


module.exports = {
  toPascalCase,
  toCamelCase,
  toShortFeatureName
};