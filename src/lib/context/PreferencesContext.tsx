"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { UserPreferences, InterestType, TripBundle, SpotifyMusicProfile } from "../types";
import { migrateLegacyStorage } from "../utils/migrateLegacyStorage";

interface PreferencesContextType {
  preferences: UserPreferences;
  bundles: TripBundle[] | null;
  isHydrated: boolean;
  updateInterests: (interests: InterestType[]) => void;
  updateMusicProfile: (profile: string) => void;
  updateSpotifyMusicProfile: (spotifyProfile: SpotifyMusicProfile) => void;
  updateTimeframe: (timeframe: string) => void;
  updateOtherPreferences: (prefs: string) => void;
  setBundles: (bundles: TripBundle[]) => void;
  resetPreferences: () => void;
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
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    // Clean up legacy localStorage keys from old architecture
    migrateLegacyStorage();

    const storedPrefs = localStorage.getItem("userPreferences");
    const storedBundles = localStorage.getItem("generatedBundles");

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

  const resetPreferences = () => {
    setPreferences(defaultPreferences);
    setBundlesState(null);
    localStorage.removeItem("userPreferences");
    localStorage.removeItem("generatedBundles");
  };

  return (
    <PreferencesContext.Provider
      value={{
        preferences,
        bundles,
        isHydrated,
        updateInterests,
        updateMusicProfile,
        updateSpotifyMusicProfile,
        updateTimeframe,
        updateOtherPreferences,
        setBundles,
        resetPreferences,
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
