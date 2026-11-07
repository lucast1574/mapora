# Motor privado de Mapora

Photon 1.3.0 oficial, Java 21 y un índice global 1.x de GraphHopper. El servicio no publica puertos ni dominio; solo la API Mapora lo consume por la red Docker interna. Los datos y el código del motor no se incluyen en el repositorio.

- DNS interno: `http://mapora-photon_photon:2322`.
- Raíz de datos exclusiva: `/var/lib/mapora-photon`.
- Índice inicial: `https://download1.graphhopper.com/public/photon-db-planet-1.0-latest.tar.bz2`, 63.112.939.450 bytes. MD5 publicado `255fcca531c928acb6ade199f350d7ae`; descargar mediante HTTPS y comprobar antes de extraer.
- JAR: versión fija y SHA-256 comprobado durante la construcción de la imagen.
- Límites: 4 CPU, 16 GiB de RAM, heap de 12 GiB. El host debe tener `vm.max_map_count >= 262144` (verificar, no modificar otros servicios).

Preparar `runtime` vacío con propietario 10001:10001, extraer el archivo verificado sin conservar propietarios en esa carpeta, y construir la imagen con este Dockerfile. No arrancar sobre un índice incompleto. Después desplegar con `docker stack deploy --resolve-image never -c compose.yml mapora-photon`. Verificar `/status`, búsqueda, búsqueda filtrada por país e inversa desde la red interna antes de cambiar `PHOTON_BASE_URL` de Mapora y desplegarla.

Configurar `PHOTON_MIN_INTERVAL_MS=50` únicamente con el motor privado (el valor por defecto para proveedores públicos es 500).

Conservar un respaldo del valor anterior de `PHOTON_BASE_URL` para rollback. Una comprobación de `/health` de la API sola no demuestra disponibilidad de búsqueda: verificar también resultados reales de búsqueda e inversa con una clave de prueba.

## Actualización del índice

Las actualizaciones son una operación de mantenimiento explícita. Descargar un dump compatible nuevo en staging, verificar su checksum, extraer en una carpeta nueva y probarlo antes de intercambiarlo por el índice activo. Nunca descomprimir encima de un índice abierto. Conservar el índice anterior hasta validar el nuevo. No se ejecutan actualizaciones o descargas automáticas sobre producción.

Fuentes: https://github.com/komoot/photon y https://download1.graphhopper.com/public/ . Datos © OpenStreetMap contributors, ODbL 1.0; conservar atribución en las respuestas y visores.

## Prueba del motor privado

Desde el servidor con permisos Docker, ejecutar `python3 infra/photon/smoke.py`.
Comprueba estado, búsquedas filtradas en PE/CO/GB/JP e inversa. Solo utiliza
ubicaciones públicas de prueba; no necesita claves de clientes. Guarda evidencia
en `/var/lib/mapora-photon/smoke-results.json`. Después del cambio de conexión,
validar también los endpoints públicos con una clave temporal de la API.
