import json
import boto3
import base64
import uuid
import os
import random


s3 = boto3.client('s3')
bedrock = boto3.client(service_name='bedrock-runtime')

BUCKET_NAME = 'ai-hackathon-output-0002' # ご自身のS3バケット名

def lambda_handler(event, context):
    try:

        prompt = event.get('prompt', 'a beautiful cat')
        
        # プロンプトが空の場合のデフォルト値を設定
        if not prompt:
            prompt = "a beautiful cat"

        seed = random.randint(0, 2147483647)

        bedrock_body = json.dumps({
            "taskType": "TEXT_IMAGE",
            "textToImageParams": {
                "text": prompt,
            },
            "imageGenerationConfig": {
                "numberOfImages": 1,
                "quality": "standard",
                "height": 1024,
                "width": 1024,
                "cfgScale": 8.0,
                "seed": seed
            }
        })

        modelId = 'amazon.titan-image-generator-v1'
        
        response = bedrock.invoke_model(
            body=bedrock_body,
            modelId=modelId,
            accept='application/json',
            contentType='application/json'
        )
        
        response_body = json.loads(response.get('body').read())
        base64_image = response_body.get('images')[0]
        image_data = base64.b64decode(base64_image)

        file_name = f'{uuid.uuid4()}.png'
        s3.put_object(Bucket=BUCKET_NAME, Key=file_name, Body=image_data, ContentType='png')
        
        url = f"https://{BUCKET_NAME}.s3.{os.environ.get('AWS_REGION')}.amazonaws.com/{file_name}"

        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'OPTIONS,POST'
            },
            'body': json.dumps({'imageUrl': url})
        }
    except Exception as e:
        print(e)
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)})}
