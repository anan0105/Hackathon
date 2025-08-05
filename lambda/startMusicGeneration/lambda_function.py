import json
import os
import urllib.request

REPLICATE_API_URL = "https://api.replicate.com/v1/predictions"
MUSICGEN_VERSION = "7a76a8258b23fae65c5a22debb8841d1d7e816b75c2f24218cd2bd8573787906"
#以下環境変数のため人それぞれ
REPLICATE_API_TOKEN = os.environ.get('REPLICATE_API_TOKEN')

def lambda_handler(event, context):
    try:
        # カスタム統合に合わせて、eventから直接promptを取得
        prompt = event.get('prompt', 'a peaceful piano melody')

        start_body = { "version": MUSICGEN_VERSION, "input": {"prompt": prompt} }
        headers = { "Authorization": f"Token {REPLICATE_API_TOKEN}", "Content-Type": "application/json" }
        
        req = urllib.request.Request(REPLICATE_API_URL, data=json.dumps(start_body).encode('utf-8'), headers=headers)
        
        with urllib.request.urlopen(req) as res:
            data = json.loads(res.read().decode())
        
        prediction_id = data.get("id")

        # プロキシ統合用の戻り値
        return {
            'statusCode': 202,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'OPTIONS,POST'
            },
            'body': json.dumps({'prediction_id': prediction_id})
        }
    except Exception as e:
        print(e)
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)})}