/**
 * issue-phase017-markdownEditor-for-mywork-005: 設定画面の Gantt / Calendar / Kanban セクション。
 * 保存先はビュー内パネルと共通の `viewSettings.<namespace>`（ViewSettingsHub 経由）。
 */
import { Setting } from 'obsidian'
import { DEFAULT_STORAGE_DATA } from 'svelte-calendar-lib'
import type { ViewSettingsHub } from './settings-hub'

/** namespace データへ path の位置の値だけをマージする（他キーは保持。元オブジェクトは変更しない）。 */
export function setNested(existing: Record<string, unknown>, path: string[], value: unknown): Record<string, unknown> {
  const [head, ...rest] = path
  if (rest.length === 0) return { ...existing, [head]: value }
  const child = existing[head]
  const childObj = child && typeof child === 'object' ? (child as Record<string, unknown>) : {}
  return { ...existing, [head]: setNested(childObj, rest, value) }
}

/** 整数入力の検証。非整数・範囲外は null（保存しない）。 */
export function parseIntInRange(text: string, min: number, max: number): number | null {
  if (!/^-?\d+$/.test(text.trim())) return null
  const n = Number(text)
  return n >= min && n <= max ? n : null
}

type Field =
  | { kind: 'toggle'; label: string; path: string[]; def: boolean }
  | { kind: 'number'; label: string; path: string[]; def: number; min: number; max: number }
  | { kind: 'select'; label: string; path: string[]; def: number; options: Record<string, string> }
  | { kind: 'text'; label: string; path: string[]; def: string }

const WEEK_START = { '0': '日曜', '1': '月曜' }

const GANTT_FIELDS: Field[] = [
  { kind: 'number', label: '行の高さ', path: ['rowHeight'], def: 32, min: 16, max: 100 },
  { kind: 'number', label: 'インデント幅', path: ['indentSize'], def: 20, min: 0, max: 100 },
  { kind: 'toggle', label: 'ツリーペインを表示', path: ['showTreePane'], def: true },
  { kind: 'number', label: 'フォントサイズ', path: ['fontSize'], def: 12, min: 8, max: 32 },
  { kind: 'toggle', label: '土日を表示', path: ['showWeekends'], def: true },
  { kind: 'toggle', label: '週末の背景色', path: ['weekendBackground'], def: true },
]

const w = DEFAULT_STORAGE_DATA.weekSettings
const m = DEFAULT_STORAGE_DATA.monthSettings
const CALENDAR_FIELDS: Field[] = [
  { kind: 'number', label: '週: 開始時刻', path: ['weekSettings', 'startHour'], def: w.startHour, min: 0, max: 23 },
  { kind: 'number', label: '週: 終了時刻', path: ['weekSettings', 'endHour'], def: w.endHour, min: 1, max: 24 },
  { kind: 'number', label: '週: 補助目盛(分)', path: ['weekSettings', 'minorTick'], def: w.minorTick, min: 1, max: 60 },
  { kind: 'number', label: '週: 主目盛(分)', path: ['weekSettings', 'majorTick'], def: w.majorTick, min: 1, max: 180 },
  { kind: 'toggle', label: '週: 土日を表示', path: ['weekSettings', 'showWeekend'], def: w.showWeekend },
  { kind: 'toggle', label: '週: 終日枠を表示', path: ['weekSettings', 'showAllDay'], def: w.showAllDay },
  { kind: 'toggle', label: '週: 計画帯を表示', path: ['weekSettings', 'showPlanBand'], def: w.showPlanBand },
  { kind: 'select', label: '週: 週の開始曜日', path: ['weekSettings', 'weekStartsOn'], def: w.weekStartsOn, options: WEEK_START },
  { kind: 'number', label: '月: 1日の最大表示件数', path: ['monthSettings', 'maxItemsPerDay'], def: m.maxItemsPerDay, min: 1, max: 20 },
  { kind: 'select', label: '月: 週の開始曜日', path: ['monthSettings', 'weekStartsOn'], def: m.weekStartsOn, options: WEEK_START },
  { kind: 'toggle', label: '月: 土日を表示', path: ['monthSettings', 'showWeekend'], def: m.showWeekend },
  { kind: 'toggle', label: '月: 終日を表示', path: ['monthSettings', 'showAllDay'], def: m.showAllDay },
  { kind: 'toggle', label: '月: 単日を表示', path: ['monthSettings', 'showSingleDay'], def: m.showSingleDay },
  { kind: 'toggle', label: '月: タスク時刻を表示', path: ['monthSettings', 'showTaskTime'], def: (m as { showTaskTime?: boolean }).showTaskTime ?? false },
  { kind: 'toggle', label: '営業時間を有効化', path: ['businessHours', 'enabled'], def: DEFAULT_STORAGE_DATA.businessHours.enabled },
]

const KANBAN_FIELDS: Field[] = [
  { kind: 'text', label: 'グルーピング(groupBy)', path: ['groupBy'], def: '' },
  { kind: 'number', label: '見出しレベル', path: ['headingLevel'], def: 2, min: 1, max: 6 },
  { kind: 'toggle', label: '単位を表示', path: ['showUnits'], def: false },
  { kind: 'toggle', label: 'グループ間の移動を許可', path: ['allowCrossGroupMove'], def: false },
  { kind: 'toggle', label: 'カードタイトルを複数行表示', path: ['cardTitleMultiline'], def: false },
]

function readPath(data: Record<string, unknown>, path: string[]): unknown {
  let cur: unknown = data
  for (const k of path) {
    if (!cur || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[k]
  }
  return cur
}

function renderSection(
  containerEl: HTMLElement,
  hub: ViewSettingsHub,
  title: string,
  namespace: string,
  fields: Field[],
): void {
  containerEl.createEl('h3', { text: title })
  containerEl.createEl('p', {
    text: '開いているビューには即時反映されません。ビューを開き直すと反映されます。',
    cls: 'setting-item-description',
  })
  const save = (path: string[], value: unknown) => {
    const merged = setNested(hub.get<Record<string, unknown>>(namespace) as Record<string, unknown>, path, value)
    hub.set(namespace, merged)
  }
  for (const f of fields) {
    const saved = readPath(hub.get<Record<string, unknown>>(namespace) as Record<string, unknown>, f.path)
    const s = new Setting(containerEl).setName(f.label)
    if (f.kind === 'toggle') {
      s.addToggle(t => t.setValue(typeof saved === 'boolean' ? saved : f.def).onChange(v => save(f.path, v)))
    } else if (f.kind === 'number') {
      s.addText(t =>
        t
          .setValue(String(typeof saved === 'number' ? saved : f.def))
          .onChange(v => {
            const n = parseIntInRange(v, f.min, f.max)
            if (n !== null) save(f.path, n)
          }),
      )
    } else if (f.kind === 'select') {
      s.addDropdown(d => {
        for (const [k, label] of Object.entries(f.options)) d.addOption(k, label)
        d.setValue(String(typeof saved === 'number' ? saved : f.def)).onChange(v => save(f.path, Number(v)))
      })
    } else {
      s.addText(t =>
        t.setValue(typeof saved === 'string' ? saved : f.def).onChange(v => {
          if (v.trim() !== '') save(f.path, v.trim())
        }),
      )
    }
  }
}

export function renderViewSettingsSections(containerEl: HTMLElement, hub: ViewSettingsHub): void {
  renderSection(containerEl, hub, 'Gantt 表示設定', 'gantt', GANTT_FIELDS)
  renderSection(containerEl, hub, 'Calendar 表示設定', 'calendar', CALENDAR_FIELDS)
  renderSection(containerEl, hub, 'Kanban 表示設定', 'kanban', KANBAN_FIELDS)
}
