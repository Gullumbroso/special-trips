import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/lib/spotify";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Check if user denied authorization
    if (error) {
      return NextResponse.redirect(
        new URL(`/music_taste?error=access_denied`, request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL(`/music_taste?error=invalid_callback`, request.url)
      );
    }

    // Validate state for CSRF protection
    const storedState = request.cookies.get("spotify_auth_state")?.value;
    if (!storedState || storedState !== state) {
      return NextResponse.redirect(
        new URL(`/music_taste?error=state_mismatch`, request.url)
      );
    }

    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.redirect(
        new URL(`/music_taste?error=config_error`, request.url)
      );
    }

    // Exchange code for access token
    const tokenData = await exchangeCodeForToken(
      code,
      clientId,
      clientSecret,
      redirectUri
    );

    // Redirect to loading page with access token in URL hash (client-side only)
    const redirectUrl = new URL("/spotify_loading", request.url);
    redirectUrl.hash = `access_token=${tokenData.access_token}`;

    const response = NextResponse.redirect(redirectUrl);

    // Clear the state cookie
    response.cookies.delete("spotify_auth_state");

    return response;
  } catch (error) {
    console.error("Error in Spotify callback:", error);
    return NextResponse.redirect(
      new URL(`/music_taste?error=token_exchange_failed`, request.url)
    );
  }
}
