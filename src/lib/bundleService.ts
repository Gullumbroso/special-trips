import { TripBundle } from "./types";
import bundleData from "../../docs/04_data_sample.json";

export async function getBundles(): Promise<TripBundle[]> {
  // Simulate async API call with small delay
  await new Promise((resolve) => setTimeout(resolve, 100));
  return bundleData.bundles as TripBundle[];
}

export async function getBundleById(id: string): Promise<TripBundle | null> {
  const bundles = await getBundles();
  const index = parseInt(id, 10);
  return bundles[index] || null;
}
