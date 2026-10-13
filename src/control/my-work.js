import {parseActiveWork} from './contracts.js';

const FIELD_CHOICES = {
  summary: ['Current objective', 'Current'],
  next: ['Next bounded action', 'Next', 'Next decision', 'Then', 'Next when unblocked', 'When resumed'],
  blocker: ['Current blocker', 'Blocked by', 'Waiting for']
};

const firstField = (item, names) => names.map(name => item[name]).find(Boolean) || null;
const source = (path, sha) => ({repo:'ashleybrookeugc/research-vault', path, sha});

function stateFromName(name) {
  const match=String(name).match(/^(.*?)\s+—\s+\*\*(.+?)\*\*\s*$/);
  return match ? {name:match[1].trim(), status:match[2].trim()} : {name:String(name).trim(), status:'ACTIVE'};
}

function approvedDeferred(markdown, evidence) {
  const items=[];
  for (const match of String(markdown||'').matchAll(/^\*\*(.+?):\*\*\s*(.+)$/gm)) {
    if(!/\bdeferred\b/i.test(match[1]) || !/\bapproved\b/i.test(match[1])) continue;
    const value=match[2].trim().replace(/\.$/,'');
    for(const label of value.split(/,\s*/).map(part=>part.trim()).filter(Boolean)) {
      items.push({label, approval:'Founder approved', source:evidence});
    }
  }
  return items;
}

function promotedIdeas(markdown, evidence) {
  const promoted=String(markdown||'').split('## Promoted')[1]?.split('## Open ideas')[0] || '';
  return [...promoted.matchAll(/^### (.+)\n([\s\S]*?)(?=^### |^## |$(?![\s\S]))/gm)].map(match=>{
    const status=match[2].match(/^\*\*Status:\*\*\s*(.+)$/m)?.[1]?.trim() || 'Promoted';
    return {label:match[1].trim(), status, source:evidence};
  });
}

function verifiedUpdates(history=[]) {
  return history.filter(item=>item?.receipt?.status==='verified'
    && item.receipt?.verification?.status==='verified'
    && item.receipt?.commit_sha)
    .map(item=>({
      label:item.plain_summary,
      scope:'Canonical update',
      verified_at:item.receipt.verification.verified_at || item.resolved_at || null,
      commit_sha:item.receipt.commit_sha,
      source:item.receipt.target || null
    }));
}

export function buildMyWorkProjection({activeWork,activeSha,sideIdeas,sideIdeasSha,history=[],generatedAt=new Date().toISOString()}) {
  const activeSource=source('ACTIVE_WORK.md',activeSha);
  const sideSource=source('SIDE_IDEAS.md',sideIdeasSha);
  const work=parseActiveWork(activeWork).map(item=>{
    const identity=stateFromName(item.name);
    return {
      id:item.id,
      name:identity.name,
      status:identity.status,
      summary:firstField(item,FIELD_CHOICES.summary),
      next:firstField(item,FIELD_CHOICES.next),
      blocker:firstField(item,FIELD_CHOICES.blocker),
      authority:item.Authority || null,
      source:activeSource
    };
  });
  return {
    version:'mary-kate.my-work.v1',
    read_only:true,
    generated_at:generatedAt,
    sources:[activeSource,sideSource],
    work,
    approved_deferred:approvedDeferred(activeWork,activeSource),
    promoted:promotedIdeas(sideIdeas,sideSource),
    verified_completion:verifiedUpdates(history)
  };
}
