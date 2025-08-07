# MUSEmaker

## アプリの概要
MUSEmakerは、テキスト入力をもとに**ミーム画像・音楽・GIF・動画**を自動生成してWeb上で表示・再生できるWebアプリケーションです。

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

## 利用方法

1. 上記リンクにアクセスします。
2. テキストボックスに任意のプロンプト（例：「猫がDJをしている」）を入力します。
3. 「生成」ボタンをクリックすると、以下のような結果が順次表示されます：
   - 画像が表示される
   - 音楽が再生される
   - GIFが表示される
   - GIF＋音楽を合成した動画が再生される
4. 必要に応じて、生成されたメディアをダウンロードすることもできます。

---

## システム構成

```
ユーザー → Web UI (HTML/CSS/JavaScript) → API Gateway → Lambda関数
                                ↘ Amazon S3（画像・音声・動画保存）
```

- テキスト入力 → API呼び出し（画像/音楽/GIF/動画生成）
- 画像生成：Amazon Titan Image Generator v2
- 音楽生成：MusicGen
- GIF生成：テンプレート合成処理
- 動画合成：FFmpeg によるGIF＋音楽のマージ
- メディア保存：S3 → Web上で再生

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
| Shuichiro Nomura | [https://github.com/shuichiro-nomura](https://github.com/shuichiro-nomura) |
| （他メンバーを追加してください） | [GitHub URL] |

---

## お問い合わせ

何かご不明な点がありましたら、GitHub Issues にてご連絡ください。
