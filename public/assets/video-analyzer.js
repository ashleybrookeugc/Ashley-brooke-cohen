const form=document.querySelector('#analyzer-form'),input=document.querySelector('#urls'),statusNode=document.querySelector('#status'),resultsNode=document.querySelector('#results'),button=form.querySelector('button');
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const row=(label,value)=>`<dt>${esc(label)}</dt><dd>${esc(value||'—')}</dd>`;
function render(item){
  if(item.status==='BLOCKED')return `<article class="result blocked"><h2><span class="badge">BLOCKED</span></h2><dl><dt>Original URL</dt><dd><a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.url)}</a></dd>${row('Reason',item.reason)}</dl></article>`;
  return `<article class="result"><h2>${esc(item.suggested_title)}</h2><dl><dt>Original URL</dt><dd><a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.url)}</a></dd>${row('Description',item.description)}${row('Category',item.inferred_category)}${row('Format / style',item.format_style)}${row('Hook',item.hook)}${row('Strongest qualities',(item.strongest_qualities||[]).join(', '))}${row('Recommendation',item.portfolio_recommendation)}${row('Cache',item.cached?'Saved result':'New analysis')}</dl></article>`;
}
form.addEventListener('submit',async event=>{
  event.preventDefault();
  const urls=[...new Set(input.value.split(/\r?\n/).map(value=>value.trim()).filter(Boolean))];
  if(!urls.length)return;
  button.disabled=true;statusNode.textContent=`Analyzing ${urls.length} URL${urls.length===1?'':'s'}…`;resultsNode.innerHTML='';
  try{
    const response=await fetch('/api/admin/video-analysis',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({urls})});
    if(response.status===401){location.href='/admin/login';return}
    const body=await response.json();
    if(!response.ok)throw new Error(body.error||'Analysis failed.');
    resultsNode.innerHTML=body.results.map(render).join('');statusNode.textContent=`Finished ${body.results.length} URL${body.results.length===1?'':'s'}.`;
  }catch(error){statusNode.textContent=error.message}
  finally{button.disabled=false}
});
