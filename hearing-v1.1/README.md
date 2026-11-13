# ヒアリング V1.1 正式運用準備

V1.0保全・代表限定検収。顧客公開は未承認。詳細は [運用マニュアル](docs/OPERATIONS_MANUAL.md)。

## 構成

- `src/access.mjs`：Sites本人IDと案件の許可・期限・停止、別案件受付IDの分離。
- `src/worker.mjs`：サーバー検証、顧客公開承認ゲート、受付停止、既存GASへの互換プロキシ。
- `dist/app.js`：162問を維持、任意のタブ内保存、案件別キー、送信後消去。
- `/ops`：代表向けアクセス設定・準備状況の照会。
- `ops/access.mjs`：アクセス設定案の追加・停止・検証・履歴。
- `ops/normalize.py`：案件・受付別の分析JSON、既定で自由入力・備考を非表示。
- `ops/backup.py`：暗号化スナップショットとステージング復元。
- `ops/deletion-plan.py`：案件・受付の完全一致による削除計画。

## 検証

```sh
node package.mjs
node tests/security.mjs
python3 tests/operations.py
node ../hearing-v1/tests/system.mjs
```

秘密値はruntime設定のみ。原回答・実登録者ID・バックアップ鍵はGitへ保存しない。
V1.0の質問定義・GAS・確認サイト、main・公式サイトを変更しない。
