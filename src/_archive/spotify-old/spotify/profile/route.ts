import { NextRequest, NextResponse } from "next/server";
import { generateSpotifyMusicProfile } from "@/lib/spotify";

export async function POST(request: NextRequest) {
  try {
    const { accessToken } = await request.json();

    if (!accessToken) {
      return NextResponse.json(
        { error: "Access token is required" },
        { status: 400 }
      );
    }

    // Generate the music profile using the ranking algorithm
    const result = await generateSpotifyMusicProfile(accessToken);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error generating Spotify music profile:", error);
    return NextResponse.json(
      {
        error: "Failed to generate music profile",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
