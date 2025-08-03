// ★★★API Gatewayで取得したURLに書き換える★★★
const API_ENDPOINT = 'https://szyfr76o9g.execute-api.us-east-1.amazonaws.com/prod/generate-image';

const sendBtn = document.getElementById('send-btn');
const promptInput = document.getElementById('prompt-input');
const chatHistoryDiv = document.getElementById('chat-history');
const loadingDiv = document.getElementById('loading');

sendBtn.addEventListener('click', async () => {
    const prompt = promptInput.value.trim();
    if (!prompt) {
        alert('プロンプトを入力してください。');
        return;
    }

    // チャット履歴にユーザーのプロンプトを追加
    const userMessage = document.createElement('div');
    userMessage.classList.add('user-message');
    userMessage.textContent = prompt;
    chatHistoryDiv.appendChild(userMessage);

    // UIを更新
    loadingDiv.classList.remove('hidden');
    promptInput.value = '';
    sendBtn.disabled = true;

    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt: prompt }),
        });

        if (!response.ok) {
            throw new Error(`APIエラー: ${response.statusText}`);
        }

        const data = await response.json();
        const responseBody = JSON.parse(data.body);
        const imageUrl = responseBody.imageUrl;

        // チャット履歴に生成された画像を追加
        const imageContainer = document.createElement('div');
        imageContainer.classList.add('image-container');
        const img = document.createElement('img');
        img.src = imageUrl;
        imageContainer.appendChild(img);
        chatHistoryDiv.appendChild(imageContainer);
        chatHistoryDiv.scrollTop = chatHistoryDiv.scrollHeight; // 最新のメッセージにスクロール

    } catch (error) {
        console.error('エラー:', error);
        const errorMessage = document.createElement('p');
        errorMessage.classList.add('error-message');
        errorMessage.textContent = `エラーが発生しました: ${error.message}`;
        chatHistoryDiv.appendChild(errorMessage);
        chatHistoryDiv.scrollTop = chatHistoryDiv.scrollHeight;
    } finally {
        // UIを元に戻す
        loadingDiv.classList.add('hidden');
        sendBtn.disabled = false;
    }
});

promptInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendBtn.click();
    }
});