import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  IconArrowRight,
  IconCloud,
  IconCloudRain,
  IconMapPin,
  IconSun,
} from "@tabler/icons-react";
import { useApp } from "../context/AppContext";
import { ApiError, request } from "../lib/api";
import { dateTime, districts } from "../lib/format";
import { forecastPreview } from "../lib/forecast-preview";
import type { Forecast } from "../types";

export function HomeWeather({ district }: { district?: string }) {
  const { online } = useApp();
  const location = districts.find((place) => place.name === district);
  const [state, setState] = useState<{
    district: string;
    forecast?: Forecast;
    error?: "unavailable" | "not_configured";
  } | null>(null);
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    if (!online || !location) return;
    let active = true;
    setClock(new Date());
    setState(null);
    void request<Forecast>(
      `/api/weather?latitude=${location.latitude}&longitude=${location.longitude}`,
    ).then(
      (forecast) => {
        if (active) {
          setClock(new Date());
          setState({ district: location.name, forecast });
        }
      },
      (failure) => {
        if (active)
          setState({
            district: location.name,
            error:
              failure instanceof ApiError &&
              failure.code === "WEATHER_NOT_CONFIGURED"
                ? "not_configured"
                : "unavailable",
          });
      },
    );
    const interval = window.setInterval(() => setClock(new Date()), 60_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [online, location]);
  const current =
    online && location && state?.district === location.name ? state : null;
  const forecast = current?.forecast;
  const preview = forecast ? forecastPreview(forecast, clock) : null;
  const destination = location
    ? `/weather?district=${encodeURIComponent(location.name)}`
    : "/weather";
  const now = clock;
  const dayName = new Intl.DateTimeFormat("en-UG", {
    weekday: "long",
    timeZone: "Africa/Kampala",
  }).format(now);
  const fullDate = new Intl.DateTimeFormat("en-UG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Kampala",
  }).format(now);
  const rainChance = preview?.today?.rainChance ?? null;
  const description = forecast?.current.description ?? "";
  // The icon follows the reported condition; rain chance is shown as text.
  const ConditionIcon = /rain|shower|drizzle|storm|thunder/i.test(description)
    ? IconCloudRain
    : /clear|sun/i.test(description)
      ? IconSun
      : IconCloud;
  return (
    <section
      className="home-forecast home-weather-card"
      aria-labelledby="home-weather-title"
    >
      <div className="hw-top">
        <span className="hw-place" id="home-weather-title">
          <IconMapPin size={15} aria-hidden="true" />
          {location ? location.name : "Your local weather"}
        </span>
        <Link to={destination} className="text-link">
          View forecast
          <IconArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <div className="hw-day">
        <strong>{dayName}</strong>
        <small>{fullDate}</small>
      </div>
      {forecast && preview ? (
        <div className="hw-reading">
          <div>
            <strong className="hw-temp">
              {Math.round(forecast.current.temperature)}°C
            </strong>
            {preview.today && (
              <small>
                High {Math.round(preview.today.max)}° · Low{" "}
                {Math.round(preview.today.min)}°
              </small>
            )}
          </div>
          <div className="hw-condition">
            <ConditionIcon size={52} stroke={1.3} aria-hidden="true" />
            <strong>{description}</strong>
            <small>
              {rainChance !== null
                ? `${rainChance}% rain chance today`
                : preview.today
                  ? `${preview.today.rainMm.toFixed(1)} mm rain expected`
                  : ""}
            </small>
          </div>
        </div>
      ) : (
        <p className="home-forecast-empty" role="status">
          {!online
            ? "Reconnect to check your district forecast."
            : !location
              ? "Choose a district to see its forecast."
              : current?.error === "not_configured"
                ? "Forecasts are not set up for this service yet."
                : current?.error
                  ? "Forecast unavailable. Open weather to try again."
                  : "Checking your district forecast…"}
        </p>
      )}
      {forecast && preview && (
        <>
          {preview.stale && (
            <p className="home-data-warning" role="status">
              Older forecast. Refresh before making field decisions.
            </p>
          )}
          <details className="home-forecast-source">
            <summary>Source & update time</summary>
            <p>
              {forecast.source} · retrieved {dateTime(forecast.fetchedAt)} EAT.
              Forecast for the district centre, not a field measurement.{" "}
              {forecast.current.description}.
              {preview.today
                ? ` Expected rain today: ${preview.today.rainMm.toFixed(1)} mm.`
                : " No rain estimate for today in this response."}
              {forecast.periodNote && ` ${forecast.periodNote}`}
            </p>
          </details>
        </>
      )}
    </section>
  );
}
