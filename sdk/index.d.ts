import type { CSSProperties, JSX } from "react";
export interface Point {
  latitude: number;
  longitude: number;
}
export interface AddressQuality {
  precision: string;
  missingFields: string[];
  verified: false;
}
export interface Location extends Point {
  placeName: string;
  source: string;
  id?: string;
  address?: string;
  streetAddress?: string;
  street?: string;
  houseNumber?: string;
  district?: string;
  city?: string;
  state?: string;
  country?: string;
  countryCode?: string;
  postcode?: string;
  googleMapsLink?: string;
  attribution?: string;
  quality?: AddressQuality;
  addressStatus?: "resolved" | "unavailable" | "not_requested";
  matchedLatitude?: number;
  matchedLongitude?: number;
}
export interface LocationPickerProps {
  apiKey: string;
  baseURL?: string;
  country?: string;
  onSelect?: (location: Location) => void;
  theme?: "light" | "dark" | "grayscale";
  accent?: string;
  initialCenter?: Point;
  className?: string;
  style?: CSSProperties;
}
export interface AddressSearchProps {
  apiKey: string;
  baseURL?: string;
  country?: string;
  onSelect?: (location: Location) => void;
  onQueryChange?: (query: string) => void;
  label?: string;
  bias?: Point;
  disabled?: boolean;
}
export declare function MaporaLocationPicker(
  props: LocationPickerProps,
): JSX.Element;
export declare function MaporaAddressSearch(
  props: AddressSearchProps,
): JSX.Element;
export declare function geoRequest<T = unknown>(
  baseURL: string,
  key: string,
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T>;
