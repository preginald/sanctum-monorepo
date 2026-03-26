/**
 * PKCE (Proof Key for Code Exchange) utilities for OIDC SSO flow.
 * Uses Web Crypto API — no external dependencies.
 */

function base64UrlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function generatePKCE() {
  // Generate a random 43-128 char code verifier
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const verifier = base64UrlEncode(array);

  // Derive the S256 code challenge
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(verifier));
  const challenge = base64UrlEncode(digest);

  return { verifier, challenge };
}

export function generateState() {
  return crypto.randomUUID();
}
