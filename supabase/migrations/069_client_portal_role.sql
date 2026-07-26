-- ── Client portal role ────────────────────────────────────────────────────────
-- Grants the pre-existing (previously unused) 'client_portal' role a permission
-- preset so a cabinet can invite its own client to log in, scoped to exactly
-- one dossier via user_memberships.dossier_id / dossier_scope.
--
-- Deliberately excluded: invoice:delete, document:delete, accounting:delete,
-- accounting:lock, tva_declaration:*, report:export, settings:* — those stay
-- accountant-only.
--
-- The live permissions catalog is missing a couple of entries other
-- migrations expected to already be there (e.g. invoice:update), so this
-- upserts the exact rows client_portal needs before referencing them —
-- role_permissions.(resource, action) has a FK into permissions.

insert into public.permissions(resource, action, label)
values
  ('invoice', 'read', 'Voir les factures'),
  ('invoice', 'create', 'Créer des factures'),
  ('invoice', 'update', 'Modifier les factures'),
  ('invoice', 'send', 'Envoyer les factures'),
  ('document', 'read', 'Voir les documents'),
  ('document', 'create', 'Ajouter des documents'),
  ('accounting', 'read', 'Voir les écritures'),
  ('accounting', 'create', 'Créer des écritures'),
  ('bulletin_paie', 'read', 'Voir les bulletins'),
  ('report', 'read', 'Consulter les rapports'),
  ('dossier', 'read', 'Voir les dossiers')
on conflict (resource, action) do nothing;

insert into public.role_permissions(role_name, resource, action)
values
  ('client_portal', 'invoice', 'read'),
  ('client_portal', 'invoice', 'create'),
  ('client_portal', 'invoice', 'update'),
  ('client_portal', 'invoice', 'send'),
  ('client_portal', 'document', 'read'),
  ('client_portal', 'document', 'create'),
  ('client_portal', 'accounting', 'read'),
  ('client_portal', 'accounting', 'create'),
  ('client_portal', 'bulletin_paie', 'read'),
  ('client_portal', 'report', 'read'),
  ('client_portal', 'dossier', 'read')
on conflict (role_name, resource, action) do nothing;
