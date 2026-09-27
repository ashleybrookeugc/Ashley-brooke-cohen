import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {createGitHubAppTokenProvider} from '../src/control/adapters.js';

const {privateKey} = generateKeyPairSync('rsa',{modulusLength:2048});
const pem = privateKey.export({type:'pkcs1',format:'pem'}).toString();
const env = {CONTROL_GITHUB_APP_PRIVATE_KEY:pem,CONTROL_GITHUB_APP_ID:'4962733',CONTROL_GITHUB_INSTALLATION_ID:'165552010'};
const now = 1_780_000_000_000;

async function failedRequest(body) {
  let request;
  const tokenProvider=createGitHubAppTokenProvider(env,{
    now:()=>now,
    fetchImpl:async (url,options)=>{
      request={url,options};
      return new Response(body(options),{status:403,headers:{'content-type':'application/json'}});
    },
  });
  let error;
  try { await tokenProvider('read'); } catch (caught) { error=caught; }
  assert.ok(error);
  return {request,error};
}

test('read-token request uses the expected JWT claims, installation, repositories and permissions',async()=>{
  const {request,error}=await failedRequest(()=>JSON.stringify({message:'Resource not accessible by integration'}));
  const jwt=request.options.headers.authorization.slice('Bearer '.length);
  const [header,claims]=jwt.split('.').slice(0,2).map(part=>JSON.parse(Buffer.from(part,'base64url').toString()));
  assert.deepEqual(header,{alg:'RS256',typ:'JWT'});
  assert.deepEqual(claims,{iat:Math.floor(now/1000)-30,exp:Math.floor(now/1000)+510,iss:'4962733'});
  assert.equal(request.url,'https://api.github.com/app/installations/165552010/access_tokens');
  assert.equal(request.options.method,'POST');
  assert.equal(request.options.headers.accept,'application/vnd.github+json');
  assert.equal(request.options.headers['x-github-api-version'],'2022-11-28');
  assert.equal(request.options.headers['content-type'],'application/json');
  assert.deepEqual(JSON.parse(request.options.body),{
    repositories:['research-vault','ugc-creator-app','B-Paid','Ashley-brooke-cohen'],
    permissions:{contents:'read'},
  });
  assert.equal(error.message,'GitHub App token 403: Resource not accessible by integration');
  assert.ok(!error.message.includes(jwt));
});

test('unknown GitHub response cannot echo private key, JWT, token or Authorization header into errors or logs',async()=>{
  const {request,error}=await failedRequest(options=>JSON.stringify({
    message:`private=${pem} jwt=${options.headers.authorization} token=ghs_mockInstallationToken`,
    other:'untrusted body',
  }));
  const jwt=request.options.headers.authorization.slice('Bearer '.length);
  const logged=[];
  const original=console.error;
  console.error=(...args)=>logged.push(args.join(' '));
  try { console.error('Control request failed',error.message); } finally { console.error=original; }
  const output=JSON.stringify({error:error.message,logs:logged});
  assert.equal(error.message,'GitHub App token 403: Unrecognized GitHub error response');
  for(const secret of [pem,jwt,request.options.headers.authorization,'ghs_mockInstallationToken','untrusted body']) {
    assert.ok(!output.includes(secret));
  }
});

test('non-JSON GitHub response also stays opaque',async()=>{
  const {error}=await failedRequest(()=>`<html>${pem}</html>`);
  assert.equal(error.message,'GitHub App token 403: Unrecognized GitHub error response');
});
