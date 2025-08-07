## Hackathon

## アプリの概要
  - ミーム生成アプリ


# 🖼️🎵 Text-to-Multimedia Generator

このプロジェクトは、**テキスト入力をもとに画像・音楽・GIF・動画を自動生成してWeb上で表示・再生するWebアプリケーション**です。

以下のようなコンテンツを、すべてブラウザ上で生成・再生できます：

- 🖼️ テキストから画像生成（text-to-image）
- 🎵 テキストから音楽生成（text-to-music）
- 🌀 テキストからGIF生成（text-to-gif）
- 🎬 テキストからGIFと音楽を合成した動画生成（text-to-video）

---

## 🚀 デモ

👉 [https://your-app-url.com](https://your-app-url.com)（※デプロイ済みの場合）

以下はデモの一例です：

![demo](demo.gif)

---

## 🏗️ システム構成

```
ユーザー → Web UI (Next.jsなど) → API Gateway → Lambda関数
                           ↘ Amazon S3（画像・音声・動画保存）
```

- テキスト入力 → API呼び出し（画像/音楽/GIF/動画生成）
- 画像生成：Stable Diffusion / DALL·E API
- 音楽生成：Riffusion / MusicGen
- GIF生成：テンプレート合成処理
- 動画合成：FFmpeg によるGIF＋音楽のマージ
- メディア保存：S3 → Web上で再生

---

## ✨ 主な機能

- ✅ テキストから画像を生成して表示
- ✅ テキストから音楽を生成して再生
- ✅ テキストからGIFを生成して表示
- ✅ テキストからGIF＋音楽を合成して動画生成＆再生

---

## 🛠 使用技術

| 区分 | 技術スタック |
|------|--------------|
| フロントエンド | Next.js / React / Tailwind CSS |
| バックエンド | AWS Lambda / API Gateway |
| ストレージ | Amazon S3 |
| 画像生成 | OpenAI DALL·E API / Stable Diffusion |
| 音楽生成 | Riffusion / MusicGen |
| GIF生成 | 自作テンプレート合成 or Animate API |
| 動画生成 | FFmpeg |

---

## 🔧 セットアップ方法

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

## 📁 フォルダ構成

```plaintext
├── frontend/         # Next.js フロントエンドアプリ
├── backend/          # Lambda関数やAPI処理
├── media/            # 生成された画像・音楽・動画ファイル
├── scripts/          # FFmpegなどの補助スクリプト
└── README.md
```

---

## 📄 ライセンス

MIT License  
本プロジェクトは研究・教育目的での使用を想定しています。

---

## 🙋‍♀️ 貢献

バグ報告や提案、機能追加のPull Requestを歓迎します！

---

## 📬 お問い合わせ

何かご不明な点がありましたら、GitHub Issues にてご連絡ください。
