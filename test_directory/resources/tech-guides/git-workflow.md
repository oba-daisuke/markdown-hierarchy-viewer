# Git ブランチ戦略

## ブランチ命名規則

```
feature/  新機能
fix/      バグ修正
hotfix/   本番緊急対応
chore/    依存関係更新・設定変更
docs/     ドキュメントのみ

例:
feature/cart-ui
fix/login-redirect-bug
hotfix/payment-timeout
```

## フロー

```
main (本番)
  └── develop (開発統合)
        ├── feature/xxx  (機能開発)
        ├── fix/yyy      (バグ修正)
        └── hotfix/zzz   (緊急対応) ─→ main へ直接マージ可
```

## コミットメッセージ規約 (Conventional Commits)

```
<type>(<scope>): <description>

feat(cart): add quantity selector
fix(auth): resolve token refresh race condition
chore(deps): upgrade Next.js to 15.2
docs(api): add authentication examples
```

## PR作成チェックリスト

- [ ] ブランチ名が命名規則に従っている
- [ ] 変更内容の説明がPR本文にある
- [ ] セルフレビュー済み
- [ ] テストが追加・更新されている
- [ ] CIが全て通過している
- [ ] レビュアーがアサインされている

## マージ条件

- Approvalが最低1件（本番影響大は2件）
- CI/CD全パス
- コンフリクトなし
