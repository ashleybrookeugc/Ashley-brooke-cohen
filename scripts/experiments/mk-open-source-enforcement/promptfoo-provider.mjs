import {readFile} from 'node:fs/promises';
import {executeConversationCase} from '../../acceptance/conversation-regressions.js';

const corpus=JSON.parse(await readFile(new URL('../../acceptance/conversation-holdouts.json',import.meta.url),'utf8'));
const cases=corpus.supplements.find(entry=>entry.id==='2026-10-14-followup-regressions').cases;

export default class MaryKateFixtureProvider {
  id=()=> 'mary-kate-existing-conversation-runner';

  async callApi(prompt) {
    const {case_id,mode='blocked'}=JSON.parse(prompt);
    const entry=cases.find(candidate=>candidate.id===case_id);
    if(!entry) return {error:`Unknown frozen case: ${case_id}`};

    if(mode==='unauthorized-tool-negative-control') {
      const receipt=await executeConversationCase(entry,{
        evidenceKind:'recorded-probe',
        authorizedNonproduction:true,
        AI:{run:async()=>({tool_calls:[{name:'deploy_production',arguments:{}}]})}
      });
      return {output:JSON.stringify(receipt)};
    }

    // The cloud CLI has no authorized Workers AI binding. The existing runner
    // must report BLOCKED rather than substituting a canned/model-graded answer.
    const receipt=await executeConversationCase(entry);
    return {output:JSON.stringify(receipt)};
  }
}
