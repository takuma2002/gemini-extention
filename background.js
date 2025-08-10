// Gemini DM Assistant - background.js (Service Worker)

/**
 * Creates a detailed prompt for the Gemini API.
 * @param {string} html - The HTML string of the conversation.
 * @returns {string} The complete prompt to be sent to the API.
 */
function createPrompt(html) {
    // A simple attempt to clean the HTML and reduce token count.
    // This removes common attributes that don't affect content.
    const cleanHtml = html
        .replace(/ class="[^"]*"/g, '')
        .replace(/ style="[^"]*"/g, '')
        .replace(/ data-[\w-]*="[^"]*"/g, '');

    // The prompt is in Japanese, as per the user's request.
    return `
あなたは、あるダイレクトメッセージの会話に返信するのを手伝うAIアシスタントです。
以下に、会話スレッドのHTMLソースコードを示します。

あなたのタスクは以下の通りです。
1. このHTMLを分析して、誰が何を発言したか、会話の流れを理解してください。
2. その会話の文脈に最も適した、気の利いた返信を生成してください。
3. 返信は、このスクリプトの利用者（つまり「自分」）の視点から書いてください。
4. 出力は、生成した返信の文章だけにしてください。解説や、抽出した会話の要約、HTMLタグなどは一切含めないでください。純粋なテキストのみを返してください。

HTMLソースコード:
---
${cleanHtml}
---

生成する返信:
`;
}

/**
 * Handles the entire process of generating a reply using the Gemini API.
 * @param {string} html - The HTML from the content script.
 * @returns {Promise<{reply: string}>} An object containing the generated reply.
 */
async function handleGenerateReply(html) {
    // 1. Retrieve the API key from local storage.
    const { apiKey } = await chrome.storage.local.get('apiKey');
    if (!apiKey) {
        throw new Error("APIキーが設定されていません。拡張機能のオプションページで設定してください。");
    }

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
    const prompt = createPrompt(html);

    // 2. Prepare the request body for the Gemini API.
    const requestBody = {
        contents: [{
            parts: [{
                text: prompt
            }]
        }],
        generationConfig: {
            temperature: 0.7,
            topK: 1,
            topP: 1,
            maxOutputTokens: 2048,
        },
    };

    // 3. Make the API call.
    console.log("Sending request to Gemini API...");
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
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

// Listen for messages from the content script.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'generateReply') {
        console.log("Background script received 'generateReply' message.");

        handleGenerateReply(request.html)
            .then(sendResponse)
            .catch(error => {
                console.error("Error handling reply generation:", error);
                // Send a structured error back to the content script.
                sendResponse({ error: { message: error.message } });
            });

        // Return true to indicate that the response will be sent asynchronously.
        return true;
    }
});

console.log("Gemini DM Assistant background script loaded and listening for messages.");
