export const ROUTE_KINDS = ['state_update','decision','side_idea','temporary_context'];
export const RESPONSIBILITIES = ['needs_ashley','ai_can_handle'];
export const CONFIDENCE = ['high','medium','low'];
export const WRITE_REPO = 'ashleybrookeugc/research-vault';
export const WRITE_PATHS = ['ACTIVE_WORK.md','SIDE_IDEAS.md'];
export const MUTABLE_FIELDS = ['Current stage','Current objective','Next bounded action','Next decision','Current blocker','Why this is current now'];

export function parseActiveWork(markdown) {
  const section = String(markdown).split('## Current active workstreams')[1]?.split('## Session handoff rule')[0] || '';
  return [...section.matchAll(/^### (.+)\n([\s\S]*?)(?=^### |\z)/gm)].map(match => {
    const fields = {};
    for (const field of match[2].matchAll(/^\*\*(.+?):\*\*\s*(.+?)(?:  )?$/gm)) fields[field[1]] = field[2].trim();
    return { id: match[1].toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''), name: match[1], ...fields };
  });
}

export function validateRoute(candidate) {
  if (!candidate || !ROUTE_KINDS.includes(candidate.route_kind)) throw new Error('Invalid route_kind');
  if (!RESPONSIBILITIES.includes(candidate.responsibility)) throw new Error('Invalid responsibility');
  if (!CONFIDENCE.includes(candidate.confidence)) throw new Error('Invalid confidence');
  if (!candidate.plain_summary || typeof candidate.plain_summary !== 'string') throw new Error('Missing plain_summary');
  if (candidate.route_kind === 'decision' && candidate.responsibility !== 'needs_ashley') throw new Error('Decisions require Ashley');
  if (candidate.proposal) {
    const p = candidate.proposal;
    if (p.target_repo !== WRITE_REPO || !WRITE_PATHS.includes(p.target_path)) throw new Error('Proposal target is not allowed');
    if (p.target_path === 'ACTIVE_WORK.md') {
      if (p.operation !== 'replace_field' || !p.section || !MUTABLE_FIELDS.includes(p.field) || !p.value) throw new Error('Invalid state proposal');
    } else if (p.operation !== 'append_side_idea' || !p.title || !p.body || !p.scope) throw new Error('Invalid side-idea proposal');
  }
  return structuredClone(candidate);
}

function escaped(value) { return value.replace(/[.*+?^$()|[\]\\{}]/g,'\\$&'); }
export function applyProposal(markdown, proposal) {
  if (proposal.target_path === 'ACTIVE_WORK.md') {
    const block = new RegExp('(^### '+escaped(proposal.section)+'\\n)([\\s\\S]*?)(?=^### |^## |\\z)','m');
    const match = markdown.match(block);
    if (!match) throw new Error('Workstream section not found');
    const line = new RegExp('^\\*\\*'+escaped(proposal.field)+':\\*\\*.*$','m');
    if (!line.test(match[2])) throw new Error('State field not found');
    const updated = match[2].replace(line, '**'+proposal.field+':** '+proposal.value+'  ');
    return markdown.replace(block, match[1]+updated);
  }
  if (proposal.target_path === 'SIDE_IDEAS.md') {
    const entry = '\n### '+proposal.title+'\n**Scope:** '+proposal.scope+'  \n**Status:** captured by control plane; not a feature commitment  \n'+proposal.body.trim()+'\n';
    return markdown.trimEnd()+entry;
  }
  throw new Error('Unsupported proposal');
}

export const ROUTE_SCHEMA = {version:'control-route.v1',required:['route_kind','responsibility','confidence','plain_summary'],route_kinds:ROUTE_KINDS,responsibilities:RESPONSIBILITIES,allowed_write:{repo:WRITE_REPO,paths:WRITE_PATHS,fields:MUTABLE_FIELDS}};
