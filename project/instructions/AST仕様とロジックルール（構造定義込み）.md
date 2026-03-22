

# 📘 AST仕様とロジックルール（構造定義込み）

---

# 1. 目的

Markdownで記述された内容を、

- タスク管理（進捗・優先順位）
    
- スケジュール管理（カレンダー）
    
- 構造管理（ガントチャート）
    

に利用するため、**統一されたツリー構造（AST）に変換**します。

---

# 2. 設計思想（最重要）

> **Markdownの構造はそのまま保持し、  
> タスクの存在によって意味を後から決定する**

---

# 3. データ構造（AST）

---

## 3.1 全体構造

```ts
Document {
  type: "document"
  sections: Section[]
}
```

---

## 3.2 Section（見出し単位）

```ts
Section {
  type: "section"

  id: string
  depth: number          // h1=1, h2=2...
  title: string
  parentSectionId?: string  // 親セクションのID（トップレベルの場合はなし）

  children: Node[]
  subSections: Section[]    // 子セクション（depthがより深い見出し）
}
```

---

## 3.3 Node（共通構造）

```ts
Node = TaskNode | ListNode | QuoteNode
```

---

# 4. 各ノード定義

---

## 4.1 タスク

```ts
TaskNode {
  type: "task"

  id: string
  text: string

  status: "todo" | "doing" | "done" | "blocked" | "hold"

  children: Node[]
  parentId?: string

  meta?: Meta

  // 派生情報（計算値）
  hasTaskDescendant: boolean  // 子孫にtaskがあるか（自身は含まない）
  isGroup: boolean            // hasTaskDescendant && children.length > 0
  isLeafTask: boolean         // children.length === 0
  isMemo: false               // taskノードは常にfalse
  depth: number
  path: string[]
}
```

---

## 4.2 リスト

```ts
ListNode {
  type: "list"

  id: string
  text: string

  children: Node[]
  parentId?: string

  meta?: Meta

  // 派生情報
  hasTaskDescendant: boolean  // 子孫にtaskがあるか
  isGroup: boolean            // hasTaskDescendant && children.length > 0
  isMemo: boolean             // hasTaskDescendant === false
  depth: number
  path: string[]
}
```

---

## 4.3 メモ（ブロッククオート）

```ts
QuoteNode {
  type: "quote"

  id: string
  raw: string

  parentId?: string

  // 固定値
  hasTaskDescendant: false
  isGroup: false
  isMemo: true
}
```

---

# 5. メタ情報（最小構成）

```ts
Meta {
  schedule?: string      // 例: 2026-03-01T10:00/12:00
  due?: string
  priority?: number
  dependsOn?: string[]
  tags?: string[]
}
```

**パースルール**: タスクの直下行で `@key: value` 形式の行をメタ情報として認識する。メタ行は `children` には含めず、`meta` フィールドに格納する。`@` で始まらない行はメタ情報として扱わない。

基本は使わない。必要な場合のみ使用。

---

# 6. 意味判定ロジック

---

## 6.1 コア判定

```ts
hasTaskDescendant =
  子ノード（再帰）にtype === "task"が存在する
```

> ※ ノード自身のtype === "task"は含めない。あくまで子孫の判定のみ。

---

## 6.2 意味の決定

```ts
isGroup = (hasTaskDescendant === true || node.type === "task") && children.length > 0
isMemo  = hasTaskDescendant === false && node.type !== "task"
isLeafTask = node.type === "task" && children.length === 0
```

---

## 6.3 グループの種類

```ts
groupType =
  node.type === "task" ? "task-group" :
  node.type === "list" ? "list-group" :
  null
```

---

# 7. 進捗ロールアップルール

## ■ 方針

タスクグループの進捗はUI上で自動集計するが、Markdown上のステータスは手動更新のみ。

```ts
// UI表示用の計算（ASTには保存しない）
progressRate = 子タスクのdone数 / 子タスク総数
```

- 子タスクが全完了でも、親タスクのstatusは自動変更しない
- ロールアップはあくまで表示用の派生値

---

# 8. ID設計

---

## ■ 要件

- 再パースしても同一ノードを識別できる
    
- UIと同期できる
    

---

## ■ 生成方法

```ts
id = hash(pathWithIndex.join("/"))
```

各ノードのパス要素には兄弟内インデックス（0始まり）を付与する。
これにより、同一親・同名ノードが複数あっても衝突しない。

---

## ■ 例

```text
結合テスト[0]/テストケースA[0]/シナリオA[0]
結合テスト[0]/テストケースA[0]/シナリオB[2]
```

同名ノードが並ぶ場合：

```text
テスト[0]/確認[0]
テスト[0]/確認[1]   ← 同名でもインデックスで区別
```

---

# 9. 具体例

---

## 9.1 Markdown

```md
- 結合テスト
  - [ ] テスト観点表の再確認
```

---

## 9.2 AST

```json
{
  "type": "list",
  "text": "結合テスト",
  "hasTaskDescendant": true,
  "isGroup": true,
  "isMemo": false,
  "children": [
    {
      "type": "task",
      "text": "テスト観点表の再確認",
      "status": "todo",
      "hasTaskDescendant": false,
      "isGroup": false,
      "isLeafTask": true,
      "isMemo": false,
      "children": []
    }
  ]
}
```

---

# 10. 構造変化（重要仕様）

---

## ■ 例

```md
- A
  - B
```

↓

```md
- A
  - B
    - [ ] タスク
```

---

## ■ 変化

|ノード|before|after|
|---|---|---|
|A|メモ|グループ|
|B|メモ|グループ|

---

👉 **仕様として許容（ユーザの意図を優先）**

---

# 11. ブロッククオートの扱い

---

## ■ ルール

> **完全にraw扱い（構造に影響しない）**

---

## ■ 例

```md
> - [ ] タスク
```

👉 ASTでは：

```json
{
  "type": "quote",
  "raw": "- [ ] タスク"
}
```

---

👉 タスクとして扱わない

---

# 12. ネストルール

---

## ■ 制約なし

- 深さ無制限
    
- 混在OK
    
- 構造強制なし
    

---

## ■ 例

```md
- フェーズ
  - [ ] タスク
  - カテゴリ
    - [ ] タスク
```

---

👉 すべてASTにそのまま反映

---

# 13. 利用イメージ

---

## ■ カンバン

- taskのみ抽出
    
- groupはラベル
    

---

## ■ ガントチャート

- group構造を使用
    
- 親子関係をそのまま表示
    

---

## ■ カレンダー

- meta.scheduleを使用
    

---

# 🔥 最終まとめ

このASTは：

> **「Markdownのツリー構造をそのまま保持し、  
> taskの存在だけで意味を決定するシンプルなデータモデル」**

---

# 次のステップ

- パーサ実装（Markdown → AST）
    
- UI設計（ガント / カンバン）
    
- 外部連携設計
    

---

必要なら次は  
👉 **「このASTを生成するパーサの実装（TypeScript）」**を提示できます















```markdown
# Webアプリ開発

> 方針
> - シンプル設計
> - 高速リリース

- 企画
  - [x] 要件整理
    @schedule: 2026-04-01T10:00/2026-04-01T12:00
    - [x] 機能洗い出し
      @schedule: 2026-04-01T13:00/2026-04-01T14:00
  - メモ
    - MVP重視

- 設計
  - [ ] 画面設計
    @schedule: 2026-04-02T10:00/2026-04-02T18:00
    - [ ] ワイヤー作成
      @schedule: 2026-04-02T10:00/2026-04-02T14:00
    - [ ] UIレビュー
      @schedule: 2026-04-02T15:00/2026-04-02T18:00
  - API設計
    - GET /items

- 実装
  - フロント
    - [ ] コンポーネント
      @schedule: 2026-04-05T10:00/2026-04-05T18:00
      - [ ] Button
        @schedule: 2026-04-05T10:00/2026-04-05T12:00
      - 仕様
        - 色
        - サイズ
  - バックエンド
    - [ ] API実装
      @schedule: 2026-04-06T10:00/2026-04-06T18:00
      - [ ] 認証
        @schedule: 2026-04-06T10:00/2026-04-06T12:00

- テスト
  - [ ] 結合テスト
    @schedule: 2026-04-10T10:00/2026-04-10T18:00
    - ケースA
      - [ ] 正常系
        @schedule: 2026-04-10T10:00/2026-04-10T12:00
      - 準備
        - [ ] DB停止
          @schedule: 2026-04-10T12:00/2026-04-10T13:00

## 運用

- 監視
  - [ ] ログ監視
    @schedule: 2026-04-20T10:00/2026-04-20T12:00

> メモ
> - 夜間対応あり
```



```json
{
  "type": "document",
  "sections": [
    {
      "type": "section",
      "id": "section-1",
      "depth": 1,
      "title": "Webアプリ開発",
      "subSections": [
        { "$ref": "section-2" }
      ],
      "children": [
        {
          "type": "quote",
          "id": "q1",
          "raw": "方針\n- シンプル設計\n- 高速リリース",
          "hasTaskDescendant": false,
          "isGroup": false,
          "isMemo": true
        },
        {
          "type": "list",
          "id": "l1",
          "text": "企画",
          "children": [
            {
              "type": "task",
              "id": "t1",
              "text": "要件整理",
              "status": "done",
              "meta": {
                "schedule": "2026-04-01T10:00/2026-04-01T12:00"
              },
              "children": [
                {
                  "type": "task",
                  "id": "t2",
                  "text": "機能洗い出し",
                  "status": "done",
                  "meta": {
                    "schedule": "2026-04-01T13:00/2026-04-01T14:00"
                  },
                  "children": [],
                  "hasTaskDescendant": false,
                  "isGroup": false,
                  "isLeafTask": true,
                  "isMemo": false,
                  "depth": 3,
                  "path": ["企画[0]", "要件整理[0]", "機能洗い出し[0]"]
                }
              ],
              "hasTaskDescendant": true,
              "isGroup": true,
              "isLeafTask": false,
              "isMemo": false,
              "depth": 2,
              "path": ["企画[0]", "要件整理[0]"]
            },
            {
              "type": "list",
              "id": "l2",
              "text": "メモ",
              "children": [
                {
                  "type": "list",
                  "id": "l3",
                  "text": "MVP重視",
                  "children": [],
                  "hasTaskDescendant": false,
                  "isGroup": false,
                  "isMemo": true,
                  "depth": 3,
                  "path": ["企画[0]", "メモ[1]", "MVP重視[0]"]
                }
              ],
              "hasTaskDescendant": false,
              "isGroup": false,
              "isMemo": true,
              "depth": 2,
              "path": ["企画[0]", "メモ[1]"]
            }
          ],
          "hasTaskDescendant": true,
          "isGroup": true,
          "isMemo": false,
          "depth": 1,
          "path": ["企画[0]"]
        },
        {
          "type": "list",
          "id": "l4",
          "text": "設計",
          "children": [
            {
              "type": "task",
              "id": "t3",
              "text": "画面設計",
              "status": "todo",
              "meta": {
                "schedule": "2026-04-02T10:00/2026-04-02T18:00"
              },
              "children": [
                {
                  "type": "task",
                  "id": "t4",
                  "text": "ワイヤー作成",
                  "status": "todo",
                  "meta": {
                    "schedule": "2026-04-02T10:00/2026-04-02T14:00"
                  },
                  "children": [],
                  "hasTaskDescendant": false,
                  "isGroup": false,
                  "isLeafTask": true,
                  "isMemo": false,
                  "depth": 3,
                  "path": ["設計[1]", "画面設計[0]", "ワイヤー作成[0]"]
                },
                {
                  "type": "task",
                  "id": "t5",
                  "text": "UIレビュー",
                  "status": "todo",
                  "meta": {
                    "schedule": "2026-04-02T15:00/2026-04-02T18:00"
                  },
                  "children": [],
                  "hasTaskDescendant": false,
                  "isGroup": false,
                  "isLeafTask": true,
                  "isMemo": false,
                  "depth": 3,
                  "path": ["設計[1]", "画面設計[0]", "UIレビュー[1]"]
                }
              ],
              "hasTaskDescendant": true,
              "isGroup": true,
              "isLeafTask": false,
              "isMemo": false,
              "depth": 2,
              "path": ["設計[1]", "画面設計[0]"]
            },
            {
              "type": "list",
              "id": "l5",
              "text": "API設計",
              "children": [
                {
                  "type": "list",
                  "id": "l6",
                  "text": "GET /items",
                  "children": [],
                  "hasTaskDescendant": false,
                  "isGroup": false,
                  "isMemo": true,
                  "depth": 3,
                  "path": ["設計[1]", "API設計[1]", "GET /items[0]"]
                }
              ],
              "hasTaskDescendant": false,
              "isGroup": false,
              "isMemo": true,
              "depth": 2,
              "path": ["設計[1]", "API設計[1]"]
            }
          ],
          "hasTaskDescendant": true,
          "isGroup": true,
          "isMemo": false,
          "depth": 1,
          "path": ["設計[1]"]
        },
        {
          "type": "list",
          "id": "l7",
          "text": "実装",
          "children": [
            {
              "type": "list",
              "id": "l8",
              "text": "フロント",
              "children": [
                {
                  "type": "task",
                  "id": "t6",
                  "text": "コンポーネント",
                  "status": "todo",
                  "meta": {
                    "schedule": "2026-04-05T10:00/2026-04-05T18:00"
                  },
                  "children": [
                    {
                      "type": "task",
                      "id": "t7",
                      "text": "Button",
                      "status": "todo",
                      "meta": {
                        "schedule": "2026-04-05T10:00/2026-04-05T12:00"
                      },
                      "children": [],
                      "hasTaskDescendant": false,
                      "isGroup": false,
                      "isLeafTask": true,
                      "isMemo": false,
                      "depth": 4,
                      "path": ["実装[2]", "フロント[0]", "コンポーネント[0]", "Button[0]"]
                    },
                    {
                      "type": "list",
                      "id": "l10",
                      "text": "仕様",
                      "children": [
                        {
                          "type": "list",
                          "id": "l11",
                          "text": "色",
                          "children": [],
                          "hasTaskDescendant": false,
                          "isGroup": false,
                          "isMemo": true,
                          "depth": 5,
                          "path": ["実装[2]", "フロント[0]", "コンポーネント[0]", "仕様[1]", "色[0]"]
                        },
                        {
                          "type": "list",
                          "id": "l12",
                          "text": "サイズ",
                          "children": [],
                          "hasTaskDescendant": false,
                          "isGroup": false,
                          "isMemo": true,
                          "depth": 5,
                          "path": ["実装[2]", "フロント[0]", "コンポーネント[0]", "仕様[1]", "サイズ[1]"]
                        }
                      ],
                      "hasTaskDescendant": false,
                      "isGroup": false,
                      "isMemo": true,
                      "depth": 4,
                      "path": ["実装[2]", "フロント[0]", "コンポーネント[0]", "仕様[1]"]
                    }
                  ],
                  "hasTaskDescendant": true,
                  "isGroup": true,
                  "isLeafTask": false,
                  "isMemo": false,
                  "depth": 3,
                  "path": ["実装[2]", "フロント[0]", "コンポーネント[0]"]
                }
              ],
              "hasTaskDescendant": true,
              "isGroup": true,
              "isMemo": false,
              "depth": 2,
              "path": ["実装[2]", "フロント[0]"]
            },
            {
              "type": "list",
              "id": "l13",
              "text": "バックエンド",
              "children": [
                {
                  "type": "task",
                  "id": "t8",
                  "text": "API実装",
                  "status": "todo",
                  "meta": {
                    "schedule": "2026-04-06T10:00/2026-04-06T18:00"
                  },
                  "children": [
                    {
                      "type": "task",
                      "id": "t9",
                      "text": "認証",
                      "status": "todo",
                      "meta": {
                        "schedule": "2026-04-06T10:00/2026-04-06T12:00"
                      },
                      "children": [],
                      "hasTaskDescendant": false,
                      "isGroup": false,
                      "isLeafTask": true,
                      "isMemo": false,
                      "depth": 4,
                      "path": ["実装[2]", "バックエンド[1]", "API実装[0]", "認証[0]"]
                    }
                  ],
                  "hasTaskDescendant": true,
                  "isGroup": true,
                  "isLeafTask": false,
                  "isMemo": false,
                  "depth": 3,
                  "path": ["実装[2]", "バックエンド[1]", "API実装[0]"]
                }
              ],
              "hasTaskDescendant": true,
              "isGroup": true,
              "isMemo": false,
              "depth": 2,
              "path": ["実装[2]", "バックエンド[1]"]
            }
          ],
          "hasTaskDescendant": true,
          "isGroup": true,
          "isMemo": false,
          "depth": 1,
          "path": ["実装[2]"]
        },
        {
          "type": "list",
          "id": "l14",
          "text": "テスト",
          "children": [
            {
              "type": "task",
              "id": "t10",
              "text": "結合テスト",
              "status": "todo",
              "meta": {
                "schedule": "2026-04-10T10:00/2026-04-10T18:00"
              },
              "children": [
                {
                  "type": "list",
                  "id": "l15",
                  "text": "ケースA",
                  "children": [
                    {
                      "type": "task",
                      "id": "t11",
                      "text": "正常系",
                      "status": "todo",
                      "meta": {
                        "schedule": "2026-04-10T10:00/2026-04-10T12:00"
                      },
                      "children": [],
                      "hasTaskDescendant": false,
                      "isGroup": false,
                      "isLeafTask": true,
                      "isMemo": false,
                      "depth": 4,
                      "path": ["テスト[3]", "結合テスト[0]", "ケースA[0]", "正常系[0]"]
                    },
                    {
                      "type": "list",
                      "id": "l16",
                      "text": "準備",
                      "children": [
                        {
                          "type": "task",
                          "id": "t12",
                          "text": "DB停止",
                          "status": "todo",
                          "meta": {
                            "schedule": "2026-04-10T12:00/2026-04-10T13:00"
                          },
                          "children": [],
                          "hasTaskDescendant": false,
                          "isGroup": false,
                          "isLeafTask": true,
                          "isMemo": false,
                          "depth": 5,
                          "path": ["テスト[3]", "結合テスト[0]", "ケースA[0]", "準備[1]", "DB停止[0]"]
                        }
                      ],
                      "hasTaskDescendant": true,
                      "isGroup": true,
                      "isMemo": false,
                      "depth": 4,
                      "path": ["テスト[3]", "結合テスト[0]", "ケースA[0]", "準備[1]"]
                    }
                  ],
                  "hasTaskDescendant": true,
                  "isGroup": true,
                  "isMemo": false,
                  "depth": 3,
                  "path": ["テスト[3]", "結合テスト[0]", "ケースA[0]"]
                }
              ],
              "hasTaskDescendant": true,
              "isGroup": true,
              "isLeafTask": false,
              "isMemo": false,
              "depth": 2,
              "path": ["テスト[3]", "結合テスト[0]"]
            }
          ],
          "hasTaskDescendant": true,
          "isGroup": true,
          "isMemo": false,
          "depth": 1,
          "path": ["テスト[3]"]
        }
      ]
    },
    {
      "type": "section",
      "id": "section-2",
      "depth": 2,
      "title": "運用",
      "parentSectionId": "section-1",
      "subSections": [],
      "children": [
        {
          "type": "list",
          "id": "l17",
          "text": "監視",
          "children": [
            {
              "type": "task",
              "id": "t13",
              "text": "ログ監視",
              "status": "todo",
              "meta": {
                "schedule": "2026-04-20T10:00/2026-04-20T12:00"
              },
              "children": [],
              "hasTaskDescendant": false,
              "isGroup": false,
              "isLeafTask": true,
              "isMemo": false,
              "depth": 3,
              "path": ["監視[0]", "ログ監視[0]"]
            }
          ],
          "hasTaskDescendant": true,
          "isGroup": true,
          "isMemo": false,
          "depth": 2,
          "path": ["監視[0]"]
        },
        {
          "type": "quote",
          "id": "q2",
          "raw": "メモ\n- 夜間対応あり",
          "hasTaskDescendant": false,
          "isGroup": false,
          "isMemo": true
        }
      ]
    }
  ]
}
```


フラットリスト（カレンダー・ガント向け抽出例）：

```json
[
  {
    "id": "t1",
    "type": "task",
    "title": "要件整理",
    "start": "2026-04-01T10:00:00",
    "end": "2026-04-01T12:00:00",
    "status": "done",
    "isLeafTask": false,
    "tags": ["Webアプリ開発", "企画"]
  },
  {
    "id": "t2",
    "type": "task",
    "title": "機能洗い出し",
    "start": "2026-04-01T13:00:00",
    "end": "2026-04-01T14:00:00",
    "status": "done",
    "isLeafTask": true,
    "tags": ["Webアプリ開発", "企画", "要件整理"]
  },
  {
    "id": "t3",
    "type": "task",
    "title": "画面設計",
    "start": "2026-04-02T10:00:00",
    "end": "2026-04-02T18:00:00",
    "status": "todo",
    "isLeafTask": false,
    "tags": ["Webアプリ開発", "設計"]
  },
  {
    "id": "t4",
    "type": "task",
    "title": "ワイヤー作成",
    "start": "2026-04-02T10:00:00",
    "end": "2026-04-02T14:00:00",
    "status": "todo",
    "isLeafTask": true,
    "tags": ["Webアプリ開発", "設計", "画面設計"]
  },
  {
    "id": "t5",
    "type": "task",
    "title": "UIレビュー",
    "start": "2026-04-02T15:00:00",
    "end": "2026-04-02T18:00:00",
    "status": "todo",
    "isLeafTask": true,
    "tags": ["Webアプリ開発", "設計", "画面設計"]
  },
  {
    "id": "t6",
    "type": "task",
    "title": "コンポーネント",
    "start": "2026-04-05T10:00:00",
    "end": "2026-04-05T18:00:00",
    "status": "todo",
    "isLeafTask": false,
    "tags": ["Webアプリ開発", "実装", "フロント"]
  },
  {
    "id": "t7",
    "type": "task",
    "title": "Button",
    "start": "2026-04-05T10:00:00",
    "end": "2026-04-05T12:00:00",
    "status": "todo",
    "isLeafTask": true,
    "tags": ["Webアプリ開発", "実装", "フロント", "コンポーネント"]
  },
  {
    "id": "t8",
    "type": "task",
    "title": "API実装",
    "start": "2026-04-06T10:00:00",
    "end": "2026-04-06T18:00:00",
    "status": "todo",
    "isLeafTask": false,
    "tags": ["Webアプリ開発", "実装", "バックエンド"]
  },
  {
    "id": "t9",
    "type": "task",
    "title": "認証",
    "start": "2026-04-06T10:00:00",
    "end": "2026-04-06T12:00:00",
    "status": "todo",
    "isLeafTask": true,
    "tags": ["Webアプリ開発", "実装", "バックエンド", "API実装"]
  },
  {
    "id": "t10",
    "type": "task",
    "title": "結合テスト",
    "start": "2026-04-10T10:00:00",
    "end": "2026-04-10T18:00:00",
    "status": "todo",
    "isLeafTask": false,
    "tags": ["Webアプリ開発", "テスト"]
  },
  {
    "id": "t11",
    "type": "task",
    "title": "正常系",
    "start": "2026-04-10T10:00:00",
    "end": "2026-04-10T12:00:00",
    "status": "todo",
    "isLeafTask": true,
    "tags": ["Webアプリ開発", "テスト", "結合テスト", "ケースA"]
  },
  {
    "id": "t12",
    "type": "task",
    "title": "DB停止",
    "start": "2026-04-10T12:00:00",
    "end": "2026-04-10T13:00:00",
    "status": "todo",
    "isLeafTask": true,
    "tags": ["Webアプリ開発", "テスト", "結合テスト", "準備"]
  },
  {
    "id": "t13",
    "type": "task",
    "title": "ログ監視",
    "start": "2026-04-20T10:00:00",
    "end": "2026-04-20T12:00:00",
    "status": "todo",
    "isLeafTask": true,
    "tags": ["運用", "監視"]
  }
]
```

