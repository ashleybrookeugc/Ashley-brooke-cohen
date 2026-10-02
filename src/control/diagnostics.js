// Only route-contract fields cross this boundary. Free-form content and unknown
// provider fields are represented by type/length, never copied into diagnostics.
const categorical=new Set(['route_kind','responsibility','confidence','target_repo','target_path','operation','field']);
const routeKeys=['route_kind','responsibility','confidence','plain_summary','project_id','why','proposal'];
const proposalKeys=['target_repo','target_path','operation','section','field','value','title','body','scope'];
const shape=value=>({type:value===null?'null':Array.isArray(value)?'array':typeof value,...(typeof value==='string'?{length:value.length}:{} )});
export function sanitizeRejectedRoute(value,secrets=[]) {
  const clean=(value,key,depth=0)=>{
    if(depth>3)return shape(value);
    if(value===null||typeof value!=='object') {
      if(typeof value==='boolean'||typeof value==='number'||value===null)return value;
      if(typeof value==='string'&&categorical.has(key)&&value.length<=120&&/^[a-zA-Z0-9_ .@/:-]*$/.test(value)&&!secrets.some(secret=>secret&&value.includes(secret))&&!/bearer|token|secret|password|private.key|gh[pousr]_|github_pat_|sk-/i.test(value))return value;
      return shape(value);
    }
    if(Array.isArray(value))return {type:'array',length:value.length};
    const keys=key==='proposal'?proposalKeys:routeKeys;
    return Object.fromEntries(keys.filter(k=>Object.hasOwn(value,k)).map(k=>[k,clean(value[k],k,depth+1)]));
  };
  return clean(value,'route');
}
export function routingDiagnostic(candidate,{provider='unknown',model=null,secrets=[]}={},validation={path:'response',reason:'Invalid provider response'}) {
  return {version:'control-routing-failure.v1',status:'failed',provider,model,
    validation:{path:validation.path||'route',reason:validation.reason||'Route validation failed'},
    rejected_route:sanitizeRejectedRoute(candidate,secrets)};
}
