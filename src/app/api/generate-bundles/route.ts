import { NextRequest, NextResponse } from 'next/server';
import { UserPreferences } from '@/lib/types';
import OpenAI from 'openai';
import { INTEREST_LABELS } from '@/lib/constants';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Use Edge Runtime for fast response
export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const PROMPT_ID = 'pmpt_68b758d74f60819593d91d254518d4fc020955df32c90659';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const preferences: UserPreferences = body.preferences;

    console.log('[API] Starting background OpenAI response generation');

    // Format preferences (same logic from inngest/functions.ts)
    const interestsString = preferences.interests
      .map((interest) => INTEREST_LABELS[interest])
      .join(', ');

    let musicTasteString = preferences.musicProfile;
    if (preferences.spotifyMusicProfile) {
      const spotifyData = {
        artists: preferences.spotifyMusicProfile.artists.map((a) => a.name),
        genres: preferences.spotifyMusicProfile.genres,
      };
      musicTasteString = JSON.stringify(spotifyData);
    }

    const promptVariables = {
      interests: interestsString,
      music_taste: musicTasteString,
      date_range: preferences.timeframe,
      free_text_requests: preferences.otherPreferences || 'None',
    };

    console.log('[API] Creating background response with prompt variables:', {
      interests: interestsString.substring(0, 50),
      date_range: preferences.timeframe,
    });

    // Create background response
    // NOTE: The prompt (pmpt_68b758d74f60819593d91d254518d4fc020955df32c90659)
    // already has the fetch_event_images function defined in OpenAI dashboard
    const response = await openai.responses.create({
      prompt: {
        id: PROMPT_ID,
        variables: promptVariables,
      },
      background: true, // KEY CHANGE: Run in background mode
      store: true, // Required for background mode
      reasoning: {
        effort: 'medium',
        summary: 'auto',
      },
    });

    console.log(`[API] Created background response ${response.id} with status: ${response.status}`);

    return NextResponse.json({
      responseId: response.id,
      status: response.status,
    });
  } catch (error) {
    console.error('[API] Error creating background response:', error);
    return NextResponse.json(
      { error: 'Failed to create generation job' },
      { status: 500 }
    );
  }
}
