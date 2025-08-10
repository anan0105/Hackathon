window.addEventListener('load', () => {

    // ★★★ ご自身のAPI GatewayのURLに書き換えてください ★★★
    const API_BASE_URL = 'https://d7f37136t4.execute-api.us-east-1.amazonaws.com/prod_3'; // 例

    const API_ENDPOINTS = {
        image: `${API_BASE_URL}/generate-image`,
        gif_start: `${API_BASE_URL}/start-gif-generate`,
        gif_status: `${API_BASE_URL}/check-gif-status`,
        music_start: `${API_BASE_URL}/start-music-generation`,
        music_status: `${API_BASE_URL}/check-music-status`,
        video_start: `${API_BASE_URL}/start-video-generation`,
        music_composition_check: `${API_BASE_URL}/check-music-and-start-composition`,
        video_status: `${API_BASE_URL}/check-composition-status`,
        loop_video_start: `${API_BASE_URL}/start-loop-video-generation`,
        loop_video_status: `${API_BASE_URL}/check-loop-video-status`,
    };

    let currentRoom = 'image';
    let pollingIntervals = {};
    let currentAudio = null;

    // --- HTML要素の取得 ---
    const sidebar = document.getElementById('sidebar');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const sendBtn = document.getElementById('send-btn');
    const playBtn = document.getElementById('play-btn');
    const promptInput = document.getElementById('prompt-input');
    const loadingDiv = document.getElementById('loading');
    const roomTitle = document.getElementById('room-title');
    const navButtons = document.querySelectorAll('.nav-btn');
    const homeBtn = document.getElementById('home-btn');
    const chatArea = document.getElementById('chat-area');
    const gameContainer = document.getElementById('game-container');

    // --- イベントリスナーの設定 ---
    sidebarToggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        document.querySelector('.container').classList.toggle('sidebar-open');
    });

    homeBtn.addEventListener('click', () => {
        window.location.href = 'index.html';
    });
    
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            removeNotification(button);
            const newRoom = button.dataset.room;
            currentRoom = newRoom;
            
            document.querySelectorAll('.chat-history-panel').forEach(panel => {
                panel.classList.remove('active-panel');
            });

            if (newRoom === 'game') {
                roomTitle.textContent = 'ミニゲーム';
                chatArea.classList.add('hidden');
                gameContainer.classList.remove('hidden');
            } else {
                gameContainer.classList.add('hidden');
                chatArea.classList.remove('hidden');
                const targetPanel = document.getElementById(`chat-history-${newRoom}`);
                if(targetPanel) targetPanel.classList.add('active-panel');

                const roomConfig = {
                    image: { title: 'AI Image Generator', placeholder: '作りたい画像の日本語プロンプトを入力' },
                    gif: { title: 'AI GIF Generator', placeholder: '作りたいGIFアニメの日本語プロンプトを入力' },
                    music: { title: 'AI Music Generator', placeholder: '作りたい音楽の日本語プロンプトを入力' },
                    video: { title: 'AI Video Generator', placeholder: '作りたい動画の日本語プロンプトを入力' },
                    loop_video: { title: 'AI Loop Video Generator', placeholder: '作りたいループ動画の日本語プロンプトを入力' }
                };
                roomTitle.textContent = roomConfig[newRoom].title;
                promptInput.placeholder = roomConfig[newRoom].placeholder;
            }
            navButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

                        // ルーム切り替え時に再生ボタンの状態を更新する
            const activePanel = document.querySelector('.chat-history-panel.active-panel');
            let lastMediaElement = null;

            if (activePanel) {
                // パネル内の最後のaudioまたはvideo要素を取得
                lastMediaElement = activePanel.querySelector('audio:last-of-type, video:last-of-type');
            }

            if (lastMediaElement) {
                currentAudio = lastMediaElement;
                playBtn.disabled = false;
                // メディアの状態に応じてボタンのテキストを正しく設定
                playBtn.textContent = currentAudio.paused ? '再生' : '停止';
            } else {
                // 再生するメディアがない場合はボタンを無効化
                currentAudio = null;
                playBtn.disabled = true;
                playBtn.textContent = '再生';
            }


        });
    });

    const TRANSLATE_API_URL = 'https://script.google.com/macros/s/AKfycbysDLQt1Di1iGqpJetaW_uEtW2tb0DqSoAq2sDWF-_gpSm8veAUPDtl9BWzaT-t6xOx/exec';

    sendBtn.addEventListener('click', async () => {
        const japanesePrompt = promptInput.value.trim();
        if (!japanesePrompt) return;
        const startedRoom = currentRoom;

        if (pollingIntervals[startedRoom]) {
            clearInterval(pollingIntervals[startedRoom]);
            delete pollingIntervals[startedRoom];
        }

        addUserMessage(japanesePrompt, startedRoom);
        loadingDiv.classList.remove('hidden');
        promptInput.value = '';
        sendBtn.disabled = true;
        if (playBtn) playBtn.disabled = true;

        try {
            addSystemMessage('日本語を英語に翻訳中...', startedRoom);
            const res = await fetch(`${TRANSLATE_API_URL}?text=${encodeURIComponent(japanesePrompt)}`);
            if (!res.ok) throw new Error('翻訳APIエラー');
            const data = await res.json();
            const englishPrompt = data.translated;
            addSystemMessage(`翻訳結果: ${englishPrompt}`, startedRoom);

            const generationHandlers = {
                image: handleImageGeneration,
                gif: handleGifGeneration,
                music: handleMusicGeneration,
                video: handleVideoGeneration,
                loop_video: handleLoopVideoGeneration
            };
            await generationHandlers[startedRoom](englishPrompt, startedRoom);

            if (startedRoom === 'image') {
                loadingDiv.classList.add('hidden');
                sendBtn.disabled = false;
            }
        } catch (error) {
            addErrorMessage(error.message, startedRoom);
            loadingDiv.classList.add('hidden');
            sendBtn.disabled = false;
        }
    });

    playBtn.addEventListener('click', () => {
        if (currentAudio) {
            currentAudio.paused ? currentAudio.play() : currentAudio.pause();
            playBtn.textContent = currentAudio.paused ? '再生' : '停止';
        }
    });

    promptInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendBtn.click();
        }
    });
    
    // --- 初期化処理 ---
    const params = new URLSearchParams(window.location.search);
    const initialRoom = params.get('room');
    if (initialRoom) {
        document.querySelector(`.nav-btn[data-room="${initialRoom}"]`)?.click();
    } else {
        document.getElementById('chat-history-image').classList.add('active-panel');
    }

    // --- メッセージ表示関連の関数 ---
    function showNotification(room) {
        const targetButton = document.querySelector(`.nav-btn[data-room="${room}"]`);
        if (!targetButton || targetButton.querySelector('.notification-popup')) return;
        const notification = document.createElement('span');
        notification.className = 'notification-popup';
        notification.textContent = '完了';
        targetButton.appendChild(notification);
    }

    function removeNotification(button) {
        button.querySelector('.notification-popup')?.remove();
    }
    
    function appendMessageToPanel(room, element) {
        const targetPanel = document.getElementById(`chat-history-${room}`);
        if (targetPanel) {
            targetPanel.appendChild(element);
            targetPanel.scrollTop = targetPanel.scrollHeight;
        }
    }

    function addUserMessage(text, room) {
        const userMessage = document.createElement('div');
        userMessage.classList.add('user-message');
        userMessage.textContent = text;
        appendMessageToPanel(room, userMessage);
    }

    function addImageMessage(url, room, fileName = 'generated.png') {
        const container = document.createElement('div');
        container.classList.add('image-container');
        const img = document.createElement('img');
        img.src = url;
        img.crossOrigin = "anonymous";
        container.appendChild(img);
        const buttonGroup = document.createElement('div');
        buttonGroup.classList.add('button-group');
        const copyBtn = document.createElement('button');
        copyBtn.textContent = '📋 コピー';
        copyBtn.onclick = () => handleCopyToClipboard(url);
        buttonGroup.appendChild(copyBtn);
        const downloadBtn = createDownloadButton(url, fileName);
        buttonGroup.appendChild(downloadBtn);
        container.appendChild(buttonGroup);
        appendMessageToPanel(room, container);
    }

    function addAudioMessage(url, room, fileName = 'generated.mp3') {
        const container = document.createElement('div');
        container.classList.add('audio-container');
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.src = url;
        container.appendChild(audio);
        const downloadBtn = createDownloadButton(url, fileName);
        container.appendChild(downloadBtn);
        appendMessageToPanel(room, container);
        if(room === currentRoom){
            currentAudio = audio;
            playBtn.disabled = false;
            playBtn.textContent = '再生';
        }
    }
    
    function addVideoMessage(url, room, fileName = 'generated.mp4') {
        const container = document.createElement('div');
        container.classList.add('video-container');
        const video = document.createElement('video');
        video.controls = true;
        video.src = url;
        video.playsInline = true;
        if (room === 'loop_video') {
            video.loop = true;
            video.autoplay = true;
            video.muted = true;
        }
        container.appendChild(video);
        const downloadBtn = createDownloadButton(url, fileName);
        container.appendChild(downloadBtn);
        appendMessageToPanel(room, container);
        if(room === currentRoom){
            currentAudio = video;
            playBtn.disabled = false;
            playBtn.textContent = video.autoplay ? '停止' : '再生';
        }
    }
    
    function addErrorMessage(text, room) {
        const p = document.createElement('p');
        p.className = 'error-message';
        p.textContent = `エラーが発生しました: ${text}`;
        appendMessageToPanel(room, p);
    }

    function addSystemMessage(text, room) {
        const p = document.createElement('p');
        p.className = 'system-message';
        p.textContent = text;
        appendMessageToPanel(room, p);
    }

    // --- 各種生成処理 ---

    async function handleImageGeneration(prompt, room) {
        try {
            const response = await fetch(API_ENDPOINTS.image, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: prompt }),
            });
            if (!response.ok) throw new Error(await response.text());
            const data = await response.json();
            const responseBody = typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
            if (responseBody && responseBody.imageUrl) {
                addImageMessage(responseBody.imageUrl, room);
                showNotification(room);
            } else {
                throw new Error('APIの応答に画像URLが含まれていませんでした。');
            }
        } catch (error) {
            throw error; // エラーを呼び出し元に伝達し、UI処理を一元化
        }
    }

    // ▼▼▼ 新設: ポーリング処理を共通化する関数 ▼▼▼
    function startPolling(apiEndpoint, payload, room, resultHandler) {
        if (pollingIntervals[room]) {
            clearInterval(pollingIntervals[room]);
        }
        pollingIntervals[room] = setInterval(async () => {
            try {
                const statusResponse = await fetch(apiEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!statusResponse.ok) throw new Error(await statusResponse.text());

                const statusBody = await statusResponse.json();
                const statusData = typeof statusBody.body === 'string' ? JSON.parse(statusBody.body) : statusBody.body;
                
                const status = statusData.status;
                const isFinished = ['SUCCEEDED', 'FAILED', 'succeeded', 'failed', 'canceled'].includes(status);
                
                if (isFinished) {
                    clearInterval(pollingIntervals[room]);
                    delete pollingIntervals[room];

                    if (status === 'SUCCEEDED' || status === 'succeeded') {
                        resultHandler(statusData); // 各機能ごとの成功処理を呼び出す
                    } else {
                        throw new Error(statusData.output || statusData.error || '不明なエラーが発生しました');
                    }
                    
                    
                    loadingDiv.classList.add('hidden');
                    sendBtn.disabled = false;
                    
                }
            } catch (error) {
                clearInterval(pollingIntervals[room]);
                delete pollingIntervals[room];
                addErrorMessage(error.message, room);
                
                loadingDiv.classList.add('hidden');
                sendBtn.disabled = false;
                
            }
        }, 5000);
    }

    async function handleGifGeneration(prompt, room) {
        try {
            addSystemMessage("GIF生成ワークフローを開始します...", room);
            const startResponse = await fetch(API_ENDPOINTS.gif_start, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: prompt }) });
            if (!startResponse.ok) throw new Error(await startResponse.text());
            const startBody = await startResponse.json();
            const executionArn = (typeof startBody.body === 'string' ? JSON.parse(startBody.body) : startBody.body).executionArn;
            if (!executionArn) throw new Error('実行IDの取得に失敗。');
            addSystemMessage(`実行ID: ${executionArn.split(':').pop()} で生成中です...`, room);

            // 共通ポーリング関数を呼び出す
            startPolling(API_ENDPOINTS.gif_status, { executionArn }, room, (statusData) => {
                const finalOutput = typeof statusData.output === 'string' ? JSON.parse(statusData.output) : statusData.output;
                addSystemMessage("GIF生成が完了しました！", room);
                addImageMessage(finalOutput.gifUrl, room, 'generated.gif');
                showNotification(room);
            });
        } catch (error) {
            addErrorMessage(error.message, room);
            
            loadingDiv.classList.add('hidden');
            sendBtn.disabled = false;
            
        }
    }

    async function handleMusicGeneration(prompt, room) {
        try {
            addSystemMessage("音楽生成を開始します...", room);
            const startResponse = await fetch(API_ENDPOINTS.music_start, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: prompt }) });
            if (!startResponse.ok) throw new Error(`APIエラー (start)`);
            const startBody = await startResponse.json();
            const predictionId = (typeof startBody.body === 'string' ? JSON.parse(startBody.body) : startBody.body).prediction_id;
            if (!predictionId) throw new Error('生成ジョブの開始に失敗。');
            addSystemMessage(`予測ID: ${predictionId} で生成中です...`, room);

            startPolling(API_ENDPOINTS.music_status, { id: predictionId }, room, (statusData) => {
                addSystemMessage("音楽が完成しました！", room);
                addAudioMessage(statusData.output, room);
                showNotification(room);
            });
        } catch (error) {
            addErrorMessage(error.message, room);
            if(room === currentRoom) {
                loadingDiv.classList.add('hidden');
                sendBtn.disabled = false;
            }
        }
    }
    
    async function handleLoopVideoGeneration(prompt, room) {
        try {
            addSystemMessage("ループ動画生成ワークフローを開始します...", room);
            const startResponse = await fetch(API_ENDPOINTS.loop_video_start, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: prompt }) });
            if (!startResponse.ok) throw new Error(await startResponse.text());
            const startBody = await startResponse.json();
            const executionArn = (typeof startBody.body === 'string' ? JSON.parse(startBody.body) : startBody.body).executionArn;
            if (!executionArn) throw new Error('実行IDの取得に失敗しました。');
            addSystemMessage(`実行ID: ${executionArn.split(':').pop()} で生成中です...`, room);

            startPolling(API_ENDPOINTS.loop_video_status, { executionArn }, room, (statusData) => {
                const finalOutput = typeof statusData.output === 'string' ? JSON.parse(statusData.output) : statusData.output;
                addSystemMessage("ループ動画生成が完了しました！", room);
                // ループ動画の場合は finalOutput.videoUrl を使用
                addVideoMessage(finalOutput.videoUrl, room, 'generated_loop.mp4');
                showNotification(room);
            });
        } catch (error) {
            // ▼▼▼ 修正点 ▼▼▼
            // 条件分岐を削除し、エラー時に必ずUIをリセットする
            addErrorMessage(error.message, room);
            loadingDiv.classList.add('hidden');
            sendBtn.disabled = false;
            // ▲▲▲ 修正点 ▲▲▲
        }
    }


    // handleVideoGeneration関数の前あたりに追加
function startMusicCheckPolling(apiEndpoint, payload, room, resultHandler) {
    const pollKey = `${room}-music-check`;
    if (pollingIntervals[pollKey]) {
        clearInterval(pollingIntervals[pollKey]);
    }

    pollingIntervals[pollKey] = setInterval(async () => {
        try {
            const statusResponse = await fetch(apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!statusResponse.ok) throw new Error(await statusResponse.text());

            const statusBody = await statusResponse.json();
            const statusData = typeof statusBody.body === 'string' ? JSON.parse(statusBody.body) : statusBody.body;
            
            const status = statusData.status;
            
            // ▼▼▼ 修正点：'composition_started'でも停止するように条件を変更 ▼▼▼
            const isFinished = ['composition_started', 'FAILED', 'failed', 'canceled'].includes(status);
            
            if (isFinished) {
                clearInterval(pollingIntervals[pollKey]);
                delete pollingIntervals[pollKey];

                if (status === 'composition_started') {
                    resultHandler(statusData); // 成功時の処理を呼び出す
                } else {
                    // 失敗した場合はエラーを投げる
                    throw new Error(statusData.output || statusData.error || '音楽生成または動画合成の開始に失敗しました');
                }
            }
            // isFinishedがfalseの場合は、次のインターバルでポーリングを続ける
        } catch (error) {
            clearInterval(pollingIntervals[pollKey]);
            delete pollingIntervals[pollKey];
            addErrorMessage(error.message, room);
            loadingDiv.classList.add('hidden');
            sendBtn.disabled = false;
        }
    }, 5000); // 5秒ごとに確認
}



    async function handleVideoGeneration(prompt, room) {
        try {
            addSystemMessage("画像生成と音楽生成を開始します...", room);
            const startResponse = await fetch(API_ENDPOINTS.video_start, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: prompt }) });
            if (!startResponse.ok) throw new Error(`APIエラー (start)`);
            const responseBody = JSON.parse((await startResponse.json()).body);
            const imageS3Url = responseBody.imageUrl;
            const musicPredictionId = responseBody.prediction_id;
            if (!imageS3Url || !musicPredictionId) throw new Error('生成ジョブの開始に失敗。');
            addImageMessage(imageS3Url, room);
            addSystemMessage("音楽の生成完了を待っています...", room);
            
            const musicPollKey = `${room}-music`;
            startMusicCheckPolling(
                API_ENDPOINTS.music_composition_check, 
                { image_s3_url: imageS3Url, music_prediction_id: musicPredictionId }, 
                room, // room名（キー識別に利用）
                (musicStatusBody) => { // 成功時のコールバック関数
                    const executionArn = musicStatusBody.execution_arn;
                    addSystemMessage("動画の合成を開始しました...", room);
                    startSecondPolling(executionArn, room);
                }
            );
        } catch (error) {
            // ▼▼▼ 修正点 ▼▼▼
            // 条件分岐を削除し、エラー時に必ずUIをリセットする
            addErrorMessage(error.message, room);
            loadingDiv.classList.add('hidden');
            sendBtn.disabled = false;
            // ▲▲▲ 修正点 ▲▲▲
        }
    }

    function startSecondPolling(executionArn, room) {
        const videoPollKey = `${room}-video`;
        startPolling(API_ENDPOINTS.video_status, { execution_arn: executionArn }, videoPollKey, (videoStatusBody) => {
            addSystemMessage("動画が完成しました！", room);

            // videoStatusBody.output には動画URLが直接入っているため、
            // JSON.parse() を使わずにそのまま videoUrl として利用する。
            const videoUrl = videoStatusBody.output;

            // videoUrlが正しく取得できているか念のためチェック
            if (videoUrl && typeof videoUrl === 'string' && videoUrl.startsWith('http')) {
                addVideoMessage(videoUrl, room, 'generated_video.mp4');
                showNotification(room);
            } else {
                addErrorMessage('受信したデータから有効な動画URLを取得できませんでした。', room);
                console.error('Invalid video URL received:', videoStatusBody);
            }

            // ▲▲▲ ここまで修正 ▲▲▲
        });
    }

    // --- ユーティリティ関数 ---
    function createDownloadButton(url, fileName) {
        const button = document.createElement('button');
        button.classList.add('download-btn');
        button.textContent = '⬇️';
        button.title = 'ダウンロード';
        button.onclick = () => handleDownload(url, fileName);
        return button;
    }

    async function handleDownload(url, fileName) {
        try {
            const response = await fetch(url, { mode: 'cors' });
            if (!response.ok) throw new Error('ファイルの取得に失敗しました。');
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = blobUrl;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(blobUrl);
            a.remove();
        } catch (error) {
            console.error('ダウンロードエラー:', error);
            window.open(url, '_blank');
            addErrorMessage('ダウンロードに失敗しました。新しいタブでファイルを開きます。', currentRoom);
        }
    }

    async function handleCopyToClipboard(imageUrl) {
        try {
            if (!navigator.clipboard || !navigator.clipboard.write) {
                throw new Error('お使いのブラウザはクリップボードAPIをサポートしていません。');
            }
            const blob = await new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'Anonymous';
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    canvas.toBlob(resolve, 'image/png');
                };
                img.onerror = () => reject(new Error('画像の読み込みに失敗しました。'));
                img.src = imageUrl;
            });
            if (!blob) throw new Error('画像形式の変換に失敗しました。');
            await navigator.clipboard.write([ new ClipboardItem({ 'image/png': blob }) ]);
            addSystemMessage('画像をクリップボードにコピーしました！', currentRoom);
        } catch (error) {
            console.error('コピー失敗:', error);
            addErrorMessage(`コピーに失敗しました: ${error.message}`, currentRoom);
        }
    }
});
