import { z } from "zod";

const text = z.string().nullish();
const number = z.number().nullish();
const count = z.number().int().nonnegative().nullish();
const flag = z.boolean().nullish();
const rating = z
  .object({
    value: number,
    votes_count: count,
    rating_max: number,
    rating_type: text,
  })
  .nullish();
const clock = z.object({ hour: number, minute: number });
const hours = z
  .object({
    current_status: text,
    timetable: z
      .record(
        z.string(),
        z
          .array(z.object({ open: clock.nullish(), close: clock.nullish() }))
          .nullable(),
      )
      .nullish(),
  })
  .nullish();

// These names are the established public tool contract. Schemas strip vendor
// additions at every nested boundary; absent metrics remain unknown, never zero.
export const localBusinessRowSchema = z.object({
  rank_group: number,
  rank_absolute: number,
  title: text,
  description: text,
  category: text,
  additional_categories: z.array(z.string()).nullish(),
  address: text,
  phone: text,
  url: text,
  domain: text,
  contact_url: text,
  cid: text,
  place_id: text,
  latitude: number,
  longitude: number,
  rating,
  is_claimed: flag,
  total_photos: count,
  check_url: text,
  rating_distribution: z
    .record(z.string(), z.number().nonnegative().nullable())
    .nullish(),
  price_level: text,
  address_info: z
    .object({
      borough: text,
      address: text,
      city: text,
      zip: text,
      region: text,
      country_code: text,
    })
    .nullish(),
  work_hours: hours,
  work_time: z.object({ work_hours: hours }).nullish(),
  local_justifications: z.array(z.object({ type: text, text: text })).nullish(),
});

const answerSchema = z.object({
  answer_id: text,
  answer_text: text,
  original_answer_text: text,
  profile_name: text,
  time_ago: text,
  timestamp: text,
});
export const businessQuestionSchema = z.object({
  rank_absolute: number,
  question_id: text,
  question_text: text,
  original_question_text: text,
  profile_name: text,
  time_ago: text,
  timestamp: text,
  items: z.array(answerSchema).nullable().default(null),
});
export const businessReviewSchema = z.object({
  rank_absolute: number,
  time_ago: text,
  timestamp: text,
  rating,
  review_text: text,
  original_review_text: text,
  original_language: text,
  profile_name: text,
  local_guide: flag,
  reviews_count: count,
  photos_count: count,
  review_highlights: z
    .array(z.object({ feature: text, assessment: text }))
    .nullish(),
  source: z.object({ title: text, url: text, domain: text }).nullish(),
  owner_answer: text,
  owner_time_ago: text,
  owner_timestamp: text,
  review_id: text,
});
export const businessUpdateSchema = z.object({
  rank_absolute: number,
  author: text,
  post_date: text,
  timestamp: text,
  post_text: text,
  snippet: text,
  url: text,
  links: z.array(z.object({ title: text, type: text, url: text })).nullish(),
});
export const businessTotalsSchema = z.object({
  title: text,
  reviews_count: count,
  rating,
  cid: text,
  place_id: text,
});

export interface BusinessLocation {
  locationCoordinate?: string;
  locationCode?: number;
  languageCode: string;
}
export type BusinessTaskEndpoint =
  | "reviews"
  | "extended_reviews"
  | "my_business_updates";
export type BusinessTaskOutcome = {
  status: "pending" | "completed";
  result:
    | (z.infer<typeof businessTotalsSchema> & {
        items: Array<
          | z.infer<typeof businessReviewSchema>
          | z.infer<typeof businessUpdateSchema>
        >;
      })
    | null;
};
export type LocalSerpTaskOutcome =
  | { status: "pending" }
  | { status: "failed"; message: string }
  | { status: "completed"; items: z.infer<typeof localBusinessRowSchema>[] };
export interface MapsRequest {
  keyword: string;
  locationCoordinate: string;
  languageCode: string;
  searchType: "maps" | "local_finder";
  device: "desktop" | "mobile";
  depth: number;
  searchPlaces?: boolean;
}
