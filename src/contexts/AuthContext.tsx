import { createContext, useContext, useEffect, useState, useRef, ReactNode, useCallback } from 'react';
import type { User, Session } from '@supabase/auth-js';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole } from '@/types';

const ACTIVE_ORG_KEY = 'p2g_active_organization_id';

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
  userDataError: string | null;
  isSuperAdmin: boolean;
  needsOrgSelection: boolean;
  mfaStatus: MFAStatus;
  completeMfaChallenge: () => void;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refetchUserData: () => Promise<void>;
  retryUserData: () => void;
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
  const [userDataError, setUserDataError] = useState<string | null>(null);
  const [userDataRetry, setUserDataRetry] = useState(0);
  const authUserIdRef = useRef<string | null>(null);
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
    const { data: orgData, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .maybeSingle();

    if (error) throw error;
    if (!orgData) throw new Error('Organização não encontrada');
    
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
      setUserDataError(null);
      try {
        // Fetch profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (profileError) throw profileError;
        
        if (cancelled) return;
        setProfile(profileData);

        // Fetch roles
        const { data: rolesData, error: rolesError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId);

        if (rolesError) throw rolesError;
        
        if (cancelled) return;
        if (rolesData) {
          setRoles(rolesData.map(r => r.role as AppRole));
        }

        // Fetch user's organization memberships
        const { data: orgsData, error: orgsError } = await supabase
          .rpc('get_user_organizations', { _user_id: userId });

        if (orgsError) throw orgsError;
        
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
        if (!cancelled) setUserDataError('Não foi possível carregar os dados da conta.');
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
      setUserDataError(null);
      setMfaStatus('none');
      setIsLoadingUserData(false);
    }

    return () => {
      cancelled = true;
    };
  }, [user?.id, loadOrganization, checkMFAStatus, userDataRetry]);

  const retryUserData = () => {
    if (!user?.id) return;
    setIsLoadingUserData(true);
    setUserDataError(null);
    setUserDataRetry((value) => value + 1);
  };

  // Auth state listener
  useEffect(() => {
    let mounted = true;

    const applySession = (nextSession: Session | null) => {
      const nextUserId = nextSession?.user.id ?? null;
      // SIGNED_IN can also fire when an existing session is revalidated (for
      // example, when the tab regains focus). Only a changed identity needs a
      // new profile fetch; otherwise this flag would never be cleared because
      // the user-id-dependent fetch effect does not run again.
      if (authUserIdRef.current !== nextUserId) {
        authUserIdRef.current = nextUserId;
        setIsLoadingUserData(Boolean(nextUserId));
        setUserDataError(null);
        setProfile(null);
        setOrganization(null);
        setOrganizations([]);
        setRoles([]);
        setNeedsOrgSelection(false);
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setIsLoading(false);
    };
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        applySession(session);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      applySession(session);
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

  const signOut = async () => {
    // Limpar estados ANTES de chamar o Supabase para evitar race conditions
    setUser(null);
    setSession(null);
    setProfile(null);
    setOrganization(null);
    setOrganizations([]);
    setRoles([]);
    setNeedsOrgSelection(false);
    setUserDataError(null);
    setIsLoadingUserData(false);
    authUserIdRef.current = null;
    
    // Limpar localStorage
    localStorage.removeItem(ACTIVE_ORG_KEY);
    
    // Agora sim, chamar o Supabase
    await supabase.auth.signOut();
  };

  const refetchUserData = async () => {
    if (!user?.id) return;

    try {
      // Re-fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      setProfile(profileData);

      // Re-fetch current organization
      const storedOrgId = localStorage.getItem(ACTIVE_ORG_KEY);
      if (storedOrgId) {
        await loadOrganization(storedOrgId);
      } else if (profileData?.organization_id) {
        await loadOrganization(profileData.organization_id);
      }

      // Re-fetch organizations list
      const { data: orgsData, error: orgsError } = await supabase
        .rpc('get_user_organizations', { _user_id: user.id });

      if (orgsError) throw orgsError;
      
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
        userDataError,
        isSuperAdmin,
        needsOrgSelection,
        mfaStatus,
        completeMfaChallenge,
        signIn,
        signOut,
        refetchUserData,
        retryUserData,
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
