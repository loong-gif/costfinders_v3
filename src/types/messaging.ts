export interface ConversationRow {
  id: string
  claim_id: string
  consumer_id: string
  business_owner_id: string
  status: 'active' | 'archived'
  last_message_at: string | null
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

export interface ConversationWithPreview {
  id: string
  claim_id: string
  consumer_id: string
  business_owner_id: string
  status: 'active' | 'archived'
  last_message_at: string | null
  last_message: string | null
  unread_count: number
  deal_title: string | null
  other_party_name: string | null
  created_at: string
}
