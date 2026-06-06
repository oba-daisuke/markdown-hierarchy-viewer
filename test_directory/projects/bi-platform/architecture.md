# アーキテクチャ — 社内BI基盤

## 全体構成

```
データソース群
  ├── CRM (Salesforce)
  ├── 会計システム (SAP)
  ├── ECサイト (PostgreSQL)
  ├── HRシステム (CSV出力)
  └── 在庫管理 (MySQL)
         │
         ▼ ETL (Apache Airflow / Cloud Composer)
         │   ・抽出・変換・ロード
         │   ・スケジュール実行
         │   ・エラーハンドリング
         │
         ▼ データウェアハウス (BigQuery)
         │   ├── raw/          生データ
         │   ├── staging/      クレンジング済み
         │   ├── marts/        ビジネスロジック適用済み
         │   └── reporting/    レポーティング用ビュー
         │
         ▼ データ変換 (dbt)
         │   ・SQLモデル管理
         │   ・テスト・ドキュメント自動生成
         │
         ▼ BIツール (Looker Studio + BigQuery ML)
             ├── 経営ダッシュボード
             ├── 部門別レポート
             └── アドホック分析
```

## データモデル（Starスキーマ）

### ファクトテーブル

| テーブル | 説明 | 粒度 |
|---------|------|------|
| `fact_sales` | 売上取引 | 1行 = 1注文明細 |
| `fact_orders` | 注文 | 1行 = 1注文 |
| `fact_inventory` | 在庫移動 | 1行 = 1在庫イベント |

### ディメンションテーブル

| テーブル | 説明 |
|---------|------|
| `dim_customer` | 顧客マスター（SCD Type 2）|
| `dim_product` | 商品マスター |
| `dim_date` | 日付ディメンション |
| `dim_store` | 店舗・チャネル |

## 技術選定理由

| 技術 | 選定理由 |
|------|---------|
| BigQuery | スケーラビリティ、Google Workspace連携、コスト効率 |
| dbt | SQL中心、テスト機能、ドキュメント自動生成 |
| Cloud Composer | 既存GCPインフラとの一貫性、マネージドAirflow |
| Looker Studio | コスト0（BigQuery接続無料枠）、Google SSO |
