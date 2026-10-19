import { useReleaseFeatures } from '@/hooks/useReleaseFeatures';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { messagesApi } from './api';
import type { Conversation } from './types';
export function unreadMessages(conversations: readonly Conversation[]) {
  return conversations.reduce((count, item) => count + (item.archived ? 0 : item.unread), 0);
}
export function useUnreadMessages() {
  const { user, organization } = useAuth();
  const { features } = useReleaseFeatures();
  const { data } = useQuery({ queryKey: ['messages-snapshot', organization?.id ?? '', user?.id ?? ''], queryFn: () => messagesApi.snapshot(organization?.id ?? ''), enabled: features.messages && !!user?.id && !!organization?.id, retry: false, refetchInterval: 30000 });
  return features.messages ? unreadMessages(data?.conversations ?? []) : 0;
}
