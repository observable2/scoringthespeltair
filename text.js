// cleans one whitespace-separated token of markdown before it is measured:
// trims, drops inner hyphens (a trailing hyphen is kept), asterisks and curly quotes
function normalizeToken(token) {
  token = token.trim();
  // Remove any hyphen that is NOT the last character of the token
  token = token.replace(/-(?!$)/g, "");
  return token
    .replace(/\*\*\*/g, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    // use Unicode escapes to avoid editor silently converting curly quotes to straight ones
    .replace(/[“”‘’]/g, "");
}

export { normalizeToken };
