import {WRITE_REPO} from './contracts.js';

// This classifier grants only read access. Mixed commands retain the existing
// proposal/approval path, including commands after a question or polite prefix.
export function isReadQuestion(text) {
  const input=String(text||'').replace(/[’‘]/g,"'").trim();
  const question=/^(?:(?:and|so)\s+)?(?:(?:please\s+)?(?:(?:can|could|would) you\s+)?(?:what|why|when|where|who|how|was|were|is|are|has|have|does|did|do you think|should|tell me|show me|give me|explain|assess|evaluate|summarize)\b|actually\s+i\s+meant\b|i need help with\b)/i.test(input)
    || /^(?:for|about)\b[\s\S]*\b(?:what|why|when|where|who|how|is|are|does|did)\b/i.test(input);
  const command=/(?:^|[?!;.]\s*|\band\s+(?:then\s+)?)(?:(?:please|now)\s+)*(?:update|set|change|mark|approve|publish|ship|post|send|delete|spend|pay|purchase|transfer|remove|deploy|merge|buy|upload|execute|run|resume|continue|advance|switch)\b/i.test(input)
    || /\b(?:can|could|would) you\s+(?:please\s+)?(?:update|set|change|approve|publish|send|delete|deploy|merge|run|execute|buy|pay|upload)\b/i.test(input);
  return question&&!command;
}

export const isPriorityQuestion=text=>isReadQuestion(text)&&/\b(?:prioriti(?:ze|es|y)|what should (?:i|we) (?:do|focus on)|what (?:needs|requires) (?:my|our) attention|what is (?:currently )?blocked)\b/i.test(text);

export function authorityKind(text,workstream=null) {
  if(/^Mary Kate(?:\s*\/|\s*—|$)/i.test(workstream||'')&&/\b(?:desired (?:outcome|result)|(?:my|our|product) goals?|founder intent)\b/i.test(text)) return 'founder';
  if(/^Mary Kate(?:\s*\/|\s*—|$)/i.test(workstream||'')&&isReadQuestion(text)&&/\b(?:delays?|slow|taking (?:days|hours|weeks)|not working|broken|going wrong)\b/i.test(text)) return 'failure';
  if(/\b(?:decid(?:e|ed)|permissions?|automatic|model selection|capability selection)\b/i.test(text)) return 'founder';
  if(/\b(?:fail(?:ed|ure)?|read.only|went wrong|going wrong)\b/i.test(text)) return 'failure';
  if(/\b(?:telemetry|tests?|benchmark|evaluation)\b/i.test(text)) return 'tests';
  return 'current';
}
const rowMatch={founder:/^\| Mary Kate founder intent,/,failure:/^\| Known failure,/,tests:/^\| Mary Kate tests,/};

// Whole paragraphs retain qualifications/negation. Ranking is deterministic
// lexical selection, not semantic understanding or a freshness guarantee.
export function selectParagraphs(content,query,budget=10000) {
  const terms=[...new Set((query.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g)||[]).filter(x=>!['what','with','that','this','should','about','have','from','does','happened','actually','meant','the','and','for','next'].includes(x)))];
  const blocks=String(content).split(/\n\s*\n/);let heading='document';
  const scored=blocks.map((text,index)=>{
    const h=text.match(/^#{1,6}\s+(.+)/m);if(h)heading=h[1];
    const lower=text.toLowerCase();
    return {index,section:heading,text,score:terms.reduce((sum,term)=>sum+(lower.includes(term)?1:0)+(heading.toLowerCase().includes(term)?2:0),0)};
  });
  // A focused small source fits whole: lexical filtering must not drop its
  // cause or qualifications just because they use different words.
  if(String(content).length<=budget) return {excerpts:scored.map(({index,section,text})=>({paragraph:index,section,text})),source_characters:String(content).length,selected_characters:String(content).length,truncated:false,selection:'complete source within character budget'};
  const ranked=scored.filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.index-b.index);
  let used=0;const selected=[];
  for(const block of ranked) {if(used+block.text.length>budget)continue;selected.push(block);used+=block.text.length;if(selected.length===8)break;}
  return {excerpts:selected.sort((a,b)=>a.index-b.index).map(({index,section,text})=>({paragraph:index,section,text})),source_characters:String(content).length,selected_characters:used,truncated:used<String(content).length,selection:'query-term overlap; whole paragraphs; source order breaks ties'};
}

export async function retrieveIndexedEvidence(github,text,{activeWork,kind=authorityKind(text)}={}) {
  // Expand a domain synonym only for evidence lookup; never for intent or
  // permission. The linked incident must still come from the indexed hub.
  const query=kind==='founder'&&/\b(?:desired (?:outcome|result)|(?:my|our|product) goals?)\b/i.test(text)
    ? `${text} product objective recurring problem user-level jobs`
    : kind==='failure'&&/\b(?:chatbot|delays?|slow|taking (?:days|hours|weeks)|going wrong)\b/i.test(text)?`${text} chat conversation read-only failure`:text;
  const sources=[];const missing=[];let routing_source=null;
  const add=(path,file,budget)=>{if(!file?.sha||typeof file.content!=='string'){missing.push({path,reason:'unversioned_or_missing'});return;}
    const selected=selectParagraphs(file.content,query,budget);
    sources.push({source:{repo:WRITE_REPO,path,sha:file.sha,sha_kind:'blob'},...selected});
    if(!selected.excerpts.length)missing.push({path,reason:'no_matching_paragraphs'});
  };
  if(kind==='founder'||kind==='failure') {
    // Their focused authority is sufficient; do not attach unrelated current-work history.
  } else if(isPriorityQuestion(text)&&activeWork?.sha) {
    const content=String(activeWork.content);
    const priority=content.split('## Current execution priority')[1]?.split(/^## /m)[0]||'';
    const excerpts=[];let used=0;
    for(const paragraph of priority.split(/\n\s*\n/).filter(x=>x.trim()).slice(0,2)) {
      if(used+paragraph.length<=7000){excerpts.push({section:'Current execution priority',text:paragraph});used+=paragraph.length;}
    }
    const current=content.split('## Current active workstreams')[1]?.split('## Session handoff rule')[0]||'';
    let section='Current active workstreams';
    for(const line of current.split(/\r?\n/)) {
      if(line.startsWith('### '))section=line.slice(4);
      if(/^\*\*(?:Current|Next|Next bounded action):/.test(line)&&used+line.length<=11000){excerpts.push({section,text:line});used+=line.length;}
    }
    sources.push({source:{repo:WRITE_REPO,path:'ACTIVE_WORK.md',sha:activeWork.sha,sha_kind:'blob'},excerpts,source_characters:content.length,selected_characters:used,truncated:used<content.length,selection:'first two execution checkpoints plus current/next fields; no inferred priority order'});
    if(!excerpts.length)missing.push({path:'ACTIVE_WORK.md',reason:'no_current_work_sections'});
  } else add('ACTIVE_WORK.md',activeWork,7000);
  if(kind!=='current') {
    const index=await github.readFile(WRITE_REPO,'PROJECT_INDEX.md');
    routing_source={repo:WRITE_REPO,path:'PROJECT_INDEX.md',sha:index.sha,sha_kind:'blob'};
    const rows=String(index.content).split(/\r?\n/).filter(line=>rowMatch[kind].test(line));
    const path=rows.length===1?rows[0].split('|')[2]?.match(/`([^`]+)`/)?.[1]:null;
    if(!index.sha||!path||! /^(?:research|shared-capabilities)\/[a-zA-Z0-9_./-]+\.md$/.test(path)||path.includes('..')) missing.push({reason:'indexed_authority_missing',kind});
    else {
      const file=await github.readFile(WRITE_REPO,path);add(path,file,kind==='failure'?3000:7000);
      // One bounded expansion into a real failure record, chosen only from
      // links present in the retrieved hub. Never accept a model-supplied URL.
      if(kind==='failure') {
        const candidates=[...String(file.content).matchAll(/(?:\]\(|`)((?:[\w./-]+\/)?failures\/[\w-]+\.md)(?:[)#`])/g)].map(m=>m[1].startsWith('failures/')?'shared-capabilities/ai-workflows/'+m[1]:m[1]);
        const ranked=[...new Set(candidates)].map(path=>({path,score:(path.toLowerCase().match(/read-only|retriev|priorit|chat|follow-up/g)||[]).filter(term=>query.toLowerCase().includes(term)).length})).sort((a,b)=>b.score-a.score);
        const follow=ranked.find(x=>x.score>0&&/^shared-capabilities\/ai-workflows\/failures\/[\w-]+\.md$/.test(x.path));
        if(follow)add(follow.path,await github.readFile(WRITE_REPO,follow.path),3000);
      }
    }
  }
  return {version:'indexed-evidence.v1',authority_kind:kind,routing_source,sources,missing,limitations:['Static indexed routes and lexical paragraph ranking; not semantic proof.','Blob SHAs identify fetched files; no atomic repository snapshot is claimed.','Conflicting historical/current notes must remain qualified; source order alone is not freshness.']};
}
