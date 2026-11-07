# Mapora React

Download the package from Mapora, install the `.tgz` in your project, then:

```jsx
import { MaporaLocationPicker } from '@mapora/react';
import '@mapora/react/style.css';

<MaporaLocationPicker
 apiKey="mp_pub_YOUR_BROWSER_KEY"
 baseURL="https://maps-api.nexode.app"
 country="PE"
 onSelect={(location) => saveAddress(location)}
/>
```

Use a browser key restricted to your exact HTTPS origin, with `search` and
`reverse` scopes. Browser keys are intentionally visible to visitors. Origin
restrictions reduce accidental browser reuse; they are not server identity
verification. Never embed a secret key. Quotas apply to autocomplete/reverse
calls; tiles do not add API requests. Autocomplete waits 350 ms and cancels stale
results. Maps require WebGL. `country` is optional (worldwide search).

Optional props: `theme` (`light`, `dark`, `grayscale`), `accent` (six-digit hex),
`initialCenter` (`{latitude, longitude}`). `onSelect` can first receive a pin
without address, then its nearby address when lookup completes. Save exact
`latitude`/`longitude`; `matchedLatitude`/`matchedLongitude` refer to the nearby
source feature. Address quality describes source completeness, not verification.
Respect the attribution displayed by the map.

`MaporaAddressSearch` also accepts `onQueryChange(query)`. Use it to invalidate
a previously selected address when the user edits the text, before submitting
a route, coverage check or another operation that requires a confirmed selection.

Both components accept optional `city`, `district` and `state` filters. Combine
them with `country="PE"` to use the offline Peru street index. A result with
`match.coordinateType === "street_reference"` identifies a street reference,
not a doorway. `match.houseNumberMatched` is false; never replace a requested
house number with an invented coordinate. Municipal references are derived from
published map labels. `match.sourceURL` and `match.sourceDate` provide provenance.

TypeScript declarations are included. `baseURL` defaults to the production API;
`className` and `style` let your app compose the picker. With a strict CSP, allow
your API base in `connect-src`, the bundled same-origin worker in `worker-src`,
and `data:`/`blob:` images. The worker ships inside the package and is resolved
by the bundler; Vite consumer installation/build is part of validation.

The archive is distributed directly by Mapora; it has not been published to the
public npm registry. React 19 is a peer dependency.
