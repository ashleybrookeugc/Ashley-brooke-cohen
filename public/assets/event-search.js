(()=>{
  const normalize=v=>String(v??'').toLowerCase().replace(/[’']/g,"'").replace(/[^a-z0-9&+.' -]+/g,' ').replace(/\s+/g,' ').trim();
  const haystack=e=>normalize([
    e.event_name,
    e.brand,
    e.neighborhood,
    e.address,
    e.what_it_is,
    e.what_is_free,
    e.caveats,
    e.practical_notes,
    ...(e.categories||[]),
    ...(e.classifications||[])
  ].filter(Boolean).join(' '));

  let tries=0;
  function install(){
    if(typeof matches!=='function'||typeof render!=='function'||typeof state==='undefined'){
      if(tries++<100)setTimeout(install,100);
      return;
    }
    const input=document.querySelector('#event-search');
    if(!input)return;
    const baseMatches=matches;
    matches=function(item,t){
      if(!baseMatches(item,t))return false;
      const q=normalize(input.value);
      if(!q)return true;
      const text=haystack(item.event);
      return q.split(' ').filter(Boolean).every(term=>text.includes(term));
    };
    input.addEventListener('input',()=>render());
    input.addEventListener('search',()=>render());
    const clear=document.querySelector('#clear-filters');
    if(clear)clear.addEventListener('click',()=>{input.value='';render()});
  }
  install();
})();