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
    signUp:(email,password)=>one(client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}})),
    magicLink:(email)=>one(client.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname,shouldCreateUser:true}})),
    signOut:()=>one(client.auth.signOut()),
    profile:async()=>{const u=await user();return one(client.from('profiles').select('*').eq('id',u.id).single())},
    acceptInvitations:()=>one(client.rpc('accept_my_invitations')),
    listAudits:()=>one(client.from('audits').select('*,audit_indicators(*),evidence_files(*,profiles!evidence_files_uploaded_by_fkey(display_name,email)),evidence_links(*)').order('updated_at',{ascending:false})),
    createAudit:async p=>{const u=await user();return one(client.from('audits').insert({...p,owner_id:u.id}).select().single())},
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
