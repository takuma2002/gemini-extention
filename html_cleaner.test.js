/**
 * @jest-environment jsdom
 */

// --- Function to be tested (copied from content_script.js) ---
function getCleanedHtml(element) {
    const clonedElement = element.cloneNode(true);
    const selectorsToRemove = ['script', 'style', 'svg', 'iframe', 'noscript', 'link', 'meta', 'button', 'input'];
    const allowedAttributes = ['alt', 'title', 'aria-label', 'datetime', 'href', 'src'];

    const allElements = clonedElement.querySelectorAll('*');

    allElements.forEach(el => {
        if (selectorsToRemove.includes(el.tagName.toLowerCase())) {
            el.remove();
            return;
        }
        const attrsToRemove = [];
        for (const attr of el.attributes) {
            if (!allowedAttributes.includes(attr.name.toLowerCase())) {
                attrsToRemove.push(attr.name);
            }
        }
        attrsToRemove.forEach(attrName => el.removeAttribute(attrName));
    });

    for (let i = 0; i < 5; i++) {
        clonedElement.querySelectorAll('div').forEach(div => {
            if (div.children.length === 1 && div.children[0].tagName === 'DIV' && !Array.from(div.childNodes).some(node => node.nodeType === 3 && node.textContent.trim() !== '')) {
                div.parentNode.replaceChild(div.children[0], div);
            }
        });
    }

    let finalHtml = clonedElement.innerHTML;
    finalHtml = finalHtml.replace(/>\s+</g, '><');
    finalHtml = finalHtml.split('\n').map(line => line.trim()).join('\n');
    finalHtml = finalHtml.replace(/^\s*[\r\n]/gm, '');

    return finalHtml.trim();
}


// --- Jest Tests ---
describe('getCleanedHtml', () => {
    it('should remove unwanted tags like script and style', () => {
        const container = document.createElement('div');
        container.innerHTML = '<div>Hello<script>alert("XSS")</script> World</div>';
        const cleaned = getCleanedHtml(container);
        expect(cleaned).toBe('<div>Hello World</div>');
    });

    it('should remove all attributes except for the allowed ones', () => {
        const container = document.createElement('div');
        container.innerHTML = '<p class="message" id="msg1" style="color: red;" title="A title">Message</p>';
        const cleaned = getCleanedHtml(container);
        expect(cleaned).toBe('<p title="A title">Message</p>');
    });

    it('should preserve multiple spaces inside a text node', () => {
        const container = document.createElement('div');
        container.innerHTML = '<p>Hello   World</p>'; // 3 spaces
        const cleaned = getCleanedHtml(container);
        expect(cleaned).toBe('<p>Hello   World</p>');
    });

    it('should collapse whitespace between tags but not inside them', () => {
        const container = document.createElement('div');
        container.innerHTML = '<div>  First  </div>   <div>   Second   </div>';
        const cleaned = getCleanedHtml(container);
        // The conservative approach does not trim text content within tags.
        // It only removes whitespace between tags.
        expect(cleaned).toBe('<div>  First  </div><div>   Second   </div>');
    });

    it('should handle a complex cleaning scenario correctly', () => {
        const container = document.createElement('div');
        container.innerHTML = `
            <div class="chat" id="main">
                <script>console.log('test')</script>
                <div class="message" style="padding: 10px;">
                    <p>Hi there!   How are you?</p>
                    <button>Click me</button>
                </div>
            </div>
        `;
        const cleaned = getCleanedHtml(container);
        // The structure simplification pass will remove the redundant 'message' div.
        const expected = '<div><p>Hi there!   How are you?</p></div>';
        expect(cleaned).toBe(expected);
    });
});
