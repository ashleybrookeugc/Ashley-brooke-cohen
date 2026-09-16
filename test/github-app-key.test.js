import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync, webcrypto} from 'node:crypto';
import {githubPrivateKeyPkcs8Bytes} from '../src/control/github-key.js';

test('converts a GitHub-style PKCS#1 RSA PEM into PKCS#8 that Web Crypto can import and sign with', async () => {
  const {privateKey} = generateKeyPairSync('rsa', {modulusLength: 2048});
  const githubStylePem = privateKey.export({type:'pkcs1', format:'pem'}).toString();
  assert.match(githubStylePem, /BEGIN RSA PRIVATE KEY/);

  const imported = await webcrypto.subtle.importKey(
    'pkcs8',
    githubPrivateKeyPkcs8Bytes(githubStylePem),
    {name:'RSASSA-PKCS1-v1_5', hash:'SHA-256'},
    false,
    ['sign']
  );
  const signature = await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5', imported, new TextEncoder().encode('github-app-jwt'));
  assert.ok(signature.byteLength > 0);
});

test('preserves already-PKCS#8 PEM input', async () => {
  const {privateKey} = generateKeyPairSync('rsa', {modulusLength: 2048});
  const pkcs8Pem = privateKey.export({type:'pkcs8', format:'pem'}).toString();
  const imported = await webcrypto.subtle.importKey(
    'pkcs8',
    githubPrivateKeyPkcs8Bytes(pkcs8Pem),
    {name:'RSASSA-PKCS1-v1_5', hash:'SHA-256'},
    false,
    ['sign']
  );
  assert.equal(imported.type, 'private');
});
