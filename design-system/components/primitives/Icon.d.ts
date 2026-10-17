/**
 * Thin-line stroke icon (Feather/Lucide ISC subset) matching the site's
 * icon style. Inherits color from `color`/currentColor.
 */
export interface IconProps {
  name:
    | "search" | "check" | "chevron-down" | "arrow-up" | "arrow-right"
    | "map-pin" | "user" | "info" | "clock" | "droplet" | "calendar"
    | "pencil" | "alert-triangle" | "alert-octagon" | "x" | "menu"
    | "smartphone" | "phone" | "globe"
    | "plus" | "minus" | "chevron-up" | "chevron-left" | "chevron-right"
    | "external-link" | "download" | "play" | "filter" | "sliders"
    | "bell" | "lock" | "star" | "home" | "mail" | "credit-card" | "repeat"
    | "dumbbell" | "flame" | "heart" | "trending-up" | "bar-chart-2"
    | "target" | "timer" | "trophy" | "youtube";
  size?: number;
  strokeWidth?: number;
  style?: React.CSSProperties;
}
export declare function Icon(props: IconProps): JSX.Element;
