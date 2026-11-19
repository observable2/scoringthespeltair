function mod(n, m) {
  // modulo that handles negative numbers: mod(num, modulus)
  return ((n % m) + m) % m;
}

function shuffle (b) {
  let a = b.slice(); // make a copy
  let i = a.length;
  if (i < 2) return a;
  while (--i > 0) {
    // ~~ is a common optimization for Math.floor
    let j = ~~(Math.random() * (i + 1));
    let t = a[j];
    a[j] = a[i];
    a[i] = t;
  }
  return a;
}

export { mod, shuffle }
