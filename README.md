# lambda_dynamodb_test
LambdaとDynamoDBを用いた簡単なAPIを初めて作成してみるテスト


## 想定アプリ
簡単なカジュアルゲーム
ワンタップゲームのようなゲームで、スコアを登録、ハイスコアでランキングを表示させるもの

## Architecture
### API
API Gateway + Lambda + DynamoDB

### batch
ランキング更新をする
CloudWatch Events + Lmabda (+DynamoDB)

## API Gateway

|API|概要|
|---|---|
|/signup|登録|
|/signin|ログイン（今回は使ってない）|
|/user|ユーザ情報の取得|
|/score|スコア登録|
|/ranking|ランキング取得|
|/batch|バッチを手動で実行するためのデバッグ用API|
