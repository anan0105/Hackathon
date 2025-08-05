# Step Functions から渡された「画像の S3 URL」と「音声の S3 URL」を受け取り、静止画＋音声をマージして MP4 動画を作成し、S3 にアップロード
import os, uuid, subprocess
import boto3

s3 = boto3.client('s3')
BUCKET = os.environ['BUCKET_NAME']
REGION = os.environ.get('AWS_REGION', 'us-east-1')

def lambda_handler(event, context):
    try:
        # --- ログ: イベント受信 ---
        print("[START] Event received:", event)

        # --- STEP1: URL取得とキー抽出 ---
        img_url = event['image_s3_url']
        aud_url = event['music_s3_url']
        print(f"[STEP1] image_s3_url={img_url}, music_s3_url={aud_url}")
        img_key = img_url.split('/')[-1]
        aud_key = aud_url.split('/')[-1]

        # --- STEP2: ファイルダウンロード ---
        print(f"[STEP2] Downloading image ({img_key}) and audio ({aud_key}) to /tmp")
        s3.download_file(BUCKET, img_key, "/tmp/image.png")
        s3.download_file(BUCKET, aud_key, "/tmp/music.wav")
        print("[STEP2] Download complete")

        # --- STEP3: ffmpeg 合成 ---
        out = "/tmp/output.mp4"
        cmd = [
            "/opt/bin/ffmpeg", "-y",
            "-loop", "1", "-i", "/tmp/image.png",
            "-i", "/tmp/music.wav",
            "-c:v", "libx264", "-tune", "stillimage",
            "-c:a", "aac", "-b:a", "192k",
            "-shortest", "-pix_fmt", "yuv420p", out
        ]
        print("[STEP3] Running ffmpeg:", ' '.join(cmd))
        subprocess.run(cmd, check=True)
        print(f"[STEP3] ffmpeg finished, output file at {out}")

        # --- STEP4: 動画アップロード ---
        key = f"video-{uuid.uuid4()}.mp4"
        print(f"[STEP4] Uploading video to s3://{BUCKET}/{key}")
        s3.upload_file(out, BUCKET, key, ExtraArgs={'ContentType':'video/mp4'})
        url = f"https://{BUCKET}.s3.{REGION}.amazonaws.com/{key}"
        print("[STEP4] Uploaded video URL:", url)

        # --- 結果返却 ---
        result = {'status': 'succeeded', 'output': url}
        print("[END] Returning result:", result)
        return result

    except Exception as e:
        print("[ERROR] Exception occurred:", str(e), flush=True)
        raise