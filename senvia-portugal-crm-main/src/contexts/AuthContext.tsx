import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import type { User, Session } from '@supabase/auth-js';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole } from '@/types';

const ACTIVE_ORG_KEY = 'senvia_active_organization_id';

type MFAStatus = 'none' | 'pending' | 'verified';

interface Profile {
  id: string;
  organization_id: string | null;
  full_name: string;
  avatar_url: string | null;
  created_at: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  code: string | null;
  public_key: string;
  plan: string;
  created_at: string;
  form_settings?: unknown;
  niche?: string;
  enabled_modules?: unknown;
  logo_url?: string | null;
  invoicexpress_account_name?: string | null;
  invoicexpress_api_key?: string | null;
  whatsapp_instance?: string | null;
  whatsapp_api_key?: string | null;
  whatsapp_base_url?: string | null;
  integrations_enabled?: any;
  tax_config?: any;
  sales_settings?: any;
}

interface UserOrganizationMembership {
  organization_id: string;
  organization_name: string;
  organization_code: string;
  organization_slug: string;
  member_role: AppRole;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  organization: Organization | null;
  organizations: UserOrganizationMembership[];
  roles: AppRole[];
  isLoading: boolean;
  isSuperAdmin: boolean;
  needsOrgSelection: boolean;
  mfaStatus: MFAStatus;
  completeMfaChallenge: () => void;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refetchUserData: () => Promise<void>;
  switchOrganization: (orgId: string) => Promise<void>;
  selectOrganization: (orgId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<UserOrganizationMembership[]>([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingUserData, setIsLoadingUserData] = useState(false);
  const [needsOrgSelection, setNeedsOrgSelection] = useState(false);
  const [mfaStatus, setMfaStatus] = useState<MFAStatus>('none');

  const isSuperAdmin = roles.includes('super_admin');

  // Check MFA assurance level
  const checkMFAStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error || !data) {
        setMfaStatus('none');
        return;
      }
      if (data.nextLevel === 'aal2' && data.currentLevel !== 'aal2') {
        setMfaStatus('pending');
      } else if (data.currentLevel === 'aal2') {
        setMfaStatus('verified');
      } else {
        setMfaStatus('none');
      }
    } catch {
      setMfaStatus('none');
    }
  }, []);

  const completeMfaChallenge = useCallback(() => {
    setMfaStatus('verified');
  }, []);

  // Load organization by ID
  const loadOrganization = useCallback(async (orgId: string) => {
    const { data: orgData } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .maybeSingle();
    
    if (orgData) {
      setOrganization(orgData);
      localStorage.setItem(ACTIVE_ORG_KEY, orgId);
      setNeedsOrgSelection(false);
    }
    
    return orgData;
  }, []);

  // Fetch profile, organizations and roles
  useEffect(() => {
    let cancelled = false;

    const fetchUserData = async (userId: string) => {
      setIsLoadingUserData(true);
      try {
        // Fetch profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        
        if (cancelled) return;
        setProfile(profileData);

        // Fetch roles
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId);
        
        if (cancelled) return;
        if (rolesData) {
          setRoles(rolesData.map(r => r.role as AppRole));
        }

        // Fetch user's organization memberships
        const { data: orgsData } = await supabase
          .rpc('get_user_organizations', { _user_id: userId });
        
        if (cancelled) return;
        
        // get_user_organizations now returns all orgs for super_admins automatically
        const userOrgs = (orgsData || []) as UserOrganizationMembership[];
        setOrganizations(userOrgs);

        // Determine which organization to load
        const storedOrgId = localStorage.getItem(ACTIVE_ORG_KEY);
        
        if (userOrgs.length === 0) {
          // No organizations - might be new user
          if (profileData?.organization_id) {
            await loadOrganization(profileData.organization_id);
          } else {
            setOrganization(null);
            setNeedsOrgSelection(false);
          }
        } else if (userOrgs.length === 1) {
          // Only one organization - auto select
          await loadOrganization(userOrgs[0].organization_id);
        } else if (storedOrgId && userOrgs.some(o => o.organization_id === storedOrgId)) {
          // Multiple orgs but we have a stored selection that's still valid
          await loadOrganization(storedOrgId);
        } else {
          // Multiple organizations and no valid stored selection - need to choose
          setNeedsOrgSelection(true);
          setOrganization(null);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        if (!cancelled) setIsLoadingUserData(false);
      }
    };

    if (user?.id) {
      fetchUserData(user.id);
      checkMFAStatus();
    } else {
      setProfile(null);
      setOrganization(null);
      setOrganizations([]);
      setRoles([]);
      setNeedsOrgSelection(false);
      setMfaStatus('none');
      setIsLoadingUserData(false);
    }

    return () => {
      cancelled = true;
    };
  }, [user?.id, loadOrganization, checkMFAStatus]);

  // Auth state listener
  useEffect(() => {
    let mounted = true;
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    }).catch(() => {
      if (mounted) setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    // Limpar estados ANTES de chamar o Supabase para evitar race conditions
    setUser(null);
    setSession(null);
    setProfile(null);
    setOrganization(null);
    setOrganizations([]);
    setRoles([]);
    setNeedsOrgSelection(false);
    
    // Limpar localStorage
    localStorage.removeItem(ACTIVE_ORG_KEY);
    
    // Agora sim, chamar o Supabase
    await supabase.auth.signOut();
  };

  const refetchUserData = async () => {
    if (!user?.id) return;

    try {
      // Re-fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      setProfile(profileData);

      // Re-fetch current organization
      const storedOrgId = localStorage.getItem(ACTIVE_ORG_KEY);
      if (storedOrgId) {
        await loadOrganization(storedOrgId);
      } else if (profileData?.organization_id) {
        await loadOrganization(profileData.organization_id);
      }

      // Re-fetch organizations list
      const { data: orgsData } = await supabase
        .rpc('get_user_organizations', { _user_id: user.id });
      
      setOrganizations((orgsData || []) as UserOrganizationMembership[]);
    } catch (error) {
      console.error('Error refetching user data:', error);
    }
  };

  const switchOrganization = async (orgId: string) => {
    // Verify user has access to this organization
    const hasAccess = organizations.some(o => o.organization_id === orgId);
    if (!hasAccess && !isSuperAdmin) {
      console.error('User does not have access to this organization');
      return;
    }

    // Sync active_organization_id in JWT so RLS uses the correct org
    await supabase.auth.updateUser({
      data: { active_organization_id: orgId }
    });

    await loadOrganization(orgId);
    
    // Reload the page to ensure all data is fresh for the new organization
    window.location.reload();
  };

  const selectOrganization = async (orgId: string) => {
    // Sync active_organization_id in JWT so RLS uses the correct org
    await supabase.auth.updateUser({
      data: { active_organization_id: orgId }
    });
    await loadOrganization(orgId);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        organization,
        organizations,
        roles,
        isLoading: isLoading || isLoadingUserData,
        isSuperAdmin,
        needsOrgSelection,
        mfaStatus,
        completeMfaChallenge,
        signIn,
        signUp,
        signOut,
        refetchUserData,
        switchOrganization,
        selectOrganization,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
