import { supabase } from '@/lib/supabase'

/**
 * Fetch business contact details for the "reveal" step after a claim is created.
 * Returns the subset of master_business_info fields that consumers see
 * once they have verified their identity and claimed a deal.
 */
export async function getBusinessContactDetails(businessId: number) {
  const { data, error } = await supabase
    .from('master_business_info')
    .select(
      'business_id, name, address, city, website, score, review_count, category, facebook_url, instagram_url',
    )
    .eq('business_id', businessId)
    .single()

  if (error || !data) return null
  return data
}
