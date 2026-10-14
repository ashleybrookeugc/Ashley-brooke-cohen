import {pathToFileURL} from 'node:url';
import {writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
const [modulePath,source,jobDir]=process.argv.slice(2);
try{
  const {processVideo}=await import(pathToFileURL(modulePath));
  // Use the existing analyzer unchanged; each run has its own package root.
  const result=await processVideo(source,{outputRoot:join(jobDir,'packages')});
  await writeFile(join(jobDir,'result.tmp'),JSON.stringify(result));
  await rename(join(jobDir,'result.tmp'),join(jobDir,'result.json'));
}catch(error){await writeFile(join(jobDir,'failure.json'),JSON.stringify({code:error.code||'ANALYSIS_FAILED',message:'Analyzer failed. No completed evidence is available.'}));process.exitCode=1;}
