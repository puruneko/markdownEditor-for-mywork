# AstIndex スコープ設定変更時のホットリロード（データ残留バグ修正）

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
設定画面で「索引スコープ」（vault 全体 / 指定フォルダ / 現在のファイルのみ）を変更しても、`AstIndex` は再初期化されない。`scope` フィールドが構築時に `readonly` で固定されているため、変更後も古いスコープのデータが `this.scope` として残り続ける。

**具体的な症状:**
- 「Vault 全体」→「現在のファイルのみ」に切り替えても、全ファイルのタスクがパネルに表示され続ける。
- 「現在のファイルのみ」→「Vault 全体」に切り替えると、初回スキャン済みのファイル以外は索引に載らない。

### 根本原因
`AstIndex` の `scope` と `scopeFolder` は `private readonly` で宣言されており、実行時に変更できない。`getDocuments()` / `getAllTaskNodes()` は `this.scope` を使うため、設定変更が反映されない。

### 方針
1. `AstIndex` に `setScope(scope: IndexScope, scopeFolder?: string): Promise<void>` を追加する。
   - `this.scope` と `this.scopeFolder` を更新（`readonly` を除去）。
   - 既存の `index` Map をクリア。
   - `initialScan()` を再実行して新スコープのファイルを索引化。
   - `notify()` を呼び変更をハンドラに通知。
2. `settings.ts` の `indexScope` / `indexScopeFolder` の `onChange` で `plugin.astIndex.setScope()` を呼ぶ。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- 作業着手の開始時に一度だけ `project/governance/` を確認し、本プロジェクトのルールを確認すること（`AI_RUNTIME_RULES.md` のロード順に従う）。
- テスト観点とテストコードは毎回すべてを見直すこと（`TESTING_STANDARD.md` 準拠）。

### 既存資産の再利用（必読・実装前に読む）
- `src/sync/ast-index.ts` — 修正対象。`scope` / `scopeFolder` の `readonly` を外し `setScope` を追加。
- `src/settings.ts` — `onChange` ハンドラを修正して `setScope` を呼ぶ。

### 仕様（確定事項）
- `setScope` は `async` — `initialScan` が `await` を含む。
- `setScope` 内では：
  1. `this.scope = scope` / `this.scopeFolder = scopeFolder ?? ''` を更新。
  2. `this.index.clear()` で古いデータを全消去。
  3. `await this.initialScan()` で新スコープを再走査。
  4. `this.notify()` でハンドラに通知（`initialScan` 内で個別 notify するが、最後に全体通知も入れない。`initialScan` が各ファイル更新後に `notify()` を呼ぶ実装のため不要）。
- `scopeFolder` の onChange でも同様に `setScope('folder', newValue)` を呼ぶ（スコープが `folder` の場合のみ再走査が必要だが、安全のため常に呼ぶ）。

### TODO
- [x] `AstIndex.scope` / `scopeFolder` の `readonly` を除去。
- [x] `AstIndex.setScope(scope, scopeFolder?)` を追加（async、index クリア→再スキャン→notify）。
- [x] `settings.ts` の `indexScope` onChange で `setScope` を呼ぶ。
- [x] `settings.ts` の `indexScopeFolder` onChange で `setScope` を呼ぶ。
- [x] 既存テストが通ること（vitest run: 328件パス）。
- [x] scope 切り替え時に古いデータが消えることをユニットテストで確認（3ケース追加）。

### 受け入れ基準（すべて満たすこと）
- vault → current-file に切り替えると、次の `getAllTaskNodes()` は現在ファイルのタスクのみ返す。
- current-file → vault に切り替えると、Vault 全体が再索引化される。
- 切り替え中も `onChange` ハンドラが発火し、ビューが再描画される。
- 既存テスト全件パス。

### 履歴（追記のみ）

#### 2026-06-29

- User Instruction:
  - 読み込み範囲変更時にMDデータ全体を再構築してほしい（全体⇒単ファイルで全体タスクが残留するバグ）

- Change:
  - Issue 新規作成（phase001-006）
  - `AstIndex.scope` / `scopeFolder` の `readonly` を除去
  - `AstIndex.setScope(scope, scopeFolder?)` を追加（async、index クリア→initialScan 再実行→notify）
  - `settings.ts` の `indexScope` / `indexScopeFolder` onChange で `setScope` を呼ぶよう修正
  - `ast-index.test.ts` に setScope テスト 3件追加（vault→current-file、current-file→vault、onChange 発火）

- Rationale:
  - `AstIndex.scope` が `readonly` であり、設定変更が実行時に反映されないことが根本原因。`setScope` で index クリア＋再スキャンすることで対応。スキャン対象ゼロの場合も `notify()` を末尾で呼び、ビューへ変更を通知する。

---

## 3. メタデータ
- id: issue-phase001-006__ast-index-scope-hot-reload
- status: closed
- phase: 001
- related_specs: なし（仕様は本issueに内包）
- related_decisions:
- target_files: src/sync/ast-index.ts, src/settings.ts
- created: 2026-06-29
- created: 2026-06-29
- closed: 2026-06-29
- updated: 2026-06-29
