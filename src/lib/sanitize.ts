// ============================================================================
// File: src/lib/sanitize.ts
// Purpose: Lightweight HTML sanitizer for admin-entered rich-text content
//          (product descriptions, offer customHtml, etc.). Removes <script>,
//          on* event handlers, javascript: URLs, and other XSS vectors while
//          preserving safe formatting tags.
// Role: Defense-in-depth against stored XSS. Admins are semi-trusted, but
//       their content renders on the public customer site, so we sanitize.
// ============================================================================

/**
 * Sanitize an HTML string for safe rendering via dangerouslySetInnerHTML.
 * Removes: <script>, <iframe>, <object>, <embed>, on* handlers, javascript:
 * URLs, data: URLs (except images), and style attributes.
 * Allows: basic formatting tags (p, br, strong, em, ul, ol, li, h1-h6, a, img,
 * table, thead, tbody, tr, td, th, div, span, blockquote, code, pre).
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";
  let s = html;
  // Remove script, iframe, object, embed, style tags and their content
  s = s.replace(/<(script|iframe|object|embed|style|link|meta|base|form|input|button|textarea|select)[^>]*>[\s\S]*?<\/\1>/gi, "");
  // Remove self-closing versions of dangerous tags
  s = s.replace(/<(script|iframe|object|embed|style|link|meta|base|form|input|button|textarea|select)[^>]*\/?>/gi, "");
  // Remove on* event handlers (onclick, onload, onerror, etc.)
  s = s.replace(/\son\w+\s*=\s*"[^"]*"/gi, "");
  s = s.replace(/\son\w+\s*=\s*'[^']*'/gi, "");
  s = s.replace(/\son\w+\s*=\s*[^\s>]+/gi, "");
  // Remove javascript: URLs in href/src
  s = s.replace(/(href|src)\s*=\s*["']javascript:[^"']*["']/gi, '$1="#"');
  s = s.replace(/(href|src)\s*=\s*javascript:[^\s>]*/gi, '$1="#"');
  // Remove data: URLs in href (except images — data:image/ is allowed in src)
  s = s.replace(/href\s*=\s*["']data:[^"']*["']/gi, 'href="#"');
  // Remove style attributes (can contain expression() / url(javascript:))
  s = s.replace(/\sstyle\s*=\s*"[^"]*"/gi, "");
  s = s.replace(/\sstyle\s*=\s*'[^']*'/gi, "");
  return s;
}
