import { type NextRequest, NextResponse } from 'next/server'
import { outboundEntryPoint, toExternalUrl } from '@/lib/outbound'
import { supabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const offerId = Number(id)
  if (!Number.isInteger(offerId) || offerId <= 0) {
    return new NextResponse('Not found', { status: 404 })
  }

  const { data: offer } = await supabase
    .from('promo_offer_master')
    .select('id, business_id, source_url')
    .eq('id', offerId)
    .eq('status', 'active')
    .maybeSingle()
  const destination = toExternalUrl(offer?.source_url)
  if (!offer || !destination) {
    return new NextResponse('Offer source unavailable', { status: 404 })
  }

  void supabase.from('public_outbound_clicks').insert({
    offer_id: offerId,
    business_id: offer.business_id,
    destination_kind: 'offer_source',
    entry_point: outboundEntryPoint(request.nextUrl.searchParams.get('from')),
  })

  return NextResponse.redirect(destination)
}
