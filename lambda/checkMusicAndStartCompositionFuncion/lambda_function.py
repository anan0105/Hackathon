import os, json, urllib.request, uuid
import boto3

# クライアント初期化
s3 = boto3.client('s3')
sf = boto3.client('stepfunctions')

# 環境変数
REPLICATE_API_URL = "https://api.replicate.com/v1/predictions"
TOKEN             = os.environ['REPLICATE_API_TOKEN']
BUCKET            = os.environ['BUCKET_NAME']
FSM_ARN           = os.environ['STATE_MACHINE_ARN']


def lambda_handler(event, context):
    try:
        # --- ログ出力: イベント受信 ---
        print("[START] Received event:", json.dumps(event))


        # API Gatewayのタイムアウト(29秒)の3秒前に警告を出す
        time_left = context.get_remaining_time_in_millis()
        if time_left < 3000:
            print("[WARNING] API Gateway timeout is imminent!")

        # --- 1) パラメータ取得 ---
        image_url     = event.get('image_s3_url')
        prediction_id = event.get('music_prediction_id')
        print(f"[STEP1] imageUrl={image_url}, prediction_id={prediction_id}")
        if not image_url or not prediction_id:
            print("[ERROR] Missing parameters")
            return {
                "statusCode": 400,
                "headers": {"Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"error": "image_s3_url と music_prediction_id が必須です"})
            }

        # --- 2) Replicate ステータス確認 ---
        status_url = f"{REPLICATE_API_URL}/{prediction_id}"
        print(f"[STEP2] Checking Replicate status at {status_url}")
        req = urllib.request.Request(status_url, headers={"Authorization": f"Token {TOKEN}"})
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
        print("[STEP2] Replicate response:", data)
        if data.get('status') != 'succeeded':
            print("[STEP2] Status not succeeded, returning processing")
            return {
                "statusCode": 200,
                "headers": {"Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"status": "processing"})
            }

        # --- 3) 音声データのダウンロード & S3 保存 ---
        out_url  = data['output']
        print(f"[STEP3] Downloading audio from {out_url}")
        wav_data = urllib.request.urlopen(out_url).read()
        key      = f"audio-{uuid.uuid4()}.wav"
        print(f"[STEP3] Uploading audio to S3://{BUCKET}/{key}")
        s3.put_object(Bucket=BUCKET, Key=key, Body=wav_data, ContentType='audio/wav')
        music_s3_url = f"https://{BUCKET}.s3.{os.environ['AWS_REGION']}.amazonaws.com/{key}"
        print("[STEP3] Music S3 URL:", music_s3_url)

        # --- 4) Step Functions 実行開始 ---
        exec_input = {
            'image_s3_url': image_url,
            'music_s3_url': music_s3_url
        }
        print("[STEP4] Starting Step Functions with input:", exec_input)
        resp = sf.start_execution(stateMachineArn=FSM_ARN, input=json.dumps(exec_input))
        execution_arn = resp['executionArn']
        print("[STEP4] Execution ARN:", execution_arn)

        # --- 5) レスポンス返却 ---
        response_payload = {
            "status":        "composition_started",
            "execution_arn": execution_arn
        }
        print("[END] Response payload:", response_payload)
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin":      "*",
                "Access-Control-Allow-Headers":     "Content-Type",
                "Access-Control-Allow-Methods":     "OPTIONS,POST"
            },
            "body": json.dumps(response_payload)
        }

    except Exception as e:
        # 例外時の開発者向けログ
        print("[ERROR] Exception occurred:", str(e), flush=True)
        # クライアント向けに 500 を返却
        return {
            "statusCode": 500,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": str(e)})
        }
