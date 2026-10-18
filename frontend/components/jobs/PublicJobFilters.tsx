import Form from "next/form";
import Link from "next/link";

import { ENGAGEMENT_TYPE_OPTIONS, LOCATION_TYPE_OPTIONS } from "@/lib/job-options";

export type PublicJobFilterValues = {
  type?: string;
  location?: string;
  city?: string;
  area?: string;
};

const selectClass =
  "rounded-xl border-2 border-beedero-border bg-beedero-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-beedero-black";

/**
 * The four filters the public endpoint takes (doc §3.1): engagement type,
 * location type, city and role area.
 *
 * A server component on purpose. `next/form` with a string action submits the
 * fields as a query string, so the filtering keeps happening on the server
 * where the cache is — and the page still works with JavaScript off, which for
 * a page whose job is to be crawled and shared is not a hypothetical.
 *
 * No `cursor` field: changing a filter has to start the walk again, and the
 * only reliable way to guarantee that is for the form not to know the cursor.
 */
export function PublicJobFilters({ values }: { values: PublicJobFilterValues }) {
  const hasFilters = Boolean(values.type || values.location || values.city || values.area);

  return (
    <Form action="/jobs" className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="job-filter-type">
        Engagement type
      </label>
      <select id="job-filter-type" name="type" defaultValue={values.type ?? ""} className={selectClass}>
        <option value="">Any type</option>
        {ENGAGEMENT_TYPE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor="job-filter-location">
        Location type
      </label>
      <select
        id="job-filter-location"
        name="location"
        defaultValue={values.location ?? ""}
        className={selectClass}
      >
        <option value="">Anywhere</option>
        {LOCATION_TYPE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor="job-filter-city">
        City
      </label>
      <input
        id="job-filter-city"
        name="city"
        defaultValue={values.city ?? ""}
        placeholder="City"
        className={`w-32 ${selectClass}`}
      />

      <label className="sr-only" htmlFor="job-filter-area">
        Role area
      </label>
      <input
        id="job-filter-area"
        name="area"
        defaultValue={values.area ?? ""}
        placeholder="Area (e.g. design)"
        className={`w-44 ${selectClass}`}
      />

      <button
        type="submit"
        className="rounded-xl bg-beedero-black px-4 py-2 text-sm font-bold text-beedero-yellow transition hover:opacity-90"
      >
        Filter
      </button>

      {hasFilters && (
        <Link href="/jobs" className="px-2 py-2 text-sm font-semibold text-zinc-500 underline">
          Clear
        </Link>
      )}
    </Form>
  );
}
