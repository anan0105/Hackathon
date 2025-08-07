import json
import boto3

sfn = boto3.client('stepfunctions')

def lambda_handler(event, context):
    try:

        arn = event.get('executionArn')

        
        if not arn:
            raise ValueError("executionArn is required")

        response = sfn.describe_execution(executionArn=arn)
        
        status = response['status']
        output = {}

        if status == 'SUCCEEDED':
            output = response['output']
        elif status == 'FAILED':
            output = response.get('cause', 'An unknown error occurred.')
            
        return {
            'statusCode': 200,
            'headers': { 'Access-Control-Allow-Origin': '*' },
            'body': json.dumps({
                'status': status,
                'output': output
            })
        }
    except Exception as e:
        # エラーログをCloudWatchに出力するためにprint文を追加
        print(f"Error: {e}")
        return {
            'statusCode': 500,
            'headers': { 'Access-Control-Allow-Origin': '*' },
            'body': json.dumps({'error': str(e)})
        }