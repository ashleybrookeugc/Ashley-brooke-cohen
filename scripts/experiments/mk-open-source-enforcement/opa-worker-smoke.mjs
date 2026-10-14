import opaWasm from './opa-wasm-browser.esm.js';
import policyWasm from './policy.wasm';

let loaded;
const policy=()=>loaded??=(opaWasm.loadPolicy(policyWasm));

export default {
  async fetch(request) {
    const input=await request.json();
    const result=(await policy()).evaluate(input)?.[0]?.result;
    return Response.json(result??{allow:false,violations:['OPA decision was undefined.']});
  }
};
