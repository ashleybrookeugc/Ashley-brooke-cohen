import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {describeFrames,saveVisualReview,visionReady} from './visual-review.mjs';
export async function describeStored(modulePath,jobDir){
  if(!await visionReady())throw Error('Local image descriptions are not configured');
  const stored=JSON.parse(await readFile(join(jobDir,'result.json'),'utf8'));
  const {verifyEvidencePackage}=await import(pathToFileURL(modulePath));
  const checked=await verifyEvidencePackage(stored.package_directory);
  const result={...stored,manifest:checked.manifest,evidence:checked.evidence,semantic_input:checked.semantic_input};
  const review=await describeFrames(result);await saveVisualReview(jobDir,review);return review;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const [modulePath,jobDir]=process.argv.slice(2);
  try{await describeStored(modulePath,jobDir);}catch{await writeFile(join(jobDir,'visual-failure.json'),JSON.stringify({error:'Image descriptions failed. Original source and basic notes retained.'}),{mode:0o600});process.exitCode=1;}
}
