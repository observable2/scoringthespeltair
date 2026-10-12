function mod(n, m) {
  // mod function that handles negative numbers, usage: mod(num, modulous)
  return ((n % m) + m) % m;
}

function shuffle (b) {
  let a = b.slice(); // make a copy
  let i = a.length;
  if (i < 2) return a;
  while (--i > 0) {
    let j = ~~(Math.random() * (i + 1)); // ~~ is a common optimization for Math.floor
    let t = a[j];
    a[j] = a[i];
    a[i] = t;
  }
  return a;
}

export { mod, shuffle }
