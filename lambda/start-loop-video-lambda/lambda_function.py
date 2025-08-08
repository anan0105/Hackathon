import json
import boto3
import os

sfn = boto3.client('stepfunctions')
# 環境変数からステートマシンのARNを取得
STATE_MACHINE_ARN = os.environ['STATE_MACHINE_ARN']

def lambda_handler(event, context):
    try:
        prompt = event.get('prompt', 'a beautiful cat')
        print("--- Received Event ---")
        print(json.dumps(event, indent=2))
        print("----------------------")

        
        if not prompt:
            raise ValueError("Prompt is required")

        response = sfn.start_execution(
            stateMachineArn=STATE_MACHINE_ARN,
            input=json.dumps({'prompt': prompt})
        )
        print("--- Received Event_2 ---")
        print(response)
        print("----------------------")
        
        return {
            'statusCode': 202,
            'headers': { 'Access-Control-Allow-Origin': '*' },
            'body': json.dumps({'executionArn': response['executionArn']})
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': { 'Access-Control-Allow-Origin': '*' },
            'body': json.dumps({'error': str(e)})
        }