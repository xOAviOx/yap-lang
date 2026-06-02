import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { run } from "../src/runner.js";

const here = dirname(fileURLToPath(import.meta.url));
const exampleDir = resolve(here, "../examples");

/** Runs source and returns the lines spilled (and any error message). */
function exec(source: string): { lines: string[]; ok: boolean; error?: string } {
  const lines: string[] = [];
  const result = run(source, (t) => lines.push(t));
  return { lines, ok: result.ok, error: result.error };
}

/** Runs source, asserting success, and returns the printed lines. */
function lines(source: string): string[] {
  const r = exec(source);
  expect(r.error, r.error).toBeUndefined();
  expect(r.ok).toBe(true);
  return r.lines;
}

describe("interpreter — section 3.4 examples", () => {
  it("variables + output (string/number concat)", () => {
    expect(
      lines('vibe lang = "YapLang"\nvibe year = 2026\nspill("yo, welcome to " + lang + ", year " + year)'),
    ).toEqual(["yo, welcome to YapLang, year 2026"]);
  });

  it("if / orfr / nah", () => {
    const program = `
      vibe score = 85
      fr (score >= 90) {
        spill("you ate that")
      } orfr (score >= 60) {
        spill("mid but passing")
      } nah {
        spill("it's giving fail")
      }
    `;
    expect(lines(program)).toEqual(["mid but passing"]);
  });

  it("while loop with break (dip) and continue (skrt)", () => {
    const program = `
      vibe i = 0
      onloop (i < 10) {
        i = i + 1
        fr (i == 3) { skrt }
        fr (i == 7) { dip }
        spill(i)
      }
    `;
    expect(lines(program)).toEqual(["1", "2", "4", "5", "6"]);
  });

  it("grind (for) loop", () => {
    const program = `grind (vibe j = 0; j < 5; j = j + 1) { spill("rep " + j) }`;
    expect(lines(program)).toEqual([
      "rep 0",
      "rep 1",
      "rep 2",
      "rep 3",
      "rep 4",
    ]);
  });

  it("functions, return, and recursion", () => {
    const program = `
      bestie add(a, b) { bet a + b }
      bestie fib(n) {
        fr (n < 2) { bet n }
        bet fib(n - 1) + fib(n - 2)
      }
      spill(add(2, 3))
      spill(fib(10))
    `;
    expect(lines(program)).toEqual(["5", "55"]);
  });

  it("arrays: index access, assignment, howmany", () => {
    const program = `
      vibe squad = ["zoomer", "boomer", "doomer"]
      spill(squad[0])
      squad[1] = "gamer"
      spill(squad[1])
      spill(howmany(squad))
    `;
    expect(lines(program)).toEqual(["zoomer", "gamer", "3"]);
  });

  it("logical operators with short-circuit + sus", () => {
    const program = `
      vibe a = nocap
      vibe b = cap
      fr (a vibin sus b) { spill("logic checks out") }
    `;
    expect(lines(program)).toEqual(["logic checks out"]);
  });
});

describe("interpreter — built-ins", () => {
  it("vibecheck reports types", () => {
    expect(
      lines(
        `spill(vibecheck(5))
         spill(vibecheck("hi"))
         spill(vibecheck(nocap))
         spill(vibecheck(ghosted))
         spill(vibecheck([1,2]))
         bestie f() { bet 1 }
         spill(vibecheck(f))`,
      ),
    ).toEqual(["number", "string", "boolean", "ghosted", "array", "function"]);
  });

  it("howmany counts strings and arrays", () => {
    expect(lines('spill(howmany("hello"))\nspill(howmany([1,2,3]))')).toEqual([
      "5",
      "3",
    ]);
  });

  it("glowup / chill change case", () => {
    expect(lines('spill(glowup("yap"))\nspill(chill("LOUD"))')).toEqual([
      "YAP",
      "loud",
    ]);
  });

  it("slide pushes and yoink pops", () => {
    const program = `
      vibe a = [1, 2]
      spill(slide(a, 3))
      spill(a)
      spill(yoink(a))
      spill(a)
    `;
    expect(lines(program)).toEqual(["3", "[1, 2, 3]", "3", "[1, 2]"]);
  });

  it("numify parses numbers", () => {
    expect(lines('spill(numify("42") + 8)')).toEqual(["50"]);
  });
});

describe("interpreter — semantics", () => {
  it("treats 0 and empty string as truthy, cap and ghosted as falsy", () => {
    const program = `
      fr (0) { spill("zero truthy") }
      fr ("") { spill("empty truthy") }
      fr (cap) { spill("nope") } nah { spill("cap falsy") }
      fr (ghosted) { spill("nope") } nah { spill("ghosted falsy") }
    `;
    expect(lines(program)).toEqual([
      "zero truthy",
      "empty truthy",
      "cap falsy",
      "ghosted falsy",
    ]);
  });

  it("supports closures", () => {
    const program = `
      bestie makeCounter() {
        vibe n = 0
        bestie tick() { n = n + 1\n bet n }
        bet tick
      }
      vibe c = makeCounter()
      spill(c())
      spill(c())
      spill(c())
    `;
    expect(lines(program)).toEqual(["1", "2", "3"]);
  });

  it("modulo and division work", () => {
    expect(lines("spill(17 % 5)\nspill(10 / 4)")).toEqual(["2", "2.5"]);
  });
});

describe("interpreter — error handling", () => {
  it("reports undefined variables with a line number, no crash", () => {
    const r = exec("spill(squadd)");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("squadd");
    expect(r.error).toMatch(/line 1/);
  });

  it("reports division by zero", () => {
    const r = exec("spill(1 / 0)");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/divide by zero/);
  });

  it("reports out-of-bounds array access", () => {
    const r = exec("vibe a = [1]\nspill(a[5])");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/out of bounds/);
  });

  it("reports calling a non-function", () => {
    const r = exec("vibe x = 5\nspill(x())");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/not a bestie/);
  });

  it("reports wrong argument count", () => {
    const r = exec("bestie add(a, b) { bet a + b }\nspill(add(1))");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/wants 2 args but got 1/);
  });

  it("syntax errors do not throw out of run()", () => {
    const r = exec("fr (x { }");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/sus syntax/);
  });
});

describe("example programs (definition of done)", () => {
  function runFile(name: string): string[] {
    const src = readFileSync(resolve(exampleDir, name), "utf8");
    return lines(src);
  }

  it("hello.yap", () => {
    expect(runFile("hello.yap")[0]).toBe("yo, welcome to YapLang 🔥");
  });

  it("fizzbuzz.yap prints correct FizzBuzz 1–20", () => {
    expect(runFile("fizzbuzz.yap")).toEqual([
      "1",
      "2",
      "Fizz",
      "4",
      "Buzz",
      "Fizz",
      "7",
      "8",
      "Fizz",
      "Buzz",
      "11",
      "Fizz",
      "13",
      "14",
      "FizzBuzz",
      "16",
      "17",
      "Fizz",
      "19",
      "Buzz",
    ]);
  });

  it("fibonacci.yap prints fib(10) = 55", () => {
    const out = runFile("fibonacci.yap");
    expect(out[0]).toBe("fib(10) = 55");
    expect(out[1]).toBe("[0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55]");
  });

  it("guess_logic.yap runs end to end", () => {
    const out = runFile("guess_logic.yap");
    expect(out).toEqual([
      "3 is lowkey too small",
      "10 is highkey too big",
      "you ate that — 7 is it!",
      "logic checks out",
      "at least one of them is nocap",
      "count 1",
      "count 2",
      "count 4",
      "count 5",
      "count 6",
    ]);
  });
});
