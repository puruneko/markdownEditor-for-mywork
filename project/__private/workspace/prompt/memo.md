
カレンダーアプリで各ITEMに開始終了時刻を持たせていますが、今回DEADLINEタイプのアイテムを作成しようと思っていて、時刻単位の期限と日単位の期限を作ろうと思っています。今のほかのItemの定義が以下なのですが、ここにあらたにdeadline用の型を定義したくありません。
そこで、start,end,dateRangeをTimeSpanと定義し、start:Datetime,end:DateTimeもしくはstart:CalendarDate,end:CalendarDate,もしくは


```ts
/**
 * ISO日付（YYYY-MM-DD）専用ブランド型
 */
export type ISODate = string & { readonly __brand: 'ISODate' };

/**
 * ISO日時（YYYY-MM-DDTHH:mm:ss.sssZ 等）
 */
export type ISODateTime = string & { readonly __brand: 'ISODateTime' };

export type TimeSpan =
  | CalendarDateTimeRange
  | CalendarDateRange
  | CalendarDateTimePoint
  | CalendarDatePoint;


export type CalendarItem = {
  /** 一意識別子 */
  id: string;
  /** アイテムタイプ */
  type: 'task' | 'appointment' | 'deadline';
  /** 表示タイトル */
  title: string;
  /** タグ（分類用） */
  tags?: string[];
  /** 詳細説明 */
  description?: string;
  /** カスタムスタイル（CSSプロパティ） */
  style?: Partial<CSSStyleDeclaration>;
  /** 親階層の配列（0番目がTop parent、最後が直近のparent） */
  parents?: string[];
} & TimeSpan;

export interface CalendarDateRange {
  kind: "CalendarDateRange"
  readonly start: ISODate; // inclusive
  readonly end: ISODate;   // exclusive
}

export interface CalendarDateTimeRange {
  kind: "CalendarDateTimeRange"
  start: ISODateTime;
  end: ISODateTime;
}
export interface CalendarDatePoint {
  kind: 'CalendarDatePoint';
  at: ISODate; // 粒度は利用側で解釈
}
export interface CalendarDateTimePoint {
  kind: 'CalendarDateTimePoint';
  at: ISODateTime; // 粒度は利用側で解釈
}


```