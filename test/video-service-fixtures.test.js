import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,access,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildFixtures} from '../scripts/acceptance/video-service-fixtures.mjs';

test('replaced or truncated public media is rejected before creating derived fixtures',async()=>{
  const root=await mkdtemp(join(tmpdir(),'video-service-identity-'));
  try{
    const source=join(root,'truncated.mp4'),out=join(root,'no-derived-media');
    await writeFile(source,'A successful HTTP download label does not prove complete video bytes.');
    await assert.rejects(buildFixtures(source,out),/SOURCE_HASH_MISMATCH/);
    await assert.rejects(access(out));
  }finally{await rm(root,{recursive:true,force:true});}
});
