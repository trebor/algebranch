// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

/**
 * Utility to convert an ArrayBuffer to a URL-safe Base64 string (Base64URL).
 */
function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Utility to convert a URL-safe Base64 string (Base64URL) back to an ArrayBuffer.
 */
function base64UrlToBuffer(base64url: string): ArrayBuffer {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding back
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Compresses a string into a URL-safe Base64URL string using deflate compression.
 */
export async function compressString(str: string): Promise<string> {
  const bytes = new TextEncoder().encode(str);
  
  const stream = new Blob([bytes]).stream();
  const compressedStream = stream.pipeThrough(new CompressionStream('deflate'));
  
  const response = new Response(compressedStream);
  const blob = await response.blob();
  const buffer = await blob.arrayBuffer();
  
  return bufferToBase64Url(buffer);
}

/**
 * Decompresses a URL-safe Base64URL string back into the original string using deflate.
 */
export async function decompressString(compressed: string): Promise<string> {
  const buffer = base64UrlToBuffer(compressed);
  
  const stream = new Blob([buffer]).stream();
  const decompressedStream = stream.pipeThrough(new DecompressionStream('deflate'));
  
  const response = new Response(decompressedStream);
  return await response.text();
}
