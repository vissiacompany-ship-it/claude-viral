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
    subniche: body.subniche || undefined,
    professionalOneLiner: body.professionalOneLiner || undefined,
    audienceType: body.audienceType || undefined,

    sells: body.sells,
    audience: body.audience || '',
    realProblem: body.realProblem || undefined,

    desiredOutcome: body.desiredOutcome || undefined,
    emotionalDriver: body.emotionalDriver || undefined,
    awarenessLevel: body.awarenessLevel || undefined,
    marketSophistication: body.marketSophistication || undefined,
    mechanism: body.mechanism || undefined,
    promiseResult: body.promiseResult || undefined,
    promiseDeadline: body.promiseDeadline || undefined,
    promiseObjection: body.promiseObjection || undefined,
    pastAttempts: body.pastAttempts,
    lifeTransformation: body.lifeTransformation || undefined,
    proofBank: body.proofBank,

    positioningBeliefs: body.positioningBeliefs,
    coreValues: body.coreValues,
    successDefinition: body.successDefinition || undefined,
    whatYouReject: body.whatYouReject || undefined,
    shadowTrait: body.shadowTrait || undefined,

    formality: body.formality || undefined,
    voicePersonality: body.voicePersonality,
    voiceReference: body.voiceReference || undefined,
    signaturePhrases: body.signaturePhrases,
    avoidWords: body.avoidWords,

    extraInstructions: body.extraInstructions || '',
    primaryColor: body.primaryColor || '#E8421A',
    primaryColors: body.primaryColors,
    logo: body.logo,
    brandText: body.brandText,
    brandTextVisible: body.brandTextVisible,
    brandPosition: body.brandPosition,
    verifiedBadge: body.verifiedBadge,
    imageStyleReference: body.imageStyleReference,
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
