// client/utils.js

/**
 * Converts a string to camelCase (e.g., "Hello World" -> "helloWorld").
 * @param {string} str - The input string.
 * @returns {string} The camelCase string.
 */
function toCamelCase(str) {
    return str.replace(/[^a-zA-Z0-9 ]/g, '').split(' ').filter(Boolean).map((word, index) => index === 0 ? word.charAt(0).toLowerCase() + word.slice(1) : word.charAt(0).toUpperCase() + word.slice(1)).join('');
}

/**
 * Extracts a concise and unique feature name from a test scenario title.
 * Prioritizes meaningful keywords and limits length for file naming.
 * @param {string} scenarioTitle - The full "Test Scenario" title from Excel.
 * @returns {string} A short, unique, and descriptive feature name.
 */
function toShortFeatureName(scenarioTitle) {
    const commonWords = new Set(['a', 'an', 'the', 'of', 'in', 'on', 'at', 'for', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'not', 'no', 'this', 'that', 'these', 'those', 'from', 'to', 'by', 'as', 'it', 'its', 'from', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'in', 'off', 'on', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 'now', 'verify', 'check', 'ensure', 'manage', 'test', 'scenario', 'flow', 'functionality', 'page', 'module', 'system', 'with']);
    const words = scenarioTitle.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(' ').filter(word => word.length > 2 && !commonWords.has(word));
    if (words.length === 0) { return toCamelCase(scenarioTitle.substring(0, Math.min(scenarioTitle.length, 15))) || 'genericFeature'; }
    let shortName = '';
    for (let i = 0; i < words.length; i++) {
        const nextWordPascal = words[i].charAt(0).toUpperCase() + words[i].slice(1);
        if ((shortName.length + nextWordPascal.length) < 25) { shortName += nextWordPascal; } else { if (shortName === '') { shortName = words[i].substring(0, Math.min(words[i].length, 25)); } break; }
    }
    return toCamelCase(shortName) || toCamelCase(words[0]) || 'genericFeature';
}

// Make them globally accessible for other scripts to use
window.toCamelCase = toCamelCase;
window.toShortFeatureName = toShortFeatureName;