import json
import os
import boto3
import base64
import uuid
import random
import urllib.request

s3 = boto3.client('s3')
bedrock = boto3.client('bedrock-runtime')

BUCKET_NAME         = os.environ['BUCKET_NAME']
AWS_REGION          = os.environ.get('AWS_REGION', 'us-east-1')
REPLICATE_API_URL   = "https://api.replicate.com/v1/predictions"
MUSICGEN_VERSION    = "7a76a8258b23fae65c5a22debb8841d1d7e816b75c2f24218cd2bd8573787906"
REPLICATE_API_TOKEN = os.environ['REPLICATE_API_TOKEN']

def lambda_handler(event, context):
    try:
        prompt = event.get('prompt', 'a beautiful cat')
        
        # プロンプトが空の場合のデフォルト値を設定
        if not prompt:
            prompt = "a beautiful cat"

        # --- 音楽生成の開始リクエスト ---
        replicate_body = {
            "version": MUSICGEN_VERSION,
            "input": {"prompt": prompt}
        }
        req = urllib.request.Request(
            REPLICATE_API_URL,
            data=json.dumps(replicate_body).encode('utf-8'),
            headers={
                "Authorization": f"Token {REPLICATE_API_TOKEN}",
                "Content-Type": "application/json"
            }
        )
        with urllib.request.urlopen(req) as res:
            music_resp = json.loads(res.read().decode())
        prediction_id = music_resp.get("id")

        # --- 画像生成 ---
        seed = random.randint(0, 2**31-1)
        bedrock_request = {
            "taskType": "TEXT_IMAGE",
            "textToImageParams": {"text": prompt},
            "imageGenerationConfig": {
                "numberOfImages": 1, "quality": "standard",
                "height": 1024, "width": 1024,
                "cfgScale": 8.0, "seed": seed
            }
        }
        bedrock_resp = bedrock.invoke_model(
            body=json.dumps(bedrock_request),
            modelId = 'amazon.titan-image-generator-v2:0',
        )

        resp_body = json.loads(bedrock_resp['body'].read())
        img_data  = base64.b64decode(resp_body['images'][0])

        img_key = f"image-{uuid.uuid4()}.png"
        s3.put_object(Bucket=BUCKET_NAME, Key=img_key, Body=img_data, ContentType='image/png')
        imageUrl = f"https://{BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{img_key}"

        # --- 最終レスポンス ---
        response_body = {
            'imageUrl': imageUrl,
            'prediction_id': prediction_id
        }
        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(response_body)
        }
    except Exception as e:
        print(e)
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)})}