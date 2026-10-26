/**
 * Serialises a JSON-LD payload for embedding inside
 * `<script type="application/ld+json">`.
 *
 * The browser HTML-parses the contents of a `<script>` element *before* any
 * JSON parsing happens, so a value containing `</script>` closes the element
 * early and everything after it becomes live markup — a stored XSS in any
 * field a user controls (an org name, a one-liner, a breadcrumb label).
 * `JSON.stringify` alone does not help: it only escapes quotes and
 * backslashes, never `<`.
 *
 * Escaping `<` and `>` makes `</script>` unrepresentable; `&` is escaped so
 * the output is also safe if it ever lands somewhere HTML entities are
 * decoded. U+2028/U+2029 are valid in JSON strings but are line terminators
 * to older JS parsers, which would break the payload. All five stay valid
 * JSON — `\uXXXX` inside a string literal decodes back to the same
 * character, so consumers (Google, Bing) read the original text.
 */

const NEEDS_ESCAPING = /[<>&\u2028\u2029]/g;

export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data).replace(
    NEEDS_ESCAPING,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}
