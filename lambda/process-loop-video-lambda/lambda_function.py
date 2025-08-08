import json
import boto3
import os
import hashlib
import base64
from PIL import Image
import io
import requests
import subprocess
import uuid
import threading #  threadingライブラリをインポート

# AWSクライアントの初期化
s3 = boto3.client('s3')
bedrock = boto3.client(service_name='bedrock-runtime')

# 環境変数から設定値を取得
BUCKET_NAME = os.environ['BUCKET_NAME']
REPLICATE_API_TOKEN = os.environ['REPLICATE_API_TOKEN']
MODEL_ID = 'amazon.titan-image-generator-v2:0'
NUM_FRAMES = 10
FRAME_DURATION = 200

# ▼▼▼ 音楽生成を別スレッドで実行するための関数を定義 ▼▼▼
def generate_music_task(prompt, result_container):
    try:
        print("--- (Thread) Starting Music Generation ---")
        music_output = requests.post(
            "https://api.replicate.com/v1/predictions",
            headers={"Authorization": f"Token {REPLICATE_API_TOKEN}", "Content-Type": "application/json"},
            json={"version": "riffusion/riffusion:8cf61ea6c56afd61d8f5b9ffd14d7c216c0a93844ce2d82ac1c9ecc9c7f24e05", "input": {"prompt_a": prompt}}
        ).json()
        
        while music_output.get("status") not in ["succeeded", "failed"]:
            music_output = requests.get(music_output["urls"]["get"], headers={"Authorization": f"Token {REPLICATE_API_TOKEN}"}).json()
        
        if music_output.get("status") == "failed":
            raise Exception("Music generation failed")
            
        music_url = music_output["output"]["audio"]
        music_data = requests.get(music_url).content
        
        # 結果を共有のコンテナに格納
        result_container['music_data'] = music_data
        print("--- (Thread) Music Generation Succeeded ---")
        
    except Exception as e:
        # エラーを共有のコンテナに格納
        result_container['error'] = e
        print(f"--- (Thread) Music Generation Failed: {e} ---")
# ▲▲▲ ここまで ▲▲▲

def lambda_handler(event, context):
    try:
        prompt = event['prompt']
        
        # --- 1. 音楽生成をバックグラウンドで開始 ---
        music_result = {} # スレッドからの結果を受け取るための辞書
        music_thread = threading.Thread(target=generate_music_task, args=(prompt, music_result))
        music_thread.start() # 音楽生成スレッドを開始

        # --- 2. 音楽生成を待たずにGIF生成を開始 ---
        print("--- 1. Starting GIF Generation (in parallel) ---")
        seed = int(hashlib.sha256(prompt.encode('utf-8')).hexdigest(), 16) % 2147483647
        images = []
        for i in range(NUM_FRAMES):
            enhanced_prompt = f"{prompt}, animated, frame {i+1}/{NUM_FRAMES}"
            bedrock_body = json.dumps({ "taskType": "TEXT_IMAGE", "textToImageParams": {"text": enhanced_prompt}, "imageGenerationConfig": { "numberOfImages": 1, "quality": "standard", "height": 512, "width": 512, "cfgScale": 8.0, "seed": seed }})
            response = bedrock.invoke_model(body=bedrock_body, modelId=MODEL_ID)
            response_body = json.loads(response.get('body').read())
            image_data = base64.b64decode(response_body.get('images')[0])
            images.append(Image.open(io.BytesIO(image_data)))

        gif_buffer = io.BytesIO()
        images[0].save(gif_buffer, format='GIF', save_all=True, append_images=images[1:], duration=FRAME_DURATION, loop=0)
        gif_buffer.seek(0)
        
        gif_path = f"/tmp/{uuid.uuid4()}.gif"
        with open(gif_path, 'wb') as f:
            f.write(gif_buffer.read())
        print(f"GIF saved to {gif_path}")

        # --- 3. 音楽生成の完了を待機（合流） ---
        print("--- 2. Waiting for music generation to complete ---")
        music_thread.join() # 音楽生成スレッドが終わるまで待つ

        # スレッドでエラーが発生したかチェック
        if 'error' in music_result:
            raise music_result['error']
        
        music_data = music_result['music_data']
        music_path = f"/tmp/{uuid.uuid4()}.wav"
        with open(music_path, 'wb') as f:
            f.write(music_data)
        print(f"Music saved to {music_path}")
            
        # --- 4. FFmpegで動画を合成 ---
        print("--- 3. Combining GIF and Music with FFmpeg ---")
        output_video_path = f"/tmp/{uuid.uuid4()}.mp4"
        
        command = [
            '/opt/bin/ffmpeg',
            '-i', gif_path,
            '-i', music_path,
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-shortest',
            output_video_path
        ]
        subprocess.run(command, check=True)
        print(f"Video created at {output_video_path}")

        # --- 5. 完成した動画をS3にアップロード ---
        print("--- 4. Uploading final video to S3 ---")
        file_name = f'loop_videos/{context.aws_request_id}.mp4'
        with open(output_video_path, 'rb') as f:
            s3.put_object(Bucket=BUCKET_NAME, Key=file_name, Body=f, ContentType='video/mp4')
            
        final_video_url = f"https://{BUCKET_NAME}.s3.{os.environ.get('AWS_REGION')}.amazonaws.com/{file_name}"
        
        return {
            'statusCode': 200,
            'videoUrl': final_video_url
        }

    except Exception as e:
        print(e)
        raise e












