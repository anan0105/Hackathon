

// ★★★ ご自身のAPI GatewayのURLに書き換えてください ★★★
const API_BASE_URL = 'https://szyfr76o9g.execute-api.us-east-1.amazonaws.com/prod_3'; // 例

// 各機能のエンドポイントURLを設定
const API_ENDPOINTS = {
    image: `${API_BASE_URL}/generate-image`,
    music_start: `${API_BASE_URL}/start-music-generation`,
    music_status: `${API_BASE_URL}/check-music-status`,
    video_start: `${API_BASE_URL}/start-video-generation`,
    music_composition_check: `${API_BASE_URL}/check-music-and-start-composition`,
    video_status: `${API_BASE_URL}/check-composition-status`
};

let currentRoom = 'image';
let pollingInterval;
let currentAudio = null; // ★★★ 再生するaudio要素を保存する変数 ★★★




// --- HTML要素の取得 ---
const sidebar = document.getElementById('sidebar');
const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
const sendBtn = document.getElementById('send-btn');
const playBtn = document.getElementById('play-btn');
const promptInput = document.getElementById('prompt-input');
const chatHistoryDiv = document.getElementById('chat-history');
const loadingDiv = document.getElementById('loading');
const roomTitle = document.getElementById('room-title');
const navButtons = document.querySelectorAll('.nav-btn');


// サイドバー開閉ボタン
sidebarToggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
});


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
            promptInput.placeholder = '作りたい画像の日本語プロンプトを入力';
            addSystemMessage('画像生成ルームへようこそ！');
        } else if (currentRoom === 'music') {
            roomTitle.textContent = 'AI Music Generator';
            promptInput.placeholder = '作りたい音楽の日本語プロンプトを入力';
            addSystemMessage('音楽生成ルームへようこそ！');
        } else {
            roomTitle.textContent = 'AI Video Generator';
            promptInput.placeholder = '作りたい動画の日本語プロンプトを入力';
            addSystemMessage('動画生成ルームへようこそ！');
        }
    });
});

const TRANSLATE_API_URL = 'https://script.google.com/macros/s/AKfycbysDLQt1Di1iGqpJetaW_uEtW2tb0DqSoAq2sDWF-_gpSm8veAUPDtl9BWzaT-t6xOx/exec';

// 送信ボタンの処理
sendBtn.addEventListener('click', async () => {
    const japanesePrompt = promptInput.value.trim();
    if (!japanesePrompt) return;

    addUserMessage(japanesePrompt);
    loadingDiv.classList.remove('hidden');
    promptInput.value = '';
    sendBtn.disabled = true;
    if (playBtn) playBtn.disabled = true;
    if (currentAudio) currentAudio = null;
    if (pollingInterval) clearInterval(pollingInterval);

    try {
        // --- 1. 日本語を英語に翻訳 ---
        addSystemMessage('日本語を英語に翻訳中...');
        const translateResponse = await fetch(`${TRANSLATE_API_URL}?text=${encodeURIComponent(japanesePrompt)}`);
        if (!translateResponse.ok) {
            throw new Error('翻訳APIでエラーが発生しました。');
        }
        const translationData = await translateResponse.json();
        const englishPrompt = translationData.translated;

        addSystemMessage(`翻訳結果: ${englishPrompt}`);
        console.log(`Translated to English: ${englishPrompt}`);

        // --- 2. 翻訳後の英語プロンプトでAIを呼び出す ---
        if (currentRoom === 'image') {
            await handleImageGeneration(englishPrompt);
        } else if (currentRoom === 'music') { // ★★★ else if に変更 ★★★
            await handleMusicGeneration(englishPrompt);
        } else if (currentRoom === 'video') { // ★★★ videoの場合の処理を追加 ★★★
            await handleVideoGeneration(englishPrompt);
        }

    } catch (error) {
        addErrorMessage(error.message);
        loadingDiv.classList.add('hidden');
        sendBtn.disabled = false;
    }
});

// 再生ボタンの処理 ★★★ 新しく追加 ★★★
playBtn.addEventListener('click', () => {
    if (currentAudio) {
        currentAudio.play();
    }
});

// Enterキーでの送信
promptInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendBtn.click();
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

// --- 音楽生成処理 ---
async function handleMusicGeneration(prompt) {
    try {
        // 1. 生成開始リクエスト
        const startResponse = await fetch(API_ENDPOINTS.music_start, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: prompt }),
        });
        if (!startResponse.ok) throw new Error(`APIエラー (start)`);
        
        const startData = await startResponse.json();
        const responseBody = JSON.parse(startData.body); // bodyの中身を解釈
        const predictionId = responseBody.prediction_id; // bodyの中から取得

        if (!predictionId) throw new Error('生成ジョブの開始に失敗。');

        // ★★★ このログでIDとURLを確認 ★★★
        console.log("取得したPrediction ID:", predictionId);
        console.log("これからポーリングするURL:", `${API_ENDPOINTS.music_status}?id=${predictionId}`);

        // 2. 状況確認を5秒おきに開始（ポーリング）
        const pollingInterval = setInterval(async () => {
            try {
                const statusResponse = await fetch(API_ENDPOINTS.music_status, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: predictionId })
                });
                if (!statusResponse.ok) throw new Error(`APIエラー (status)`);
                
                const musicStatusData = await musicStatusResponse.json();
                const musicStatusBody = JSON.parse(musicStatusData.body); // bodyの中身を解釈

                console.log("ポーリング中だよ")

                if (musicStatusBody.status === 'composition_started') {
                    console.log("成功だよ")
                    clearInterval(pollingInterval);
                    const executionArn = musicStatusBody.execution_arn;
                    addSystemMessage("動画の合成を開始しました...");
                    startSecondPolling(executionArn);
                } else if (musicStatusBody.status === 'failed') {
                    clearInterval(pollingInterval);
                    throw new Error(`音楽生成に失敗: ${musicStatusBody.error}`);
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

// --- 動画生成処理（3段階非同期） ---
async function handleVideoGeneration(prompt) {
    if (pollingInterval) clearInterval(pollingInterval);

    try {
        // --- 1. 生成開始リクエスト ---
        addSystemMessage("画像生成と音楽生成を開始します...");
        const startResponse = await fetch(API_ENDPOINTS.video_start, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: prompt }),
        });
        if (!startResponse.ok) throw new Error(`APIエラー (start)`);

        const startData = await startResponse.json();
        const responseBody = JSON.parse(startData.body); // bodyの中身を解釈
        
        const imageS3Url = responseBody.imageUrl;
        const musicPredictionId = responseBody.prediction_id;

        if (!imageS3Url || !musicPredictionId) throw new Error('生成ジョブの開始に失敗。');
        
        addImageMessage(imageS3Url);
        addSystemMessage("音楽の生成完了を待っています...");

        console.log("取得したMusic Prediction ID:", musicPredictionId);
        console.log("これからポーリングするURL:", `${API_ENDPOINTS.video_status}?id=${musicPredictionId}`);

        // --- 2. 第1ポーリング：音楽の完了と動画合成の開始を確認 ---
        pollingInterval = setInterval(async () => {
            try {
                const musicStatusResponse = await fetch(API_ENDPOINTS.music_composition_check, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        image_s3_url: imageS3Url,
                        music_prediction_id: musicPredictionId
                    })
                });
                if (!musicStatusResponse.ok) throw new Error(`APIエラー (music_composition_check)`);

                console.log("ポーリング中だよ")
                        
                const musicStatusData = await musicStatusResponse.json();
                const musicStatusBody = JSON.parse(musicStatusData.body); // bodyの中身を解釈

                if (musicStatusBody.status === 'composition_started') {
                    console.log("成功だよ")
                    clearInterval(pollingInterval);
                    const executionArn = musicStatusBody.execution_arn;
                    addSystemMessage("動画の合成を開始しました...");
                    startSecondPolling(executionArn);
                } else if (musicStatusBody.status === 'failed') {
                    clearInterval(pollingInterval);
                    throw new Error(`音楽生成に失敗: ${musicStatusBody.error}`);
                }
                // 'processing'の間は待機
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

// --- 第2ポーリング：動画合成の完了を確認する関数 ---
function startSecondPolling(executionArn) {
    pollingInterval = setInterval(async () => {
        try {
            const videoStatusResponse = await fetch(API_ENDPOINTS.video_status, { // video_statusを呼び出し
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ execution_arn: executionArn })
            });
            if (!videoStatusResponse.ok) throw new Error(`APIエラー (video_status)`);

            console.log("第二ポーリング中だよ")
            
            const videoStatusData = await videoStatusResponse.json();
            const videoStatusBody = JSON.parse(videoStatusData.body); // bodyの中身を解釈


            
            if (videoStatusBody.status === 'SUCCEEDED') {
                console.log("第二ポーリング成功だよ")
                console.log("動画のurl:",videoStatusBody.output)
                clearInterval(pollingInterval);
                addVideoMessage(videoStatusBody.output); // 最終的な動画URLを表示
                loadingDiv.classList.add('hidden');
                sendBtn.disabled = false;
            } else if (videoStatusBody.status === 'FAILED') {
                clearInterval(pollingInterval);
                throw new Error(`動画合成に失敗しました。`);
            }
            // 'RUNNING'の間は待機
        } catch (error) {
            clearInterval(pollingInterval);
            addErrorMessage(error.message);
            loadingDiv.classList.add('hidden');
            sendBtn.disabled = false;
        }
    }, 10000); // 動画合成は時間がかかるため10秒おきに確認
}





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

// 音楽プレーヤーを画面に表示する関数
function addAudioMessage(url) {
    const audioContainer = document.createElement('div');
    audioContainer.classList.add('audio-container');
    const audio = document.createElement('audio');
    audio.controls = true; // 操作パネルは表示したまま
    audio.preload = 'auto';
    audio.src = url;

    // audio要素をグローバル変数に保存
    currentAudio = audio;
    
    // 再生ボタンを有効化
    playBtn.disabled = false;

    audioContainer.appendChild(audio);
    chatHistoryDiv.appendChild(audioContainer);
}

function addVideoMessage(url) {
    const container = document.createElement('div');
    container.classList.add('video-container');
    const video = document.createElement('video');
    video.controls = true;
    video.preload = 'auto';
    video.src = url;
    video.playsInline = true;

    // video要素をグローバル変数に保存
    // ★★★ このままだと音楽と競合するため、currentMediaなどに変更するのが望ましい ★★★
    currentAudio = video; 
    
    // 既存の再生ボタンを有効化
    playBtn.disabled = false;

    container.appendChild(video);
    chatHistoryDiv.appendChild(container);
}
