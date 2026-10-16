import test from 'node:test';
import assert from 'node:assert/strict';
import {createControlService,createMemoryStore} from '../src/control/service.js';

// Frozen source-level reproduction of Ashley's production blocker-answer failure.
// The current focus documents unfinished creator analysis, but the specific
// Current blocker field is absent from the video workstream projection.
const active = [
'# Active Work',
'## Current focus',
'**Workstream:** Shared video-understanding / evidence engine',
'**Do next:** Check real usefulness and wrong or missing observations; full creator acceptance remains open.',
'## Current active workstreams',
'### Shared video-understanding / evidence engine — ACTIVE / PARALLEL',
'**Current:** The real upload and transcript work; creator usefulness and end-to-end workflow understanding are UNVERIFIED.',
'**Next:** Validate missing actions, story/pacing and useful editing advice on a real creator clip.',
'**Last verified work:** Speech transcript and content summary built; earlier creator acceptance FAILED. Full creator understanding remains UNPASSED.',
'## Session handoff rule',
'Keep real source evidence.',
].join('\n');

test('video blocker follow-up must not imply nothing is blocking acceptance when saved evidence documents failures', async () => {
  const reads=[]; let writes=0, models=0;
  const github = {
    async readFile(_repo,path) {
      reads.push(path);
      if(path==='ACTIVE_WORK.md')return {content:active,sha:'fixture-active-blob'};
      if(path==='PROJECT_INDEX.md')return {content:'',sha:'fixture-index-blob'};
      throw new Error('No other fixtures are needed for read-only priority follow-up: '+path);
    },
    async writeFile() { writes++; throw new Error('Read-only must not write'); }
  };
  const service = createControlService({
    github,store:createMemoryStore(),
    router:{async route(){models++;return {route_kind:'temporary_context',responsibility:'ai_can_handle',confidence:'high',plain_summary:'Provider double cannot grade real user-facing answers.'};}}
  });
  const first=await service.capture('What should I do today?');
  const response=await service.capture('And what about blockers?', {
    conversationHistory:[{role:'user',text:'What should I do today?'},{role:'assistant',text:first.plain_summary}]
  });
  assert.equal(writes,0);
  assert.equal(response.queue_item,null);
  assert.equal(response.model_selection?.task,'priority_advice','Reproduce the actual deterministic answer path, not a simulated provider answer.');
  assert.match(response.plain_summary,/creator|workflow|acceptance|unverified|failed|unpassed/i,
    'Explain the documented unfinished acceptance rather than a missing field.');
  assert.doesNotMatch(response.plain_summary,/No specific blocker is saved/i,
    'Missing blocker field is not evidence that no material obstacle exists.');
});
