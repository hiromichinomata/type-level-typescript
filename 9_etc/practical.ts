// practical-types.ts
// =========================================================
// Practical TypeScript Patterns for real-world web dev
// =========================================================

// ---------- Tiny test helpers ----------
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false
type Expect<T extends true> = T
type Prettify<T> = { [K in keyof T]: T[K] } & {}  // 人間に優しい見た目

// =========================================================
// 0) 標準ユーティリティ型の実用例
// =========================================================
type User = {
  id: string
  email: string
  name: string
  age?: number
  address?: {
    zip: string
    city: string
  }
}

// PATCH API：全部 optional にした入力（部分更新）
type PatchUserInput = Partial<User>

// 一覧 API：表示に使うキーだけ
type UserListItem = Pick<User, 'id' | 'name' | 'email'>

// 新規作成 DTO：サーバーが id を付与（リクエストから除外）
type CreateUserInput = Omit<User, 'id'>

// 不変で渡す（UI層へ渡る読み取り専用）
type UserReadOnly = Readonly<User>

// null/undefined を取り除く
type T1 = NonNullable<string | null | undefined> // string

// Promise の中身を取り出す
type FetchUser = () => Promise<User>
type UserResolved = Awaited<ReturnType<FetchUser>>

// キー→値の辞書（Enum 的に）
type Role = 'admin' | 'member' | 'viewer'
const RoleLabel: Record<Role, string> = {
  admin: '管理者',
  member: 'メンバー',
  viewer: '閲覧者',
}

// =========================================================
// 1) 条件型・分配・キー再マッピング
// =========================================================
// a) Union をフィルタ
type ExtractByTag<U, Tag extends string> =
  U extends { type: Tag } ? U : never

// b) プロパティ名をテンプレで変換
type ApiRename<T> = {
  [K in keyof T as `api_${string & K}`]: T[K]
}
type R1 = ApiRename<User> // api_id, api_email, ...

// c) Optional/Required をキー単位で
type PartialBy<T, K extends keyof T> =
  Omit<T, K> & Partial<Pick<T, K>>
type RequiredBy<T, K extends keyof T> =
  Omit<T, K> & Required<Pick<T, K>>
type R2 = PartialBy<User, 'name' | 'age'>
type R3 = RequiredBy<User, 'address'>

// d) Mutable 化（Readonly外し）
type Mutable<T> = { -readonly [K in keyof T]: T[K] }

// =========================================================
// 2) 再帰ユーティリティ（Deep 系）
// =========================================================
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object
    ? DeepPartial<T[K]>
    : T[K]
}
type DeepReadonly<T> = {
  readonly [K in keyof T]:
    T[K] extends object ? DeepReadonly<T[K]> : T[K]
}

type PatchUserDeep = DeepPartial<User>
type FrozenUser = DeepReadonly<User>

// DeepMerge（右優先、オブジェクトは再帰マージ）
type DeepMerge<A, B> =
  A extends object
    ? B extends object
      ? Prettify<{
          [K in keyof (A & B)]:
            K extends keyof B
              ? K extends keyof A
                ? DeepMerge<A[K], B[K]>
                : B[K]
              : K extends keyof A
                ? A[K]
                : never
        }>
      : B
    : B

type DM = DeepMerge<
  { a: { x: 1; y: 2 }, b: 0 },
  { a: { y: 9, z: 3 }, c: true }
>
// a: { x:1, y:9, z:3 }, b:0, c:true

// =========================================================
// 3) API 層：DTO ⇄ Domain の型変換
// =========================================================
// a) snake_case → camelCase へのキー変換（再帰）
type SnakeToCamel<S extends string> =
  S extends `${infer H}_${infer T}`
    ? `${H}${Capitalize<SnakeToCamel<T>>}`
    : S

type CamelizeKeys<T> = T extends any[]
  ? { [I in keyof T]: CamelizeKeys<T[I]> }
  : T extends object
    ? { [K in keyof T as SnakeToCamel<string & K>]: CamelizeKeys<T[K]> }
    : T

// API Response（snake）：実務でよくあるやつ
type ApiUser = {
  id: string
  user_name: string
  created_at: string
  profile?: { favorite_color: string }
}
type DomainUser = CamelizeKeys<ApiUser>
// => { id: string; userName: string; createdAt: string; profile?: { favoriteColor: string } }

// b) 既存型に上書き（Overwrite）/ マージ（Merge）
type Overwrite<A, B> = Prettify<Omit<A, keyof B> & B>
type Merge<A, B> = Prettify<A & B>

type DomainUserWithFlags = Merge<DomainUser, { isNew: boolean }>
type DomainUserOverwriteEmail = Overwrite<User, { email: string | null }>

// =========================================================
// 4) フロント実務：フォーム、Union、網羅チェック
// =========================================================
// a) フォーム状態：値＋エラー＋dirty
type FieldState<T> = {
  value: T
  error?: string
  dirty: boolean
}
type FormState<T> = {
  [K in keyof T]: FieldState<T[K]>
}
type UserForm = FormState<Pick<User, 'name' | 'email' | 'age'>>

// b) Discriminated Union + 網羅チェック
type Loading = { type: 'loading' }
type Success<T> = { type: 'success', data: T }
type Failure = { type: 'failure', error: string }
type RemoteData<T> = Loading | Success<T> | Failure

// Exhaustive check ユーティリティ
function assertNever(x: never): never { throw new Error(String(x)) }
// 使用例（型だけの例）
type _ExhaustiveDemo = (rd: RemoteData<User>) => string
const exhaustiveDemo: _ExhaustiveDemo = (rd) => {
  switch (rd.type) {
    case 'loading': return '...'
    case 'success': return rd.data.name
    case 'failure': return rd.error
    default: return assertNever(rd) // 新variant追加時にエラーで気付ける
  }
}

// c) XOR（相互排他的な props セット）
type XOR<A, B> =
  | (A & { [K in keyof B]?: never })
  | (B & { [K in keyof A]?: never })

type Range =
  XOR<{ before: Date }, { after: Date }>
  // before か after のどちらかだけ

// =========================================================
// 5) コンポーネント Props／satisfies／as const
// =========================================================
type ButtonBaseProps = {
  disabled?: boolean
  onClick?: () => void
}
type AnchorLike = ButtonBaseProps & {
  as: 'a'
  href: string
}
type ButtonLike = ButtonBaseProps & {
  as?: 'button' // default
  type?: 'button' | 'submit'
}
type ButtonProps = XOR<AnchorLike, ButtonLike>

const primaryButton = {
  as: 'button',
  type: 'submit',
  disabled: false,
} satisfies ButtonProps // 過不足チェックが効く

// 定数の型狭め：as const / satisfies
const COLORS = ['red', 'green', 'blue'] as const
type Color = typeof COLORS[number]
const palette: Record<Color, `#${string}`> = {
  red: '#f00',
  green: '#0f0',
  blue: '#00f',
}

// =========================================================
// 6) ブランド型（Nominal Typing）/ IDの取り違え防止
// =========================================================
type Brand<T, B extends string> = T & { readonly __brand: B }

type UserId = Brand<string, 'UserId'>
type PostId = Brand<string, 'PostId'>

const makeUserId = (s: string): UserId => s as UserId
const makePostId = (s: string): PostId => s as PostId

declare const uId: UserId
declare const pId: PostId
// const bad: UserId = pId  // ❌ コンパイルエラーにできる（取り違え防止）

// =========================================================
// 7) ユーティリティいろいろ
// =========================================================
// a) Union の keys を抽出
type KeysOfUnion<U> = U extends any ? keyof U : never
type KU = KeysOfUnion<{ a: 1 } | { b: 2; c: 3 }> // "a" | "b" | "c"

// b) Union -> Intersection
type UnionToIntersection<U> =
  (U extends any ? (x: U) => void : never) extends
    (x: infer I) => void ? I : never

// c) Exact（余計なプロパティ禁止）
type Exact<A, B> =
  A extends B
    ? Exclude<keyof A, keyof B> extends never
      ? Exclude<keyof B, keyof A> extends never
        ? true : false
      : false
    : false

type OnlyName = { name: string }
type _Exact1 = Expect<Equal<Exact<OnlyName, { name: string }>, true>>
type _Exact2 = Expect<Equal<Exact<OnlyName & { x?: 1 }, { name: string }>, false>>

// d) OptionalKeys / RequiredKeys
type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never
}[keyof T]
type RequiredKeys<T> = Exclude<keyof T, OptionalKeys<T>>
type _Opt = OptionalKeys<User>   // "age" | "address"
type _Req = RequiredKeys<User>   // "id" | "email" | "name"

// e) NonEmptyArray
type NonEmptyArray<T> = [T, ...T[]]
const tagsOk: NonEmptyArray<string> = ['ts', 'fp']
// const tagsNg: NonEmptyArray<string> = [] // ❌

// f) Key remapで prefix/suffix 命名規則 enforce
type WithLoadingFlags<T> = {
  [K in keyof T as `${string & K}Loading`]: boolean
}
type UserLoading = WithLoadingFlags<Pick<User, 'email' | 'name'>>
// emailLoading / nameLoading

// g) テンプレ型キーで Route パラメータ抽出
type Params<Path extends string> =
  Path extends `${string}:${infer P}/${infer Rest}`
    ? { [K in P | keyof Params<`/${Rest}`>]: string }
    : Path extends `${string}:${infer P}`
      ? { [K in P]: string }
      : {}
type P1 = Params<'/users/:id/posts/:postId'> // { id: string; postId: string }

// =========================================================
// 8) API バリデーション風（型で安全運搬）
// =========================================================
type JsonPrimitive = string | number | boolean | null
type Json = JsonPrimitive | Json[] | { [k: string]: Json }

type ApiResult<TData extends Json = Json> =
  | { ok: true; data: TData }
  | { ok: false; error: string }

type _Rok: ApiResult<{ id: string; name: string }> = { ok: true, data: { id: '1', name: 'a' } }
// const _Rbad: ApiResult = { ok: true, data: new Date() } // ❌ Date は Json でない

// =========================================================
// 9) まとめ：実務よくあるワークフロー例
// =========================================================
// 1) Fetch して API 型（snake）で受ける
type ApiUserList = { users: ApiUser[] }

// 2) camel へ変換した Domain 型でアプリ内を流す
type DomainUserList = CamelizeKeys<ApiUserList>

// 3) UI 層に渡すとき Readonly にして事故防止
type DomainUserListRO = DeepReadonly<DomainUserList>

// 4) フォームは Partial/DeepPartial で段階入力に対応
type EditUserForm = FormState<PartialBy<User, 'email'>> // email を後で確定

// 5) PATCH/PUT は DTO（Pick/Omit/Overwrite）で精密化
type UpdateUserInput = Overwrite<
  Partial<Pick<User, 'name' | 'age' | 'address'>>,
  { id: string } // id は必須
>

// 6) コンポーネント Props で XOR や satisfies を使って漏れなく
const linkBtn = {
  as: 'a',
  href: '/users/1',
  disabled: false,
} satisfies ButtonProps

// ---------------------------------------------------------
// “コンパイルが静かに通る”＝型で網羅・整合が取れているサイン
// ---------------------------------------------------------
