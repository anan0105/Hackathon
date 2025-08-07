# MUSEmaker
仮
## アプリの概要
MUSEmakerは、テキスト入力をもとに**画像・音楽・GIF・動画**を自動生成してWeb上で表示・再生できるアプリケーションです。

以下のコンテンツをすべてブラウザ上で生成・再生可能です：

- テキストから画像生成（text-to-image）
- テキストから音楽生成（text-to-music）
- テキストからGIF生成（text-to-gif）
- テキストからGIFと音楽を合成した動画生成（text-to-video）

---

## デモ

👉 [https://your-app-url.com](https://your-app-url.com)

以下はデモの一例です：

![demo](demo.gif)

---
仮
## 利用方法

1. 上記リンクにアクセスします。
2. テキストボックスに任意のプロンプト（例：「吠える犬」）を入力します。
3. 「生成」ボタンをクリックすると、以下のような結果が表示されます：
   - 画像が表示される
   - 音楽が再生される
   - GIFが表示される
   - GIF＋音楽を合成した動画が再生される
4. 必要に応じて、生成されたメディアをダウンロードすることもできます。

---

## 使用技術

| 区分 | 技術スタック |
|------|--------------|
| Front End | HTML / CSS / JavaScript |
| Back End | Python |
| AI Model | Amazon Titan Image Generator v2 / MusicGen |
| Cloud Service | AWS / Replicate |

---

## 技術詳細

### 🔹 AWSサービス構成

- **API Gateway**: フロントエンドからのHTTPリクエストを受け取り、バックエンド（Lambda）にルーティング。
- **AWS Lambda**: 各生成処理を非同期で実行（画像生成、音楽生成、GIF作成、動画合成など）
- **Step Functions**: GIF＋音楽の合成やメディアの順序処理など、複数Lambda関数のワークフローを管理。
- **Amazon S3**: 生成された画像・音楽・動画を保存し、Webでのアクセスを可能に。
- **Amazon Bedrock**: Titan Image Generator v2を提供する生成AIプラットフォーム。

### 🔹 Replicate
さまざまな生成AIモデルをAPI経由で簡単に利用できるサービス。MusicGenをはじめとするAIモデルをノーコードで呼び出し可能。認証トークンとエンドポイントURLを使ってAPI操作。

### 🔹 Amazon Titan Image Generator v2
画像生成モデル。プロンプトに基づいてリアルで高解像度な画像を生成可能。

### 🔹 MusicGen
音楽生成モデル。プロンプトから自然な音楽を数秒～数分単位で生成可能で、スタイル指定やジャンル制御にも対応。Replicateを通じてAPI利用可能。

---

## システムの流れ

本システムは、入力されたテキストをもとに以下の4種類のメディアを生成します：

### ① テキストから画像生成（text-to-image）

![text-to-image flow](b3390c84-ac01-4c25-a1aa-2c0a0ebd89d1.png)

#### 処理の流れ：

1. ユーザーが**日本語のテキスト**をフロントエンドで入力  
2. Google翻訳を使って**英語に翻訳**  
3. JSON形式でテキストをAPI Gateway経由で送信  
4. Lambda関数が**Amazon Bedrock**に指示を送り、**AMAZON Titan Image Generator v2**を呼び出す  
5. 生成された画像が**Amazon S3に保存**  
6. 画像のURLをフロントエンドに返却し、Web上で表示  

### ② テキストから音楽生成（text-to-music）

![text-to-music flow](a719a73b-497f-4f32-be22-ece39ba36c90.png)

#### 処理の流れ：

1. ユーザーが**日本語のテキスト**を入力  
2. Google翻訳を使用して**英語テキストに変換**  
3. 翻訳されたテキストをAPI Gateway経由で送信  
4. Lambda関数が**Replicate API**経由で**MusicGenモデル**を呼び出し、生成処理を開始  
5. Lambdaが発行された `prediction ID` を元にステータス確認 → 音楽生成が完了  
6. 音楽データ（音声ファイル）を**Amazon S3に保存**  
7. 音楽ファイルのURLをWebに返却し、再生  

仮
### ③ テキストからGIF生成（text-to-gif）

#### 処理の流れ：

1. ユーザーの入力テキストからキーワードを抽出（例：「踊る犬」）  
2. 事前に準備したGIFテンプレート（アニメーション）とキーワードを組み合わせる  
3. 画像フレームや字幕を編集してGIFを生成  
4. GIFをS3にアップロードし、URLを返却してWeb上で表示  

### ④ テキストからGIF＋音楽合成動画生成（text-to-video）

#### 処理の流れ：

1. 上記の③で生成したGIFと、②で生成した音楽ファイルを取得  
2. Lambda関数がFFmpegを呼び出して、
   - GIFを映像、
   - 音楽をBGM
   としてマージし、動画（MP4など）を生成  
3. 完成した動画ファイルをS3に保存  
4. 動画URLをフロントエンドへ返却し、ブラウザで再生

---

## セットアップ方法

### 1. リポジトリのクローン

```bash
git clone https://github.com/your-username/text-to-multimedia.git
cd text-to-multimedia
```

### 2. `.env` ファイルの作成

以下のようなAPIキーを設定：

```
OPENAI_API_KEY=your_openai_key
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
```

### 3. 必要ライブラリのインストール

```bash
npm install
```

### 4. アプリケーションの起動

```bash
npm run dev
```
---

## チームメンバー

| 名前 | GitHubアカウント |
|------|------------------|
| Anan Eguchi | [https://github.com/anan0105](https://github.com/anan0105) |
| Shuichiro Nomura | [https://github.com/Shuichiro-labo](https://github.com/Shuichiro-labo) |
| Ryuta Sugai | [https://github.com/Ryuta-work](https://github.com/Ryuta-work) |

---

## お問い合わせ

何かご不明な点がありましたら、GitHub Issues にてご連絡ください。
