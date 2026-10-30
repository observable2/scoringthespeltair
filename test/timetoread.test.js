// run with: npm test   (node's built-in test runner; no dependencies)
// Expected values use the default constants: 112 ms per letter, 150 ms per clause or
// sentence mark, 1000 ms per line break, 75 ms per extra space, 300 ms per tab. They are
// written out in full so that changing a constant makes the arithmetic here fail loudly.
import { test } from "node:test";
import assert from "node:assert/strict";
import { timeToRead, wordTime, whitespaceTime, spelTime, timeToReadDefaults } from "../timetoread.js";

const L = 112; // ms per letter
const BREAK = 1000;
const END2 = 2 * BREAK; // the end of a text that has another line break
const NBSP = String.fromCodePoint(0xa0);
const RESPECT = { whitespace: "respect" };

test("defaults are frozen and as documented", () => {
  assert.ok(Object.isFrozen(timeToReadDefaults));
  assert.equal(timeToReadDefaults.perLetter, L);
  assert.equal(timeToReadDefaults.perNewline, BREAK);
});

test("wordTime: letters and the currently specified punctuation only", () => {
  assert.equal(wordTime("reading"), 7 * L);
  assert.equal(wordTime("away."), 4 * L + 150);
  assert.equal(wordTime("a,"), L + 150);
  assert.equal(wordTime("a;"), L + 150);
  assert.equal(wordTime("a?"), L + 150);
  assert.equal(wordTime("a(b)"), 2 * L + 150); // only the closing parenthesis is a mark
  assert.equal(wordTime("a'b"), 2 * L); // apostrophe: not counted
  assert.equal(wordTime("a-b"), 2 * L); // hyphen: not counted
  assert.equal(wordTime("1698"), 0); // digits are not letters
  assert.equal(wordTime("1st"), 2 * L);
  assert.equal(wordTime("caf&#233;"), 4 * L);
  assert.equal(wordTime("reading", 2), 392); // factor divides everything
  assert.equal(wordTime("reading", 1, { perLetter: 100 }), 700);
});

test("wordTime: HTML and Markdown inside a token are not read", () => {
  assert.equal(wordTime("<em>la</em>st"), 4 * L);
  assert.equal(wordTime("**bold**,"), 4 * L + 150);
  assert.equal(wordTime("grandson&mdash;by"), 10 * L + 150);
  assert.equal(wordTime("&lt;b&gt;"), L); // decoded text, not a tag
  assert.equal(wordTime("[link](http://x.org/a(b))"), 4 * L); // the target, with its parenthesis, is dropped
  assert.equal(wordTime("![alt text](img.png)"), 0);
  assert.equal(wordTime("<em>a</em>", 1, { html: false }), 5 * L);
  assert.equal(wordTime("[a](b)", 1, { markdown: false }), 2 * L + 150); // the target is read, and ) is a mark
});

test("timeToRead: the end of the text counts as a line ending", () => {
  const one = 7 * L + BREAK;
  assert.equal(timeToRead("reading"), one);
  assert.equal(timeToRead("reading "), one);
  assert.equal(timeToRead("reading\n"), one);
  assert.equal(timeToRead("reading\n\n"), one); // collapsed: still one ending
  assert.equal(timeToRead("reading\n", 1, RESPECT), one); // the real newline is the ending
  assert.equal(timeToRead("reading", 1, RESPECT), one);
  assert.equal(timeToRead("reading\n\n", 1, RESPECT), 7 * L + 2 * BREAK);
  assert.equal(timeToRead(""), 0);
  assert.equal(timeToRead(" \n\t "), 0);
});

test("timeToRead is the sum of its parts", () => {
  const sum = wordTime("a") + whitespaceTime(" ") + wordTime("b") + BREAK;
  assert.equal(timeToRead("a b"), sum);
  assert.equal(timeToRead("a b", 2), wordTime("a", 2) + wordTime("b", 2) + Math.round(BREAK / 2));
});

test("collapsed whitespace: only structure makes line breaks", () => {
  assert.equal(timeToRead("a b"), 2 * L + BREAK);
  assert.equal(timeToRead("a\nb"), 2 * L + BREAK); // a newline is just a space
  assert.equal(timeToRead("a  \t b"), 2 * L + BREAK);
  assert.equal(timeToRead("a\n\nb"), 2 * L + BREAK + END2); // blank line: a paragraph break
  assert.equal(timeToRead("One two.\n\nThree"), 6 * L + 150 + BREAK + 5 * L + END2);
});

test("respected whitespace: newlines, spaces and tabs count", () => {
  assert.equal(timeToRead("a\nb", 1, RESPECT), 2 * L + BREAK + END2);
  assert.equal(timeToRead("a b", 1, RESPECT), 2 * L + BREAK); // the ordinary space is free
  assert.equal(timeToRead("a  b", 1, RESPECT), 2 * L + 75 + BREAK);
  assert.equal(timeToRead("a\tb", 1, RESPECT), 2 * L + 300 + BREAK);
  assert.equal(timeToRead("a\n    b", 1, RESPECT), 2 * L + BREAK + 4 * 75 + END2); // indentation counts
  assert.equal(timeToRead("  a", 1, RESPECT), L + 2 * 75 + BREAK); // so does leading space
  assert.equal(timeToRead("a  b", 1, { ...RESPECT, perSpace: 0 }), 2 * L + BREAK);
});

test("no-break spaces are respected even when whitespace is collapsed", () => {
  assert.equal(timeToRead("a&nbsp;&nbsp;b"), 2 * L + 75 + BREAK);
  assert.equal(timeToRead(`a${NBSP}${NBSP}b`), 2 * L + 75 + BREAK);
  assert.equal(timeToRead("a&nbsp;b"), 2 * L + BREAK); // a single one stands for the ordinary space
});

test("HTML structure", () => {
  assert.equal(timeToRead("<p>a</p><p>b</p>"), 2 * L + BREAK + END2); // a leading break is not a pause
  assert.equal(timeToRead("<p>a</p>\n<p>b</p>"), 2 * L + BREAK + END2);
  assert.equal(timeToRead("a<br>b"), 2 * L + BREAK + END2);
  assert.equal(timeToRead("a<br/>b"), 2 * L + BREAK + END2);
  assert.equal(timeToRead("<em>a</em> <strong>b</strong>"), 2 * L + BREAK); // inline tags add nothing
  assert.equal(timeToRead("<table><tr><td>a</td><td>b</td></tr></table>"), 2 * L + BREAK);
  assert.equal(timeToRead("<!-- hidden -->a"), L + BREAK);
  assert.equal(timeToRead("<script>var x = 1;</script>a"), L + BREAK);
  assert.equal(timeToRead("<style>p { color: red }</style>a"), L + BREAK);
  assert.equal(timeToRead("a &mdash; b"), 2 * L + 150 + BREAK);
});

test("<pre> respects whitespace even when the rest is collapsed", () => {
  assert.equal(timeToRead("<pre>a   b</pre>"), 2 * L + 2 * 75 + BREAK);
  assert.equal(timeToRead("<pre>\na\nb</pre>"), 2 * L + BREAK + END2); // the first newline is dropped
});

test("Markdown structure", () => {
  assert.equal(timeToRead("# Title\ntext"), 5 * L + BREAK + 4 * L + END2);
  assert.equal(timeToRead("- a\n- b"), 2 * L + BREAK + END2);
  assert.equal(timeToRead("1. a\n2. b"), 2 * L + BREAK + END2); // the numerals are not read
  assert.equal(timeToRead("> a\n> b"), 2 * L + BREAK); // quoted lines still flow together
  assert.equal(timeToRead("a  \nb"), 2 * L + BREAK + END2); // two trailing spaces: hard break
  assert.equal(timeToRead("see [this](http://example.com/x) now"), 10 * L + BREAK);
  assert.equal(timeToRead("see ![a pic](pic.png) now"), 6 * L + BREAK);
  assert.equal(timeToRead("[text][ref]\n\n[ref]: http://example.com"), 4 * L + BREAK);
  assert.equal(timeToRead("a**b**c"), 3 * L + BREAK);
  assert.equal(timeToRead("a\\.b"), 2 * L + 150 + BREAK); // an escaped mark is still shown
  assert.equal(timeToRead("```\na  b\n```"), 2 * L + 75 + BREAK); // code keeps its spacing
  assert.equal(timeToRead("a\n\n---\n\nb"), 2 * L + BREAK + END2);
});

test("an invalid whitespace option is rejected", () => {
  assert.throws(() => timeToRead("a", 1, { whitespace: "pre" }), /whitespace must be/);
});

test("the end of the text is worth two line breaks if the text has another line break", () => {
  const plain = { whitespace: "respect" };
  // no other line break: one
  assert.equal(timeToRead("a b"), 2 * L + BREAK);
  assert.equal(timeToRead("<p>a b</p>"), 2 * L + BREAK); // a leading and a trailing block edge are not "other"
  assert.equal(timeToRead("a b\n", 1, plain), 2 * L + BREAK); // the real newline is the end
  // another line break: two, and a real newline at the end coincides with them
  assert.equal(timeToRead("a\nb", 1, plain), 2 * L + BREAK + END2);
  assert.equal(timeToRead("a\nb\n", 1, plain), 2 * L + BREAK + END2);
  assert.equal(timeToRead("a\n\nb\n\n"), 2 * L + BREAK + END2);
  assert.equal(timeToRead("a\nb\n\n\n", 1, plain), 2 * L + BREAK + 3 * BREAK); // more real breaks than the end needs
  assert.equal(timeToRead("\na", 1, plain), L + BREAK + END2); // a leading real newline is a line break too
  // the counts are options
  assert.equal(timeToRead("a\nb", 1, { ...plain, endBreaksMultiline: 3 }), 2 * L + BREAK + 3 * BREAK);
  assert.equal(timeToRead("a b", 1, { endBreaks: 0 }), 2 * L);
  assert.equal(timeToRead("a b", 2), wordTime("a", 2) + wordTime("b", 2) + BREAK / 2);
});

test("whitespaceTime counts a gap that is only whitespace", () => {
  assert.equal(whitespaceTime("     ", 1, RESPECT), 4 * 75); // the ordinary space is free
  assert.equal(whitespaceTime(" ", 1, RESPECT), 0);
  assert.equal(whitespaceTime("\n", 1, RESPECT), BREAK);
  assert.equal(whitespaceTime("\n    ", 1, RESPECT), BREAK + 4 * 75); // indentation counts, as in timeToRead
  assert.equal(whitespaceTime("\n\n", 1, RESPECT), 2 * BREAK);
  assert.equal(whitespaceTime("\t", 1, RESPECT), 300);
  assert.equal(whitespaceTime("     "), 0); // collapsed
  assert.equal(whitespaceTime("a<!--@ /para -->"), 0);
  assert.equal(whitespaceTime("\n<!--@ /para -->\n", 1, RESPECT), 2 * BREAK); // comments are not read
});

test("spelTime: one word is wordTime plus the gap after it, and no end of text", () => {
  assert.equal(spelTime("north"), wordTime("north"));
  assert.equal(spelTime("north", "\n", 1, RESPECT), wordTime("north") + BREAK);
  assert.equal(spelTime("north", "\n    ", 1, RESPECT), wordTime("north") + BREAK + 4 * 75);
  assert.equal(spelTime("years", "     ", 1, RESPECT), 5 * L + 4 * 75);
  assert.equal(spelTime("years", "     "), 5 * L); // collapsed
});

test("spelTime: whitespace inside a multi-word spel counts, as in timeToRead", () => {
  assert.equal(spelTime("all that"), 7 * L);
  assert.equal(spelTime("all that", "", 1, RESPECT), 7 * L); // one ordinary space is free
  assert.equal(spelTime("Thomas\u2019  Stone", "", 1, RESPECT), 11 * L + 75);
  assert.equal(spelTime("change\nno   time", "", 1, RESPECT), 12 * L + BREAK + 2 * 75);
  assert.equal(spelTime("change\nno   time", "       ", 1, RESPECT), 12 * L + BREAK + 2 * 75 + 6 * 75);
  assert.equal(spelTime("change\nno", "", 1), 8 * L); // collapsed: the newline is a space
  assert.equal(spelTime("all that ", "\n", 1, RESPECT), 7 * L + BREAK + 75); // its own trailing space joins the gap
  assert.equal(spelTime("  all that", "", 1, RESPECT), 7 * L); // leading whitespace belongs to the gap before
});

test("spelTime: { end: true } adds the end-of-text break like timeToRead", () => {
  const end = { ...RESPECT, end: true };
  assert.equal(spelTime("way", "", 1, end), 3 * L + BREAK);
  assert.equal(spelTime("way", "\n", 1, end), 3 * L + BREAK); // a real line break at the end is the ending
  assert.equal(spelTime("way", "\n\n", 1, end), 3 * L + 2 * BREAK);
  assert.equal(spelTime("a\nb", "", 1, end), timeToRead("a\nb", 1, RESPECT)); // two, as the text has another break
  assert.equal(spelTime("a b", "", 1, { end: true }), timeToRead("a b"));
  assert.equal(spelTime("way", "", 2, end), 3 * Math.round(L / 2) + Math.round(BREAK / 2));
});

test("spelTime: markup, spel markup included, is not read", () => {
  const plain = spelTime("all that", " \n", 1, RESPECT);
  assert.equal(spelTime("<!--@ spel -->all <em>that</em><!--@ /spel -->", " <!--@ /para -->\n", 1, RESPECT), plain);
  assert.equal(spelTime("all that", "<br>", 1), 7 * L + BREAK); // structural markup in the gap is a break
  assert.equal(spelTime(""), 0);
});
