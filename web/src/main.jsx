import React from "react";
import { createRoot } from "react-dom/client";
import Landing from "./Landing";
import Dashboard from "./Dashboard";
import Auth from "./Auth";
import { Logo } from "./ui";
import "./style.css";
const path = location.pathname;
if (location.hostname === "app-mapora.nexode.app" && path === "/")
  location.replace("/app");
function Legal() {
  return (
    <div className="legal-page">
      <Logo />
      <main>
        <h1>Condiciones y privacidad</h1>
        <p>
          Mapora es un servicio de API geográfica operado por el titular de
          Nexode. Contacto: <a href="mailto:hola@nexode.app">hola@nexode.app</a>
          . Este aviso se actualizó el 6 de noviembre de 2026.
        </p>
        <h2>Cuenta y uso</h2>
        <p>
          Eres responsable de proteger tu contraseña y tus API keys. No utilices
          el servicio para actividades ilegales, extracción masiva abusiva de
          datos o solicitudes que comprometan su disponibilidad. Podemos
          suspender accesos ante abuso. No envíes datos personales sensibles en
          las consultas.
        </p>
        <h2>Planes y suscripciones</h2>
        <p>
          Free incluye 1.000 peticiones por mes calendario UTC. Launch incluye
          25.000 por USD 9 al mes. Scale cuesta USD 29 al mes y no tiene cuota
          mensual. Sus límites por minuto son 30, 120 y 300, respectivamente.
          Cada petición autenticada a rutas geográficas admitida por la clave
          consume una unidad, incluso desde caché o si devuelve un error. Los
          rechazos por autenticación, permisos o cuota no cuentan. No cobramos
          excedentes automáticamente.
        </p>
        <p>
          Los planes de pago se renuevan mensualmente mediante Stripe hasta su
          cancelación. Puedes cancelar desde el portal de facturación y
          conservar el acceso hasta el fin del período pagado. Los cambios de
          plan pueden incluir prorrateos calculados por Stripe. Revisa siempre
          el importe y los términos mostrados por Stripe antes de confirmar.
          Contacta al soporte para errores de cobro o solicitudes de devolución;
          se respetan los derechos obligatorios que correspondan.
        </p>
        <h2>Datos y disponibilidad</h2>
        <p>
          Las direcciones proceden de Photon/OpenStreetMap y su cobertura puede
          ser incompleta. El geocodificador puede describir un punto cercano, no
          el exacto. Los enlaces de Google Maps se interpretan sin usar Google
          Places. El servicio depende de proveedores externos y no ofrece una
          garantía contractual de disponibilidad o latencia. “Ilimitado” se
          refiere a cuota mensual, no a capacidad concurrente o disponibilidad
          ilimitada.
        </p>
        <h2>Información que conservamos</h2>
        <p>
          Guardamos nombre, correo, contraseña cifrada mediante hash, sesiones,
          hashes de claves, suscripciones y registros de operación, estado HTTP
          y tiempo de respuesta. No almacenamos números de tarjeta: los gestiona
          Stripe. Las consultas pueden conservarse temporalmente en la caché de
          la API y se envían al proveedor geográfico; no forman parte del
          historial personal mostrado en el panel.
        </p>
        <p>
          Stripe procesa la facturación, Resend entrega los correos de acceso y
          Photon procesa las consultas geográficas. Usamos cookies necesarias
          para mantener tu sesión; no incluimos seguimiento publicitario. Para
          solicitar acceso, corrección o eliminación de tus datos, escribe desde
          el correo de tu cuenta a hola@nexode.app.
        </p>
        <h2>Atribución</h2>
        <p>
          Los datos geográficos pertenecen a{" "}
          <a href="https://www.openstreetmap.org/copyright">
            © OpenStreetMap contributors
          </a>
          , bajo ODbL. Debes conservar la atribución correspondiente al mostrar
          los resultados.
        </p>
        <a href="/">Volver a Mapora</a>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")).render(
  path.startsWith("/app") ? (
    <Dashboard />
  ) : ["/login", "/signup", "/forgot", "/reset"].includes(path) ? (
    <Auth />
  ) : path === "/legal" ? (
    <Legal />
  ) : (
    <Landing />
  ),
);
