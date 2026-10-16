import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const root='test/fixtures/mk-handoff-pilot/';
const artifactPath=root+'worker-output.md';
const receiptPath=root+'receipt.json';
const blobSha=text=>createHash('sha1').update('blob '+Buffer.byteLength(text)+'\0'+text).digest('hex');

// The worker's assertion is NOT evidence. Git's own checked-out tree must
// contain the exact named artifact and the receipt must match its blob identity.
// This is a scoped rehearsal. Protection from an adversarial worker additionally
// requires an independently controlled runner/CI and protected-branch policy.
function gate(receipt, worktree, gitBlob) {
  const fail=code=>({allowed:false,code});
  if (!receipt||typeof receipt!=='object')return fail('receipt_missing');
  if(receipt.schema!=='mk-handoff-pilot.v1')return fail('receipt_schema_invalid');
  if(receipt.action!=='documentation_only')return fail('unauthorized_action');
  if(receipt.target_repo!=='ashleybrookeugc/Ashley-brooke-cohen'||receipt.target_path!==artifactPath)return fail('target_not_allowed');
  if(receipt.authorization!=='pilot_explicitly_authorized')return fail('approval_missing');
  if(!/^[0-9a-f]{40}$/.test(receipt.artifact_commit_sha||''))return fail('commit_receipt_missing');
  if(!/^[0-9a-f]{40}$/.test(receipt.artifact_blob_sha||''))return fail('blob_receipt_missing');
  if(!worktree||!gitBlob)return fail('committed_artifact_missing');
  const computed=blobSha(worktree);
  if(computed!==gitBlob)return fail('git_tree_mismatch');
  if(receipt.artifact_blob_sha!==gitBlob)return fail('receipt_blob_mismatch');
  if(!receipt.verification||receipt.verification.status!=='readback_verified'||receipt.verification.blob_sha!==gitBlob)return fail('readback_receipt_missing');
  return {allowed:true,code:'stage_receipt_verified'};
}

test('stage contract rejects missing and falsified receipts',()=>{
  const content=readFileSync(artifactPath,'utf8');
  const gitBlob=execFileSync('git',['rev-parse',`HEAD:${artifactPath}`],{encoding:'utf8'}).trim();
  const valid={schema:'mk-handoff-pilot.v1',action:'documentation_only',target_repo:'ashleybrookeugc/Ashley-brooke-cohen',target_path:artifactPath,authorization:'pilot_explicitly_authorized',artifact_commit_sha:'1'.repeat(40),artifact_blob_sha:gitBlob,verification:{status:'readback_verified',blob_sha:gitBlob}};
  for(const [candidate,code] of [
    [null,'receipt_missing'],
    [{...valid,authorization:'none'},'approval_missing'],
    [{...valid,target_path:'src/control/service.js'},'target_not_allowed'],
    [{...valid,artifact_blob_sha:'0'.repeat(40)},'receipt_blob_mismatch'],
    [{...valid,verification:{status:'self_reported',blob_sha:gitBlob}},'readback_receipt_missing'],
    [{...valid,artifact_commit_sha:null},'commit_receipt_missing']
  ])assert.equal(gate(candidate,content,gitBlob).code,code);
  assert.equal(gate(valid,content,gitBlob).allowed,true);
});

test('GitHub-backed pilot cannot be marked complete without real receipt',()=>{
  const content=readFileSync(artifactPath,'utf8');
  const gitBlob=execFileSync('git',['rev-parse',`HEAD:${artifactPath}`],{encoding:'utf8'}).trim();
  const receipt=existsSync(receiptPath)?JSON.parse(readFileSync(receiptPath,'utf8')):null;
  const result=gate(receipt,content,gitBlob);
  assert.equal(result.allowed,true,`STAGE_BLOCKED:${result.code}`);
});
