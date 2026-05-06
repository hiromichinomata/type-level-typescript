// =========================================================
// Type-Level Todo App for TypeScript
// (c) you – runtime-free, compile-time verified
// =========================================================

// ---------- Test helpers ----------
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false
type Expect<T extends true> = T

// ---------- Small numeric helpers (tuple-based) ----------
type BuildTuple<N extends number, T extends unknown[] = []> =
  T['length'] extends N ? T : BuildTuple<N, [unknown, ...T]>

/** tuple の length を number として安定させる */
type TupleLen<T extends readonly unknown[]> = T extends readonly unknown[]
  ? T['length'] extends infer L extends number
    ? L
    : never
  : never

type Inc<N extends number> = TupleLen<[...BuildTuple<N>, unknown]>
type Add<A extends number, B extends number> = TupleLen<
  [...BuildTuple<A>, ...BuildTuple<B>]
>

// ---------- Core model ----------
type Priority = 1 | 2 | 3           // 1: High, 2: Medium, 3: Low
type Id<N extends number> = `t${N}` // e.g. "t0", "t1", ...

type Task<
  ID extends string = string,
  Title extends string = string,
  Done extends boolean = boolean,
  P extends Priority = 2,
  /** `= []` だと空タプル専用になり、タグ付き Task と整合しない */
  Tags extends readonly string[] = readonly string[]
> = {
  id: ID
  title: Title
  done: Done
  priority: P
  tags: Tags
}

/** 一覧に載りうる Task の上限（Priority をデフォルトの 2 リテラルに狭めない） */
type AnyTask = Task<string, string, boolean, Priority, readonly string[]>

type State<
  NextId extends number = 0,
  L extends readonly AnyTask[] = []
> = {
  nextId: NextId
  list: L
}

/** `extends State` 単体だと既定が State<0,[]> に寄るため、ヘルパで束縛 */
type AnyState = State<number, readonly AnyTask[]>

type Init = State<0, []>

// ---------- Predicates & tiny utils ----------
type HasId<L extends readonly AnyTask[], TId extends string> =
  L extends readonly [infer H, ...infer R]
    ? H extends AnyTask
      ? [H['id']] extends [TId]
        ? [TId] extends [H['id']]
          ? true
          : HasId<R extends readonly AnyTask[] ? R : never, TId>
        : HasId<R extends readonly AnyTask[] ? R : never, TId>
      : false
    : false

/** L[n] がユニオンに膨らむのを避け、id で 1 件に絞る（id: string にはマッチさせない） */
type TaskById<
  L extends readonly AnyTask[],
  Id extends string
> = L extends readonly [infer H, ...infer R]
  ? [H] extends [never]
    ? never
    : H extends AnyTask
      ? [H['id']] extends [Id]
        ? [Id] extends [H['id']]
          ? H
          : TaskById<R extends readonly AnyTask[] ? R : never, Id>
        : TaskById<R extends readonly AnyTask[] ? R : never, Id>
      : never
  : never

// ---------- State operations ----------
// AddTask: 追加（自動採番）
export type AddTask<
  S extends AnyState,
  Title extends string,
  P extends Priority = 2,
  Tags extends readonly string[] = readonly []
> = {
  nextId: Inc<S['nextId']>
  list: [
    ...S['list'],
    Task<Id<S['nextId']>, Title, false, P, Tags>
  ]
}

// Toggle / Complete / Reopen / SetPriority / Tag編集 / Remove

/** 多相関数 `F` を特定タスク `H` に当てた戻り値（`ReturnType<F>` は AnyTask に膨らむので使わない） */
type ApplyTaskFn<H, F> = F extends (t: H) => infer R ? R : never

// リストの中身をIDで1件更新（見つからなければそのまま）
// infer H に extends AnyTask を付けるとリテラル id が string に潰れるので付けない
type UpdateById<
  L extends readonly AnyTask[],
  TId extends string,
  F extends <T extends AnyTask>(t: T) => AnyTask
> =
  L extends readonly [infer H, ...infer R]
    ? H extends Task<infer HID, any, any, any, any>
      ? HID extends TId
        ? [
            ApplyTaskFn<H, F>,
            ...(R extends readonly AnyTask[] ? R : never)
          ]
        : [
            H,
            ...UpdateById<
              R extends readonly AnyTask[] ? R : never,
              TId,
              F
            >
          ]
      : L
    : L

// 関数型に見えるけど、型界の「関数オブジェクト」
type ToggleFn<T extends AnyTask> =
  Task<
    T['id'],
    T['title'],
    T['done'] extends true ? false : true,
    T['priority'],
    T['tags']
  >
type CompleteFn<T extends AnyTask> =
  Task<T['id'], T['title'], true, T['priority'], T['tags']>
type ReopenFn<T extends AnyTask> =
  Task<T['id'], T['title'], false, T['priority'], T['tags']>
type SetPriorityFn<T extends AnyTask, P extends Priority> =
  Task<T['id'], T['title'], T['done'], P, T['tags']>
type SetTitleFn<T extends AnyTask, Title extends string> =
  Task<T['id'], Title, T['done'], T['priority'], T['tags']>
type AddTagFn<T extends AnyTask, Tag extends string> =
  Task<T['id'], T['title'], T['done'], T['priority'], readonly [...T['tags'], Tag]>
type RemoveTagFn<T extends AnyTask, Tag extends string> =
  T['tags'] extends readonly [infer H extends string, ...infer R extends string[]]
    ? H extends Tag
      ? Task<T['id'], T['title'], T['done'], T['priority'], readonly [...R]>
      : // 先頭が違う場合は先頭を残して続きで再帰除去
        T['tags'] extends readonly [H, ...infer RT extends string[]]
          ? Task<T['id'], T['title'], T['done'], T['priority'], readonly [H, ...(
              RemoveTagFn<
                Task<
                  T['id'],
                  T['title'],
                  T['done'],
                  T['priority'],
                  readonly [...RT]
                >,
                Tag
              >['tags']
            )]>
          : T
    : T

// 型内で F を “適用” するヘルパ（Toggle/Complete などで使用）
type Apply<
  L extends readonly AnyTask[],
  TId extends string,
  F extends <T extends AnyTask>(t: T) => AnyTask
> = UpdateById<L, TId, F>

export type Toggle<S extends AnyState, TId extends string> = {
  nextId: S['nextId']
  list: Apply<S['list'], TId, <T extends AnyTask>(t: T) => ToggleFn<T>>
}

export type Complete<S extends AnyState, TId extends string> = {
  nextId: S['nextId']
  list: Apply<S['list'], TId, <T extends AnyTask>(t: T) => CompleteFn<T>>
}

export type Reopen<S extends AnyState, TId extends string> = {
  nextId: S['nextId']
  list: Apply<S['list'], TId, <T extends AnyTask>(t: T) => ReopenFn<T>>
}

export type SetPriority<S extends AnyState, TId extends string, P extends Priority> = {
  nextId: S['nextId']
  list: Apply<S['list'], TId, <T extends AnyTask>(t: T) => SetPriorityFn<T, P>>
}

export type SetTitle<S extends AnyState, TId extends string, Title extends string> = {
  nextId: S['nextId']
  list: Apply<S['list'], TId, <T extends AnyTask>(t: T) => SetTitleFn<T, Title>>
}

export type AddTag<S extends AnyState, TId extends string, Tag extends string> = {
  nextId: S['nextId']
  list: Apply<S['list'], TId, <T extends AnyTask>(t: T) => AddTagFn<T, Tag>>
}

export type RemoveTag<S extends AnyState, TId extends string, Tag extends string> = {
  nextId: S['nextId']
  list: Apply<S['list'], TId, <T extends AnyTask>(t: T) => RemoveTagFn<T, Tag>>
}

// Remove: 該当IDを取り除く（なければそのまま）
type RemoveById<L extends readonly AnyTask[], TId extends string> =
  L extends readonly [infer H, ...infer R]
    ? H extends Task<infer HID, any, any, any, any>
      ? HID extends TId
        ? (R extends readonly AnyTask[] ? R : never)
        : [H, ...RemoveById<R extends readonly AnyTask[] ? R : never, TId>]
      : L
    : L

export type Remove<S extends AnyState, TId extends string> = {
  nextId: S['nextId']
  list: RemoveById<S['list'], TId>
}

// ---------- Queries (絞り込み / 統計) ----------
// 絞り込みは State をそのまま返す版 と、List だけ返す版の2系統を用意

// Done 状態で絞り込み（Listだけ）
export type FilterByDone<L extends readonly AnyTask[], D extends boolean> =
  L extends readonly [infer H, ...infer R]
    ? H extends Task<any, any, infer Done, any, any>
      ? Done extends D
        ? [H, ...FilterByDone<R extends readonly AnyTask[] ? R : never, D>]
        : FilterByDone<R extends readonly AnyTask[] ? R : never, D>
      : []
    : []

// Tag を含むものに絞り込み（Listだけ）
type HasTag<Tags extends readonly string[], T extends string> =
  Tags extends readonly [infer H extends string, ...infer R extends string[]]
    ? H extends T ? true : HasTag<R, T>
    : false

export type FilterByTag<L extends readonly AnyTask[], T extends string> =
  L extends readonly [infer H, ...infer R]
    ? H extends Task<any, any, any, any, infer Tags extends readonly string[]>
      ? HasTag<Tags, T> extends true
        ? [H, ...FilterByTag<R extends readonly AnyTask[] ? R : never, T>]
        : FilterByTag<R extends readonly AnyTask[] ? R : never, T>
      : []
    : []

// total - done（tuple 差分）
type Subtract<
  A extends number,
  B extends number
> = BuildTuple<A> extends [
  ...infer U extends readonly unknown[],
  ...BuildTuple<B>
]
  ? TupleLen<U>
  : 0

// Stats（合計 / Open / Done）
type CountDone<L extends readonly AnyTask[], Acc extends number = 0> =
  L extends readonly [infer H, ...infer R]
    ? H extends Task<any, any, infer Done, any, any>
      ? Done extends true
        ? CountDone<R extends readonly AnyTask[] ? R : never, Inc<Acc>>
        : CountDone<R extends readonly AnyTask[] ? R : never, Acc>
      : Acc
    : Acc

export type Stats<L extends readonly AnyTask[]> = {
  total: L['length']
  done: CountDone<L>
  open: Subtract<L['length'], CountDone<L>>
}

export type StrictStats<L extends readonly AnyTask[]> = Stats<L>

/** Done だけのリストか（タスクの done がすべてリテラル true） */
type AllTasksDone<L extends readonly AnyTask[]> =
  L extends readonly []
    ? true
    : L extends readonly [infer H, ...infer R]
      ? H extends Task<any, any, true, any, any>
        ? AllTasksDone<R extends readonly AnyTask[] ? R : never>
        : false
      : false

// ---------- (Optional) 厳格版: IDが無ければ never を返す ----------
export type ToggleStrict<S extends AnyState, TId extends string> =
  HasId<S['list'], TId> extends true ? Toggle<S, TId> : never
export type CompleteStrict<S extends AnyState, TId extends string> =
  HasId<S['list'], TId> extends true ? Complete<S, TId> : never
export type ReopenStrict<S extends AnyState, TId extends string> =
  HasId<S['list'], TId> extends true ? Reopen<S, TId> : never
export type SetPriorityStrict<S extends AnyState, TId extends string, P extends Priority> =
  HasId<S['list'], TId> extends true ? SetPriority<S, TId, P> : never
export type RemoveStrict<S extends AnyState, TId extends string> =
  HasId<S['list'], TId> extends true ? Remove<S, TId> : never

// =========================================================
// --------------------- Usage / Tests ----------------------
// =========================================================

// 初期状態
type S0 = Init
// 追加
type S1 = AddTask<S0, "買い物に行く", 2, ["home"]>     // => t0
type S2 = AddTask<S1, "掃除をする", 3>                // => t1
type S3 = AddTask<S2, "原稿を書く", 1, ["work"]>      // => t2

// 完了 & 再オープン & トグル
type S4 = Complete<S3, "t1"> // 掃除を完了
type S5 = Reopen<S4, "t1">   // やっぱり未完了に戻す
type S6 = Toggle<S5, "t0">   // t0 をトグル（未完了 -> 完了）

// 優先度/タイトル/タグの編集
type S7 = SetPriority<S6, "t2", 1>     // t2 を最優先に
type S8 = SetTitle<S7, "t2", "技術記事を書く"> // タイトル変更
type S9 = AddTag<S8, "t2", "typescript">
type S10 = RemoveTag<S9, "t0", "home"> // t0 から "home" を外す

// 削除
type S11 = Remove<S10, "t1"> // t1 を削除（nextId は維持され ID の衝突なし）
type S12 = AddTask<S11, "散歩する"> // 新規は t3（削除の有無に関係なく一意）

// 絞り込み
type DoneOnly = FilterByDone<S12['list'], true>
type TaggedTS = FilterByTag<S12['list'], "typescript">

// 統計
type StatsLoose = Stats<S12['list']>
type StatsStrict = StrictStats<S12['list']>

// -------------------- Expectations -----------------------
type E0  = Expect<Equal<S1['list'][0]['id'], "t0">>
type E1  = Expect<Equal<S2['list'][1]['id'], "t1">>
// S3 時点ではタプルが具体的なので優先度・ID をそのまま検証できる
type E2  = Expect<Equal<TaskById<S3['list'], "t2">['priority'], 1>>
type E3  = Expect<Equal<TaskById<S3['list'], "t2">['id'], "t2">>
// Complete〜Remove までは nextId=3 のまま（追加以外では増えない）
type E4 = Expect<
  Equal<
    [
      S4['nextId'],
      S5['nextId'],
      S6['nextId'],
      S7['nextId'],
      S8['nextId'],
      S9['nextId'],
      S10['nextId'],
      S11['nextId']
    ],
    [3, 3, 3, 3, 3, 3, 3, 3]
  >
>
type E5 = Expect<Equal<S12['nextId'], 4>>
type E6 = Expect<Equal<HasId<S11['list'], "t1">, false>>
type E7a = Expect<Equal<TaskById<S12['list'], "t3">['id'], "t3">>
type E7b = Expect<Equal<S3['nextId'], 3>>
// Stats が Subtract に依存するので、数ヘルパの経路も明示（Done/tag は長さが number に落ちやすい）
type E8  = Expect<Equal<Subtract<3, 1>, 2>>
type E9  = Expect<Equal<StatsStrict['done'], CountDone<S12['list']>>>
type E10 = Expect<
  Equal<
    StatsStrict['open'],
    Subtract<S12['list']['length'], CountDone<S12['list']>>
  >
>
type E11 = Expect<Equal<AllTasksDone<DoneOnly>, true>>
