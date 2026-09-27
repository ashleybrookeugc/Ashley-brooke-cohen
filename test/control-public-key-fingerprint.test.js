import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createPublicKey,generateKeyPairSync,webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {publicKeyFingerprintPayload} from '../src/control/public-key-fingerprint.js';

test('diagnostic returns only the SHA-256 fingerprint of canonical public SPKI bytes',async()=>{
  const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
  const pem=privateKey.export({type:'pkcs1',format:'pem'}).toString();
  const expected=createHash('sha256').update(createPublicKey(privateKey).export({type:'spki',format:'der'})).digest('base64');
  const payload=await publicKeyFingerprintPayload(pem,webcrypto.subtle);
  assert.deepEqual(payload,{public_key_sha256_spki:expected});
  const serialized=JSON.stringify(payload);
  assert.equal(serialized.includes(pem),false);
  assert.equal(serialized.includes('PRIVATE KEY'),false);
  assert.equal(serialized.includes('JWT'),false);
  assert.equal(serialized.includes('token'),false);
});

test('diagnostic route remains behind the existing admin check',()=>{
  const source=readFileSync(new URL('../src/control-worker.js',import.meta.url),'utf8');
  assert.ok(source.indexOf('if(!await isAdmin(request,env))')<source.indexOf("path==='/api/control/_diagnostics/public-key-fingerprint'"));
});
