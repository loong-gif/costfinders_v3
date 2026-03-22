export interface ConversationRow {
  id: string
  claim_id: string
  business_id: number
  consumer_id: string
  status: 'active' | 'archived'
  created_at: string
  updated_at: string
}

export interface MessageRow {
  id: string
  conversation_id: string
  sender_id: string
  sender_type: 'business' | 'consumer'
  content: string
  read_at: string | null
  created_at: string
}

export interface ConversationWithPreview extends ConversationRow {
  deal_title: string
  last_message: string
  last_message_at: string
  last_message_sender_type: 'business' | 'consumer'
  unread_count: number
  claim_status: string
}
