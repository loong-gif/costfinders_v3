export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          admin_email: string | null
          admin_id: string
          created_at: string | null
          details: Json | null
          id: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          admin_email?: string | null
          admin_id: string
          created_at?: string | null
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          admin_email?: string | null
          admin_id?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      admin_profiles: {
        Row: {
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          permissions: string[]
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name?: string | null
          id: string
          last_name?: string | null
          permissions?: string[]
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          permissions?: string[]
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      business_claims: {
        Row: {
          admin_notes: string | null
          business_id: number
          created_at: string
          evidence_document_url: string | null
          id: string
          profile_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          verification_attempts: number
          verification_code: string | null
          verification_code_expires_at: string | null
          verification_method: string | null
        }
        Insert: {
          admin_notes?: string | null
          business_id: number
          created_at?: string
          evidence_document_url?: string | null
          id?: string
          profile_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          verification_attempts?: number
          verification_code?: string | null
          verification_code_expires_at?: string | null
          verification_method?: string | null
        }
        Update: {
          admin_notes?: string | null
          business_id?: number
          created_at?: string
          evidence_document_url?: string | null
          id?: string
          profile_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          verification_attempts?: number
          verification_code?: string | null
          verification_code_expires_at?: string | null
          verification_method?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'business_claims_business_id_fkey'
            columns: ['business_id']
            isOneToOne: false
            referencedRelation: 'master_business_info'
            referencedColumns: ['business_id']
          },
          {
            foreignKeyName: 'business_claims_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'business_profiles'
            referencedColumns: ['id']
          },
        ]
      }
      business_profiles: {
        Row: {
          business_id: number | null
          claim_status: string
          created_at: string
          email: string | null
          first_name: string
          id: string
          last_name: string
          tier: string
          tier_note: string | null
          tier_source: string | null
          updated_at: string
          verification_status: string
        }
        Insert: {
          business_id?: number | null
          claim_status?: string
          created_at?: string
          email?: string | null
          first_name?: string
          id: string
          last_name?: string
          tier?: string
          tier_note?: string | null
          tier_source?: string | null
          updated_at?: string
          verification_status?: string
        }
        Update: {
          business_id?: number | null
          claim_status?: string
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          tier?: string
          tier_note?: string | null
          tier_source?: string | null
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'business_profiles_business_id_fkey'
            columns: ['business_id']
            isOneToOne: false
            referencedRelation: 'master_business_info'
            referencedColumns: ['business_id']
          },
        ]
      }
      business_reviews: {
        Row: {
          author_name: string | null
          author_profile_picture: string | null
          author_url: string | null
          business_id: number | null
          created_at: string | null
          google_review_id: string | null
          id: number
          images: Json | null
          published_at: string | null
          rating: number | null
          review_text: string | null
          updated_at: string | null
        }
        Insert: {
          author_name?: string | null
          author_profile_picture?: string | null
          author_url?: string | null
          business_id?: number | null
          created_at?: string | null
          google_review_id?: string | null
          id: number
          images?: Json | null
          published_at?: string | null
          rating?: number | null
          review_text?: string | null
          updated_at?: string | null
        }
        Update: {
          author_name?: string | null
          author_profile_picture?: string | null
          author_url?: string | null
          business_id?: number | null
          created_at?: string | null
          google_review_id?: string | null
          id?: number
          images?: Json | null
          published_at?: string | null
          rating?: number | null
          review_text?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'business_reviews_business_id_fkey'
            columns: ['business_id']
            isOneToOne: false
            referencedRelation: 'master_business_info'
            referencedColumns: ['business_id']
          },
        ]
      }
      claims: {
        Row: {
          admin_close_reason: string | null
          admin_closed_at: string | null
          booked_date: string | null
          booked_time: string | null
          business_id: number
          business_response: string | null
          business_snapshot: Json | null
          consumer_id: string
          created_at: string
          deal_id: number
          deal_title: string | null
          expires_at: string
          id: string
          notes: string | null
          preferred_date: string | null
          preferred_time: string | null
          price_label: string | null
          relay_method: string | null
          relay_note: string | null
          relay_outcome: string | null
          relayed_at: string | null
          relayed_by: string | null
          responded_at: string | null
          status: Database['public']['Enums']['claim_status']
          updated_at: string
        }
        Insert: {
          admin_close_reason?: string | null
          admin_closed_at?: string | null
          booked_date?: string | null
          booked_time?: string | null
          business_id: number
          business_response?: string | null
          business_snapshot?: Json | null
          consumer_id: string
          created_at?: string
          deal_id: number
          deal_title?: string | null
          expires_at?: string
          id?: string
          notes?: string | null
          preferred_date?: string | null
          preferred_time?: string | null
          price_label?: string | null
          relay_method?: string | null
          relay_note?: string | null
          relay_outcome?: string | null
          relayed_at?: string | null
          relayed_by?: string | null
          responded_at?: string | null
          status?: Database['public']['Enums']['claim_status']
          updated_at?: string
        }
        Update: {
          admin_close_reason?: string | null
          admin_closed_at?: string | null
          booked_date?: string | null
          booked_time?: string | null
          business_id?: number
          business_response?: string | null
          business_snapshot?: Json | null
          consumer_id?: string
          created_at?: string
          deal_id?: number
          deal_title?: string | null
          expires_at?: string
          id?: string
          notes?: string | null
          preferred_date?: string | null
          preferred_time?: string | null
          price_label?: string | null
          relay_method?: string | null
          relay_note?: string | null
          relay_outcome?: string | null
          relayed_at?: string | null
          relayed_by?: string | null
          responded_at?: string | null
          status?: Database['public']['Enums']['claim_status']
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'claims_consumer_id_fkey'
            columns: ['consumer_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fk_claims_business'
            columns: ['business_id']
            isOneToOne: false
            referencedRelation: 'master_business_info'
            referencedColumns: ['business_id']
          },
          {
            foreignKeyName: 'fk_claims_deal'
            columns: ['deal_id']
            isOneToOne: false
            referencedRelation: 'promo_offer_master'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fk_claims_deal'
            columns: ['deal_id']
            isOneToOne: false
            referencedRelation: 'public_offers'
            referencedColumns: ['id']
          },
        ]
      }
      clinic_memberships: {
        Row: {
          benefits: Json | null
          billing_period: string | null
          business_id: number | null
          created_at: string | null
          is_ocr_required: boolean | null
          is_offer_extracted: boolean | null
          membership_name: string | null
          membership_price: number | null
          minimum_commitment_months: number | null
          need_browser: boolean
          plan_id: number
          source_url: string | null
          updated_at: string | null
        }
        Insert: {
          benefits?: Json | null
          billing_period?: string | null
          business_id?: number | null
          created_at?: string | null
          is_ocr_required?: boolean | null
          is_offer_extracted?: boolean | null
          membership_name?: string | null
          membership_price?: number | null
          minimum_commitment_months?: number | null
          need_browser?: boolean
          plan_id?: number
          source_url?: string | null
          updated_at?: string | null
        }
        Update: {
          benefits?: Json | null
          billing_period?: string | null
          business_id?: number | null
          created_at?: string | null
          is_ocr_required?: boolean | null
          is_offer_extracted?: boolean | null
          membership_name?: string | null
          membership_price?: number | null
          minimum_commitment_months?: number | null
          need_browser?: boolean
          plan_id?: number
          source_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'clinic_memberships_business_id_fkey'
            columns: ['business_id']
            isOneToOne: false
            referencedRelation: 'master_business_info'
            referencedColumns: ['business_id']
          },
        ]
      }
      clinic_promotions: {
        Row: {
          business_id: number | null
          campaign_end_date: string | null
          campaign_start_date: string | null
          created_at: string | null
          is_active: boolean | null
          is_ocr_required: boolean | null
          is_offer_extracted: boolean | null
          promotion_content: Json | null
          promotion_id: number
          promotion_title: string | null
          requires_cf_verification: boolean
          screenshot: string | null
          source_url: string | null
          updated_at: string | null
        }
        Insert: {
          business_id?: number | null
          campaign_end_date?: string | null
          campaign_start_date?: string | null
          created_at?: string | null
          is_active?: boolean | null
          is_ocr_required?: boolean | null
          is_offer_extracted?: boolean | null
          promotion_content?: Json | null
          promotion_id: number
          promotion_title?: string | null
          requires_cf_verification?: boolean
          screenshot?: string | null
          source_url?: string | null
          updated_at?: string | null
        }
        Update: {
          business_id?: number | null
          campaign_end_date?: string | null
          campaign_start_date?: string | null
          created_at?: string | null
          is_active?: boolean | null
          is_ocr_required?: boolean | null
          is_offer_extracted?: boolean | null
          promotion_content?: Json | null
          promotion_id?: number
          promotion_title?: string | null
          requires_cf_verification?: boolean
          screenshot?: string | null
          source_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'clinic_promotions_business_id_fkey'
            columns: ['business_id']
            isOneToOne: false
            referencedRelation: 'master_business_info'
            referencedColumns: ['business_id']
          },
        ]
      }
      clinic_services: {
        Row: {
          business_id: number
          created_at: string | null
          regular_price: number | null
          service_area: string | null
          service_category: Database['public']['Enums']['clinic_service_category_enum']
          service_id: number
          service_name: Database['public']['Enums']['clinic_service_name_enum']
          source_url: string | null
          unit_type: string | null
          updated_at: string | null
        }
        Insert: {
          business_id: number
          created_at?: string | null
          regular_price?: number | null
          service_area?: string | null
          service_category?: Database['public']['Enums']['clinic_service_category_enum']
          service_id?: number
          service_name: Database['public']['Enums']['clinic_service_name_enum']
          source_url?: string | null
          unit_type?: string | null
          updated_at?: string | null
        }
        Update: {
          business_id?: number
          created_at?: string | null
          regular_price?: number | null
          service_area?: string | null
          service_category?: Database['public']['Enums']['clinic_service_category_enum']
          service_id?: number
          service_name?: Database['public']['Enums']['clinic_service_name_enum']
          source_url?: string | null
          unit_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'fk_service_business'
            columns: ['business_id']
            isOneToOne: false
            referencedRelation: 'master_business_info'
            referencedColumns: ['business_id']
          },
        ]
      }
      content_categories: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      content_locations: {
        Row: {
          city: string
          created_at: string | null
          id: string
          is_active: boolean | null
          state: string
          state_code: string
          updated_at: string | null
        }
        Insert: {
          city: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          state: string
          state_code: string
          updated_at?: string | null
        }
        Update: {
          city?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          state?: string
          state_code?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          business_owner_id: string
          claim_id: string
          consumer_id: string
          created_at: string
          id: string
          last_message_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          business_owner_id: string
          claim_id: string
          consumer_id: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          business_owner_id?: string
          claim_id?: string
          consumer_id?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'conversations_claim_id_fkey'
            columns: ['claim_id']
            isOneToOne: true
            referencedRelation: 'claims'
            referencedColumns: ['id']
          },
        ]
      }
      deal_reports: {
        Row: {
          admin_note: string | null
          claim_id: string | null
          created_at: string
          id: string
          note: string | null
          offer_id: number | null
          reason: string
          reporter_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          claim_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          offer_id?: number | null
          reason: string
          reporter_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          claim_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          offer_id?: number | null
          reason?: string
          reporter_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'deal_reports_claim_id_fkey'
            columns: ['claim_id']
            isOneToOne: true
            referencedRelation: 'claims'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'deal_reports_offer_id_fkey'
            columns: ['offer_id']
            isOneToOne: false
            referencedRelation: 'promo_offer_master'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'deal_reports_offer_id_fkey'
            columns: ['offer_id']
            isOneToOne: false
            referencedRelation: 'public_offers'
            referencedColumns: ['id']
          },
        ]
      }
      listing_requests: {
        Row: {
          admin_notes: string | null
          business_id: number | null
          business_name: string
          contact_email: string
          contact_name: string
          contact_role: string | null
          created_at: string
          details: string
          id: string
          offer_id: number | null
          page_url: string | null
          request_type: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          business_id?: number | null
          business_name: string
          contact_email: string
          contact_name: string
          contact_role?: string | null
          created_at?: string
          details: string
          id?: string
          offer_id?: number | null
          page_url?: string | null
          request_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          business_id?: number | null
          business_name?: string
          contact_email?: string
          contact_name?: string
          contact_role?: string | null
          created_at?: string
          details?: string
          id?: string
          offer_id?: number | null
          page_url?: string | null
          request_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'listing_requests_business_id_fkey'
            columns: ['business_id']
            isOneToOne: false
            referencedRelation: 'master_business_info'
            referencedColumns: ['business_id']
          },
          {
            foreignKeyName: 'listing_requests_offer_id_fkey'
            columns: ['offer_id']
            isOneToOne: false
            referencedRelation: 'promo_offer_master'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'listing_requests_offer_id_fkey'
            columns: ['offer_id']
            isOneToOne: false
            referencedRelation: 'public_offers'
            referencedColumns: ['id']
          },
        ]
      }
      master_business_info: {
        Row: {
          address: string | null
          business_id: number
          category: string | null
          city: string | null
          created_at: string | null
          facebook_url: string | null
          google_place_id: string | null
          instagram_url: string | null
          logo: string | null
          name: string | null
          phone: string | null
          phone_source: string | null
          review_count: number | null
          score: number | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          business_id?: number
          category?: string | null
          city?: string | null
          created_at?: string | null
          facebook_url?: string | null
          google_place_id?: string | null
          instagram_url?: string | null
          logo?: string | null
          name?: string | null
          phone?: string | null
          phone_source?: string | null
          review_count?: number | null
          score?: number | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          business_id?: number
          category?: string | null
          city?: string | null
          created_at?: string | null
          facebook_url?: string | null
          google_place_id?: string | null
          instagram_url?: string | null
          logo?: string | null
          name?: string | null
          phone?: string | null
          phone_source?: string | null
          review_count?: number | null
          score?: number | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
          sender_type: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
          sender_type: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: 'messages_conversation_id_fkey'
            columns: ['conversation_id']
            isOneToOne: false
            referencedRelation: 'conversations'
            referencedColumns: ['id']
          },
        ]
      }
      monitor_state: {
        Row: {
          domain_name: string
          last_change_at: string | null
          last_check_id: string | null
          last_processed_at: string | null
          monitor_id: string
          updated_at: string
        }
        Insert: {
          domain_name: string
          last_change_at?: string | null
          last_check_id?: string | null
          last_processed_at?: string | null
          monitor_id: string
          updated_at?: string
        }
        Update: {
          domain_name?: string
          last_change_at?: string | null
          last_check_id?: string | null
          last_processed_at?: string | null
          monitor_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      offer_confirmations: {
        Row: {
          admin_note: string | null
          business_id: number | null
          created_at: string
          id: string
          kind: string
          note: string | null
          offer_id: number | null
          owner_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          snapshot: Json
          status: string
        }
        Insert: {
          admin_note?: string | null
          business_id?: number | null
          created_at?: string
          id?: string
          kind: string
          note?: string | null
          offer_id?: number | null
          owner_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          snapshot: Json
          status?: string
        }
        Update: {
          admin_note?: string | null
          business_id?: number | null
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          offer_id?: number | null
          owner_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          snapshot?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'offer_confirmations_business_id_fkey'
            columns: ['business_id']
            isOneToOne: false
            referencedRelation: 'master_business_info'
            referencedColumns: ['business_id']
          },
          {
            foreignKeyName: 'offer_confirmations_offer_id_fkey'
            columns: ['offer_id']
            isOneToOne: false
            referencedRelation: 'promo_offer_master'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'offer_confirmations_offer_id_fkey'
            columns: ['offer_id']
            isOneToOne: false
            referencedRelation: 'public_offers'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          alerts_email: boolean
          alerts_sms: boolean
          avatar_url: string | null
          created_at: string
          deletion_requested_at: string | null
          favorite_categories: string[]
          first_name: string | null
          id: string
          last_login_at: string | null
          last_name: string | null
          location_city: string | null
          location_state: string | null
          phone: string | null
          phone_verified_at: string | null
          status: string
          unsubscribe_token: string
          updated_at: string
          verification_status: string
        }
        Insert: {
          alerts_email?: boolean
          alerts_sms?: boolean
          avatar_url?: string | null
          created_at?: string
          deletion_requested_at?: string | null
          favorite_categories?: string[]
          first_name?: string | null
          id: string
          last_login_at?: string | null
          last_name?: string | null
          location_city?: string | null
          location_state?: string | null
          phone?: string | null
          phone_verified_at?: string | null
          status?: string
          unsubscribe_token?: string
          updated_at?: string
          verification_status?: string
        }
        Update: {
          alerts_email?: boolean
          alerts_sms?: boolean
          avatar_url?: string | null
          created_at?: string
          deletion_requested_at?: string | null
          favorite_categories?: string[]
          first_name?: string | null
          id?: string
          last_login_at?: string | null
          last_name?: string | null
          location_city?: string | null
          location_state?: string | null
          phone?: string | null
          phone_verified_at?: string | null
          status?: string
          unsubscribe_token?: string
          updated_at?: string
          verification_status?: string
        }
        Relationships: []
      }
      promo_email_staging: {
        Row: {
          business_id: number | null
          created_at: string
          email_content: string | null
          email_date: string | null
          email_sender: string | null
          promo_email_id: number
        }
        Insert: {
          business_id?: number | null
          created_at?: string
          email_content?: string | null
          email_date?: string | null
          email_sender?: string | null
          promo_email_id?: number
        }
        Update: {
          business_id?: number | null
          created_at?: string
          email_content?: string | null
          email_date?: string | null
          email_sender?: string | null
          promo_email_id?: number
        }
        Relationships: [
          {
            foreignKeyName: 'fk_promo_email_staging_business'
            columns: ['business_id']
            isOneToOne: false
            referencedRelation: 'master_business_info'
            referencedColumns: ['business_id']
          },
          {
            foreignKeyName: 'promo_email_staging_business_id_fkey'
            columns: ['business_id']
            isOneToOne: false
            referencedRelation: 'master_business_info'
            referencedColumns: ['business_id']
          },
          {
            foreignKeyName: 'promo_email_staging_business_id_fkey1'
            columns: ['business_id']
            isOneToOne: false
            referencedRelation: 'master_business_info'
            referencedColumns: ['business_id']
          },
        ]
      }
      promo_offer_items: {
        Row: {
          created_at: string
          delivered_units: number | null
          item_name: string | null
          offer_id: number
          offer_item_id: number
          service_id: number | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivered_units?: number | null
          item_name?: string | null
          offer_id: number
          offer_item_id?: number
          service_id?: number | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivered_units?: number | null
          item_name?: string | null
          offer_id?: number
          offer_item_id?: number
          service_id?: number | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'promo_offer_items_offer_id_fkey'
            columns: ['offer_id']
            isOneToOne: false
            referencedRelation: 'promo_offer_master'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'promo_offer_items_offer_id_fkey'
            columns: ['offer_id']
            isOneToOne: false
            referencedRelation: 'public_offers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'promo_offer_items_service_id_fkey'
            columns: ['service_id']
            isOneToOne: false
            referencedRelation: 'clinic_services'
            referencedColumns: ['service_id']
          },
        ]
      }
      promo_offer_master: {
        Row: {
          business_id: number | null
          conditions: string[] | null
          created_at: string
          discount_amount: number | null
          discount_percent: number | null
          discount_price: number | null
          id: number
          is_active: boolean | null
          is_membership_required: boolean | null
          is_new_customer_required: boolean | null
          is_package: boolean
          membership_plan_id: number | null
          offer_fingerprint: string | null
          offer_raw_text: string | null
          price_model: string
          promotion_id: number | null
          regular_price: number | null
          updated_at: string | null
        }
        Insert: {
          business_id?: number | null
          conditions?: string[] | null
          created_at?: string
          discount_amount?: number | null
          discount_percent?: number | null
          discount_price?: number | null
          id?: number
          is_active?: boolean | null
          is_membership_required?: boolean | null
          is_new_customer_required?: boolean | null
          is_package?: boolean
          membership_plan_id?: number | null
          offer_fingerprint?: string | null
          offer_raw_text?: string | null
          price_model?: string
          promotion_id?: number | null
          regular_price?: number | null
          updated_at?: string | null
        }
        Update: {
          business_id?: number | null
          conditions?: string[] | null
          created_at?: string
          discount_amount?: number | null
          discount_percent?: number | null
          discount_price?: number | null
          id?: number
          is_active?: boolean | null
          is_membership_required?: boolean | null
          is_new_customer_required?: boolean | null
          is_package?: boolean
          membership_plan_id?: number | null
          offer_fingerprint?: string | null
          offer_raw_text?: string | null
          price_model?: string
          promotion_id?: number | null
          regular_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'fk_offer_business'
            columns: ['business_id']
            isOneToOne: false
            referencedRelation: 'master_business_info'
            referencedColumns: ['business_id']
          },
          {
            foreignKeyName: 'fk_offer_membership_plan'
            columns: ['membership_plan_id']
            isOneToOne: false
            referencedRelation: 'clinic_memberships'
            referencedColumns: ['plan_id']
          },
          {
            foreignKeyName: 'fk_offer_promotion'
            columns: ['promotion_id']
            isOneToOne: false
            referencedRelation: 'clinic_promotions'
            referencedColumns: ['promotion_id']
          },
          {
            foreignKeyName: 'fk_offer_promotion'
            columns: ['promotion_id']
            isOneToOne: false
            referencedRelation: 'v_promotion_content_guardrail_violations'
            referencedColumns: ['promotion_id']
          },
        ]
      }
      promo_offer_price_history: {
        Row: {
          changed_at: string
          id: number
          new_discount_amount: number | null
          new_discount_percent: number | null
          new_discount_price: number | null
          new_regular_price: number | null
          offer_id: number
          old_discount_amount: number | null
          old_discount_percent: number | null
          old_discount_price: number | null
          old_regular_price: number | null
        }
        Insert: {
          changed_at?: string
          id?: number
          new_discount_amount?: number | null
          new_discount_percent?: number | null
          new_discount_price?: number | null
          new_regular_price?: number | null
          offer_id: number
          old_discount_amount?: number | null
          old_discount_percent?: number | null
          old_discount_price?: number | null
          old_regular_price?: number | null
        }
        Update: {
          changed_at?: string
          id?: number
          new_discount_amount?: number | null
          new_discount_percent?: number | null
          new_discount_price?: number | null
          new_regular_price?: number | null
          offer_id?: number
          old_discount_amount?: number | null
          old_discount_percent?: number | null
          old_discount_price?: number | null
          old_regular_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'promo_offer_price_history_offer_id_fkey'
            columns: ['offer_id']
            isOneToOne: false
            referencedRelation: 'promo_offer_master'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'promo_offer_price_history_offer_id_fkey'
            columns: ['offer_id']
            isOneToOne: false
            referencedRelation: 'public_offers'
            referencedColumns: ['id']
          },
        ]
      }
      promo_offer_terms: {
        Row: {
          created_at: string
          is_membership_required: boolean | null
          is_new_customer_required: boolean | null
          is_not_combinable: boolean | null
          is_one_per_patient: boolean | null
          is_returning_customer_required: boolean | null
          membership_plan_id: number | null
          min_quantity: number | null
          min_unit:
            | Database['public']['Enums']['offer_purchase_unit_enum']
            | null
          offer_id: number
          promo_code: string | null
          raw_terms: string[]
          redemption_frequency: string | null
          requires_consultation: boolean | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          is_membership_required?: boolean | null
          is_new_customer_required?: boolean | null
          is_not_combinable?: boolean | null
          is_one_per_patient?: boolean | null
          is_returning_customer_required?: boolean | null
          membership_plan_id?: number | null
          min_quantity?: number | null
          min_unit?:
            | Database['public']['Enums']['offer_purchase_unit_enum']
            | null
          offer_id: number
          promo_code?: string | null
          raw_terms?: string[]
          redemption_frequency?: string | null
          requires_consultation?: boolean | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          is_membership_required?: boolean | null
          is_new_customer_required?: boolean | null
          is_not_combinable?: boolean | null
          is_one_per_patient?: boolean | null
          is_returning_customer_required?: boolean | null
          membership_plan_id?: number | null
          min_quantity?: number | null
          min_unit?:
            | Database['public']['Enums']['offer_purchase_unit_enum']
            | null
          offer_id?: number
          promo_code?: string | null
          raw_terms?: string[]
          redemption_frequency?: string | null
          requires_consultation?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'promo_offer_terms_membership_plan_id_fkey'
            columns: ['membership_plan_id']
            isOneToOne: false
            referencedRelation: 'clinic_memberships'
            referencedColumns: ['plan_id']
          },
          {
            foreignKeyName: 'promo_offer_terms_offer_id_fkey'
            columns: ['offer_id']
            isOneToOne: true
            referencedRelation: 'promo_offer_master'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'promo_offer_terms_offer_id_fkey'
            columns: ['offer_id']
            isOneToOne: true
            referencedRelation: 'public_offers'
            referencedColumns: ['id']
          },
        ]
      }
      promo_social_staging: {
        Row: {
          business_id: number | null
          created_at: string
          input_url: string | null
          post_url: string | null
          promo_social_id: number
          promo_text_raw: string | null
          timestamp: string | null
        }
        Insert: {
          business_id?: number | null
          created_at?: string
          input_url?: string | null
          post_url?: string | null
          promo_social_id?: number
          promo_text_raw?: string | null
          timestamp?: string | null
        }
        Update: {
          business_id?: number | null
          created_at?: string
          input_url?: string | null
          post_url?: string | null
          promo_social_id?: number
          promo_text_raw?: string | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'fk_promo_social_staging_business'
            columns: ['business_id']
            isOneToOne: false
            referencedRelation: 'master_business_info'
            referencedColumns: ['business_id']
          },
          {
            foreignKeyName: 'promo_social_staging_business_id_fkey'
            columns: ['business_id']
            isOneToOne: false
            referencedRelation: 'master_business_info'
            referencedColumns: ['business_id']
          },
        ]
      }
      promotion_content_guardrail_queue: {
        Row: {
          details: Json
          detected_at: string
          guardrail_code: string
          id: number
          last_seen_at: string
          promotion_id: number
          resolved_at: string | null
          status: string
        }
        Insert: {
          details?: Json
          detected_at?: string
          guardrail_code: string
          id?: number
          last_seen_at?: string
          promotion_id: number
          resolved_at?: string | null
          status?: string
        }
        Update: {
          details?: Json
          detected_at?: string
          guardrail_code?: string
          id?: number
          last_seen_at?: string
          promotion_id?: number
          resolved_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'promotion_content_guardrail_queue_promotion_id_fkey'
            columns: ['promotion_id']
            isOneToOne: false
            referencedRelation: 'clinic_promotions'
            referencedColumns: ['promotion_id']
          },
          {
            foreignKeyName: 'promotion_content_guardrail_queue_promotion_id_fkey'
            columns: ['promotion_id']
            isOneToOne: false
            referencedRelation: 'v_promotion_content_guardrail_violations'
            referencedColumns: ['promotion_id']
          },
        ]
      }
      saved_deals: {
        Row: {
          consumer_id: string
          deal_id: number
          id: number
          saved_at: string
        }
        Insert: {
          consumer_id: string
          deal_id: number
          id?: never
          saved_at?: string
        }
        Update: {
          consumer_id?: string
          deal_id?: number
          id?: never
          saved_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'fk_saved_deals_deal'
            columns: ['deal_id']
            isOneToOne: false
            referencedRelation: 'promo_offer_master'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fk_saved_deals_deal'
            columns: ['deal_id']
            isOneToOne: false
            referencedRelation: 'public_offers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'saved_deals_consumer_id_fkey'
            columns: ['consumer_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      social_data_production: {
        Row: {
          business_id: number
          created_at: string | null
          facebook_url: string | null
          instagram_url: string | null
          process_flag: string | null
          updated_at: string | null
          website_clean: string | null
        }
        Insert: {
          business_id: number
          created_at?: string | null
          facebook_url?: string | null
          instagram_url?: string | null
          process_flag?: string | null
          updated_at?: string | null
          website_clean?: string | null
        }
        Update: {
          business_id?: number
          created_at?: string | null
          facebook_url?: string | null
          instagram_url?: string | null
          process_flag?: string | null
          updated_at?: string | null
          website_clean?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'fk_social_data_production_business'
            columns: ['business_id']
            isOneToOne: true
            referencedRelation: 'master_business_info'
            referencedColumns: ['business_id']
          },
        ]
      }
    }
    Views: {
      public_business_directory: {
        Row: {
          address: string | null
          business_state: string | null
          category: string | null
          city: string | null
          name: string | null
          review_count: number | null
          score: number | null
          slug: string | null
        }
        Insert: {
          address?: string | null
          business_state?: never
          category?: string | null
          city?: string | null
          name?: string | null
          review_count?: number | null
          score?: number | null
          slug?: never
        }
        Update: {
          address?: string | null
          business_state?: never
          category?: string | null
          city?: string | null
          name?: string | null
          review_count?: number | null
          score?: number | null
          slug?: never
        }
        Relationships: []
      }
      public_offer_confirmations: {
        Row: {
          confirmed_at: string | null
          offer_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'offer_confirmations_offer_id_fkey'
            columns: ['offer_id']
            isOneToOne: false
            referencedRelation: 'promo_offer_master'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'offer_confirmations_offer_id_fkey'
            columns: ['offer_id']
            isOneToOne: false
            referencedRelation: 'public_offers'
            referencedColumns: ['id']
          },
        ]
      }
      public_offers: {
        Row: {
          billing_period: string | null
          business_city: string | null
          business_id: number | null
          business_state: string | null
          campaign_end_date: string | null
          campaign_start_date: string | null
          clinic_memberships: Json | null
          clinic_promotions: Json | null
          conditions: string[] | null
          created_at: string | null
          discount_amount: number | null
          discount_percent: number | null
          discount_price: number | null
          id: number | null
          is_active: boolean | null
          is_membership_required: boolean | null
          is_new_customer_required: boolean | null
          is_package: boolean | null
          master_business_info: Json | null
          membership_name: string | null
          membership_plan_id: number | null
          membership_price: number | null
          minimum_commitment_months: number | null
          offer_fingerprint: string | null
          offer_raw_text: string | null
          price_model: string | null
          promo_offer_items: Json | null
          promotion_id: number | null
          promotion_title: string | null
          regular_price: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'fk_offer_business'
            columns: ['business_id']
            isOneToOne: false
            referencedRelation: 'master_business_info'
            referencedColumns: ['business_id']
          },
        ]
      }
      v_promotion_content_guardrail_violations: {
        Row: {
          classification: string | null
          element_index: number | null
          element_text: string | null
          is_active: boolean | null
          promotion_id: number | null
          source_url: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      address_state_code: { Args: { p_address: string }; Returns: string }
      admin_feedback_notes: {
        Args: { p_ids: string[] }
        Returns: {
          admin_note: string
          id: string
        }[]
      }
      admin_set_user_status: {
        Args: { new_status: string; target_user_id: string }
        Returns: undefined
      }
      admin_user_emails: {
        Args: { p_user_ids: string[] }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      approve_business_claim: {
        Args: { p_admin_notes?: string; p_claim_id: string }
        Returns: Json
      }
      claim_consumer_contact: {
        Args: { p_claim_id: string }
        Returns: {
          consumer_email: string
          consumer_name: string
          consumer_phone: string
        }[]
      }
      claim_owner_notice_email: {
        Args: { p_claim_id: string }
        Returns: string
      }
      claimed_membership_name: { Args: { p_offer_id: number }; Returns: string }
      classify_promotion_content_element: {
        Args: { p_text: string }
        Returns: string
      }
      clear_package_item_unit_prices_for_offer: {
        Args: { p_offer_id: number }
        Returns: undefined
      }
      clinic_service_category_for_name: {
        Args: {
          p_service: Database['public']['Enums']['clinic_service_name_enum']
        }
        Returns: Database['public']['Enums']['clinic_service_category_enum']
      }
      create_notification: {
        Args: {
          notification_body: string
          notification_link?: string
          notification_title: string
          notification_type: string
          target_user_id: string
        }
        Returns: undefined
      }
      delete_own_account: { Args: never; Returns: Json }
      email_preferences_for_user: {
        Args: { p_user_id: string }
        Returns: {
          email_opt_out: boolean
          unsubscribe_token: string
        }[]
      }
      fn_build_offer_fingerprint: {
        Args: {
          p_discount_amount: number
          p_discount_percent: number
          p_discount_price: number
          p_items: string
          p_source: string
        }
        Returns: string
      }
      fn_normalize_fingerprint_segment: {
        Args: { p_raw: string }
        Returns: string
      }
      fn_offer_items_signature: {
        Args: { p_offer_id: number }
        Returns: string
      }
      fn_offer_source_key: {
        Args: {
          p_business_id: number
          p_membership_plan_id: number
          p_promotion_id: number
        }
        Returns: string
      }
      get_business_category_counts: {
        Args: never
        Returns: {
          category: string
          count: number
        }[]
      }
      get_business_cities: {
        Args: never
        Returns: {
          city: string
          count: number
        }[]
      }
      get_business_count_for_city: {
        Args: { city_name: string }
        Returns: number
      }
      get_city_deal_counts: {
        Args: never
        Returns: {
          city: string
          deal_count: number
          provider_count: number
        }[]
      }
      get_offer_category_counts: {
        Args: never
        Returns: {
          count: number
          provider_ids: number[]
          service_category: string
        }[]
      }
      get_or_create_claim_conversation: {
        Args: { p_claim_id: string }
        Returns: {
          business_owner_id: string
          claim_id: string
          consumer_id: string
          created_at: string
          id: string
          last_message_at: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: '*'
          to: 'conversations'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      identity_compact: { Args: { p_text: string }; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      issue_business_claim_code: {
        Args: { p_claim_id: string }
        Returns: string
      }
      latest_offer_confirmations: {
        Args: never
        Returns: {
          business_id: number
          created_at: string
          is_current: boolean
          kind: string
          note: string
          offer_id: number
          status: string
        }[]
      }
      offer_confirmation_snapshot: {
        Args: {
          p_discount_amount: number
          p_discount_percent: number
          p_discount_price: number
          p_offer_raw_text: string
          p_price_model: string
          p_regular_price: number
        }
        Returns: Json
      }
      provider_generic_terms: { Args: never; Returns: string[] }
      provider_identity_terms: {
        Args: { p_city: string; p_name: string; p_website: string }
        Returns: string[]
      }
      provider_site_label: { Args: { p_website: string }; Returns: string }
      reject_business_claim: {
        Args: { p_admin_notes?: string; p_claim_id: string }
        Returns: Json
      }
      scrub_identity_terms: {
        Args: { p_label: string; p_terms: string[]; p_text: string }
        Returns: string
      }
      scrub_provider_identity: {
        Args: {
          p_city?: string
          p_name: string
          p_text: string
          p_website: string
        }
        Returns: string
      }
      sync_non_package_offer_prices: {
        Args: { p_offer_id: number }
        Returns: undefined
      }
      unsubscribe_by_token: { Args: { p_token: string }; Returns: boolean }
      verify_business_claim_code: {
        Args: { p_claim_id: string; p_code: string }
        Returns: Json
      }
    }
    Enums: {
      claim_status:
        | 'pending'
        | 'contacted'
        | 'booked'
        | 'completed'
        | 'cancelled'
        | 'expired'
      clinic_service_category_enum:
        | 'Neurotoxin'
        | 'Dermal Filler'
        | 'Microneedling'
        | 'Facial'
        | 'Laser & Light'
        | 'Laser Hair Removal'
        | 'Wellness'
        | 'Regenerative Injectable'
        | 'Body Contouring'
        | 'Skin Tightening'
      clinic_service_name_enum:
        | 'Botox'
        | 'Dysport'
        | 'Xeomin'
        | 'Jeuveau'
        | 'Daxxify'
        | 'Letybo'
        | 'Myobloc'
        | 'Neurotoxin'
        | 'Dermal Filler'
        | 'Juvéderm'
        | 'Restylane'
        | 'Radiesse'
        | 'Belotero'
        | 'RHA Filler'
        | 'Skinvive'
        | 'Filler Dissolving'
        | 'Morpheus8'
        | 'RF Microneedling'
        | 'SkinPen Microneedling'
        | 'Sylfirm X'
        | 'Microchanneling'
        | 'Microneedling'
        | 'Hydrafacial'
        | 'DiamondGlow'
        | 'Dermaplaning'
        | 'Glo2 Facial'
        | 'Facial'
        | 'IPL Photofacial'
        | 'BBL Photofacial'
        | 'LED Light Therapy'
        | 'CO2 Laser'
        | 'CoolPeel'
        | 'Halo Laser'
        | 'Moxi Laser'
        | 'Picoway'
        | 'Vbeam'
        | 'ClearSilk'
        | 'Laser Genesis'
        | 'Laser Treatment'
        | 'Laser Hair Removal'
        | 'NAD Therapy'
        | 'IV Therapy'
        | 'Vitamin Injection'
        | 'Weight Loss'
        | 'Hormone Therapy'
        | 'Peptide Therapy'
        | 'Sculptra'
        | 'Chemical Peel'
        | 'Kybella'
        | 'Thread Lift'
        | 'Tattoo Removal'
        | 'Skin Tightening'
        | 'Regenerative Injectable'
        | 'PRP'
        | 'PRF'
        | 'Exosome Therapy'
        | 'Body Contouring'
        | 'CoolSculpting'
        | 'Wellness'
        | 'Massage'
        | 'Pearl Fractional'
        | 'Customized Facial'
        | 'Lunchtime Peel'
        | 'PRX Skin Perfecting'
        | 'Perfect Derma Peel'
        | 'Sofwave'
        | 'Tixel'
        | 'Lipo Dissolve'
        | 'Versa'
        | 'Evolysse'
        | 'EZ Gel'
        | 'PDRN'
        | 'PRFM'
        | 'Fraxel'
        | 'Clear + Brilliant'
        | 'Emsculpt'
        | 'VI Peel'
        | 'Microdermabrasion'
        | 'Hair Restoration'
        | 'Ultherapy'
        | 'Thermage'
        | 'HIFU'
        | 'Forma'
        | 'Emface'
      offer_purchase_unit_enum:
        | 'unit'
        | 'vial'
        | 'syringe'
        | 'session'
        | 'treatment'
        | 'area'
        | 'item'
        | 'other'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      claim_status: [
        'pending',
        'contacted',
        'booked',
        'completed',
        'cancelled',
        'expired',
      ],
      clinic_service_category_enum: [
        'Neurotoxin',
        'Dermal Filler',
        'Microneedling',
        'Facial',
        'Laser & Light',
        'Laser Hair Removal',
        'Wellness',
        'Regenerative Injectable',
        'Body Contouring',
        'Skin Tightening',
      ],
      clinic_service_name_enum: [
        'Botox',
        'Dysport',
        'Xeomin',
        'Jeuveau',
        'Daxxify',
        'Letybo',
        'Myobloc',
        'Neurotoxin',
        'Dermal Filler',
        'Juvéderm',
        'Restylane',
        'Radiesse',
        'Belotero',
        'RHA Filler',
        'Skinvive',
        'Filler Dissolving',
        'Morpheus8',
        'RF Microneedling',
        'SkinPen Microneedling',
        'Sylfirm X',
        'Microchanneling',
        'Microneedling',
        'Hydrafacial',
        'DiamondGlow',
        'Dermaplaning',
        'Glo2 Facial',
        'Facial',
        'IPL Photofacial',
        'BBL Photofacial',
        'LED Light Therapy',
        'CO2 Laser',
        'CoolPeel',
        'Halo Laser',
        'Moxi Laser',
        'Picoway',
        'Vbeam',
        'ClearSilk',
        'Laser Genesis',
        'Laser Treatment',
        'Laser Hair Removal',
        'NAD Therapy',
        'IV Therapy',
        'Vitamin Injection',
        'Weight Loss',
        'Hormone Therapy',
        'Peptide Therapy',
        'Sculptra',
        'Chemical Peel',
        'Kybella',
        'Thread Lift',
        'Tattoo Removal',
        'Skin Tightening',
        'Regenerative Injectable',
        'PRP',
        'PRF',
        'Exosome Therapy',
        'Body Contouring',
        'CoolSculpting',
        'Wellness',
        'Massage',
        'Pearl Fractional',
        'Customized Facial',
        'Lunchtime Peel',
        'PRX Skin Perfecting',
        'Perfect Derma Peel',
        'Sofwave',
        'Tixel',
        'Lipo Dissolve',
        'Versa',
        'Evolysse',
        'EZ Gel',
        'PDRN',
        'PRFM',
        'Fraxel',
        'Clear + Brilliant',
        'Emsculpt',
        'VI Peel',
        'Microdermabrasion',
        'Hair Restoration',
        'Ultherapy',
        'Thermage',
        'HIFU',
        'Forma',
        'Emface',
      ],
      offer_purchase_unit_enum: [
        'unit',
        'vial',
        'syringe',
        'session',
        'treatment',
        'area',
        'item',
        'other',
      ],
    },
  },
} as const
