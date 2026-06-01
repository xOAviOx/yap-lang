// fibonacci.yap — recursion with bestie + bet

bestie fib(n) {
  fr (n < 2) { bet n }
  bet fib(n - 1) + fib(n - 2)
}

spill("fib(10) = " + fib(10))   // 55

// ...and the whole sequence with a loop
vibe seq = []
grind (vibe i = 0; i < 11; i = i + 1) {
  slide(seq, fib(i))
}
spill(seq)
