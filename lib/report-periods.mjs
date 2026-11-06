const DAY = 86400000;
const iso = (date) => date.toISOString().slice(0, 10);
const utc = (value) => new Date(value + "T00:00:00Z");
export const reportToday = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
export function validDate(value) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value || "") &&
    !Number.isNaN(utc(value).valueOf()) &&
    iso(utc(value)) === value
  );
}
function monthStart(today, offset) {
  const date = utc(today);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1),
  );
}
export function reportPeriod(
  preset = "previous_2_months",
  start,
  end,
  today = reportToday(),
) {
  if (!validDate(today)) throw new Error("Invalid reporting date.");
  let from, to, previousFrom, previousTo;
  switch (preset) {
    case "previous_2_months":
      from = iso(monthStart(today, -2));
      to = iso(new Date(monthStart(today, 0).valueOf() - DAY));
      previousFrom = iso(monthStart(today, -4));
      previousTo = iso(new Date(monthStart(today, -2).valueOf() - DAY));
      break;
    case "last_month":
      from = iso(monthStart(today, -1));
      to = iso(new Date(monthStart(today, 0).valueOf() - DAY));
      previousFrom = iso(monthStart(today, -2));
      previousTo = iso(new Date(monthStart(today, -1).valueOf() - DAY));
      break;
    case "this_month":
      from = iso(monthStart(today, 0));
      to = today;
      break;
    case "year_to_date":
      from = today.slice(0, 4) + "-01-01";
      to = today;
      break;
    case "rolling_2_months": {
      const date = utc(today),
        target = monthStart(today, -2);
      const last = new Date(
        Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
      ).getUTCDate();
      target.setUTCDate(Math.min(last, date.getUTCDate()));
      from = iso(target);
      to = today;
      break;
    }
    case "all_time":
      from = "2000-01-01";
      to = today;
      break;
    case "custom":
      from = start;
      to = end;
      break;
    default:
      throw new Error("Choose a valid reporting period.");
  }
  if (
    !validDate(from) ||
    !validDate(to) ||
    from > to ||
    from < "2000-01-01" ||
    to > today
  )
    throw new Error(
      "Use valid start and end dates between 2000 and today, in order.",
    );
  if (!previousFrom && preset !== "all_time") {
    previousTo = iso(new Date(utc(from).valueOf() - DAY));
    previousFrom = iso(
      new Date(
        utc(from).valueOf() - (utc(to).valueOf() - utc(from).valueOf() + DAY),
      ),
    );
  }
  return {
    preset,
    start: from,
    end: to,
    previous_start: previousFrom || null,
    previous_end: previousTo || null,
    comparison_basis: ["previous_2_months", "last_month"].includes(preset)
      ? "Previous complete calendar months"
      : preset === "all_time"
        ? "No earlier period"
        : "Immediately preceding period of equal days",
  };
}
export function csvCell(value) {
  let text = String(value ?? "");
  if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
