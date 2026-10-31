import {parseCanonicalFacts} from '../../src/control/contracts.js';
import {createAmbiguityGate, createControlService, createMemoryStore} from '../../src/control/service.js';
import {modelTaskProfile, triageRequest} from '../../src/control/triage.js';

// Local routing only. This provider never reads an API key and never calls fetch.
export default class LocalRoutingProvider {
  constructor(options = {}) {
    this.config = options.config || {};
    if (this.config.network !== 'forbidden') throw new Error('Local routing provider refuses to load unless config.network is forbidden');
  }

  id = () => 'mary-kate-local-routing';

  callApi = async (_prompt, context) => {
    const vars = context?.vars || {};
    const output = await routeLocally(vars);
    return {output: JSON.stringify(output), tokenUsage: {total: 0, prompt: 0, completion: 0, cached: 0}};
  };
}

function priorityRun(document) {
  let reads = 0;
  let writes = 0;
  let routerCalls = 0;
  const service = createControlService({
    store: createMemoryStore(),
    router: {route() { routerCalls += 1; throw new Error('local phrasing eval forbids model dispatch'); }},
    github: {
      readFile: async () => { reads += 1; return {content: document, sha: 'phrasing-fixture-sha'}; },
      writeFile: async () => { writes += 1; throw new Error('local phrasing eval forbids canonical writes'); },
    },
  });
  return {
    service,
    snapshot(result) {
      return {
        mode: result.triage?.mode ?? null,
        read_only: result.triage?.read_only ?? null,
        max_model_calls: result.triage?.max_model_calls ?? null,
        calls: result.model_selection?.calls ?? null,
        queued: result.queue_item != null,
        plain_summary: result.plain_summary ?? '',
        reads, writes, router_calls: routerCalls,
      };
    },
  };
}

async function routeLocally(vars) {
  if (vars.kind === 'triage') {
    const result = triageRequest(vars.input, vars.triageContext);
    return {mode: result.mode, read_only: result.read_only, max_model_calls: result.max_model_calls};
  }
  if (vars.kind === 'task_profile') return {task: modelTaskProfile(vars.input, vars.context || {})};
  if (vars.kind === 'ambiguity') {
    const facts = vars.empty_facts === true ? [] : parseCanonicalFacts(vars.document);
    const result = createAmbiguityGate(vars.input, facts);
    return {status: result.status, reason: result.reason ?? null, section: result.section ?? null};
  }
  if (vars.kind === 'priority_capture') {
    const run = priorityRun(vars.document);
    return run.snapshot(await run.service.capture(vars.input));
  }
  if (vars.kind === 'priority_sequence') {
    const run = priorityRun(vars.document);
    const phrases = typeof vars.phrases === 'string' ? JSON.parse(vars.phrases) : vars.phrases;
    if (!Array.isArray(phrases)) throw new Error('priority sequence requires a phrase list');
    const steps = [];
    for (const input of phrases) steps.push(run.snapshot(await run.service.capture(input)));
    const last = steps.at(-1) || {};
    return {reads: last.reads ?? 0, writes: last.writes ?? 0, router_calls: last.router_calls ?? 0, steps};
  }
  throw new Error(`Unsupported local routing kind: ${vars.kind || 'missing'}`);
}
