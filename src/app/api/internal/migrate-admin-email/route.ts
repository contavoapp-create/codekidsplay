import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupabaseAdminConfigured } from '@/lib/supabase/env'

const OLD_EMAIL = 'admin@codekidsplay.ro'
const NEW_EMAIL = 'admin@codemakerclub.ro'
const TOKEN = 'a5a23b801544cf1a7398bad70eac8bda'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('x-migrate-token')
  if (!auth || auth !== TOKEN) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: 'supabase admin not configured' }, { status: 500 })
  }

  const admin = createAdminClient()
  const { data: listed, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (listErr) {
    return NextResponse.json({ ok: false, error: listErr.message }, { status: 500 })
  }

  const user = (listed?.users ?? []).find(u => u.email?.toLowerCase() === OLD_EMAIL)
  if (!user) {
    const already = (listed?.users ?? []).find(u => u.email?.toLowerCase() === NEW_EMAIL)
    return NextResponse.json({
      ok: true,
      status: already ? 'already_migrated' : 'not_found',
      email: already?.email ?? null,
    })
  }

  const { data: updated, error: updErr } = await admin.auth.admin.updateUserById(user.id, {
    email: NEW_EMAIL,
    email_confirm: true,
  })
  if (updErr) {
    return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    status: 'updated',
    id: user.id,
    email: updated.user?.email ?? NEW_EMAIL,
  })
}
