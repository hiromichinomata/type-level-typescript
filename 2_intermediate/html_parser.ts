// =========================================================
// Type-level HTML Parser (subset)
// =========================================================

// ---------- Test helpers ----------
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false
type Expect<T extends true> = T

// ---------- AST ----------
export type TextNode<T extends string> = {
  type: 'text'
  value: T
}
export type Attr<Name extends string, Value extends string | true> = Readonly<{
  name: Name
  value: Value
}>
export type ElementNode<
  Tag extends string,
  Attrs extends readonly Attr<any, any>[],
  Children extends readonly Node[]
> = {
  type: 'element'
  tag: Tag
  attrs: Attrs
  children: Children
}
export type Node =
  | TextNode<string>
  | ElementNode<string, readonly Attr<any, any>[], readonly Node[]>

export type Document<Children extends readonly Node[]> = {
  type: 'document'
  children: Children
}

// ---------- Whitespace utils ----------
type WS = ' ' | '\n' | '\t' | '\r'
type TrimLeft<S extends string> =
  S extends `${WS}${infer R}` ? TrimLeft<R> : S
type TrimRight<S extends string> =
  S extends `${infer R}${WS}` ? TrimRight<R> : S
type Trim<S extends string> = TrimLeft<TrimRight<S>>

// ---------- Char categories ----------
type DelimName = WS | '/' | '>'
type DelimAttrName = WS | '=' | '/' | '>'
type DelimUnquoted = WS | '/' | '>'

// is one of chars
type IsOneOf<C extends string, U extends string> =
  C extends U ? true : false

// read token until a delimiter
type ReadUntil<
  S extends string,
  Stop extends string,
  Acc extends string = ''
> =
  S extends `${infer C}${infer R}`
    ? IsOneOf<C, Stop> extends true
      ? [Acc, `${C}${R}`]
      : ReadUntil<R, Stop, `${Acc}${C}`>
    : [Acc, '']

// ---------- Void elements ----------
type VoidTag =
  | 'br' | 'img' | 'hr' | 'input' | 'meta' | 'link'
  | 'source' | 'track' | 'area' | 'base' | 'col'
  | 'embed' | 'param' | 'wbr'
type IsVoid<T extends string> = T extends VoidTag ? true : false

// ---------- Attribute parsing ----------
type ParseAttrValue<
  S extends string
> =
  // "value"
  S extends `"${infer V}"${infer Rest}` ? [V, Rest]
  // 'value'
  : S extends `'${infer V}'${infer Rest}` ? [V, Rest]
  // unquoted value
  : ReadUntil<S, DelimUnquoted>

// Parse one attribute: returns [Attr, Rest] or never
type ParseOneAttr<
  S extends string
> = (
  // name
  ReadUntil<TrimLeft<S>, DelimAttrName> extends [infer N extends string, infer Rest1 extends string]
    ? N extends ''
      ? never
      : // name [= value] ?
        TrimLeft<Rest1> extends `=${infer AfterEq}`
          ? // with value
            ParseAttrValue<TrimLeft<AfterEq>> extends [infer V extends string, infer Rest2 extends string]
              ? [Attr<N, V>, Rest2]
              : never
          : // boolean attr
            [Attr<N, true>, Rest1]
    : never
)

// Parse attributes until '>' or '/>'
type ParseAttrs<
  S extends string,
  Acc extends readonly Attr<any, any>[] = []
> =
  TrimLeft<S> extends ''
    ? [Acc, '']
    : TrimLeft<S> extends `/>${infer Rest}` // stop
      ? [Acc, Rest]
      : TrimLeft<S> extends `>${infer Rest}`
        ? [Acc, Rest]
        : ParseOneAttr<S> extends [infer A extends Attr<any, any>, infer RestNext extends string]
          ? ParseAttrs<RestNext, readonly [...Acc, A]>
          : [Acc, S] // fallthrough（異常系はここで止める）

// ---------- Open tag parsing ----------
type ParseOpenTag<
  S extends string
> =
  // `<tag ...>` または `<tag .../>`
  S extends `<${infer AfterLt}`
    ? ReadUntil<TrimLeft<AfterLt>, DelimName> extends [infer T extends string, infer Rest1 extends string]
      ? T extends '' ? never
        : ParseAttrs<Rest1> extends [infer As extends readonly Attr<any, any>[], infer Rest2 extends string]
          ? TrimLeft<Rest1> extends `${string}/>${string}` // self-close syntactically
            ? [T, As, true, Rest2]
            : IsVoid<T> extends true // implicit self-close by void tag
              ? [T, As, true, Rest2]
              : [T, As, false, Rest2]
          : never
      : never
    : never

// ---------- Closing tag parsing: </tag> ----------
type ParseCloseTag<
  S extends string
> =
  TrimLeft<S> extends `</${infer After}`
    ? ReadUntil<TrimLeft<After>, WS | '>'> extends [infer N extends string, infer Rest1 extends string]
      ? TrimLeft<Rest1> extends `>${infer Rest2}` ? [N, Rest2] : never
      : never
    : never

// ---------- Text parsing ----------
type ParseRawTextUntilLt<S extends string> =
  S extends `${infer T}<${infer R}` ? [T, `<${R}`] : [S, '']

type MaybePushText<
  Acc extends readonly Node[],
  Raw extends string
> =
  Trim<Raw> extends '' ? Acc : readonly [...Acc, TextNode<Raw>]

// ---------- Node list parsing until specific closing tag ----------
type ParseNodes<
  S extends string,
  StopOnTag extends string | null,
  Acc extends readonly Node[] = []
> =
  TrimLeft<S> extends ''
    ? [Acc, ''] // EOF
    : // closing?
      (StopOnTag extends string
        ? (TrimLeft<S> extends `</${string}` // potential close
            ? ParseCloseTag<S> extends [infer N extends string, infer RestAfter extends string]
              ? (N extends StopOnTag
                  ? [Acc, RestAfter] // found matching close
                  : never) // mismatched closing tag
              : never
            : never)
        : never) extends [any, any] ? (StopOnTag extends string ? [Acc, string] : never)
        : // not closing, parse element or text
          TrimLeft<S> extends `<${string}`
            ? // element
              ParseOpenTag<TrimLeft<S>> extends [infer T extends string, infer As extends readonly Attr<any, any>[], infer Self extends boolean, infer RestAfterOpen extends string]
                ? (Self extends true
                    ? ParseNodes<RestAfterOpen, StopOnTag, readonly [...Acc, ElementNode<T, As, []>]>
                    : // parse children until </T>
                      ParseNodes<RestAfterOpen, T> extends [infer Kids extends readonly Node[], infer RestAfterChildren extends string]
                        ? ParseNodes<RestAfterChildren, StopOnTag, readonly [...Acc, ElementNode<T, As, Kids>]>
                        : never)
                : never
            : // text
              ParseRawTextUntilLt<S> extends [infer Raw extends string, infer RestNext extends string]
                ? ParseNodes<RestNext, StopOnTag, MaybePushText<Acc, Raw>>
                : never

// ---------- Top-level document ----------
export type ParseHTML<S extends string> =
  ParseNodes<TrimLeft<S>, null> extends [infer Kids extends readonly Node[], infer _Rest]
    ? Document<Kids>
    : never

// =========================================================
// ------------------------- Tests -------------------------
// =========================================================

type HTML1 = `
<div id="app">
  <h1 class="title">Hi</h1>
  <p data-x="1">Hello <em>world</em>!</p>
  <br/>
</div>`

type AST1 = ParseHTML<HTML1>

// Top-level: 1要素(div)
type T0 = Expect<Equal<AST1['children']['length'], 1>>
type T1 = Expect<Equal<AST1['children'][0]['type'], 'element'>>
type T2 = Expect<Equal<AST1['children'][0]['tag'], 'div'>>

// div の attrs
type DivAttrs = AST1['children'][0] extends ElementNode<any, infer A, any> ? A : never
type T3 = Expect<Equal<DivAttrs[number], Attr<'id', 'app'>>>

// div の children: h1, p, br の順（空白テキストは自動で落とす）
type DivKids = AST1['children'][0] extends ElementNode<any, any, infer C> ? C : never
type T4 = Expect<Equal<DivKids[0] extends ElementNode<any, any, any> ? DivKids[0]['tag'] : never, 'h1'>>
type T5 = Expect<Equal<DivKids[1] extends ElementNode<any, any, any> ? DivKids[1]['tag'] : never, 'p'>>
type T6 = Expect<Equal<DivKids[2] extends ElementNode<any, any, any> ? DivKids[2]['tag'] : never, 'br'>>

// h1 の class
type H1Attrs = DivKids[0] extends ElementNode<'h1', infer A, any> ? A : never
type T7 = Expect<Equal<H1Attrs[number], Attr<'class', 'title'>>>

// p の内容: "Hello " / <em>world</em> / "!"
type PKids = DivKids[1] extends ElementNode<'p', any, infer C> ? C : never
type T8  = Expect<Equal<PKids[0], TextNode<'Hello '>>>
type T9  = Expect<Equal<PKids[1] extends ElementNode<any, any, any> ? PKids[1]['tag'] : never, 'em'>>
type T10 = Expect<Equal<PKids[2], TextNode<'!'>>>

// 自閉/void の扱い
type BRKids = DivKids[2] extends ElementNode<'br', any, infer K> ? K : never
type T11 = Expect<Equal<BRKids['length'], 0>>

// ブール属性
type HTML2 = `<input disabled type="text">`
type AST2 = ParseHTML<HTML2>
type InputAttrs = AST2['children'][0] extends ElementNode<'input', infer A, any> ? A : never
type T12 = Expect<Equal<InputAttrs[number], Attr<'disabled', true>>>
type T13 = Expect<Equal<InputAttrs[number], Attr<'type', 'text'>>>
