import { CalendarDays } from "lucide-react";

import { PlaceholderPage } from "@/pages/placeholder-page";

// Hearings happen in Neuquén time, whatever the device says.
const TIME_ZONE = "America/Argentina/Buenos_Aires";
const LONG_DATE = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: TIME_ZONE,
});
// en-CA formats as YYYY-MM-DD, the machine-readable form <time dateTime> wants.
const ISO_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE });

function Today() {
  const now = new Date();
  const text = LONG_DATE.format(now);
  return (
    <time dateTime={ISO_DATE.format(now)}>
      {text.charAt(0).toLocaleUpperCase("es-AR") + text.slice(1)}
    </time>
  );
}

/** Agenda: the day's hearings. The rail arrives with the agenda task; for now, its frame. */
export function HomePage() {
  return (
    <PlaceholderPage
      title="Audiencias de hoy"
      subtitle={<Today />}
      icon={CalendarDays}
      description="Acá vas a ver las audiencias del día en orden, con la sala, el juez o la jueza y el estado que informa la OFIJU."
    />
  );
}
