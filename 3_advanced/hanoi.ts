// =========================================================
// Type-level Tower of Hanoi (3 pegs) for TypeScript
// =========================================================

// ---------- Test helpers ----------
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false
type Expect<T extends true> = T

// ---------- Small-nat arithmetic（BuildTuple + ['length'] の相互再帰でスタック溢れするのでカウンタ実装） ----------
/** 長さ N のタプルを数え上げてから 1 要素足した長さ → N + 1 */
type Inc<N extends number> =
  _Take<N, []> extends infer Acc extends unknown[]
    ? [...Acc, unknown]['length']
    : never

type _Take<N extends number, Acc extends unknown[]> =
  Acc['length'] extends N ? Acc : _Take<N, [...Acc, unknown]>

/** N > 0 なら N - 1。0 のときは 0（このファイルでは減算のみに使う） */
type Dec<N extends number> = N extends 0 ? 0 : _Pred<N, []>

type _Pred<N extends number, Acc extends unknown[]> =
  [...Acc, unknown]['length'] extends N ? Acc['length'] : _Pred<N, [...Acc, unknown]>

type Add<A extends number, B extends number> = B extends 0 ? A : Add<Inc<A>, Dec<B>>

type Double<N extends number> = Add<N, N>

type Eq<A extends number, B extends number> = A extends B ? (B extends A ? true : false) : false

type Lt<A extends number, B extends number> =
  Eq<A, B> extends true ? false : _LtCmp<A, B, []>

type _LtCmp<A extends number, B extends number, Acc extends unknown[]> =
  Acc['length'] extends A
    ? Acc['length'] extends B
      ? false
      : true
    : Acc['length'] extends B
      ? false
      : _LtCmp<A, B, [...Acc, unknown]>

// 2^N - 1（最小手数）
type Pow2MinusOne<N extends number, Acc extends number = 0> =
  N extends 0 ? Acc : Pow2MinusOne<Dec<N>, Inc<Double<Acc>>>

// ---------- Problem model ----------
// 円盤は 1 が最小（最上段）、N が最大（最下段）
type BuildAsc<N extends number, A extends number[] = []> =
  A['length'] extends N ? A : BuildAsc<N, [...A, Inc<A['length']>]>
type Reverse<T extends number[], R extends number[] = []> =
  T extends [infer H extends number, ...infer U extends number[]]
    ? Reverse<U, [H, ...R]> : R
// Push の結果と同じく readonly にして終局状態との比較が付くようにする
type Stack<N extends number> = Readonly<Reverse<BuildAsc<N>>> // [N, ..., 2, 1]（末尾がトップ）

type Peg = 'A' | 'B' | 'C'
type Move<F extends Peg, T extends Peg> = Readonly<{ from: F; to: T }>

type State = Readonly<{
  A: readonly number[]
  B: readonly number[]
  C: readonly number[]
}>

type InitState<N extends number, Start extends Peg> = Readonly<{
  A: Start extends 'A' ? Stack<N> : []
  B: Start extends 'B' ? Stack<N> : []
  C: Start extends 'C' ? Stack<N> : []
}>

// ---------- Stack ops (型でスタック操作とサイズ制約を検査) ----------
type Top<R extends readonly number[]> =
  R extends readonly [...any[], infer T extends number] ? T : never

type Pop<R extends readonly number[]> =
  R extends readonly [...infer Rest extends number[], infer T extends number]
    ? [readonly [...Rest], T]
    : never // 空からは取り出せない → never で不正検知

type CanPlace<R extends readonly number[], D extends number> =
  R extends [] ? true
  : Top<R> extends infer T extends number
    ? (Lt<D, T> extends true ? true : false)
    : false

type Push<R extends readonly number[], D extends number> =
  CanPlace<R, D> extends true ? readonly [...R, D] : never

/** 移動先ペグへ Disk を載せた結果（ルール違反なら never） */
type PushedTo<
  Mid extends State,
  T extends Peg,
  Disk extends number
> =
  T extends 'A' ? Push<Mid['A'], Disk>
  : T extends 'B' ? Push<Mid['B'], Disk>
  : Push<Mid['C'], Disk>

type _AfterPush<Mid extends State, T extends Peg, Disk extends number> =
  [PushedTo<Mid, T, Disk>] extends [never]
    ? never
    : PushedTo<Mid, T, Disk> extends infer P extends readonly number[]
      ? Readonly<{
          A: T extends 'A' ? P : Mid['A']
          B: T extends 'B' ? P : Mid['B']
          C: T extends 'C' ? P : Mid['C']
        }>
      : never

// 1手適用（不正なら never）
type ApplyMove<S extends State, F extends Peg, T extends Peg> =
  Pop<F extends 'A' ? S['A'] : F extends 'B' ? S['B'] : S['C']> extends
    [infer FromRest extends readonly number[], infer Disk extends number]
      ? Readonly<{
          A: F extends 'A' ? FromRest : S['A']
          B: F extends 'B' ? FromRest : S['B']
          C: F extends 'C' ? FromRest : S['C']
        }> extends infer Mid extends State
        ? _AfterPush<Mid, T, Disk>
        : never
      : never

// 複数手の適用
type ApplyMoves<S extends State, M extends readonly Move<any, any>[]> =
  M extends readonly [infer H, ...infer R]
    ? H extends Move<infer F extends Peg, infer T extends Peg>
      ? ApplyMoves<ApplyMove<S, F, T>, R extends readonly Move<any, any>[] ? R : []>
      : S
    : S

// ---------- Solver（型だけで解く） ----------
type Concat<A extends readonly any[], B extends readonly any[]> = readonly [...A, ...B]

export type Hanoi<
  N extends number,
  From extends Peg,
  To extends Peg,
  Aux extends Peg
> =
  N extends 0 ? readonly []
  : Concat<
      Concat<
        Hanoi<Dec<N>, From, Aux, To>,               // N-1 を補助へ
        readonly [Move<From, To>]                   // 最大を目的地へ
      >,
      Hanoi<Dec<N>, Aux, To, From>                  // N-1 を目的地へ
    >

// =========================================================
// --------------------------- Tests ------------------------
// =========================================================

// 3枚：A -> C
type M3 = Hanoi<3, 'A', 'C', 'B'>
type T0 = Expect<Equal<M3['length'], 7>>                 // 2^3 - 1
type T1 = Expect<Equal<M3[0], Move<'A', 'C'>>> // 1手目
type T2 = Expect<Equal<M3[6], Move<'A', 'C'>>> // 最後の手

// シミュレーション：正しく全部 C に移るか
type S0 = InitState<3, 'A'>
type SEnd = ApplyMoves<S0, M3>
type T3 = Expect<Equal<SEnd['A']['length'], 0>>
type T4 = Expect<Equal<SEnd['B']['length'], 0>>
type T5 = Expect<Equal<SEnd['C'], Stack<3>>>             // [3,2,1]（末尾がトップ）

// 最小手数の一般式 2^N - 1 と一致するか
type M1 = Hanoi<1, 'A', 'B', 'C'>
type M2 = Hanoi<2, 'A', 'B', 'C'>
type M4 = Hanoi<4, 'A', 'B', 'C'>
type C1 = Expect<Equal<M1['length'], Pow2MinusOne<1>>>   // 1
type C2 = Expect<Equal<M2['length'], Pow2MinusOne<2>>>   // 3
type C3 = Expect<Equal<M3['length'], Pow2MinusOne<3>>>   // 7
type C4 = Expect<Equal<M4['length'], Pow2MinusOne<4>>>   // 15

// ルール違反の検知（大きい→小さいへ直接は置けない）
type Bad1 = ApplyMove<InitState<2, 'A'>, 'A', 'B'>       // OK（1 を Bへ）
type Bad2 = ApplyMove<Bad1, 'A', 'B'>                    // NG：2 を 1 の上に置く
type T6 = Expect<Equal<Bad2, never>>
