import os
import json
import boto3

# Step Functions クライアント
sf = boto3.client('stepfunctions')

def lambda_handler(event, context):
    try:
        # --- ログ: リクエスト受信 ---
        print("[START] Received event:", event)

        # --- 1) 入力パース ---
        body = event.get('body')
        if body:
            payload = json.loads(body)
        else:
            payload = event
        execution_arn = payload.get('execution_arn')
        print(f"[STEP1] execution_arn={execution_arn}")
        if not execution_arn:
            return {
                'statusCode': 400,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'execution_arn が必須です'})
            }

        # --- 2) Step Functions 実行ステータス取得 ---
        res = sf.describe_execution(executionArn=execution_arn)
        status = res.get('status')  # RUNNING, SUCCEEDED, FAILED...
        print(f"[STEP2] Execution status: {status}")

        # --- 3) 完了時のみ出力を取得 ---
        final_output_url = ''
        if status == 'SUCCEEDED':
            output = json.loads(res.get('output', '{}'))
            final_output_url = output.get('output', '')
            print(f"[STEP3] Retrieved final_output_url: {final_output_url}")

        # --- 4) プロキシ統合レスポンス ---

        response_body = {'status': status, 'output': final_output_url}
        print("[END] Response:", response_body)
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'OPTIONS,POST'
            },
            'body': json.dumps(response_body)
        }

    except Exception as e:
        print("[ERROR] Exception occurred:", str(e), flush=True)
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }