const PRIVATE_KEY_BLOCK = /-----BEGIN ((?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY)-----\r?\n([\s\S]*?)-----END \1-----/g;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

export function containsPrivateKeyBlock(text) {
  for (const match of text.matchAll(PRIVATE_KEY_BLOCK)) {
    const body = match[2]
      .replace(/^\s*(?:Proc-Type: 4,ENCRYPTED\r?\n)?(?:DEK-Info: [A-Z0-9-]+,[A-F0-9]+\r?\n)?/i, "")
      .replace(/\s/g, "");
    if (body.length >= 64 && body.length % 4 === 0 && BASE64.test(body)) return true;
  }
  return false;
}
