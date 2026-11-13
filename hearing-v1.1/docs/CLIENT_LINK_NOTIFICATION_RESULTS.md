# V1.1 最小差分：専用URL・回答完了通知

2026-11-13。変更対象は専用URL認証と保存後通知の2点。162問・CSS・保存の検証/書込ロジックを維持。main・公式サイト・V1.0は変更なし。

## 専用URL
- RJB-20261113用に256ビット乱数トークンを発行。平文トークンはソースやスプレッドシートへ保存しない。
- 有効期限：2026-12-13 23:59:59 JST。
- URLフラグメントを同一OriginのPOSTで交換し、URLから消去。HttpOnly/Secure/SameSite=Strictの署名Cookieへ移行。
- サーバーにはトークンSHA256だけを保存。毎回、案件・期限・有効/停止を検証。
- 無効/未提示のトークンでは質問定義・送信APIを拒否。他案件への書込も拒否。
- SitesのChatGPTログインゲートは解除し、アプリ内の専用URL認証へ変更。/opsは従来どおり代表の認証が必要。
- Rjb様への送付は行っていない。
- ログイン状態・認証ヘッダーのないHTTP接続で実測：未提示schema401、トークン交換200、案件セッション200（RJB-20261113・review:false）、162問取得200、他案件403。

## 通知
- 宛先固定：azumamotozumi0303@gmail.com。回答本文や個人情報は通知本文へ含めない。
- 保存がokとなった後だけ通知。Notifications台帳にSENDINGを先に記録してから送信し、SENT/FAILEDと日時・エラーを記録。
- 同じ保存照合IDは再通知しない。送信結果が不確定/失敗の場合も自動再送しないため重複を避ける。
- 台帳自体の障害はGoogle実行ログへ記録する。
- V1.0のApps Scriptには触らず、独立V1.1プロジェクトに保存コードをコピー。保存関数は入口名だけpersistSubmission_へ分離し、中身は原本と完全一致。
- 新プロジェクト：https://script.google.com/home/projects/19bj1iLgMjOq2IOZCz4LlYDaBxRS_1ioh65ahsHPVPOYf22u4CUIbGmM6/edit
- Googleの追加権限承認・新デプロイが未完了。実メール送信・受信確認はまだ実施していない。
- 通知の実送信検証が終わるまでACCEPT_SUBMISSIONS=falseで受付を停止。

## 自動検証
- 従来のアクセス/保存互換31項目、専用URL14項目、通知9項目、運用ツール11項目、既存V1.0の15項目：合計80項目PASS。
- 通知の試験はMailApp模擬。保存失敗時の非送信、固定宛先、重複抑止、FAILED記録、クォータ不足、SENDING時の再送抑止を確認。
- 既存dist/schema.json・dist/style.cssは前のV1.1コミット79bb2f1と同一。

## 残作業
- 本人による通知用Googleプロジェクトのデプロイ・スプレッドシート/メール送信権限の承認。
- 設定関数実行、通知台帳準備、新GAS_URL/GAS_SECRETをV1.1だけへ接続。
- Rjb用画面から架空回答を送信し、Answers/Notifications/通知メール受信を照合。同じIDでの再送で通知と回答が増えないことを実測する。
- 実機iPhone・Androidは引き続き未検証。
