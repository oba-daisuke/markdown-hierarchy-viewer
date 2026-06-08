# Markdown Hierarchy Viewer

ローカルの Markdown ディレクトリを階層ナビゲーション付きでブラウザ表示する Python Web アプリです。

## 機能

- ファイルツリーサイドバー（ディレクトリの展開・折りたたみ）
- 目次サイドバー（スクロール連動でアクティブ見出しをハイライト）
- パンくずナビゲーション
- シンタックスハイライト付き Markdown レンダリング
- 同一ディレクトリ内の構成パネル（見出し一覧付き）
- ディレクトリの自動リスト生成（INDEX.md / README.md がない場合）
- ダークモード対応（OS 設定に追従）

## セットアップ

```bash
# uv がない場合はインストール
curl -LsSf https://astral.sh/uv/install.sh | sh

# 依存関係をインストール
uv sync
```

## 使い方

```bash
# 指定ディレクトリを開く
uv run mdview /path/to/your/notes

# ポートを変更する場合
uv run mdview /path/to/your/notes --port 8080

# カレントディレクトリを開く
uv run mdview .
```

ブラウザで `http://127.0.0.1:8000` を開きます。

## ファイル構成

```
app.py              # FastAPI サーバー本体
pyproject.toml      # uv プロジェクト定義・依存関係
templates/
  viewer.html       # Jinja2 テンプレート
static/
  style.css         # スタイルシート（ダークモード対応）
  app.js            # 最小限の JavaScript（スクロールスパイ・タブ切り替え）
test_directory/     # 動作確認用サンプル Markdown
```

## 依存ライブラリ

| パッケージ | 用途 |
|---|---|
| FastAPI + uvicorn | Web サーバー |
| Jinja2 | HTML テンプレート |
| markdown | Markdown → HTML 変換 |
| Pygments | シンタックスハイライト |
