function derLength(length) {
  if (length < 128) return Uint8Array.of(length);
  const bytes = [];
  for (let value = length; value; value >>>= 8) bytes.unshift(value & 255);
  return Uint8Array.of(0x80 | bytes.length, ...bytes);
}

function der(tag, ...parts) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const encodedLength = derLength(length);
  const output = new Uint8Array(1 + encodedLength.length + length);
  let offset = 0;
  output[offset++] = tag;
  output.set(encodedLength, offset);
  offset += encodedLength.length;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function pemBytes(pem) {
  const body = String(pem || '').replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  if (!body) throw new Error('GitHub App private key is missing');
  return Uint8Array.from(atob(body), character => character.charCodeAt(0));
}

export function githubPrivateKeyPkcs8Bytes(pem) {
  const bytes = pemBytes(pem);
  if (/-----BEGIN PRIVATE KEY-----/.test(pem)) return bytes;
  if (!/-----BEGIN RSA PRIVATE KEY-----/.test(pem)) throw new Error('Unsupported GitHub App private key PEM format');

  const version = der(0x02, Uint8Array.of(0));
  const rsaEncryption = Uint8Array.of(0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01);
  const algorithm = der(0x30, rsaEncryption, Uint8Array.of(0x05, 0x00));
  return der(0x30, version, algorithm, der(0x04, bytes));
}
