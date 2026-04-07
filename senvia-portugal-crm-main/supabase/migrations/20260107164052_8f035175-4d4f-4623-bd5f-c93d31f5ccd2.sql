-- ============================================
-- SENVIA OS - Multi-Tenant CRM Database Schema
-- ============================================

-- 1. Criar Enum para Roles
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'viewer');

-- 2. Criar Tabela: organizations
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  public_key UUID DEFAULT gen_random_uuid() NOT NULL UNIQUE,
  plan TEXT DEFAULT 'basic' CHECK (plan IN ('basic', 'pro')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Criar Tabela: user_roles (Separada para segurança)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- 4. Criar Tabela: profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Criar Tabela: leads
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'scheduled', 'won', 'lost')),
  notes TEXT,
  source TEXT,
  value NUMERIC(12,2),
  gdpr_consent BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Habilitar RLS em todas as tabelas
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- ============================================
-- FUNÇÕES DE SEGURANÇA (Security Definer)
-- ============================================

-- 7. Função: has_role - Verifica role do utilizador sem recursão RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 8. Função: get_user_org_id - Obtém organization_id do utilizador
CREATE OR REPLACE FUNCTION public.get_user_org_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = _user_id
$$;

-- 9. Função: get_org_by_public_key - Valida public_key e retorna org_id
CREATE OR REPLACE FUNCTION public.get_org_by_public_key(_public_key UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.organizations WHERE public_key = _public_key
$$;

-- ============================================
-- POLÍTICAS RLS - ORGANIZATIONS
-- ============================================

-- Super Admin pode ver/gerir tudo
CREATE POLICY "Super admin full access organizations"
ON public.organizations
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Utilizadores normais veem apenas a sua organização
CREATE POLICY "Users view own organization"
ON public.organizations
FOR SELECT
TO authenticated
USING (id = public.get_user_org_id(auth.uid()));

-- ============================================
-- POLÍTICAS RLS - USER_ROLES
-- ============================================

-- Apenas Super Admin gere roles
CREATE POLICY "Super admin manages roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Utilizadores podem ver as suas próprias roles
CREATE POLICY "Users view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- ============================================
-- POLÍTICAS RLS - PROFILES
-- ============================================

-- Super Admin acesso total
CREATE POLICY "Super admin full access profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Utilizadores veem perfis da sua organização
CREATE POLICY "Users view org profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (organization_id = public.get_user_org_id(auth.uid()));

-- Utilizadores podem atualizar o seu próprio perfil
CREATE POLICY "Users update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- ============================================
-- POLÍTICAS RLS - LEADS
-- ============================================

-- Super Admin acesso total
CREATE POLICY "Super admin full access leads"
ON public.leads
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Utilizadores leem leads da sua organização
CREATE POLICY "Users read org leads"
ON public.leads
FOR SELECT
TO authenticated
USING (organization_id = public.get_user_org_id(auth.uid()));

-- Utilizadores inserem leads na sua organização
CREATE POLICY "Users insert org leads"
ON public.leads
FOR INSERT
TO authenticated
WITH CHECK (organization_id = public.get_user_org_id(auth.uid()));

-- Utilizadores atualizam leads da sua organização
CREATE POLICY "Users update org leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (organization_id = public.get_user_org_id(auth.uid()));

-- Utilizadores eliminam leads da sua organização
CREATE POLICY "Users delete org leads"
ON public.leads
FOR DELETE
TO authenticated
USING (organization_id = public.get_user_org_id(auth.uid()));

-- Leads podem ser inseridos publicamente (via Edge Function com service_role)
-- Não criamos política pública aqui - será feito via Edge Function

-- ============================================
-- TRIGGER: Criar perfil automaticamente
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Utilizador')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- TRIGGER: Atualizar updated_at nos leads
-- ============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();