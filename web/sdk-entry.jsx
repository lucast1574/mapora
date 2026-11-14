import React from "react";
import LocationPicker from "./src/location/LocationPicker";
import AddressSearch from "./src/location/AddressSearch";
export function MaporaLocationPicker(props) {
  return <LocationPicker baseURL="https://api.mapora.dev" {...props} />;
}
export function MaporaAddressSearch(props) {
  return <AddressSearch baseURL="https://api.mapora.dev" {...props} />;
}
export { geoRequest } from "./src/location/geoClient";
