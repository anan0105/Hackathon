// ★★★ ご自身のAPI GatewayのURLに書き換えてください ★★★
const API_BASE_URL = 'https://szyfr76o9g.execute-api.us-east-1.amazonaws.com/prod'; // 例

// 各機能のエンドポイントURLを設定
const API_ENDPOINTS = {
    image: `${API_BASE_URL}/generate-image`,
    music_start: `${API_BASE_URL}/start-music-generation`,
    music_status: `${API_BASE_URL}/check-music-status`
};

let currentRoom = 'image';
let pollingInterval;

const sendBtn = document.getElementById('send-btn');
const promptInput = document.getElementById('prompt-input');
const chatHistoryDiv = document.getElementById('chat-history');
const loadingDiv = document.getElementById('loading');
const roomTitle = document.getElementById('room-title');
const navButtons = document.querySelectorAll('.nav-btn');

// ルーム切り替え処理
navButtons.forEach(button => {
    button.addEventListener('click', () => {
        currentRoom = button.dataset.room;
        navButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        chatHistoryDiv.innerHTML = '';
        if (pollingInterval) clearInterval(pollingInterval);

        if (currentRoom === 'image') {
            roomTitle.textContent = 'AI Image Generator';
            promptInput.placeholder = '作りたい画像の英語プロンプトを入力';
            addSystemMessage('画像生成ルームへようこそ！');
        } else {
            roomTitle.textContent = 'AI Music Generator';
            promptInput.placeholder = '作りたい音楽の英語プロンプトを入力';
            addSystemMessage('音楽生成ルームへようこそ！');
        }
    });
});

// 送信ボタンの処理
sendBtn.addEventListener('click', async () => {
    const prompt = promptInput.value.trim();
    if (!prompt) return;

    addUserMessage(prompt);
    loadingDiv.classList.remove('hidden');
    promptInput.value = '';
    sendBtn.disabled = true;

    if (currentRoom === 'image') {
        await handleImageGeneration(prompt);
    } else {
        await handleMusicGeneration(prompt);
    }
});

// --- 画像生成処理（プロキシ統合用） ---
async function handleImageGeneration(prompt) {
    try {
        const response = await fetch(API_ENDPOINTS.image, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: prompt }),
        });
        if (!response.ok) throw new Error(`APIエラー: ${response.statusText}`);
        
        // ★★★ 修正箇所 ★★★
        const data = await response.json();
        const responseBody = JSON.parse(data.body); // bodyの中身を解釈
        addImageMessage(responseBody.imageUrl);    // bodyの中から取得

    } catch (error) {
        addErrorMessage(error.message);
    } finally {
        loadingDiv.classList.add('hidden');
        sendBtn.disabled = false;
        chatHistoryDiv.scrollTop = chatHistoryDiv.scrollHeight;
    }
}

// --- 音楽生成処理（プロキシ統合・非同期用） ---
async function handleMusicGeneration(prompt) {
    if (pollingInterval) clearInterval(pollingInterval);
    
    try {
        // 1. 生成開始リクエスト
        const startResponse = await fetch(API_ENDPOINTS.music_start, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: prompt }),
        });
        if (!startResponse.ok) throw new Error(`APIエラー (start)`);

        // ★★★ プロキシ統合用の修正 ★★★
        const startData = await startResponse.json();
        const responseBody = JSON.parse(startData.body);
        const predictionId = responseBody.prediction_id;

        console.log("取得したPrediction ID:", predictionId); // ★★★ 追加 ★★★

        if (!predictionId) throw new Error('生成ジョブの開始に失敗。');

        console.log("ここから状況確認のポーリングを開始します..."); // ★★★ 追加 ★★★

        // 2. 状況確認を5秒おきに開始（ポーリング）
        pollingInterval = setInterval(async () => {
            console.log("状況確認中... ID:", predictionId); // ★★★ 追加 ★★★
            try {
                const statusResponse = await fetch(`${API_ENDPOINTS.music_status}?id=${predictionId}`);
                if (!statusResponse.ok) throw new Error(`APIエラー (status)`);
                
                // ★★★ プロキシ統合用の修正 ★★★
                const statusData = await statusResponse.json();
                const statusBody = JSON.parse(statusData.body);

                if (statusBody.status === 'succeeded') {
                    clearInterval(pollingInterval);

                    // Replicateから返ってきた音楽URLをS3に保存する処理は省略
                    addAudioMessage(statusBody.output);
                    
                    loadingDiv.classList.add('hidden');
                    sendBtn.disabled = false;
                } else if (statusBody.status === 'failed' || statusBody.status === 'canceled') {
                    clearInterval(pollingInterval);
                    throw new Error(`生成に失敗: ${statusBody.error}`);
                }
            } catch (error) {
                clearInterval(pollingInterval);
                addErrorMessage(error.message);
                loadingDiv.classList.add('hidden');
                sendBtn.disabled = false;
            }
        }, 5000);

    } catch (error) {
        addErrorMessage(error.message);
        loadingDiv.classList.add('hidden');
        sendBtn.disabled = false;
    }
}

// (ここから下は、Enterキー処理とメッセージ追加用のヘルパー関数)

promptInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendBtn.click();
    }
});

function addUserMessage(text) {
    const userMessage = document.createElement('div');
    userMessage.classList.add('user-message');
    userMessage.textContent = text;
    chatHistoryDiv.appendChild(userMessage);
}

function addImageMessage(url) {
    const imageContainer = document.createElement('div');
    imageContainer.classList.add('image-container');
    const img = document.createElement('img');
    img.src = url;
    imageContainer.appendChild(img);
    chatHistoryDiv.appendChild(imageContainer);
}

function addAudioMessage(url) {
    const audioContainer = document.createElement('div');
    audioContainer.classList.add('audio-container');
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.src = url;
    audioContainer.appendChild(audio);
    chatHistoryDiv.appendChild(audioContainer);
}

function addErrorMessage(text) {
    const errorMessage = document.createElement('p');
    errorMessage.classList.add('error-message');
    errorMessage.textContent = `エラーが発生しました: ${text}`;
    chatHistoryDiv.appendChild(errorMessage);
}

function addSystemMessage(text) {
    const systemMessage = document.createElement('p');
    systemMessage.classList.add('system-message');
    systemMessage.textContent = text;
    chatHistoryDiv.appendChild(systemMessage);
}