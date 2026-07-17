# Supabase setup — Qualiopi audit

## Security decision

Do not protect the application with a password written in JavaScript, HTML, GitHub or localStorage. Anything shipped to the browser can be read by a visitor.

Use Supabase Auth instead:

- internal users: email + password;
- external auditors: email magic link;
- permissions: `owner`, `editor`, or `viewer` per audit through `audit_members`;
- evidence: private Storage bucket protected by Row Level Security (RLS).

The browser may contain the Supabase project URL and publishable/anon key. These are public client values. Never expose the `service_role` key.

## 1. Create the project

1. Create a Supabase project.
2. Open the SQL editor.
3. Run `supabase/migrations/20260717_initial.sql`.
4. Confirm that the private bucket `audit-evidence` exists.

## 2. Configure Authentication

In Authentication settings:

1. Enable Email authentication.
2. Keep email confirmation enabled for external users.
3. Add the GitHub Pages production URL to **Site URL** and **Redirect URLs**.
4. Create the internal Formation Entre-Deux accounts in Supabase Auth.

External auditors should receive a magic link. Their account is then attached to one audit as `viewer`.

## 3. Configure the browser client

Copy:

`js/supabase-config.example.js`

to:

`js/supabase-config.js`

Then insert the project URL and publishable/anon key from Project Settings > API.

Do not commit a service-role key.

## 4. Load Supabase in `index.html`

Add these scripts before `js/app.js`:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/supabase-config.js"></script>
<script src="js/supabase-service.js"></script>
```

Until `js/supabase-config.js` exists, the current localStorage application continues to work.

## 5. Migration order

The current app still stores audits and evidence in localStorage. Move it in controlled stages:

1. authentication gate;
2. audits and indicator states in Postgres;
3. files in private Storage;
4. evidence links in Postgres;
5. invitation UI and read-only external audit view;
6. one-time migration of existing localStorage data;
7. remove the localStorage backend after verification.

## External access flow

Recommended flow:

1. An owner clicks **Partager l’audit**.
2. They enter an email and choose `viewer` or `editor`.
3. A server-side Supabase Edge Function creates an invitation and sends a magic link.
4. The recipient signs in through that link.
5. The invitation is accepted and an `audit_members` row is created.
6. RLS gives access only to the invited audit.

Invitation creation and acceptance must be implemented server-side because email delivery and any service-role operations must never run in browser code.
