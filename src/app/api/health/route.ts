import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const start = performance.now()

  const checks: Record<string, 'ok' | 'fail'> = {
    env: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'ok' : 'fail',
  }

  // Quick Supabase connectivity check
  try {
    const { error } = await supabase
      .from('promo_offer_master')
      .select('id')
      .limit(1)
    checks.supabase = error ? 'fail' : 'ok'
  } catch {
    checks.supabase = 'fail'
  }

  const allOk = Object.values(checks).every((v) => v === 'ok')

  return Response.json({
    status: allOk ? 'healthy' : 'degraded',
    checks,
    latency_ms: Math.round(performance.now() - start),
    timestamp: new Date().toISOString(),
  }, {
    status: allOk ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  })
}
