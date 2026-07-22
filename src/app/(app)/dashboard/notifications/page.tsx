import { getNotificationsAction } from '@/lib/actions/notification-actions'
import { NotificationsClient } from './notificationsClient'

export default async function NotificationsPage() {
  const result = await getNotificationsAction(50)
  const initialNotifications =
    result.success && result.notifications ? result.notifications : []

  return <NotificationsClient initialNotifications={initialNotifications} />
}
