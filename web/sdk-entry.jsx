import React from "react";
import LocationPicker from "./src/location/LocationPicker";
import AddressSearch from "./src/location/AddressSearch";
export function MaporaLocationPicker(props) {
  return <LocationPicker baseURL="https://maps-api.nexode.app" {...props} />;
}
export function MaporaAddressSearch(props) {
  return <AddressSearch baseURL="https://maps-api.nexode.app" {...props} />;
}
export { geoRequest } from "./src/location/geoClient";
