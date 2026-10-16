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
  if(/\b(?:creator workflow|source language|campaign proof|retention findings|contentease)\b/i.test(text)) return 'creator';
  if(/\b(?:video analyzer|video understanding|video-understanding|evidence engine|private video|video upload)\b/i.test(text)) return 'video';
  return 'current';
}
const rowMatch={founder:/^\| Mary Kate founder intent,/,failure:/^\| Known failure,/,tests:/^\| Mary Kate tests,/,video:/^\| Video analyzer capability\b/,creator:/^\| Creator workflow findings for ContentEase\b/};

// Whole paragraphs retain qualifications/negation. Ranking is deterministic
// lexical selection, not semantic understanding or a freshness guarantee.
export function selectParagraphs(content,query,budget=10000) {
  const terms=[...new Set((query.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g)||[]).filter(x=>!['what','with','that','this','should','about','have','from','does','happened','actually','meant','the','and','for','next'].includes(x)))];
  const blocks=String(content).split(/\n\s*\n/);let heading='document';
  const scored=blocks.map((text,index)=>{
    const h=text.match(/^#{1,6}\s+(.+)/m);if(h)heading=h[1];
    const lower=text.toLowerCase();
    return {index,section:heading,text,score:terms.reduce((sum,term)=>sum+(lower.includes(term)?1:heading.toLowerCase().includes(term)?0.5:0),0)};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.index-b.index);
  let used=0;const selected=[];
  for(const block of scored) {if(used+block.text.length>budget)continue;selected.push(block);used+=block.text.length;if(selected.length===8)break;}
  return {excerpts:selected.sort((a,b)=>a.index-b.index).map(({index,section,text})=>({paragraph:index,section,text})),source_characters:String(content).length,selected_characters:used,truncated:used<String(content).length,selection:'query-term and owning-heading overlap; whole paragraphs; source order breaks ties'};
}


// Read-only map -> hub -> evidence. References never become model tool arguments.
function wikiTarget(reference,from='PROJECT_INDEX.md') {
  if(typeof reference!=='string'||!reference||reference.startsWith('/')||! /^[A-Za-z0-9_./#-]+$/.test(reference))return null;
  const [target,anchor,...extra]=reference.split('#');if(extra.length)return null;
  const rooted=/^(?:research|shared-capabilities|evidence)\//.test(target);
  const stack=rooted?[]:from.split('/').slice(0,-1);
  for(const part of target.split('/')){if(!part||part==='.')continue;if(part==='..'){if(!stack.length)return null;stack.pop();}else stack.push(part);}
  const path=stack.join('/');
  if(!/^(?:research|shared-capabilities|evidence)\/[A-Za-z0-9_./-]+\.(?:md|json)$/.test(path))return null;
  return {path,anchor:anchor||null};
}
function queryTerms(text) {
  const extra=/contentease|creator workflow/i.test(text)?' ugc creator workflow campaign source proof':/telemetry/i.test(text)?' telemetry heartbeat acceptance lifecycle':/video/i.test(text)?' video analyzer acceptance unfinished correction':'';
  return [...new Set((String(text).toLowerCase().concat(extra).match(/[a-z][a-z0-9-]{2,}/g)||[]).filter(x=>!['what','which','why','with','that','this','should','about','have','from','does','happened','actually','meant','the','and','for','next'].includes(x)))];
}
function linkedCandidates(content,from,text) {
  const terms=queryTerms(text),links=[];let heading='';
  for(const block of String(content).split(/\n\s*\n/)){
    const h=block.match(/^#{1,6}\s+(.+)/m);if(h)heading=h[1];
    for(const match of block.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)|\x60([^\x60]+)\x60/g)){
      // Bare product paths are prose references, not local wiki links. Only
      // explicit Markdown links or vault-root backticked paths are traversed.
      if(match[3]&&!/^(?:research|shared-capabilities|evidence)\//.test(match[3]))continue;
      const target=wikiTarget(match[2]||match[3],from);if(!target)continue;
      const label=(match[1]||'').toLowerCase(),path=target.path.toLowerCase(),scope=heading.toLowerCase();
      const score=terms.reduce((n,t)=>n+(label.includes(t)?3:0)+(path.includes(t)?1:0)+(scope.includes(t)?1:0),0);
      if(score)links.push({...target,score});
    }
  }
  const seen=new Set();return links.sort((a,b)=>b.score-a.score).filter(x=>{const key=x.path+'#'+(x.anchor||'');if(seen.has(key))return false;seen.add(key);return true;});
}
function selectWikiEvidence(content,path,text,budget,anchor) {
  if(path.endsWith('.json')) {
    let data;try{data=JSON.parse(content);}catch{return {excerpts:[],source_characters:content.length,selected_characters:0,truncated:true,selection:'invalid JSON; no evidence inferred'};}
    if(!data||typeof data!=='object'||Array.isArray(data))return {excerpts:[],source_characters:content.length,selected_characters:0,truncated:true,selection:'unsupported JSON shape'};
    const keys=['stop','status','acceptance_boundary','full_requirements','evidence','attempts',...Object.keys(data)];
    let used=0;const excerpts=[],omitted_fields=[];
    for(const key of [...new Set(keys)]){if(!(key in data))continue;const value=JSON.stringify({[key]:data[key]});if(used+value.length>budget){omitted_fields.push(key);continue;}excerpts.push({section:key,text:value});used+=value.length;}
    return {excerpts,omitted_fields,source_characters:content.length,selected_characters:used,truncated:omitted_fields.length>0,selection:'whole JSON fields; outcome/limitations before supporting detail'};
  }
  let scope=content;
  if(anchor) {
    const lines=content.split('\n'),slug=s=>s.toLowerCase().replace(/[^\p{L}\p{N}_ -]/gu,'').replace(/ /g,'-');
    const start=lines.findIndex(line=>/^#{1,6} /.test(line)&&slug(line.replace(/^#+ /,''))===anchor);
    if(start<0)return {excerpts:[],source_characters:content.length,selected_characters:0,truncated:true,selection:'indexed section missing'};
    const level=lines[start].match(/^#+/)[0].length;let end=start+1;
    while(end<lines.length&&!new RegExp('^#{1,'+level+'} ').test(lines[end]))end++;
    scope=lines.slice(start,end).join('\n');
  }
  const selection=scope.length<=budget
    ? {excerpts:scope.split(/\n\s*\n/).map((text,paragraph)=>({paragraph,section:anchor||'document',text})),selected_characters:scope.length,truncated:false,selection:'complete focused source within character budget'}
    : selectParagraphs(scope,text,budget);
  return {...selection,source_characters:content.length,...(anchor?{section_anchor:anchor,paragraph_scope:'indexed section'}:{})};
}

export async function retrieveIndexedEvidence(github,text,{activeWork,kind=authorityKind(text),scope=null}={}) {
  const sources=[],missing=[],navigation=[],visited=new Set();let routing_source=null,used=0;
  const lookupText=kind==='founder'&&/\b(?:desired (?:outcome|result)|(?:my|our|product) goals?)\b/i.test(text)
    ? `${text} product objective recurring problem user-level jobs`
    : kind==='failure'&&/\b(?:chatbot|delays?|slow|taking (?:days|hours|weeks)|going wrong)\b/i.test(text)?`${text} chat conversation read-only failure`:text;
  const limit=16000,maxSources=4,query=lookupText+(scope?' '+scope:'');
  const read=async path=>{try{return await github.readFile(WRITE_REPO,path);}catch{missing.push({path,reason:'read_unavailable'});return null;}};
  const add=(path,file,budget,anchor=null,role='evidence')=>{
    if(visited.has(path)||sources.length>=maxSources)return;
    visited.add(path);
    if(!file?.sha||typeof file.content!=='string'){missing.push({path,reason:'unversioned_or_missing'});return;}
    const selected=selectWikiEvidence(file.content,path,query,Math.min(budget,limit-used),anchor);
    used+=selected.selected_characters;
    sources.push({source:{repo:WRITE_REPO,path,sha:file.sha,sha_kind:'blob'},role,...selected});
    if(selected.omitted_fields?.some(key=>['stop','status','acceptance_boundary','full_requirements','limitations'].includes(key)))missing.push({path,reason:'outcome_qualification_omitted'});
    if(!selected.excerpts.length)missing.push({path,reason:anchor?'indexed_section_empty_or_missing':'no_matching_paragraphs'});
  };
  const active=()=>add('ACTIVE_WORK.md',activeWork,kind==='current'?7000:3000,null,'current_state_projection');
  if(kind==='current') active();
  else {
    if(['tests','video'].includes(kind))active();
    const index=await read('PROJECT_INDEX.md');
    if(index?.sha&&typeof index.content==='string') {
      routing_source={repo:WRITE_REPO,path:'PROJECT_INDEX.md',sha:index.sha,sha_kind:'blob'};
      const rows=index.content.split(/\r?\n/).filter(line=>rowMatch[kind]?.test(line));
      const ref=rows.length===1?rows[0].split('|')[2]?.match(/\x60([^\x60]+)\x60/)?.[1]:null;
      const target=wikiTarget(ref);
      if(!target)missing.push({reason:'indexed_authority_missing',kind});
      else {
        const root=await read(target.path);
        navigation.push({from:'PROJECT_INDEX.md',to:target.path,reason:'indexed authority row',status:root?.sha?'retrieved':'unavailable'});
        add(target.path,root,{founder:7000,failure:3000,tests:6000,video:6000,creator:2000}[kind],target.anchor,['tests','creator'].includes(kind)?'catalog':kind==='failure'?'instruction':'authority');
        if(root?.sha&&typeof root.content==='string'&&kind!=='founder') {
          const candidates=linkedCandidates(root.content,target.path,query).filter(x=>!visited.has(x.path));
          for(const child of candidates.slice(0,kind==='failure'?1:maxSources-sources.length)) {
            const leaf=await read(child.path);
            navigation.push({from:target.path,to:child.path,reason:'linked descriptor/query overlap',score:child.score,status:leaf?.sha?'retrieved':'unavailable'});
            add(child.path,leaf,4000,child.anchor);
          }
        }
      }
    } else missing.push({path:'PROJECT_INDEX.md',reason:'unversioned_or_missing'});
    if(!sources.length&&activeWork?.sha)active();
  }
  return {version:'indexed-evidence.v2',authority_kind:kind,routing_source,sources,missing,navigation,
    reading_contract:{entry:'PROJECT_INDEX.md',maximum_sources:maxSources,maximum_depth:2,selected_character_limit:limit,selected_characters:used},
    limitations:['Bounded indexed routes and lexical descriptor/paragraph ranking; not general semantic search.','Only successfully versioned reads count as evidence; links and model text confer no authority.','Catalog/instruction text is navigation or governance, not proof that a feature works.','Blob SHAs are per-file versions, not an atomic repo snapshot or a freshness guarantee.','Historical/current conflicts and omitted evidence remain qualified; source order is not freshness.']};
}
