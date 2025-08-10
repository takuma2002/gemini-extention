// Gemini DM Assistant - background.js (Service Worker) - Refactored

/**
 * Creates a detailed, dynamic prompt for the Gemini API.
 * @param {string} html - The HTML string of the conversation.
 * @param {string} style - The desired tone/style for the reply (e.g., "丁寧な").
 * @param {string} instructions - Specific user instructions for the reply.
 * @returns {string} The complete prompt to be sent to the API.
 */
function createPrompt(html, style, instructions) {
    // A simple attempt to clean the HTML and reduce token count.
    const cleanHtml = html
        .replace(/ class="[^"]*"/g, '')
        .replace(/ style="[^"]*"/g, '')
        .replace(/ data-[\w-]*="[^"]*"/g, '');

    // Dynamically build the instruction part of the prompt.
    let instructionsPart = `返信は、利用者の視点から、**${style}**トーンで書いてください。`;
    if (instructions && instructions.trim() !== '') {
        instructionsPart += `\nさらに、以下の具体的な指示に従ってください:\n「${instructions}」`;
    }

    // The prompt is in Japanese, as per the user's request.
    return `あなたは、あるダイレクトメッセージの会話に返信するのを手伝うAIアシスタントです。
以下に、会話スレッドのHTMLソースコードと、生成したい返信に関する指示を示します。

---
## 指示
${instructionsPart}
---
## 会話のHTMLソースコード
${cleanHtml}
---

上記の会話と指示に基づき、返信の文章だけを生成してください。解説、相槌、要約などは一切含めないでください。純粋なテキストのみを返してください。`;
}

/**
 * Handles the entire process of generating a reply using the Gemini API.
 * @param {object} request - The request object from the popup.
 * @param {string} request.html - The HTML from the content script.
 * @param {string} request.style - The desired style.
 * @param {string} request.instructions - The user's instructions.
 * @returns {Promise<{reply: string}>} An object containing the generated reply.
 */
async function handleGenerateReply(request) {
    const { html, style, instructions } = request;

    // 1. Retrieve the API key from local storage.
    const { apiKey } = await chrome.storage.local.get('apiKey');
    if (!apiKey) {
        throw new Error("APIキーが設定されていません。拡張機能のオプションページで設定してください。");
    }

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;
    const prompt = createPrompt(html, style, instructions);

    // 2. Prepare the request body for the Gemini API.
    const requestBody = {
        contents: [{
            parts: [{ text: prompt }]
        }],
        generationConfig: {
            temperature: 0.7,
            topK: 1,
            topP: 1,
            maxOutputTokens: 2048,
        },
    };

    // 3. Make the API call.
    console.log("Sending request to Gemini API with enhanced prompt.");
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorBody = await response.json();
        console.error("API Error:", errorBody);
        throw new Error(`APIリクエストに失敗しました: ${response.status}. ${errorBody.error?.message || ''}`);
    }

    // 4. Parse the response and extract the generated text.
    const responseData = await response.json();
    console.log("Received response from Gemini API.");

    if (!responseData.candidates || !responseData.candidates[0].content.parts[0].text) {
        console.error("Invalid response structure from API:", responseData);
        throw new Error("APIから予期しない形式の応答がありました。");
    }

    const generatedText = responseData.candidates[0].content.parts[0].text;

    return { reply: generatedText.trim() };
}

// Listen for messages from the popup.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'generateReply') {
        console.log("Background script received 'generateReply' message with style and instructions.");

        handleGenerateReply(request)
            .then(sendResponse)
            .catch(error => {
                console.error("Error handling reply generation:", error);
                sendResponse({ error: { message: error.message } });
            });

        return true; // Indicates that the response will be sent asynchronously.
    }
});

console.log("Gemini DM Assistant background script loaded (refactored).");
