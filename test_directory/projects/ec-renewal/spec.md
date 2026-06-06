# 技術仕様 — ECサイトリニューアル

## スタック

| レイヤー | 技術 | 備考 |
|---------|------|------|
| フロントエンド | Next.js 15 (App Router) | TypeScript |
| スタイリング | Tailwind CSS v4 | shadcn/ui コンポーネント |
| CMS | Contentful | Headless CMS |
| 決済 | Stripe | サブスク対応 |
| 検索 | Algolia | 商品検索 |
| 認証 | NextAuth.js v5 | Google / メール |
| DB | PostgreSQL 16 | Supabase |
| ORM | Prisma | |
| ホスティング | Vercel | エッジ関数 |
| CDN | CloudFront | 画像最適化 |
| 監視 | Datadog | APM + ログ |

## API設計

### 認証

```
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/session
```

### 商品

```
GET  /api/products              # 一覧（フィルタ・ページネーション）
GET  /api/products/:id          # 詳細
GET  /api/products/:id/reviews  # レビュー一覧
POST /api/products/:id/reviews  # レビュー投稿
```

### カート・注文

```
GET    /api/cart                # カート取得
POST   /api/cart/items          # アイテム追加
PATCH  /api/cart/items/:id      # 数量変更
DELETE /api/cart/items/:id      # アイテム削除
POST   /api/orders              # 注文作成
GET    /api/orders/:id          # 注文詳細
```

## パフォーマンス目標

| 指標 | 目標値 |
|------|--------|
| LCP | < 2.5s |
| FID | < 100ms |
| CLS | < 0.1 |
| TTI | < 3.5s |
| Lighthouse スコア | > 90 |

## セキュリティ要件

- HTTPS強制（HSTS）
- CSPヘッダー設定
- SQLインジェクション対策（Prismaパラメータ化クエリ）
- XSS対策（React標準 + DOMPurify）
- CSRF対策（SameSite Cookie）
- レートリミット（Upstash Redis）
- 個人情報暗号化（決済情報はStripeに委託）
