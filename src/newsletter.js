const now=()=>new Date().toISOString();
const clean=v=>typeof v==='string'?v.trim():'';
const emailOk=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)&&v.length<=254;

async function ensureSchema(env){
  await env.DB.exec(`CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    email TEXT PRIMARY KEY,
    source TEXT NOT NULL DEFAULT 'plan-my-day',
    consent_text TEXT NOT NULL,
    preferences_json TEXT,
    saved_occurrence_ids_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    zoho_status TEXT NOT NULL DEFAULT 'pending',
    zoho_synced_at TEXT,
    zoho_error TEXT
  );`);
}

function zohoConfigured(env){
  return Boolean(env.ZOHO_CLIENT_ID&&env.ZOHO_CLIENT_SECRET&&env.ZOHO_REFRESH_TOKEN&&env.ZOHO_CAMPAIGNS_LIST_KEY);
}

async function zohoAccessToken(env){
  const base=env.ZOHO_ACCOUNTS_BASE||'https://accounts.zoho.com';
  const body=new URLSearchParams({
    client_id:env.ZOHO_CLIENT_ID,
    client_secret:env.ZOHO_CLIENT_SECRET,
    refresh_token:env.ZOHO_REFRESH_TOKEN,
    grant_type:'refresh_token'
  });
  const r=await fetch(base+'/oauth/v2/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||!d.access_token)throw new Error('Zoho token refresh failed');
  return d.access_token;
}

async function syncZoho(env,email){
  const token=await zohoAccessToken(env);
  const base=env.ZOHO_CAMPAIGNS_BASE||'https://campaigns.zoho.com';
  const contactinfo=JSON.stringify({'Contact Email':email});
  const body=new URLSearchParams({resfmt:'JSON',listkey:env.ZOHO_CAMPAIGNS_LIST_KEY,contactinfo,source:'Ashley Brooke Cohen Plan My Day'});
  const r=await fetch(base+'/api/v1.1/json/listsubscribe',{method:'POST',headers:{Authorization:'Zoho-oauthtoken '+token,'content-type':'application/x-www-form-urlencoded'},body});
  const d=await r.json().catch(()=>({}));
  const code=String(d.code??'');
  if(!r.ok||(!['0','200','2003'].includes(code)&&d.status!=='success'))throw new Error(String(d.message||'Zoho subscribe failed').slice(0,300));
  return d;
}

export async function subscribeNewsletter(request,env){
  let body;
  try{body=await request.json()}catch{return Response.json({error:'Invalid request.'},{status:400})}
  const email=clean(body.email).toLowerCase();
  if(!emailOk(email))return Response.json({error:'Enter a valid email address.'},{status:400});
  if(body.consent!==true)return Response.json({error:'Consent is required.'},{status:400});
  const source=clean(body.source).slice(0,80)||'plan-my-day';
  const consentText=clean(body.consent_text).slice(0,500)||'Yes, email me NYC event picks and updates. I can unsubscribe anytime.';
  const prefs=body.preferences&&typeof body.preferences==='object'?JSON.stringify(body.preferences).slice(0,8000):null;
  const saved=Array.isArray(body.saved_occurrence_ids)?JSON.stringify(body.saved_occurrence_ids.slice(0,100)):null;
  const stamp=now();
  await ensureSchema(env);
  await env.DB.prepare(`INSERT INTO newsletter_subscribers (email,source,consent_text,preferences_json,saved_occurrence_ids_json,created_at,updated_at,zoho_status)
    VALUES (?,?,?,?,?,?,?,'pending')
    ON CONFLICT(email) DO UPDATE SET source=excluded.source,consent_text=excluded.consent_text,preferences_json=excluded.preferences_json,saved_occurrence_ids_json=excluded.saved_occurrence_ids_json,updated_at=excluded.updated_at`).bind(email,source,consentText,prefs,saved,stamp,stamp).run();
  if(!zohoConfigured(env))return Response.json({ok:true,synced:false});
  try{
    await syncZoho(env,email);
    await env.DB.prepare("UPDATE newsletter_subscribers SET zoho_status='synced',zoho_synced_at=?,zoho_error=NULL WHERE email=?").bind(now(),email).run();
    return Response.json({ok:true,synced:true});
  }catch(err){
    await env.DB.prepare("UPDATE newsletter_subscribers SET zoho_status='pending',zoho_error=? WHERE email=?").bind(String(err?.message||err).slice(0,300),email).run();
    return Response.json({ok:true,synced:false});
  }
}
