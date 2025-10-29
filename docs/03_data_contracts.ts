export type InterestType = "concerts" | "sports" | "artDesign" | "localCulture" | "culinary";

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export interface Event {
  title: string;
  fullDescription: string;
  shortDescription: string;
  interestType: InterestType;
  dateRange: DateRange;
  imageUrl?: string; // optinal event image
  eventWebsite?: string; // optional in UI
}

export interface Bundle {
  title: string;
  tripDescription: string;
  city: string;
  dateRange: DateRange;
  keyEvents: Event[];   // must be > 0
  minorEvents: Event[]; // can be 0
}

export interface GPTResponse {
  bundles: Bundle[];
}

export interface UserPreferences {
  /**
   * User's selected interests.
   * Must include at least 2 items.
   */
  interests: InterestType[];

  /**
   * Music taste profile (derived from Spotify or input by user).
   * Example: "Indie Rock, Neo-Soul, Jazz"
   */
  musicProfile: string;

  /**
   * Desired travel timeframe.
   * Example: "November 2025", "Spring 2026", "next 3 months"
   */
  timeframe: string;

  /**
   * Free-text field for other preferences by the user.
   * Example: "Should not be too cold, focus on big events, budget friendly, I like history ..."
   */
  otherPreferences?: string;
}

/**
 * Spotify Music Profile -- relevant if user connects with Spoitfy
 */
export interface SpotifyMusicProfile {
  /**
   * List of artist names the user is most likely to attend concerts for,
   * sorted by affinity.
   * 
   * - Items must be strings.
   * - Maximum of 1000 items.
   */
  artists: string[];

  /**
   * List of genres the user listens to most, aggregated from artist genres,
   * sorted by affinity.
   * 
   * - Items must be strings.
   * - Maximum of 1000 items.
   */
  genres: string[];
}
