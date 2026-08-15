import { NextRequest, NextResponse } from 'next/server'
import { getProfiles, saveProfile, deleteProfile } from '@/lib/storage'
import { Profile } from '@/types'
import { v4 as uuid } from 'uuid'

export async function GET() {
  const profiles = getProfiles()
  return NextResponse.json(profiles)
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Partial<Profile>
  const profile: Profile = {
    id: body.id || uuid(),
    name: body.name || 'Novo Perfil',
    instagram: body.instagram || '',
    niche: body.niche || '',
    audience: body.audience || '',
    tone: body.tone || '',
    contentType: body.contentType || '',
    extraInstructions: body.extraInstructions || '',
    primaryColor: body.primaryColor || '#E8421A',
    logo: body.logo,
    brandText: body.brandText,
    brandPosition: body.brandPosition,
    verifiedBadge: body.verifiedBadge,
    createdAt: body.createdAt || new Date().toISOString(),
  }
  saveProfile(profile)
  return NextResponse.json(profile)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json() as { id: string }
  deleteProfile(id)
  return NextResponse.json({ ok: true })
}
