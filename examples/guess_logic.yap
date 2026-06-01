// guess_logic.yap — a tiny "is this guess right?" demo using logic + functions
// (no real input — we simulate a few guesses so it runs anywhere)

vibe secret = 7

bestie checkGuess(guess) {
  fr (guess == secret) {
    bet "you ate that — " + guess + " is it!"
  } orfr (guess < secret) {
    bet guess + " is lowkey too small"
  } nah {
    bet guess + " is highkey too big"
  }
}

vibe guesses = [3, 10, 7]
grind (vibe i = 0; i < howmany(guesses); i = i + 1) {
  spill(checkGuess(guesses[i]))
}

// logical operators: short-circuit AND / OR / NOT
vibe a = nocap
vibe b = cap
fr (a vibin sus b) {
  spill("logic checks out")
}

fr (b lowkey a) {
  spill("at least one of them is nocap")
}

// break + continue inside a while loop
vibe i = 0
onloop (i < 10) {
  i = i + 1
  fr (i == 3) { skrt }   // skip 3
  fr (i == 7) { dip }    // stop at 7
  spill("count " + i)
}
