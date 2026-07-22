import { type NextRequest, NextResponse } from 'next/server'
import { outboundEntryPoint, toExternalUrl } from '@/lib/outbound'
import { supabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const businessId = Number(id)
  if (!Number.isInteger(businessId) || businessId <= 0) {
    return new NextResponse('Not found', { status: 404 })
  }

  const { data: business } = await supabase
    .from('master_business_info')
    .select('business_id, website, city')
    .eq('business_id', businessId)
    .maybeSingle()
  const destination = toExternalUrl(business?.website)
  if (!business || !destination) {
    return new NextResponse('Business website unavailable', { status: 404 })
  }

  void supabase.from('public_outbound_clicks').insert({
    business_id: businessId,
    destination_kind: 'business_website',
    entry_point: outboundEntryPoint(request.nextUrl.searchParams.get('from')),
    city: business.city,
  })

  return NextResponse.redirect(destination)
}
