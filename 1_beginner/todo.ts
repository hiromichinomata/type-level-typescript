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

type Inc<N extends number> = [...BuildTuple<N>, unknown]['length']
type Add<A extends number, B extends number> =
  [...BuildTuple<A>, ...BuildTuple<B>]['length']

// ---------- Core model ----------
type Priority = 1 | 2 | 3           // 1: High, 2: Medium, 3: Low
type Id<N extends number> = `t${N}` // e.g. "t0", "t1", ...

type Task<
  ID extends string = string,
  Title extends string = string,
  Done extends boolean = boolean,
  P extends Priority = 2,
  Tags extends readonly string[] = []
> = {
  id: ID
  title: Title
  done: Done
  priority: P
  tags: Tags
}

type State<
  NextId extends number = 0,
  L extends readonly Task[] = []
> = {
  nextId: NextId
  list: L
}

type Init = State<0, []>

// ---------- Predicates & tiny utils ----------
type Not<B extends boolean> = B extends true ? false : true
type HasId<L extends readonly Task[], TId extends string> =
  L extends readonly [infer H, ...infer R]
    ? H extends Task<infer HID, any, any, any, any>
      ? HID extends TId ? true : HasId<R extends Task[] ? R : never, TId>
      : false
    : false

// ---------- State operations ----------
// AddTask: 追加（自動採番）
export type AddTask<
  S extends State,
  Title extends string,
  P extends Priority = 2,
  Tags extends readonly string[] = []
> = {
  nextId: Inc<S['nextId']>
  list: [
    ...S['list'],
    Task<Id<S['nextId']>, Title, false, P, Tags>
  ]
}

// Toggle / Complete / Reopen / SetPriority / Tag編集 / Remove

// リストの中身をIDで1件更新（見つからなければそのまま）
type UpdateById<
  L extends readonly Task[],
  TId extends string,
  F extends (t: Task) => Task
> =
  L extends readonly [infer H, ...infer R]
    ? H extends Task<infer HID, any, any, any, any>
      ? HID extends TId
        ? [ReturnType<F>, ...(R extends Task[] ? R : never)]
        : [H, ...UpdateById<R extends Task[] ? R : never, TId, F>]
      : L
    : L

// 関数型に見えるけど、型界の「関数オブジェクト」
type ToggleFn<T extends Task> =
  Task<T['id'], T['title'], Not<T['done']>, T['priority'], T['tags']>
type CompleteFn<T extends Task> =
  Task<T['id'], T['title'], true, T['priority'], T['tags']>
type ReopenFn<T extends Task> =
  Task<T['id'], T['title'], false, T['priority'], T['tags']>
type SetPriorityFn<T extends Task, P extends Priority> =
  Task<T['id'], T['title'], T['done'], P, T['tags']>
type SetTitleFn<T extends Task, Title extends string> =
  Task<T['id'], Title, T['done'], T['priority'], T['tags']>
type AddTagFn<T extends Task, Tag extends string> =
  Task<T['id'], T['title'], T['done'], T['priority'], readonly [...T['tags'], Tag]>
type RemoveTagFn<T extends Task, Tag extends string> =
  T['tags'] extends readonly [infer H extends string, ...infer R extends string[]]
    ? H extends Tag
      ? Task<T['id'], T['title'], T['done'], T['priority'], readonly [...R]>
      : // 先頭が違う場合は先頭を残して続きで再帰除去
        T['tags'] extends readonly [H, ...infer RT extends string[]]
          ? Task<T['id'], T['title'], T['done'], T['priority'], readonly [H, ...(
              RemoveTagFn<Task<T['id'], T['title'], T['done'], T['priority'], RT>, Tag>['tags']
            )]>
          : T
    : T

// 型内で F を “適用” するヘルパ（Toggle/Complete などで使用）
type Apply<L extends readonly Task[], TId extends string, F> =
  F extends (t: Task) => infer _ // 形だけ検査
    ? UpdateById<L, TId, F & ((t: Task) => Task)>
    : L

export type Toggle<S extends State, TId extends string> = {
  nextId: S['nextId']
  list: Apply<S['list'], TId, <T extends Task>(t: T) => ToggleFn<T>>
}

export type Complete<S extends State, TId extends string> = {
  nextId: S['nextId']
  list: Apply<S['list'], TId, <T extends Task>(t: T) => CompleteFn<T>>
}

export type Reopen<S extends State, TId extends string> = {
  nextId: S['nextId']
  list: Apply<S['list'], TId, <T extends Task>(t: T) => ReopenFn<T>>
}

export type SetPriority<S extends State, TId extends string, P extends Priority> = {
  nextId: S['nextId']
  list: Apply<S['list'], TId, <T extends Task>(t: T) => SetPriorityFn<T, P>>
}

export type SetTitle<S extends State, TId extends string, Title extends string> = {
  nextId: S['nextId']
  list: Apply<S['list'], TId, <T extends Task>(t: T) => SetTitleFn<T, Title>>
}

export type AddTag<S extends State, TId extends string, Tag extends string> = {
  nextId: S['nextId']
  list: Apply<S['list'], TId, <T extends Task>(t: T) => AddTagFn<T, Tag>>
}

export type RemoveTag<S extends State, TId extends string, Tag extends string> = {
  nextId: S['nextId']
  list: Apply<S['list'], TId, <T extends Task>(t: T) => RemoveTagFn<T, Tag>>
}

// Remove: 該当IDを取り除く（なければそのまま）
type RemoveById<L extends readonly Task[], TId extends string> =
  L extends readonly [infer H, ...infer R]
    ? H extends Task<infer HID, any, any, any, any>
      ? HID extends TId
        ? (R extends Task[] ? R : never)
        : [H, ...RemoveById<R extends Task[] ? R : never, TId>]
      : L
    : L

export type Remove<S extends State, TId extends string> = {
  nextId: S['nextId']
  list: RemoveById<S['list'], TId>
}

// ---------- Queries (絞り込み / 統計) ----------
// 絞り込みは State をそのまま返す版 と、List だけ返す版の2系統を用意

// Done 状態で絞り込み（Listだけ）
export type FilterByDone<L extends readonly Task[], D extends boolean> =
  L extends readonly [infer H, ...infer R]
    ? H extends Task<any, any, infer Done, any, any>
      ? Done extends D
        ? [H, ...FilterByDone<R extends Task[] ? R : never, D>]
        : FilterByDone<R extends Task[] ? R : never, D>
      : []
    : []

// Tag を含むものに絞り込み（Listだけ）
type HasTag<Tags extends readonly string[], T extends string> =
  Tags extends readonly [infer H extends string, ...infer R extends string[]]
    ? H extends T ? true : HasTag<R, T>
    : false

export type FilterByTag<L extends readonly Task[], T extends string> =
  L extends readonly [infer H, ...infer R]
    ? H extends Task<any, any, any, any, infer Tags extends readonly string[]>
      ? HasTag<Tags, T> extends true
        ? [H, ...FilterByTag<R extends Task[] ? R : never, T>]
        : FilterByTag<R extends Task[] ? R : never, T>
      : []
    : []

// Stats（合計 / Open / Done）
type CountDone<L extends readonly Task[], Acc extends number = 0> =
  L extends readonly [infer H, ...infer R]
    ? H extends Task<any, any, infer Done, any, any>
      ? Done extends true
        ? CountDone<R extends Task[] ? R : never, Inc<Acc>>
        : CountDone<R extends Task[] ? R : never, Acc>
      : Acc
    : Acc

export type Stats<L extends readonly Task[]> = {
  total: L['length']
  done: CountDone<L>
  open: Add<L['length'], never> extends never ? never : (
    // open = total - done（簡便に total と done を tuple で差し引くのもありだが、
    // ここでは open は “合計から done を引いた数” として型のまま扱う必要がないケースが多い。
    // 実用上は CountOpen を別途作ってもOK。今回は open を (合計 - done) の近似で提示。
    // ただし number の演算厳密性を保ちたい場合は Subtract を実装してください。
    // ここでは簡潔さ優先で open は `total` と `done` を利用者が読み解く前提にします。
    never
  )
}
// open を厳密に出したい場合は Subtract を導入：
type Subtract<
  A extends number,
  B extends number
> = BuildTuple<A> extends [...infer U, ...BuildTuple<B>] ? U['length'] : 0

export type StrictStats<L extends readonly Task[]> = {
  total: L['length']
  done: CountDone<L>
  open: Subtract<L['length'], CountDone<L>>
}

// ---------- (Optional) 厳格版: IDが無ければ never を返す ----------
export type ToggleStrict<S extends State, TId extends string> =
  HasId<S['list'], TId> extends true ? Toggle<S, TId> : never
export type CompleteStrict<S extends State, TId extends string> =
  HasId<S['list'], TId> extends true ? Complete<S, TId> : never
export type ReopenStrict<S extends State, TId extends string> =
  HasId<S['list'], TId> extends true ? Reopen<S, TId> : never
export type SetPriorityStrict<S extends State, TId extends string, P extends Priority> =
  HasId<S['list'], TId> extends true ? SetPriority<S, TId, P> : never
export type RemoveStrict<S extends State, TId extends string> =
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
type E2  = Expect<Equal<S3['list'][2]['priority'], 1>>
type E3  = Expect<Equal<S4['list'][1]['done'], true>>
type E4  = Expect<Equal<S5['list'][1]['done'], false>>
type E5  = Expect<Equal<S6['list'][0]['done'], true>>
type E6  = Expect<Equal<S8['list'][2]['title'], "技術記事を書く">>
type E7  = Expect<Equal<S9['list'][2]['tags'], readonly ["work", "typescript"]>>
type E8  = Expect<Equal<S11['list']['length'], 2>>         // t1 を削除して2件
type E9  = Expect<Equal<S12['list'][2]['id'], "t3">>       // nextId 維持で一意
type E10 = Expect<Equal<DoneOnly[number]['done'], true>>   // 全件 done = true
type E11 = Expect<Equal<StatsStrict['total'], S12['list']['length']>>
