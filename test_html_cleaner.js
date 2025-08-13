/**
 * A REGEX-BASED SIMULATION of the advanced HTML cleaner for testing purposes.
 * This simulates the multi-pass cleaning from content_script.js in an environment
 * without a full DOM. The actual implementation in content_script.js is more robust.
 * @param {string} htmlString - The raw HTML string.
 * @returns {string} The cleaned HTML string.
 */
function simulateAdvancedCleaning(htmlString) {
    let cleaned = htmlString;

    // Pass 1: Remove unwanted tags entirely
    const selectorsToRemove = ['script', 'style', 'svg', 'iframe', 'noscript', 'link', 'meta', 'button', 'input'];
    selectorsToRemove.forEach(tag => {
        const regex = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
        cleaned = cleaned.replace(regex, '');
    });

    // Pass 2: Filter attributes, keeping only an allowlist
    const allowedAttributes = ['alt', 'title', 'aria-label', 'datetime', 'href', 'src'];
    cleaned = cleaned.replace(/<([a-zA-Z0-9]+)([^>]*)>/g, (match, tagName, attrs) => {
        const preservedAttrs = attrs.match(/([a-zA-Z\-]+)="[^"]*"/g)
            ?.filter(attr => {
                const attrName = attr.split('=')[0].toLowerCase();
                return allowedAttributes.includes(attrName);
            })
            .join(' ') || '';
        return `<${tagName}${preservedAttrs ? ' ' + preservedAttrs : ''}>`;
    });

    // Pass 3 (Structure Simplification) is too complex for a reliable regex simulation.
    // The real implementation in content_script.js handles this.

    // Pass 4: Collapse whitespace
    cleaned = cleaned.split('\n').map(line => line.trim()).join('\n');
    cleaned = cleaned.replace(/\s{2,}/g, ' ');
    cleaned = cleaned.replace(/>\s+</g, '><');
    cleaned = cleaned.replace(/^\s*[\r\n]/gm, ''); // remove empty lines

    return cleaned.trim();
}

// --- Test Data ---
const sampleHtml = `
<div class="chat-container" style="background: #fff;" id="main-chat">
    <script>alert("This should be removed");</script>
    <style>.chat-container { padding: 10px; }</style>
    <div>
        <div class="message-row other-person">
            <img src="avatar.png" alt="Avatar of other person" title="User123">
            <p class="text-bubble" data-testid="msg-1">こんにちは！お元気ですか？</p>
        </div>
    </div>
    <div class="message-row self">
        <p class="text-bubble" aria-label="My message content">はい、元気です。srcフォルダの件、ありがとうございます。</p>
        <a href="http://example.com">A link that should be preserved</a>
    </div>
    <svg width="24" height="24"><path d="..."></path></svg>
</div>
`;

// --- Test Execution ---
console.log("--- Testing Advanced HTML Cleaning (Regex Simulation) ---");
console.log(`\n[1] Original HTML (Character count: ${sampleHtml.length}):\n`);
console.log(sampleHtml);

const cleanedHtml = simulateAdvancedCleaning(sampleHtml);

console.log(`\n[2] Cleaned HTML (Character count: ${cleanedHtml.length}):\n`);
console.log(cleanedHtml);

const reduction = sampleHtml.length - cleanedHtml.length;
const reductionPercent = ((reduction / sampleHtml.length) * 100).toFixed(2);

console.log(`\n--- Test Complete ---`);
console.log(`Optimization Result: Reduced by ${reduction} characters (${reductionPercent}%).`);
