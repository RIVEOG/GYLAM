/*
# Panel Schema - Pterodactyl-style Game Server Management Panel

Creates the full database schema for a game server management panel with:
- User profiles with admin role flag
- Admin-configurable system settings (free server limits)
- Compute nodes (offline/online, ip/domain)
- Game servers (per user, per node, resource allocation)
- Built-in templates (Vanilla, Paper, Forge, Spigot, etc.)
- Plugin installs per server
- server.properties key/value editing
- Console logs

## Tables
- `profiles` — extends auth.users with username + admin flag
- `settings` — key/value store for admin-configurable panel options
- `nodes` — compute nodes with status, ip, resource capacity
- `templates` — built-in server templates (seeded)
- `servers` — user game servers (node, resources, state)
- `plugins` — installed plugins per server
- `properties` — server.properties key/value pairs per server
- `logs` — console log lines per server

## Security
- RLS enabled on every table.
- profiles: users read/update own; admins select/update all.
- settings: users select (read limits); admin update.
- nodes: authenticated can select; admin insert/update/delete.
- templates: authenticated can select; admin manage.
- servers: users CRUD own; admin manage all.
- plugins/properties/logs: scoped to server owner; admin manage all.
*/

-- ---------- profiles ----------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  is_admin boolean NOT NULL DEFAULT false,
  avatar_color text NOT NULL DEFAULT '#3b82f6',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin));

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin));

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- ---------- settings (singleton key/value) ----------
CREATE TABLE IF NOT EXISTS public.settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_select_all" ON public.settings;
CREATE POLICY "settings_select_all" ON public.settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "settings_admin_update" ON public.settings;
CREATE POLICY "settings_admin_update" ON public.settings
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin));

DROP POLICY IF EXISTS "settings_admin_insert" ON public.settings;
CREATE POLICY "settings_admin_insert" ON public.settings
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin));

INSERT INTO public.settings (key, value) VALUES
  ('free_servers_enabled', 'true'),
  ('free_ram_mb', '2048'),
  ('free_disk_mb', '5120'),
  ('free_cpu_percent', '100'),
  ('panel_name', 'Pterodactyl'),
  ('panel_url', '')
ON CONFLICT (key) DO NOTHING;

-- ---------- nodes ----------
CREATE TABLE IF NOT EXISTS public.nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'offline',
  ip_assigned text NOT NULL,
  ram_total_mb integer NOT NULL DEFAULT 4096,
  disk_total_mb integer NOT NULL DEFAULT 20480,
  cpu_total_percent integer NOT NULL DEFAULT 200,
  location text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nodes_select_auth" ON public.nodes;
CREATE POLICY "nodes_select_auth" ON public.nodes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "nodes_admin_insert" ON public.nodes;
CREATE POLICY "nodes_admin_insert" ON public.nodes
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin));

DROP POLICY IF EXISTS "nodes_admin_update" ON public.nodes;
CREATE POLICY "nodes_admin_update" ON public.nodes
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin));

DROP POLICY IF EXISTS "nodes_admin_delete" ON public.nodes;
CREATE POLICY "nodes_admin_delete" ON public.nodes
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin));

-- ---------- templates ----------
CREATE TABLE IF NOT EXISTS public.templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  icon text NOT NULL DEFAULT 'Box',
  category text NOT NULL DEFAULT 'minecraft',
  default_ram_mb integer NOT NULL DEFAULT 2048,
  default_disk_mb integer NOT NULL DEFAULT 5120,
  default_cpu_percent integer NOT NULL DEFAULT 100,
  default_port integer NOT NULL DEFAULT 25565,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "templates_select_auth" ON public.templates;
CREATE POLICY "templates_select_auth" ON public.templates
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "templates_admin_insert" ON public.templates;
CREATE POLICY "templates_admin_insert" ON public.templates
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin));

DROP POLICY IF EXISTS "templates_admin_update" ON public.templates;
CREATE POLICY "templates_admin_update" ON public.templates
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin));

DROP POLICY IF EXISTS "templates_admin_delete" ON public.templates;
CREATE POLICY "templates_admin_delete" ON public.templates
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin));

INSERT INTO public.templates (name, display_name, description, icon, category, default_ram_mb, default_disk_mb, default_cpu_percent, default_port, sort_order) VALUES
  ('vanilla', 'Vanilla Minecraft', 'Official Minecraft server by Mojang. The classic, unmodified survival experience.', 'Box', 'minecraft', 2048, 5120, 100, 25565, 1),
  ('paper', 'PaperMC', 'High-performance Minecraft server with improved tick times and huge plugin ecosystem.', 'Zap', 'minecraft', 3072, 6144, 150, 25565, 2),
  ('spigot', 'Spigot', 'Popular, optimized Minecraft server with strong plugin compatibility.', 'Wrench', 'minecraft', 2560, 5120, 120, 25565, 3),
  ('forge', 'Minecraft Forge', 'The leading modding API. Run modpacks and custom Forge mods.', 'Cpu', 'minecraft', 4096, 10240, 200, 25565, 4),
  ('fabric', 'Fabric', 'Lightweight, modern modding toolkit for fast and flexible Minecraft mods.', 'Box', 'minecraft', 3072, 7168, 150, 25565, 5),
  ('purpur', 'Purpur', 'Fork of Paper with extra performance, customization, and configuration options.', 'Sparkles', 'minecraft', 3072, 6144, 150, 25565, 6),
  ('velocity', 'Velocity Proxy', 'Modern, high-performance Minecraft proxy for networked server setups.', 'Network', 'minecraft', 1024, 2048, 50, 25577, 7),
  ('mohist', 'Mohist', 'Hybrid server combining Forge mods with Bukkit/Spigot plugins.', 'Layers', 'minecraft', 4096, 10240, 200, 25565, 8)
ON CONFLICT (name) DO NOTHING;

-- ---------- servers ----------
CREATE TABLE IF NOT EXISTS public.servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  node_id uuid REFERENCES public.nodes(id) ON DELETE SET NULL,
  template_id uuid REFERENCES public.templates(id) ON DELETE SET NULL,
  template_name text NOT NULL DEFAULT 'vanilla',
  status text NOT NULL DEFAULT 'offline',
  is_free boolean NOT NULL DEFAULT true,
  ram_mb integer NOT NULL DEFAULT 2048,
  disk_mb integer NOT NULL DEFAULT 5120,
  cpu_percent integer NOT NULL DEFAULT 100,
  port integer NOT NULL DEFAULT 25565,
  motd text NOT NULL DEFAULT 'A Minecraft Server',
  max_players integer NOT NULL DEFAULT 20,
  version text NOT NULL DEFAULT 'latest',
  sftp_user text,
  sftp_pass text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "servers_select_own_or_admin" ON public.servers;
CREATE POLICY "servers_select_own_or_admin" ON public.servers
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin));

DROP POLICY IF EXISTS "servers_insert_own" ON public.servers;
CREATE POLICY "servers_insert_own" ON public.servers
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "servers_update_own_or_admin" ON public.servers;
CREATE POLICY "servers_update_own_or_admin" ON public.servers
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin))
  WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin));

DROP POLICY IF EXISTS "servers_delete_own_or_admin" ON public.servers;
CREATE POLICY "servers_delete_own_or_admin" ON public.servers
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin));

-- ---------- plugins ----------
CREATE TABLE IF NOT EXISTS public.plugins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  name text NOT NULL,
  version text NOT NULL,
  source text NOT NULL DEFAULT 'panel',
  status text NOT NULL DEFAULT 'installed',
  enabled boolean NOT NULL DEFAULT true,
  installed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.plugins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plugins_select_owner_or_admin" ON public.plugins;
CREATE POLICY "plugins_select_owner_or_admin" ON public.plugins
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.servers s WHERE s.id = plugins.server_id AND (s.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin))));

DROP POLICY IF EXISTS "plugins_insert_owner_or_admin" ON public.plugins;
CREATE POLICY "plugins_insert_owner_or_admin" ON public.plugins
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.servers s WHERE s.id = plugins.server_id AND (s.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin))));

DROP POLICY IF EXISTS "plugins_update_owner_or_admin" ON public.plugins;
CREATE POLICY "plugins_update_owner_or_admin" ON public.plugins
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.servers s WHERE s.id = plugins.server_id AND (s.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.servers s WHERE s.id = plugins.server_id AND (s.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin))));

DROP POLICY IF EXISTS "plugins_delete_owner_or_admin" ON public.plugins;
CREATE POLICY "plugins_delete_owner_or_admin" ON public.plugins
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.servers s WHERE s.id = plugins.server_id AND (s.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin))));

-- ---------- properties ----------
CREATE TABLE IF NOT EXISTS public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  key text NOT NULL,
  value text NOT NULL,
  editable boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "properties_select_owner_or_admin" ON public.properties;
CREATE POLICY "properties_select_owner_or_admin" ON public.properties
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.servers s WHERE s.id = properties.server_id AND (s.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin))));

DROP POLICY IF EXISTS "properties_insert_owner_or_admin" ON public.properties;
CREATE POLICY "properties_insert_owner_or_admin" ON public.properties
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.servers s WHERE s.id = properties.server_id AND (s.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin))));

DROP POLICY IF EXISTS "properties_update_owner_or_admin" ON public.properties;
CREATE POLICY "properties_update_owner_or_admin" ON public.properties
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.servers s WHERE s.id = properties.server_id AND (s.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.servers s WHERE s.id = properties.server_id AND (s.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin))));

DROP POLICY IF EXISTS "properties_delete_owner_or_admin" ON public.properties;
CREATE POLICY "properties_delete_owner_or_admin" ON public.properties
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.servers s WHERE s.id = properties.server_id AND (s.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin))));

-- ---------- logs ----------
CREATE TABLE IF NOT EXISTS public.logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  line text NOT NULL,
  level text NOT NULL DEFAULT 'info',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "logs_select_owner_or_admin" ON public.logs;
CREATE POLICY "logs_select_owner_or_admin" ON public.logs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.servers s WHERE s.id = logs.server_id AND (s.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin))));

DROP POLICY IF EXISTS "logs_insert_owner_or_admin" ON public.logs;
CREATE POLICY "logs_insert_owner_or_admin" ON public.logs
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.servers s WHERE s.id = logs.server_id AND (s.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin))));

DROP POLICY IF EXISTS "logs_delete_owner_or_admin" ON public.logs;
CREATE POLICY "logs_delete_owner_or_admin" ON public.logs
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.servers s WHERE s.id = logs.server_id AND (s.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin))));

-- ---------- new_user trigger ----------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------- function to bootstrap first admin ----------
CREATE OR REPLACE FUNCTION public.set_first_admin(admin_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  existing_id uuid;
BEGIN
  SELECT id INTO existing_id FROM auth.users WHERE email = admin_email;
  IF existing_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, username, is_admin)
    VALUES (existing_id, split_part(admin_email, '@', 1), true)
    ON CONFLICT (id) DO UPDATE SET is_admin = true;
  END IF;
END;
$$;
