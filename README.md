# Mapora

Plataforma geográfica independiente en Go y React: búsqueda, enlaces de Google Maps,
consulta inversa, cuentas, API keys, consumo por petición y suscripciones Stripe.

- Landing: https://mapora.nexode.app
- Panel: https://app-mapora.nexode.app
- API: https://maps-api.nexode.app
- Contrato: https://maps-api.nexode.app/openapi.json

## Planes y consumo

| Plan | USD/mes | Peticiones por período | Por minuto |
|---|---:|---:|---:|
| Free | 0 | 1.000 | 30 |
| Launch | 9 | 25.000 | 120 |
| Scale | 29 | Sin cuota mensual | 300 |

Cada petición autenticada admitida a una ruta geográfica consume una unidad,
también si usa caché o devuelve un error. Rechazos por autenticación, permisos,
cuota o velocidad, visitas al panel, documentación, preflight y webhooks no cuentan.
No se cobran excedentes. Free usa meses calendario UTC; los planes pagados usan
el período verificado con Stripe. El administrador puede ajustar las cuotas.
El plan interno del administrador no es parte del catálogo público.

## API keys

Todas las rutas geográficas requieren X-API-Key: TU_API_KEY o Authorization: Bearer
TU_API_KEY. No enviar claves en la URL. El panel permite hasta 10 claves activas,
con permisos search/resolve/reverse. Solo se muestra la clave completa al crearla;
la base conserva un hash SHA-256 de un secreto de alta entropía.

- GET /v1/search?q=Miraflores&countrycodes=pe&limit=5
- GET /v1/reverse?lat=-12.12&lng=-77.03
- POST /v1/resolve con JSON {"url":"https://maps.app.goo.gl/...","includeAddress":true}

includeAddress:false evita la consulta de dirección. Se conserva el pin exacto
y el nombre seleccionado de Google. addressStatus:unavailable indica que el
proveedor no devolvió dirección; las coordenadas siguen disponibles.
matchedLatitude/matchedLongitude identifican el punto cercano del geocodificador.
Esto no utiliza Google Places.

Las cabeceras X-Quota-Limit, X-Quota-Remaining y X-Quota-Reset informan la cuota.
Scale devuelve unlimited en las dos primeras. HTTP 401 indica clave inválida;
403, permisos o cuenta suspendida; 429, cuota/velocidad; Retry-After indica espera.

## Persistencia y seguridad

PostgreSQL 18 con volumen persistente exclusivo de Mapora. Sesiones aleatorias
en cookies Secure, HttpOnly, SameSite=Lax y limitadas al host. Contraseñas bcrypt,
coste 12. Tokens de recuperación de un solo uso con vencimiento de 30 minutos,
entregados mediante Resend. Cambiar/restablecer contraseña revoca otras sesiones.
El administrador inicial solo se crea si no existe; los despliegues no cambian su
contraseña. El administrador no puede suspenderse/degradarse a sí mismo ni quitar
el último administrador activo. Las modificaciones administrativas tienen auditoría.

La cuota se reserva mediante una transacción que bloquea la cuenta. Varias claves,
procesos o solicitudes simultáneas no pueden gastar más que la cuota. Los fallos
de base de datos cierran el acceso, sin ejecutar solicitudes gratuitas.
Se conservan eventos de operaciones durante 180 días; el panel grafica los últimos 30.
No se guardan las direcciones consultadas en el historial personal de peticiones.

## Stripe

Productos, precios, portal y webhook exclusivos de Mapora en la cuenta autorizada.
Los precios se eligen en el servidor. El regreso del checkout no prueba un pago.
Se verifica el estado actual de Stripe bajo bloqueo por cuenta y se deduplican los
eventos de forma persistente. Firma HMAC con tolerancia de cinco minutos.
Los intentos de checkout se guardan antes de la llamada externa y reutilizan una
clave de idempotencia para reconciliar resultados inciertos.

El portal permite cambiar plan, gestionar tarjeta/facturas y cancelar al final del
período. Los cambios pueden tener prorrateos de Stripe. Un reconciliador verifica
suscripciones cada cinco minutos. Una renovación no verificada no abre una cuota
pagada nueva automáticamente. No se guardan números de tarjeta.

## Proveedor geográfico

PHOTON_BASE_URL configura el motor geográfico. Producción utiliza una instancia
privada de Photon 1.3.0 con el índice mundial de OpenStreetMap en el mismo servidor,
sin puertos ni dominio públicos. Configuración y mantenimiento: `infra/photon/`.
PHOTON_MIN_INTERVAL_MS permite ajustar el ritmo: 50 ms para el motor privado,
con cuatro consultas simultáneas como máximo. El valor por defecto sigue siendo
500 ms para no aumentar el tráfico si se configura el demo público de Photon.
El demo https://photon.komoot.io no ofrece SLA; no es la dependencia de producción.
Caché en memoria: 24 MiB/2048 entradas; búsqueda 15 minutos, pin/dirección 24 horas.
Se pierde al reiniciar. Solicitudes concurrentes iguales comparten trabajo.

No se usa el Nominatim público para autocompletado. Mostrar la atribución
© OpenStreetMap contributors con https://www.openstreetmap.org/copyright.

## Desarrollo y despliegue

Go 1.27, PostgreSQL 18. Node 24 solo compila React; la imagen final sirve todos
los assets embebidos en el binario Go. PORT=4000.

Variables: DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD (solo bootstrap), APP_URL,
SITE_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PORTAL_CONFIG,
STRIPE_PRICE_LAUNCH, STRIPE_PRICE_SCALE, RESEND_API_KEY, MAIL_FROM,
PHOTON_BASE_URL. Inyectar en el despliegue; nunca escribir secretos al repositorio.

```sh
cd web && npm ci && npm run build && cd ..
go test ./...
go vet ./...
go build ./cmd/api
docker build -t mapora .
```

Pruebas de persistencia, aislamiento y concurrencia:
TEST_DATABASE_URL con una base aislada llamada mapora_test y go test -race ./...
Las pruebas rechazan nombres distintos. Stripe se simula; no hacer cargos reales
para probar. GET /health comprueba el proceso, no la disponibilidad de Photon.

Logo original: web/public/logo.svg, un trazo M dentro de un marcador geográfico.
General Sans de Fontshare, autoalojada. GSAP/ScrollTrigger con prefers-reduced-motion.


## Mapas interactivos

`POST /v1/maps` requiere una API key con el nuevo permiso `maps`. Las claves existentes conservan sus permisos; crea una clave con «Crear mapas interactivos» para habilitar esta operación. Envía `center: {latitude, longitude}`, `title`, `zoom` (1–19), `markers` (hasta 200 puntos) y `expiresIn` en segundos (60–2.592.000; por defecto 604.800). Si no envías marcadores, se coloca uno en el centro; si no envías centro, se usa el primer marcador. La proyección admite latitudes entre ±85.05112878 y longitudes entre ±180, incluidos ceros.

La respuesta devuelve `url`, `embedHtml`, `expiresAt` y el mapa normalizado. La URL usa un token aleatorio de lectura de un solo mapa; en PostgreSQL se guarda su hash. Nunca incluye la API key. El visor `/map/{token}` puede incrustarse en otras páginas; las páginas de cuenta mantienen su protección contra iframes. La vista se consulta con `GET /v1/maps/view/{token}` y revisa caducidad, revocación de clave y suspensión del usuario en cada carga. Crear el mapa consume una petición. Las cargas y las interacciones del visor no suman peticiones a Mapora.

El panel `/app/maps` permite generar, previsualizar y copiar el enlace/iframe. MapLibre GL muestra cartografía vectorial mundial propia con datos OpenStreetMap/Protomaps, fuentes y sprites locales, atribución visible y caché HTTP normal. El visor admite temas, agrupación de marcadores, polígonos y geometría de ruta. No hay modo sin conexión, satélite ni geolocalización del dispositivo.

## Google mediante Firebase

Proyecto independiente: `mapora-platform`. Configura `FIREBASE_PROJECT_ID`, `FIREBASE_API_KEY` y `FIREBASE_APP_ID`; estos valores de cliente se entregan desde `/console/auth/providers`. Habilita Google y autoriza los dominios de Mapora en Firebase. El cliente abre Google mediante Firebase Auth, usa persistencia solo en memoria y entrega el ID token a `POST /console/google`; después descarta la sesión Firebase. Mapora emite su cookie HttpOnly habitual.

El servidor verifica RS256 con certificados públicos cacheados de Google, issuer y audience del proyecto, expiración, emisión, auth_time, UID, correo verificado y proveedor `google.com`. Vincula por UID/correo a la cuenta existente, conservando rol, plan, claves y uso; usuarios nuevos son `user`/Free. La primera vinculación invalida las sesiones y enlaces de recuperación anteriores. Para cuentas de correo aún no verificado también desactiva la contraseña anterior, evitando conservar credenciales de una preinscripción ajena; el propietario puede definir una contraseña mediante recuperación por correo. El administrador bootstrap y quienes verificaron correo por recuperación conservan su contraseña. No se conceden privilegios a partir del correo enviado por el navegador.


## SEO y páginas públicas

`npm --prefix web run build` compila el cliente y prerenderiza las siete páginas públicas con React en el proceso de construcción. El servidor Go sirve HTML completo y el cliente lo hidrata; el panel, acceso y visor compartido utilizan un shell separado con `noindex`. No hay un servidor Node en producción.

Rutas canónicas: `/`, `/documentacion`, `/api-busqueda-direcciones`, `/resolver-enlaces-google-maps`, `/geocodificacion-inversa`, `/mapas-interactivos` y `/legal`. El proceso genera títulos y descripciones propios, canonical, Open Graph/Twitter, JSON-LD de Organization/WebSite/WebPage/Service y migas de navegación. No se añaden reseñas, métricas de clientes ni valoraciones ficticias. La API de mapas se documenta sin prometer disponibilidad de Photon de sus motores dedicados.

`/sitemap.xml` solo contiene esas páginas. `robots.txt` referencia el sitemap; las páginas de cuenta y mapas compartidos permanecen rastreables para que se pueda leer su `noindex`, mientras las rutas de API y consola no se anuncian para el rastreo. Las rutas inexistentes devuelven HTTP 404 real. Las variantes con barra final y los duplicados públicos del host de API/panel redirigen a `https://mapora.nexode.app`; las rutas y métodos de la API conservan su comportamiento.

`GOOGLE_SITE_VERIFICATION` añade la etiqueta de verificación de Search Console al HTML público. Su valor es un token público de verificación, no una credencial de inicio de sesión. Las imágenes sociales PNG 1200×630 y los iconos se generan con Resvg a partir de los SVG de marca; la tarjeta conserva los trazados de General Sans sin depender de fuentes externas. Las fuentes de interfaz están alojadas localmente.

Para un cambio futuro de dominio, actualizar juntos `web/src/public/content.js`, `web/src/client.js`, los hosts canónicos de `web/embed.go`, configuración de despliegue y proveedores de autenticación/pagos, redirecciones, verificación y sitemap de Search Console. No eliminar las URLs antiguas sin preparar las redirecciones correspondientes.

Validación: ejecutar primero el build del frontend y después `go test ./...` y `go vet ./...`. Los tests del paquete `web` comprueban HTML prerenderizado, metadatos únicos, JSON-LD válido, sitemap, exclusión de páginas privadas, redirecciones, HEAD, escape de la etiqueta de verificación y 404 reales.

## Capacidades ampliadas

Ver `docs/expansion.md` y `/openapi.json`: autocompletado, búsqueda estructurada,
calidad de dirección, lugares cercanos, lotes, zonas, rutas/matrices y SDK React/JS.
Se conservan contratos y planes anteriores. Una llamada admitida cuenta como una
petición; batch10, ruta10, matriz10×10. Claves públicas de navegador por origen.

`TILE_BASE_URL` configura el gateway privado de cartografía (`infra/tiles`).
`ROUTING_BASE_URL` configura Valhalla privado (`infra/routing`);
`ROUTING_COVERAGE=latin_america` declara los datos iniciales. La ampliación
seleccionada es toda América: construir y verificar ese índice antes de
declarar `americas`. La búsqueda y el fondo cartográfico cubren el mundo.

`/service-status` presenta la comprobación actual de motores; no es un historial
de disponibilidad. CI comprueba respaldo/restauración en PostgreSQL aislado.

El build genera también `/downloads/mapora-react-2.0.0.tgz` y el cliente JS.
El paquete se instala desde el archivo descargado; no se publica en npm.
