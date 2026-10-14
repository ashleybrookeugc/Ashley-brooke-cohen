import {readFile, access} from 'node:fs/promises';
import {constants} from 'node:fs';

const contract = JSON.parse(await readFile(new URL('../docs/my-work-v1-requirements.json', import.meta.url), 'utf8'));
if (!Array.isArray(contract.authority) || contract.authority.length < 4) throw new Error('My Work requirement gate is missing its required Project Truth authorities.');
if (!Array.isArray(contract.requirements) || contract.requirements.length < 14) throw new Error('Mary Kate Command Center requirement gate is missing original V1 requirements.');
const ids = new Set();
for (const requirement of contract.requirements) {
  if (!requirement.id || !requirement.authority || !requirement.acceptance_test) throw new Error('Each My Work requirement needs an authority and observable acceptance test.');
  if (ids.has(requirement.id)) throw new Error(`Duplicate My Work requirement: ${requirement.id}`);
  ids.add(requirement.id);
  await access(new URL(`../${requirement.acceptance_test}`, import.meta.url), constants.R_OK);
}
console.log(`My Work V1 requirement gate: ${contract.requirements.length} requirements mapped to acceptance tests.`);
