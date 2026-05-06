// ===============================
// Type-Level Calculator for TS
// (c) you – runtime-free arithmetic
// ===============================

// ---------- Test helpers ----------
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false
type Expect<T extends true> = T

// ---------- Core: tuple builder ----------
type BuildTuple<N extends number, T extends unknown[] = []> =
  T['length'] extends N ? T : BuildTuple<N, [unknown, ...T]>

/** `T['length']` を number として安定させる（ジェネリック tuple での deep index 回避） */
type TupleLen<T extends readonly unknown[]> = T extends readonly unknown[]
  ? T['length'] extends infer L extends number
    ? L
    : never
  : never

// ---------- Small utilities ----------
type Inc<N extends number> = TupleLen<[...BuildTuple<N>, unknown]>
type Dec<N extends number> =
  BuildTuple<N> extends [...infer R extends readonly unknown[], unknown]
    ? TupleLen<R>
    : 0

type IsZero<N extends number> = N extends 0 ? true : false
type Eq<A extends number, B extends number> =
  Gte<A, B> extends true
    ? Gte<B, A> extends true
      ? true
      : false
    : false
type Gte<A extends number, B extends number> =
  // A >= B なら BuildTuple<A> は [ ...BuildTuple<B>, ...rest ] に分解できる
  BuildTuple<A> extends [...BuildTuple<B>, ...infer _Rest] ? true : false
type Lt<A extends number, B extends number> =
  Gte<A, B> extends true ? (Eq<A, B> extends true ? false : false) : true

// ---------- Arithmetic ----------
// 1) Add
export type Add<A extends number, B extends number> = TupleLen<
  [...BuildTuple<A>, ...BuildTuple<B>]
>

// 2) Subtract (A - B)
//    A < B の場合は never（厳格版）と 0（安全版）を用意
export type SubtractStrict<A extends number, B extends number> =
  BuildTuple<A> extends [...infer U extends readonly unknown[], ...BuildTuple<B>]
    ? TupleLen<U>
    : never

export type Subtract<A extends number, B extends number> =
  BuildTuple<A> extends [...infer U extends readonly unknown[], ...BuildTuple<B>]
    ? TupleLen<U>
    : 0

// 3) Multiply (反復加算)
type _Multiply<
  A extends number,
  B extends number,
  Acc extends number = 0
> = IsZero<B> extends true ? Acc : _Multiply<A, Dec<B>, Add<Acc, A>>

export type Multiply<A extends number, B extends number> = _Multiply<A, B>

// 4) Integer Divide & Mod (反復減算)
//    プロパティインデックスで再帰を束ねないよう商・余りを別再帰に分離
type _DivQuotient<A extends number, B extends number, Q extends number = 0> =
  Lt<A, B> extends true
    ? Q
    : _DivQuotient<SubtractStrict<A, B>, B, Inc<Q>>

type _DivRemainder<A extends number, B extends number> =
  Lt<A, B> extends true ? A : _DivRemainder<SubtractStrict<A, B>, B>

export type Divide<A extends number, B extends number> =
  B extends 0 ? never : _DivQuotient<A, B>

export type Mod<A extends number, B extends number> =
  B extends 0 ? never : _DivRemainder<A, B>

export type DivMod<A extends number, B extends number> =
  B extends 0 ? never : { quotient: Divide<A, B>; remainder: Mod<A, B> }

// 5) Power: A^B
type _Pow<A extends number, B extends number, Acc extends number = 1> =
  IsZero<B> extends true ? Acc : _Pow<A, Dec<B>, Multiply<Acc, A>>

export type Pow<A extends number, B extends number> = _Pow<A, B>

// ---------- Smoke tests (コンパイルが通ればOK) ----------
type T1 = Expect<Equal<Add<1, 2>, 3>>
type T2 = Expect<Equal<SubtractStrict<10, 3>, 7>>
type T3 = Expect<Equal<Subtract<3, 5>, 0>> // 安全版は 0
type T4 = Expect<Equal<Multiply<6, 7>, 42>>
type T5 = Expect<Equal<Divide<42, 7>, 6>>
type T6 = Expect<Equal<Mod<42, 5>, 2>>
type T7 = Expect<Equal<DivMod<42, 5>, { quotient: 8; remainder: 2 }>>
type T8 = Expect<Equal<Pow<2, 10>, 1024>>

// 追加検証例
type T9 = Expect<Equal<Inc<9>, 10>>
type T10 = Expect<Equal<Dec<0>, 0>>
type T11 = Expect<Equal<Gte<12, 12>, true>>
type T12 = Expect<Equal<Gte<13, 21>, false>>
type T13 = Expect<Equal<Lt<3, 3>, false>>
type T14 = Expect<Equal<Lt<3, 4>, true>>
