import {githubPrivateKeyPkcs8Bytes} from './github-key.js';

export async function publicKeyFingerprintPayload(pem, subtle=crypto.subtle) {
  const algorithm={name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'};
  const privateKey=await subtle.importKey('pkcs8',githubPrivateKeyPkcs8Bytes(pem),algorithm,true,['sign']);
  const privateJwk=await subtle.exportKey('jwk',privateKey);
  const publicKey=await subtle.importKey('jwk',{kty:'RSA',n:privateJwk.n,e:privateJwk.e,alg:'RS256',ext:true,key_ops:['verify']},algorithm,true,['verify']);
  const spki=await subtle.exportKey('spki',publicKey);
  const digest=new Uint8Array(await subtle.digest('SHA-256',spki));
  return {public_key_sha256_spki:btoa(String.fromCharCode(...digest))};
}
