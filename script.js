// ご自身のAPI GatewayのURLに書き換えてください
const API_BASE_URL = 'https://d7f37136t4.execute-api.us-east-1.amazonaws.com/prod_3'; // 例


// 各機能のエンドポイントURLを設定
const API_ENDPOINTS = {
    image: `${API_BASE_URL}/generate-image`,
    gif_start: `${API_BASE_URL}/start-gif-generate`,   
    gif_status: `${API_BASE_URL}/check-gif-status`,    
    music_start: `${API_BASE_URL}/start-music-generation`,
    music_status: `${API_BASE_URL}/check-music-status`,
    video_start: `${API_BASE_URL}/start-video-generation`,
    music_composition_check: `${API_BASE_URL}/check-music-and-start-composition`,
    video_status: `${API_BASE_URL}/check-composition-status`
};

let currentRoom = 'image';
let pollingInterval;
let currentAudio = null; 

const chatHistories = {
    image: '<p class="system-message">静止画生成ルームへようこそ！</p>', // 文言を修正
    gif: '<p class="system-message">GIF画像生成ルームへようこそ！</p>', // ▼▼▼ GIF用の履歴を追加 ▼▼▼
    music: '<p class="system-message">音楽生成ルームへようこそ！</p>',
    video: '<p class="system-message">動画生成ルームへようこそ！</p>'
};


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
const homeBtn = document.getElementById('home-btn'); 

// サイドバー開閉ボタン
sidebarToggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
});

// タイトルに戻るボタンの処理
homeBtn.addEventListener('click', () => {
    window.location.href = 'title.html'; 
});


// ルーム切り替え処理
navButtons.forEach(button => {
    button.addEventListener('click', () => {
        chatHistories[currentRoom] = chatHistoryDiv.innerHTML;
        currentRoom = button.dataset.room;
        chatHistoryDiv.innerHTML = chatHistories[currentRoom];

        navButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        if (pollingInterval) clearInterval(pollingInterval);


        if (currentRoom === 'image') {
            roomTitle.textContent = 'AI Image Generator';
            promptInput.placeholder = '作りたい画像の日本語プロンプトを入力';
        } else if (currentRoom === 'gif') {
            roomTitle.textContent = 'AI GIF Generator';
            promptInput.placeholder = '作りたいGIFアニメの日本語プロンプトを入力';
        } else if (currentRoom === 'music') {
            roomTitle.textContent = 'AI Music Generator';
            promptInput.placeholder = '作りたい音楽の日本語プロンプトを入力';
        } else {
            roomTitle.textContent = 'AI Video Generator';
            promptInput.placeholder = '作りたい動画の日本語プロンプトを入力';
        }

        
        chatHistoryDiv.scrollTop = chatHistoryDiv.scrollHeight;
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
        addSystemMessage('日本語を英語に翻訳中...');
        const translateResponse = await fetch(`${TRANSLATE_API_URL}?text=${encodeURIComponent(japanesePrompt)}`);
        if (!translateResponse.ok) throw new Error('翻訳APIでエラーが発生しました。');
        const translationData = await translateResponse.json();
        const englishPrompt = translationData.translated;

        addSystemMessage(`翻訳結果: ${englishPrompt}`);
        console.log(`Translated to English: ${englishPrompt}`);


        if (currentRoom === 'image') {
            await handleImageGeneration(englishPrompt);
        } else if (currentRoom === 'gif') {
            await handleGifGeneration(englishPrompt);
        } else if (currentRoom === 'music') {
            await handleMusicGeneration(englishPrompt);
        } else if (currentRoom === 'video') { 
            await handleVideoGeneration(englishPrompt);
        }


    } catch (error) {
        addErrorMessage(error.message);
        loadingDiv.classList.add('hidden');
        sendBtn.disabled = false;
    }
});

// 再生ボタンの処理
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
        
        const data = await response.json();
        const responseBody = JSON.parse(data.body); 
        addImageMessage(responseBody.imageUrl);    

    } catch (error) {
        addErrorMessage(error.message);
    } finally {
        loadingDiv.classList.add('hidden');
        sendBtn.disabled = false;
        chatHistoryDiv.scrollTop = chatHistoryDiv.scrollHeight;
    }
}






// handleGifGeneration関数をStep Functions用に全面改訂
async function handleGifGeneration(prompt) {
    try {
        addSystemMessage("GIF生成ワークフローを開始します...");
        const startResponse = await fetch(API_ENDPOINTS.gif_start, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: prompt }),
        });
        if (!startResponse.ok) throw new Error(`ワークフローの開始に失敗: ${await startResponse.text()}`);
        
        const startData = await startResponse.json();
        const responseBody = JSON.parse(startData.body);
        const executionArn = responseBody.executionArn;



        if (!executionArn) throw new Error('実行IDの取得に失敗しました。');
        addSystemMessage(`実行ID: ${executionArn.split(':').pop()} で生成中です...`);

        pollingInterval = setInterval(async () => {
            try {

                const statusResponse = await fetch(API_ENDPOINTS.gif_status, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ executionArn: executionArn })
                });


                // 以降の処理は同じ
                if (statusResponse.status === 403) throw new Error('認証エラー(403)が発生しました。APIの認証設定を確認してください。');
                if (!statusResponse.ok) throw new Error(`ステータスの確認に失敗しました: ${statusResponse.status}`);


                const statusGif = await statusResponse.json();
                const statusData = JSON.parse(statusGif.body);



                if (statusData.status === 'SUCCEEDED') {
                    clearInterval(pollingInterval);
                    addSystemMessage("GIF生成が完了しました！");
                    // outputはさらにJSON文字列になっているので二重にパース
                    const finalOutput = JSON.parse(statusData.output);
                    addImageMessage(finalOutput.gifUrl);
                    loadingDiv.classList.add('hidden');
                    sendBtn.disabled = false;
                } else if (statusData.status === 'FAILED') {
                    clearInterval(pollingInterval);
                    throw new Error(`生成に失敗しました: ${statusData.output}`);
                }
                // 'RUNNING'の間は待機
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





// --- 音楽生成処理 ---
async function handleMusicGeneration(prompt) {
    try {
        const startResponse = await fetch(API_ENDPOINTS.music_start, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: prompt }),
        });
        if (!startResponse.ok) throw new Error(`APIエラー (start)`);
        
        const startData = await startResponse.json();
        const responseBody = JSON.parse(startData.body);
        const predictionId = responseBody.prediction_id;

        if (!predictionId) throw new Error('生成ジョブの開始に失敗。');

        console.log("取得したPrediction ID:", predictionId);
        
        pollingInterval = setInterval(async () => {
            try {
                const statusResponse = await fetch(API_ENDPOINTS.music_status, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: predictionId })
                });
                if (!statusResponse.ok) {
                    clearInterval(pollingInterval);
                    throw new Error(`APIエラー (status)`);
                }
                
                const statusData = await statusResponse.json();
                const statusBody = JSON.parse(statusData.body);

                if (statusBody.status === 'succeeded') {
                    clearInterval(pollingInterval);
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

// --- 動画生成処理（3段階非同期） ---
async function handleVideoGeneration(prompt) {
    if (pollingInterval) clearInterval(pollingInterval);

    try {
        addSystemMessage("画像生成と音楽生成を開始します...");
        const startResponse = await fetch(API_ENDPOINTS.video_start, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: prompt }),
        });
        if (!startResponse.ok) throw new Error(`APIエラー (start)`);

        const startData = await startResponse.json();
        const responseBody = JSON.parse(startData.body); 
        
        const imageS3Url = responseBody.imageUrl;
        const musicPredictionId = responseBody.prediction_id;

        if (!imageS3Url || !musicPredictionId) throw new Error('生成ジョブの開始に失敗。');
        
        addImageMessage(imageS3Url);
        addSystemMessage("音楽の生成完了を待っています...");

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

                const musicStatusData = await musicStatusResponse.json();
                const musicStatusBody = JSON.parse(musicStatusData.body); 

                if (musicStatusBody.status === 'composition_started') {
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

// --- 第2ポーリング：動画合成の完了を確認する関数 ---
function startSecondPolling(executionArn) {
    pollingInterval = setInterval(async () => {
        try {
            const videoStatusResponse = await fetch(API_ENDPOINTS.video_status, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ execution_arn: executionArn })
            });
            if (!videoStatusResponse.ok) throw new Error(`APIエラー (video_status)`);

            const videoStatusData = await videoStatusResponse.json();
            const videoStatusBody = JSON.parse(videoStatusData.body); 
            
            if (videoStatusBody.status === 'SUCCEEDED') {
                clearInterval(pollingInterval);
                addVideoMessage(videoStatusBody.output); 
                loadingDiv.classList.add('hidden');
                sendBtn.disabled = false;
            } else if (videoStatusBody.status === 'FAILED') {
                clearInterval(pollingInterval);
                throw new Error(`動画合成に失敗しました。`);
            }
        } catch (error) {
            clearInterval(pollingInterval);
            addErrorMessage(error.message);
            loadingDiv.classList.add('hidden');
            sendBtn.disabled = false;
        }
    }, 10000); 
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

function addAudioMessage(url) {
    const audioContainer = document.createElement('div');
    audioContainer.classList.add('audio-container');
    const audio = document.createElement('audio');
    audio.controls = true; 
    audio.preload = 'auto';
    audio.src = url;
    currentAudio = audio;
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
    currentAudio = video; 
    playBtn.disabled = false;
    container.appendChild(video);
    chatHistoryDiv.appendChild(container);
}

window.addEventListener('load', () => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');

    if (room) {
        const targetButton = document.querySelector(`.nav-btn[data-room="${room}"]`);
        if (targetButton) {
            targetButton.click();
        }
    } else {
        // デフォルトのルームの履歴を表示
        chatHistoryDiv.innerHTML = chatHistories[currentRoom];
    }
});