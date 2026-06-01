# YapLang 🔥

> A tiny, beginner-friendly programming language whose keywords are Gen-Z slang.
> Real lexer → parser → tree-walking interpreter. No regex hacks, no magic.

```yap
bestie fib(n) {
  fr (n < 2) { bet n }
  bet fib(n - 1) + fib(n - 2)
}

grind (vibe i = 0; i < 11; i = i + 1) {
  spill("fib(" + i + ") = " + fib(i))
}
```

YapLang (`.yap`) is dynamically typed and interpreted. It's small enough to read
in an afternoon, so it's a nice way to *see* how a language actually works under
the hood.

---

## Why this exists

Most "learn how interpreters work" projects are either toy regex tricks (not
real) or huge and intimidating. YapLang is a genuine pipeline — lexer, recursive
descent parser, tree-walking evaluator with closures — kept deliberately tiny
and friendly. The slang keywords are just a fun coat of paint over a normal
little language.

> Want to re-skin it? Every keyword spelling lives in **one file**
> (`src/keywords.ts`). Change the table (and `LANGUAGE_NAME`) and you've made
> your own language — nothing in the lexer/parser/interpreter hard-codes a word.

---

## Install & run

**Requires Node.js 18+.**

```bash
# install the CLI globally
npm i -g yaplang

# run a program
yap myfile.yap
yap examples/fizzbuzz.yap
```

Other CLI bits:

```bash
yap --help       # usage
yap --version    # version
```

### From a clone (development)

```bash
npm install
npm run build        # bundles dist/ (CLI + lib) and the playground bundle
npm test             # vitest: lexer, parser, interpreter, examples
npm run dev -- examples/hello.yap   # run without building (via tsx)
```

### The playground (zero install, runs in your browser)

```bash
npm run playground   # builds, then serves playground/ at a local URL
```

Then open the printed URL. Paste code on the left, hit **Run it 🔥**, see output
on the right. Everything runs client-side — there's no backend. (Press
`Ctrl`/`Cmd` + `Enter` to run.)

---

## Keywords

| Concept            | YapLang keyword |
| ------------------ | --------------- |
| declare variable   | `vibe`          |
| print to console   | `spill` *(built-in fn)* |
| boolean true       | `nocap`         |
| boolean false      | `cap`           |
| null / empty       | `ghosted`       |
| if                 | `fr`            |
| else if            | `orfr`          |
| else               | `nah`           |
| while loop         | `onloop`        |
| for loop           | `grind`         |
| define function    | `bestie`        |
| return             | `bet`           |
| logical AND        | `vibin`         |
| logical OR         | `lowkey`        |
| logical NOT        | `sus`           |
| break              | `dip`           |
| continue           | `skrt`          |

Comments are `//` to end of line. Statements end with a newline **or** a `;`
(both fine). Blocks use `{ }`.

---

## Language tour

### Variables + output

```yap
vibe name = "Avi"
vibe age = 21
spill("yo " + name + ", age " + age)   // yo Avi, age 21
```

Strings use double quotes and support `\n`, `\t`, `\"`, `\\`. `+` concatenates;
a number next to a string is coerced to text.

### If / else if / else

```yap
vibe score = 85
fr (score >= 90) {
  spill("you ate that")
} orfr (score >= 60) {
  spill("mid but passing")     // <- this one
} nah {
  spill("it's giving fail")
}
```

### While loop (`onloop`) with break / continue

```yap
vibe i = 0
onloop (i < 10) {
  i = i + 1
  fr (i == 3) { skrt }   // continue
  fr (i == 7) { dip }    // break
  spill(i)               // 1 2 4 5 6
}
```

### For loop (`grind`) — C-style

```yap
grind (vibe j = 0; j < 5; j = j + 1) {
  spill("rep " + j)
}
```

### Functions (`bestie`), return (`bet`), recursion, closures

```yap
bestie add(a, b) {
  bet a + b
}

bestie fib(n) {
  fr (n < 2) { bet n }
  bet fib(n - 1) + fib(n - 2)
}

spill(add(2, 3))   // 5
spill(fib(10))     // 55
```

Functions are first-class values and close over their defining scope:

```yap
bestie makeCounter() {
  vibe n = 0
  bestie tick() { n = n + 1  bet n }
  bet tick
}
vibe c = makeCounter()
spill(c())  // 1
spill(c())  // 2
```

### Arrays

```yap
vibe squad = ["zoomer", "boomer", "doomer"]
spill(squad[0])         // zoomer
squad[1] = "gamer"      // assignable by index
spill(howmany(squad))   // 3
```

### Logical operators (short-circuit)

```yap
vibe a = nocap
vibe b = cap
fr (a vibin sus b) { spill("logic checks out") }
```

### Truthiness (kept simple on purpose)

`cap` (false) and `ghosted` (null) are **falsy**. *Everything* else is
**truthy** — including `0` and `""`. No surprises for beginners.

---

## Built-in functions

| Function          | What it does                                                            |
| ----------------- | ----------------------------------------------------------------------- |
| `spill(...args)`  | print args joined by a space, then a newline. Returns `ghosted`.        |
| `vibecheck(x)`    | the type as a string: `"number"`, `"string"`, `"boolean"`, `"ghosted"`, `"array"`, `"function"`. |
| `howmany(x)`      | length of a string or array.                                            |
| `glowup(s)`       | uppercase a string.                                                     |
| `chill(s)`        | lowercase a string.                                                     |
| `slide(arr, x)`   | push `x` onto `arr`; returns the new length.                            |
| `yoink(arr)`      | pop and return the last element (`ghosted` if empty).                   |
| `numify(s)`       | parse a string to a number (errors if it isn't one).                    |

---

## Errors that actually help

YapLang never dumps a raw stack trace at users. Every error is line-numbered and
written in the language's own dialect:

```
💀 sus syntax at line 4: expected ')' after condition
💀 fr real? at line 9: 'squadd' is not defined
💀 that ain't it at line 2: can't divide by zero
```

The CLI exits non-zero on error; the playground prints the message in red.

---

## How it works

YapLang is a classic three-stage interpreter pipeline. Source text flows through:

1. **Lexer** (`src/lexer.ts`) — scans the raw string into a flat list of
   **tokens** (numbers, strings, identifiers, keywords, operators), tagging each
   with a line and column. Newlines are significant (they end statements) but are
   suppressed inside `( )` and `[ ]` so expressions can wrap.
2. **Parser** (`src/parser.ts`) — a hand-written **recursive descent** parser
   turns tokens into an **AST** (`src/ast.ts`), following a strict precedence
   ladder: `assignment → or → and → equality → comparison → term → factor →
   unary → call/index → primary`.
3. **Interpreter** (`src/interpreter.ts`) — a **tree-walking evaluator** walks
   the AST and executes it. Variable scopes live in `src/environment.ts`;
   functions capture their environment to form closures; `return`/`break`/
   `continue` are implemented as thrown control-flow signals caught by the
   relevant node.

`src/runner.ts` glues the three together and exports `run(source, output)` — the
same function the CLI (`src/cli.ts`) and the browser playground both call. The
interpreter prints through an injectable `output` callback, which is why the
playground can capture `spill` output instead of it going to a terminal.

```
source ──▶ Lexer ──▶ tokens ──▶ Parser ──▶ AST ──▶ Interpreter ──▶ output
```

---

## Project layout

```
src/
  token.ts        Token type + TokenType enum
  keywords.ts     THE central slang keyword map (single source of truth)
  lexer.ts        source string -> tokens
  ast.ts          AST node definitions
  parser.ts       tokens -> AST (recursive descent)
  values.ts       runtime value model + helpers (stringify, truthiness, ...)
  environment.ts  variable scopes with a parent chain
  builtins.ts     the standard library (spill, howmany, ...)
  interpreter.ts  tree-walking evaluator
  errors.ts       YapError classes with line info
  runner.ts       run(source, output) — public entry point
  cli.ts          the `yap` command
playground/       single-page in-browser editor + runner
examples/         hello, fizzbuzz, fibonacci, guess_logic
tests/            vitest suites for lexer, parser, interpreter
```

---

## Contributing: add a built-in or keyword

**A new built-in function** — edit `src/builtins.ts`. Add a `BuiltinFunction`
inside `createBuiltins()`:

```ts
new BuiltinFunction("clamp", 3, (_ctx, args) => {
  // args are already evaluated YapValues; throw BuiltinError on bad input.
  const [x, lo, hi] = args as [number, number, number];
  return Math.max(lo as number, Math.min(hi as number, x as number));
}),
```

It's instantly available in every program (and the playground) as `clamp(...)`.

**A new / renamed keyword** — edit `src/keywords.ts` only. Add or change an entry
in `KEYWORDS` mapping a spelling to a `TokenType`. Because the rest of the
compiler speaks in concept-level `TokenType`s, you don't touch the lexer, parser,
or interpreter. To introduce a brand-new *concept* (say, a `switch`), you'd add a
`TokenType`, a keyword entry, an AST node, a parser rule, and an interpreter
case — in that order. Run `npm test` and add a case to the relevant suite.

---

## License

MIT
