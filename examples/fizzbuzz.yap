// fizzbuzz.yap — FizzBuzz 1 through 20

grind (vibe i = 1; i <= 20; i = i + 1) {
  fr (i % 15 == 0) {
    spill("FizzBuzz")
  } orfr (i % 3 == 0) {
    spill("Fizz")
  } orfr (i % 5 == 0) {
    spill("Buzz")
  } nah {
    spill(i)
  }
}
