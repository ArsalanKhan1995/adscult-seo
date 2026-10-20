import { z } from "zod";
import { fetchSerpLocationsForCountry } from "@/server/lib/dataforseo/serp-locations";
import { executeProviderReadOperation } from "./operation";

export function fetchSearchLocations(countryCode: string) {
  return executeProviderReadOperation("serp.locations", async () => ({
    locations: z
      .array(
        z.object({
          locationCode: z.number().int(),
          locationName: z.string(),
          locationType: z.string(),
          displayLabel: z.string(),
        }),
      )
      .parse(await fetchSerpLocationsForCountry(countryCode)),
    scope: {
      engine: "google",
      countryCode: countryCode.toUpperCase(),
      catalog: "dataforseo_google_geotargets",
    },
  }));
}
