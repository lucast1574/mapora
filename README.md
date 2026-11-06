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

PHOTON_BASE_URL configura el índice externo. Por defecto https://photon.komoot.io,
que permite uso moderado y no da SLA: https://github.com/komoot/photon#demo-server.
La API y la plataforma están alojadas en Nexode; el índice geográfico no está
autoalojado. Para mayor volumen, reemplazarlo por una instancia propia/contratada.
El tráfico frío al proveedor tiene dos inicios por segundo y cuatro pendientes.
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
