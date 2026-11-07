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

TypeScript declarations are included. `baseURL` defaults to the production API;
`className` and `style` let your app compose the picker. With a strict CSP, allow
your API base in `connect-src`, the bundled same-origin worker in `worker-src`,
and `data:`/`blob:` images. The worker ships inside the package and is resolved
by the bundler; Vite consumer installation/build is part of validation.

The archive is distributed directly by Mapora; it has not been published to the
public npm registry. React 19 is a peer dependency.
