"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { UserPreferences, InterestType, TripBundle, SpotifyMusicProfile } from "../types";
import { migrateLegacyStorage } from "../utils/migrateLegacyStorage";

interface PreferencesContextType {
  preferences: UserPreferences;
  bundles: TripBundle[] | null;
  bundleColors: Record<number, string>; // Maps bundle index to color scheme name
  isHydrated: boolean;
  updateInterests: (interests: InterestType[]) => void;
  updateMusicProfile: (profile: string) => void;
  updateSpotifyMusicProfile: (spotifyProfile: SpotifyMusicProfile) => void;
  updateTimeframe: (timeframe: string) => void;
  updateOtherPreferences: (prefs: string) => void;
  setBundles: (bundles: TripBundle[]) => void;
  setBundleColors: (colors: Record<number, string>) => void;
  resetPreferences: () => void;
  disconnectSpotify: () => void;
}

const defaultPreferences: UserPreferences = {
  interests: [],
  musicProfile: "",
  timeframe: "",
  otherPreferences: "",
};

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [bundles, setBundlesState] = useState<TripBundle[] | null>(null);
  const [bundleColors, setBundleColorsState] = useState<Record<number, string>>({});
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    // Clean up legacy localStorage keys from old architecture
    migrateLegacyStorage();

    const storedPrefs = localStorage.getItem("userPreferences");
    const storedBundles = localStorage.getItem("generatedBundles");
    const storedBundleColors = localStorage.getItem("bundleColors");

    console.log("Hydrating from localStorage...");
    console.log("Stored bundles found:", !!storedBundles);

    if (storedPrefs) {
      try {
        setPreferences(JSON.parse(storedPrefs));
      } catch (error) {
        console.error("Failed to parse stored preferences:", error);
      }
    }

    if (storedBundles) {
      try {
        const parsed = JSON.parse(storedBundles);
        console.log("Loading bundles from localStorage, count:", parsed.length);
        setBundlesState(parsed);
      } catch (error) {
        console.error("Failed to parse stored bundles:", error);
      }
    }

    if (storedBundleColors) {
      try {
        setBundleColorsState(JSON.parse(storedBundleColors));
      } catch (error) {
        console.error("Failed to parse stored bundle colors:", error);
      }
    }

    setIsHydrated(true);
  }, []);

  // Sync preferences to localStorage on changes
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem("userPreferences", JSON.stringify(preferences));
    }
  }, [preferences, isHydrated]);

  // Sync bundles to localStorage on changes
  useEffect(() => {
    if (isHydrated && bundles) {
      console.log("Saving bundles to localStorage:", bundles.length);
      localStorage.setItem("generatedBundles", JSON.stringify(bundles));
    }
  }, [bundles, isHydrated]);

  // Sync bundle colors to localStorage on changes
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem("bundleColors", JSON.stringify(bundleColors));
    }
  }, [bundleColors, isHydrated]);

  const updateInterests = (interests: InterestType[]) => {
    setPreferences((prev) => ({ ...prev, interests }));
  };

  const updateMusicProfile = (profile: string) => {
    setPreferences((prev) => ({ ...prev, musicProfile: profile }));
  };

  const updateSpotifyMusicProfile = (spotifyProfile: SpotifyMusicProfile) => {
    setPreferences((prev) => ({ ...prev, spotifyMusicProfile: spotifyProfile }));
  };

  const updateTimeframe = (timeframe: string) => {
    setPreferences((prev) => ({ ...prev, timeframe }));
  };

  const updateOtherPreferences = (prefs: string) => {
    setPreferences((prev) => ({ ...prev, otherPreferences: prefs }));
  };

  const setBundles = (newBundles: TripBundle[]) => {
    setBundlesState(newBundles);
  };

  const setBundleColors = (colors: Record<number, string>) => {
    setBundleColorsState(colors);
  };

  const resetPreferences = () => {
    setPreferences(defaultPreferences);
    setBundlesState(null);
    setBundleColorsState({});
    localStorage.removeItem("userPreferences");
    localStorage.removeItem("generatedBundles");
    localStorage.removeItem("bundleColors");
  };

  const disconnectSpotify = () => {
    setPreferences((prev) => ({
      ...prev,
      spotifyMusicProfile: undefined,
      musicProfile: "",
    }));
  };

  return (
    <PreferencesContext.Provider
      value={{
        preferences,
        bundles,
        bundleColors,
        isHydrated,
        updateInterests,
        updateMusicProfile,
        updateSpotifyMusicProfile,
        updateTimeframe,
        updateOtherPreferences,
        setBundles,
        setBundleColors,
        resetPreferences,
        disconnectSpotify,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (context === undefined) {
    throw new Error("usePreferences must be used within a PreferencesProvider");
  }
  return context;
}
