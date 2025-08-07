import json
import boto3
import base64
import os
from PIL import Image
import io
import hashlib

s3 = boto3.client('s3')
bedrock = boto3.client(service_name='bedrock-runtime')

# 環境変数から設定値を取得
BUCKET_NAME = os.environ['BUCKET_NAME']
MODEL_ID = 'amazon.titan-image-generator-v2:0'
NUM_FRAMES = 8
FRAME_DURATION = 150

def lambda_handler(event, context):
    try:
        # Step Functionsから渡されるプロンプトを取得
        prompt = event['prompt']
        
        # プロンプトから一意のseed値を生成
        seed = int(hashlib.sha256(prompt.encode('utf-8')).hexdigest(), 16) % 2147483647

        images = []
        for i in range(NUM_FRAMES):
            enhanced_prompt = f"{prompt}, animated, frame {i+1}/{NUM_FRAMES}"
            bedrock_body = json.dumps({
                "taskType": "TEXT_IMAGE",
                "textToImageParams": {"text": enhanced_prompt},
                "imageGenerationConfig": {
                    "numberOfImages": 1, "quality": "standard",
                    "height": 512, "width": 512,
                    "cfgScale": 8.0, "seed": seed
                }
            })
            response = bedrock.invoke_model(body=bedrock_body, modelId=MODEL_ID)
            response_body = json.loads(response.get('body').read())
            image_data = base64.b64decode(response_body.get('images')[0])
            images.append(Image.open(io.BytesIO(image_data)))

        gif_buffer = io.BytesIO()
        images[0].save(gif_buffer, format='GIF', save_all=True, append_images=images[1:], duration=FRAME_DURATION, loop=0)
        gif_buffer.seek(0)
        
        # ファイル名はコンテキストからユニークなIDを利用
        file_name = f'{context.aws_request_id}.gif'
        s3.put_object(Bucket=BUCKET_NAME, Key=file_name, Body=gif_buffer, ContentType='image/gif')
        url = f"https://{BUCKET_NAME}.s3.{os.environ.get('AWS_REGION')}.amazonaws.com/{file_name}"

        # 成功した場合、結果のURLを含む辞書をreturnする
        return {
            'statusCode': 200,
            'gifUrl': url
        }

    except Exception as e:
        print(e)
        # 失敗した場合はエラーをraiseする
        raise e