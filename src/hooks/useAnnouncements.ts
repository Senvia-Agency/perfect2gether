import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useCallback } from 'react';

interface Announcement {
  id: string;
  title: string;
  content: string;
  version: string | null;
  image_url: string | null;
  published_at: string;
}

function getStorageKey(userId: string) {
  return `senvia_last_seen_announcement_${userId}`;
}

export function useAnnouncements() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  const { data: announcement } = useQuery({
    queryKey: ['latest-announcement'],
    queryFn: async (): Promise<Announcement | null> => {
      const { data, error } = await (supabase as any)
        .from('app_announcements')
        .select('id, title, content, version, image_url, published_at')
        .eq('is_active', true)
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching announcement:', error);
        return null;
      }
      return data;
    },
    staleTime: 10 * 60 * 1000,
  });

  const alreadySeen = (() => {
    if (!user?.id || !announcement?.id) return true;
    try {
      return localStorage.getItem(getStorageKey(user.id)) === announcement.id;
    } catch {
      return false;
    }
  })();

  const shouldShow = !!announcement && !alreadySeen && !dismissed;

  const markAsSeen = useCallback(() => {
    if (!user?.id || !announcement?.id) return;
    try {
      localStorage.setItem(getStorageKey(user.id), announcement.id);
    } catch {}
    setDismissed(true);
  }, [user?.id, announcement?.id]);

  return { announcement, shouldShow, markAsSeen };
}
