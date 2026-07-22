import { getConversationsAction } from '@/lib/actions/messaging'
import { MessagesClient } from './messagesClient'

export default async function ConsumerMessagesPage() {
  const result = await getConversationsAction('consumer')
  const initialConversations =
    result.success && result.conversations ? result.conversations : []

  return <MessagesClient initialConversations={initialConversations} />
}
