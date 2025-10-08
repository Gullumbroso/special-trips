import { NextResponse } from "next/server";
import { getSpotifyAuthUrl } from "@/lib/spotify";
import { randomBytes } from "crypto";

export async function GET() {
  try {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return NextResponse.json(
        { error: "Spotify credentials not configured" },
        { status: 500 }
      );
    }

    // Generate random state for CSRF protection
    const state = randomBytes(16).toString("hex");

    // Store state in cookie for validation on callback
    const authUrl = getSpotifyAuthUrl(clientId, redirectUri, state);

    const response = NextResponse.redirect(authUrl);
    response.cookies.set("spotify_auth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
    });

    return response;
  } catch (error) {
    console.error("Error initiating Spotify auth:", error);
    return NextResponse.json(
      { error: "Failed to initiate Spotify authentication" },
      { status: 500 }
    );
  }
}
