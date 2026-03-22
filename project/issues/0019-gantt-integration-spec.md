# ガントチャート連携仕様の策定

## Status

done

---

## Summary

ガントチャート統合に必要なビジネスルール・変換ルール・UIルールを仕様書として策定する。

---

## Current Direction

- `project/specs/gantt-integration.spec.md` にGR-001〜GR-028を定義する
- AST → GanttNode のマッピングルールを明確化する
- カレンダー統合のパッチ方式（markdown-patch.ts）を踏襲する設計とする
- ガントチャートライブラリのAPI（GanttNode型、GanttEventHandlers）に合わせた変換仕様とする

---

## TODO

* [x] 仕様書（gantt-integration.spec.md）を作成する
* [x] GR-001〜GR-028のビジネスルールを定義する

---

## Notes (Append Only)

* 2026-03-22 -- Issue作成。カレンダー統合仕様（calendar-integration.spec.md）を参考に策定。

## History

### 2026-03-22 19:30

- User Instruction:
  - ガントチャート統合の実装計画・issue作成依頼

- Change:
  - gantt-integration.spec.md 新規作成（GR-001〜GR-028）

- Rationale:
  - カレンダー統合と同じパターンで仕様先行開発
