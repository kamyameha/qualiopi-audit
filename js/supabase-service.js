(() => {
  const config = window.SUPABASE_CONFIG;
  const factory = window.supabase?.createClient;

  if (!config?.url || !config?.publishableKey || !factory || config.url.includes('YOUR_PROJECT_REF')) {
    window.auditBackend = { configured: false };
    return;
  }

  const client = factory(config.url, config.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const requireUser = async () => {
    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    if (!data.user) throw new Error('AUTH_REQUIRED');
    return data.user;
  };

  const filePath = (auditId, indicatorNumber, file) => {
    const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-');
    return `${auditId}/${indicatorNumber}/${crypto.randomUUID()}-${safeName}`;
  };

  window.auditBackend = {
    configured: true,
    client,

    async session() {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return data.session;
    },

    async signIn(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    },

    async sendMagicLink(email, redirectTo = location.href.split('#')[0]) {
      const { data, error } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo, shouldCreateUser: false }
      });
      if (error) throw error;
      return data;
    },

    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    },

    async listAudits() {
      await requireUser();
      const { data, error } = await client.from('audits').select('*').order('audit_date', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data;
    },

    async createAudit(payload) {
      const user = await requireUser();
      const { data, error } = await client.from('audits').insert({ ...payload, owner_id: user.id }).select().single();
      if (error) throw error;
      const indicators = Array.from({ length: 32 }, (_, index) => ({ audit_id: data.id, indicator_number: index + 1 }));
      const { error: indicatorError } = await client.from('audit_indicators').insert(indicators);
      if (indicatorError) throw indicatorError;
      return data;
    },

    async uploadEvidence(auditId, indicatorNumber, file) {
      const user = await requireUser();
      const path = filePath(auditId, indicatorNumber, file);
      const { error: uploadError } = await client.storage.from('audit-evidence').upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;
      const { data, error } = await client.from('evidence_files').insert({
        audit_id: auditId,
        indicator_number: indicatorNumber,
        storage_path: path,
        original_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
        uploaded_by: user.id
      }).select().single();
      if (error) {
        await client.storage.from('audit-evidence').remove([path]);
        throw error;
      }
      return data;
    },

    async createEvidenceDownloadUrl(storagePath, expiresInSeconds = 300) {
      const { data, error } = await client.storage.from('audit-evidence').createSignedUrl(storagePath, expiresInSeconds);
      if (error) throw error;
      return data.signedUrl;
    },

    async addEvidenceLink(auditId, indicatorNumber, name, url) {
      const user = await requireUser();
      const { data, error } = await client.from('evidence_links').insert({
        audit_id: auditId,
        indicator_number: indicatorNumber,
        name: name || null,
        url,
        created_by: user.id
      }).select().single();
      if (error) throw error;
      return data;
    }
  };
})();
