import json
import os
import urllib.request
import boto3
import uuid

s3 = boto3.client('s3')

REPLICATE_API_URL = "https://api.replicate.com/v1/predictions"
#以下環境変数のため、人それぞれ
REPLICATE_API_TOKEN = os.environ.get('REPLICATE_API_TOKEN')
BUCKET_NAME = os.environ.get('BUCKET_NAME')

def lambda_handler(event, context):
    try:
        # eventから直接 'id' を取得
        prediction_id = event.get('id')
        print(f"Received prediction_id: {prediction_id}") # ★★★ ログを追加 ★★★
        if not prediction_id:
            raise ValueError("prediction_id is required")

        status_url = f"{REPLICATE_API_URL}/{prediction_id}"
        print(f"status_url: {status_url}") # ★★★ ログを追加 ★★★
        headers = { "Authorization": f"Token {REPLICATE_API_TOKEN}" }
        req = urllib.request.Request(status_url, headers=headers)

        with urllib.request.urlopen(req) as res:
            data = json.loads(res.read().decode())
        
        # もし生成が成功していれば、S3に保存する処理を追加
        if data.get("status") == "succeeded":
            print(f"succeeded or missed: succeeded") 
            music_file_url = data.get("output")
            if music_file_url:
                # 1. Replicateから音楽データをダウンロード
                with urllib.request.urlopen(music_file_url) as response:
                    music_data = response.read()

                # 2. ダウンロードした音楽データをS3にアップロード
                file_name = f'{uuid.uuid4()}.wav'
                s3.put_object(
                    Bucket=BUCKET_NAME,
                    Key=file_name,
                    Body=music_data,
                    ContentType='audio/wav'
                )
                print(f"kokomadekitayo")

                # 3. S3の公開URLを生成して、元のデータに追加
                s3_url = f"https://{BUCKET_NAME}.s3.{os.environ.get('AWS_REGION')}.amazonaws.com/{file_name}"
                data["output"] = s3_url # outputの値をS3のURLに置き換える

        # プロキシ統合用の戻り値
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'OPTIONS,POST'
            },
            'body': json.dumps(data)
        }
    except Exception as e:
        print(f"[ERROR] An exception occurred: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }