(() => {
  const c=window.SUPABASE_CONFIG,f=window.supabase?.createClient;
  if(!c?.url||!c?.publishableKey||!f){window.auditBackend={configured:false};return}
  const client=f(c.url,c.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const one=async q=>{const{data,error}=await q;if(error)throw error;return data};
  const user=async()=>{const{data,error}=await client.auth.getUser();if(error)throw error;if(!data.user)throw Error('AUTH_REQUIRED');return data.user};
  const path=(aid,n,file)=>`${aid}/${n}/${crypto.randomUUID()}-${file.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\w.-]+/g,'-')}`;
  window.auditBackend={configured:true,client,
    session:async()=>one(client.auth.getSession()).then(x=>x.session),
    onAuth:cb=>client.auth.onAuthStateChange(cb),
    signIn:(email,password)=>one(client.auth.signInWithPassword({email,password})),
    authRoute:email=>one(client.rpc('auth_access_route',{requested_email:email.trim().toLowerCase()})),
    signInWithMagicLink:email=>one(client.auth.signInWithOtp({email:email.trim().toLowerCase(),options:{emailRedirectTo:location.origin+location.pathname,shouldCreateUser:false}})),
    signUp:(email,password)=>one(client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}})),
    signOut:()=>one(client.auth.signOut()),
    profile:async()=>{const u=await user();return one(client.from('profiles').select('*').eq('id',u.id).single())},
    acceptInvitations:()=>one(client.rpc('accept_my_invitations')),
    listAudits:async()=>{
      const[audits,indicators,files,links,profiles]=await Promise.all([
        one(client.from('audits').select('*').order('updated_at',{ascending:false})),
        one(client.from('audit_indicators').select('*')),
        one(client.from('evidence_files').select('*')),
        one(client.from('evidence_links').select('*')),
        one(client.from('profiles').select('id,display_name,email'))
      ]),profileById=new Map(profiles.map(p=>[p.id,p]));
      return audits.map(a=>({...a,
        audit_indicators:indicators.filter(i=>i.audit_id===a.id),
        evidence_files:files.filter(f=>f.audit_id===a.id).map(f=>({...f,profiles:profileById.get(f.uploaded_by)||null})),
        evidence_links:links.filter(l=>l.audit_id===a.id)
      }))
    },
    createAudit:async p=>{const u=await user();return one(client.from('audits').insert({...p,owner_id:u.id}).select().single())},
    duplicateAudit:async source=>{const u=await user(),copy=await one(client.from('audits').insert({owner_id:u.id,name:`${source.nom} — copie`,audit_date:source.date||null,audit_type:source.type,responsible_name:source.responsable||null,status:source.statutAudit,reviewed_at:source.reviseLe||null}).select().single());await Promise.all(Object.entries(source.indicateurs).map(([n,i])=>one(client.from('audit_indicators').update({status:i.etat,notes:i.notes}).eq('audit_id',copy.id).eq('indicator_number',Number(n)))));const links=Object.entries(source.indicateurs).flatMap(([n,i])=>i.liens.map(l=>({audit_id:copy.id,indicator_number:Number(n),name:l.name||null,url:l.url,created_by:u.id})));if(links.length)await one(client.from('evidence_links').insert(links));return copy},
    updateAudit:(id,p)=>one(client.from('audits').update(p).eq('id',id).select().single()),
    deleteAudit:id=>one(client.from('audits').delete().eq('id',id)),
    updateIndicator:(aid,n,p)=>one(client.from('audit_indicators').update(p).eq('audit_id',aid).eq('indicator_number',n)),
    invite:async(audit_id,email)=>{const u=await user(),address=email.trim().toLowerCase();const invitation=await one(client.from('audit_invitations').upsert({audit_id,email:address,invited_by:u.id,revoked_at:null,expires_at:new Date(Date.now()+12096e5).toISOString()},{onConflict:'audit_id,email'}).select().single());await one(client.auth.signInWithOtp({email:address,options:{emailRedirectTo:location.origin+location.pathname,shouldCreateUser:true}}));return invitation},
    upload:async(aid,n,file)=>{const u=await user(),storage_path=path(aid,n,file);await one(client.storage.from('audit-evidence').upload(storage_path,file));try{return await one(client.from('evidence_files').insert({audit_id:aid,indicator_number:n,storage_path,original_name:file.name,mime_type:file.type||null,size_bytes:file.size,uploaded_by:u.id}).select().single())}catch(e){await client.storage.from('audit-evidence').remove([storage_path]);throw e}},
    download:async p=>one(client.storage.from('audit-evidence').createSignedUrl(p,300)).then(x=>x.signedUrl),
    removeFile:async f=>{await one(client.storage.from('audit-evidence').remove([f.storage_path]));return one(client.from('evidence_files').delete().eq('id',f.id))},
    addLink:async(aid,n,name,url)=>{const u=await user();return one(client.from('evidence_links').insert({audit_id:aid,indicator_number:n,name:name||null,url,created_by:u.id}).select().single())},
    removeLink:id=>one(client.from('evidence_links').delete().eq('id',id))
  };
})();
