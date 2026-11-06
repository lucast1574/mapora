import React, { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Code2,
  MapPin,
  Navigation,
  Search,
  ChevronDown,
} from "lucide-react";
import { Logo, Button } from "./ui";
import { api, appURL, number } from "./client";
gsap.registerPlugin(ScrollTrigger);
const samples = {
  search: {
    title: "Encuentra una dirección.",
    description:
      "Calles, distritos y lugares con país, ciudad y coordenadas. Prioriza lo que está cerca de tu usuario.",
    route: "/v1/search?q=Avenida+José+Larco&countrycodes=pe",
    result: {
      placeName: "Avenida José Larco",
      city: "Miraflores",
      countryCode: "PE",
      latitude: -12.1199058,
      longitude: -77.0289708,
    },
  },
  resolve: {
    title: "Un enlace. Un lugar.",
    description:
      "Convierte un enlace corto de Google Maps en coordenadas y conserva el nombre del lugar seleccionado.",
    route: "/v1/resolve",
    result: {
      placeName: "Plaza Mayor",
      latitude: -12.0453,
      longitude: -77.0309,
      addressStatus: "resolved",
    },
  },
  reverse: {
    title: "Dale contexto al punto.",
    description:
      "Convierte coordenadas en una referencia de dirección, sin mover el punto que tu aplicación necesita.",
    route: "/v1/reverse?lat=-12.12&lng=-77.03",
    result: {
      streetAddress: "Avenida José Larco, Miraflores, Lima",
      latitude: -12.12,
      longitude: -77.03,
      source: "photon",
    },
  },
};
function MapArtwork() {
  return (
    <div className="map-art" aria-hidden="true">
      <svg viewBox="0 0 760 650" className="map-streets">
        <path
          className="water"
          d="M0 0h170l24 122 80 63-39 117 83 110-52 119 75 119H0Z"
        />
        <g className="city-blocks">
          {Array.from({ length: 30 }, (_, i) => (
            <rect
              key={i}
              x={280 + (i % 5) * 96}
              y={30 + Math.floor(i / 5) * 96}
              width="66"
              height="66"
              rx="9"
              transform={`rotate(-15 ${310 + (i % 5) * 96} ${60 + Math.floor(i / 5) * 96})`}
            />
          ))}
        </g>
        <path
          className="city-route route-main"
          d="M250 570L340 430Q355 410 385 413L500 425Q530 430 548 395L642 208"
        />
        <path
          className="city-route route-secondary"
          d="M283 90L350 230Q363 250 395 245L562 205Q590 200 610 175L690 80"
        />
        <circle className="map-point" cx="340" cy="430" r="13" />
        <circle className="map-point" cx="642" cy="208" r="13" />
        <g className="moving-marker">
          <circle cx="500" cy="425" r="17" />
          <circle cx="500" cy="425" r="5" fill="white" />
        </g>
      </svg>
      <div className="map-label map-label-top">
        <MapPin size={15} /> Miraflores, Lima
      </div>
      <div className="coordinate-card" data-ui>
        <span>Un punto. Todos sus datos.</span>
        <strong>−12.119906, −77.028971</strong>
        <small>Avenida José Larco · Perú</small>
      </div>
    </div>
  );
}
function CodeSample({ sample }) {
  return (
    <div className="response-specimen" data-ui>
      <div className="specimen-top">
        <span>
          <span className="status-dot" />
          200 OK
        </span>
        <span>Respuesta de ejemplo</span>
      </div>
      <code className="request-path">{sample.route}</code>
      <pre>{JSON.stringify(sample.result, null, 2)}</pre>
      <div className="specimen-bottom">
        <span>JSON, listo para tu aplicación</span>
        <Code2 size={18} />
      </div>
    </div>
  );
}
export default function Landing() {
  const root = useRef(null);
  const [selected, setSelected] = useState("search");
  const [plans, setPlans] = useState([]);
  useEffect(() => {
    api("/console/plans")
      .then((v) => setPlans(v.plans))
      .catch(() => {});
  }, []);
  useEffect(() => {
    // Pricing arrives asynchronously and changes the scroll positions below it.
    const frame = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(frame);
  }, [plans]);
  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const scope = gsap.context(() => {
        gsap
          .timeline({ defaults: { ease: "power3.out" } })
          .from(".landing-nav > *", {
            y: -18,
            opacity: 0,
            stagger: 0.08,
            duration: 0.65,
          })
          .from(
            ".hero-copy h1,.hero-copy p,.hero-copy .hero-actions",
            { y: 35, opacity: 0, stagger: 0.13, duration: 0.9 },
            "-.25",
          )
          .from(
            ".map-stage",
            { y: 45, opacity: 0, rotation: 2, duration: 1 },
            "-.9",
          )
          .from(
            ".coordinate-card",
            { y: 25, opacity: 0, duration: 0.7 },
            "-.25",
          );
        gsap.to(".map-streets", {
          y: -16,
          rotation: 1,
          duration: 5,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
        gsap.to(".moving-marker", {
          x: 46,
          y: -50,
          duration: 3,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
        gsap.to(".map-point", {
          scale: 1.35,
          transformOrigin: "center",
          duration: 1.8,
          repeat: -1,
          yoyo: true,
          stagger: 0.4,
          ease: "sine.inOut",
        });
        gsap.utils.toArray(".reveal-group").forEach((section) => {
          gsap.fromTo(section.querySelectorAll(".reveal"), {
            y: 32, opacity: 0,
          }, {
            y: 0,
            opacity: 1,
            clearProps: "opacity,transform",
            stagger: 0.1,
            duration: 0.8,
            scrollTrigger: { trigger: section, start: "top 86%", once: true },
          });
        });
        gsap.from(".route-stop", {
          y: 25,
          opacity: 0,
          stagger: 0.2,
          scrollTrigger: { trigger: ".journey", start: "top 80%", once: true },
        });
        gsap.to(".journey-route", {
          xPercent: 8,
          ease: "none",
          scrollTrigger: {
            trigger: ".journey",
            start: "top bottom",
            end: "bottom top",
            scrub: 1,
          },
        });
        gsap.from(".footer-word", {
          yPercent: 22,
          opacity: 0.2,
          duration: 1,
          scrollTrigger: { trigger: ".landing-footer", start: "top 90%" },
        });
      }, root);
      return () => scope.revert();
    });
    return () => mm.revert();
  }, []);
  return (
    <div className="landing" ref={root}>
      <header className="landing-nav">
        <Logo />
        <nav aria-label="Principal">
          <a href="#producto">Producto</a>
          <a href="#integracion">Integración</a>
          <a href="#planes">Planes</a>
        </nav>
        <a className="nav-login" href={`${appURL}/login`}>
          Iniciar sesión
          <ArrowUpRight size={17} />
        </a>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <h1>
              El mundo,
              <br />
              en tu código.
            </h1>
            <p>
              Direcciones, lugares y enlaces de Google Maps. Conéctalos a tu
              aplicación con una sola API.
            </p>
            <div className="hero-actions">
              <a className="button" href={`${appURL}/signup`}>
                Crea tu API key <ArrowRight size={18} />
              </a>
              <span>
                1.000 peticiones al mes, gratis.
                <br />
                 Sin tarjeta para empezar.
              </span>
            </div>
          </div>
          <div className="map-stage">
            <MapArtwork />
            <div className="map-caption">
              <span>De una dirección a tu próximo proyecto.</span>
              <Navigation size={18} />
            </div>
          </div>
        </section>
        <section className="product-section reveal-group" id="producto">
          <div className="section-intro reveal">
            <h2>
              Encuentra. Ubica.
              <br />
              Construye.
            </h2>
            <p>
              La parte geográfica de tu producto, resuelta. Elige una operación
              y explora su respuesta.
            </p>
          </div>
          <div className="product-grid">
            <div
              className="feature-index reveal"
              role="tablist"
              aria-label="Operaciones de la API"
            >
              {Object.entries(samples).map(([key, sample]) => (
                <button
                  role="tab"
                  aria-selected={selected === key}
                  className={`feature-row ${selected === key ? "selected" : ""}`}
                  onClick={() => setSelected(key)}
                  key={key}
                >
                  <span>{sample.title}</span>
                  <ArrowUpRight size={24} />
                  {selected === key && <p>{sample.description}</p>}
                </button>
              ))}
            </div>
            <div className="reveal sample-stage" key={selected}>
              <CodeSample sample={samples[selected]} />
            </div>
          </div>
        </section>
        <section className="journey reveal-group" id="integracion">
          <div className="section-intro reveal">
            <h2>
              Tu próxima idea
              <br />
              ya tiene dirección.
            </h2>
            <p>
              Una clave para conectar tu proyecto. Un panel para saber
              exactamente cómo lo estás usando.
            </p>
          </div>
          <svg
            className="journey-route"
            viewBox="0 0 1200 200"
            aria-hidden="true"
          >
            <path d="M-100 100H230Q280 100 300 150T390 150H720Q770 150 800 80T900 80H1300" />
          </svg>
          <div className="journey-stops">
            <article className="route-stop">
              <div className="mini-account" data-ui>
                <div className="avatar">T</div>
                <div>
                  <strong>Tu cuenta</strong>
                  <span>Plan Free · Lista para empezar</span>
                </div>
                <Check size={20} />
              </div>
              <h3>Empieza con tu cuenta</h3>
              <p>
                Regístrate gratis. Tu cuota y tus claves pertenecen a tu cuenta,
                no a un dispositivo.
              </p>
            </article>
            <article className="route-stop">
              <div className="mini-key" data-ui>
                <span>Mi aplicación</span>
                <code>mp_live_••••••••••••</code>
                <span className="key-status">Activa</span>
              </div>
              <h3>Conecta con una clave</h3>
              <p>
                Claves por proyecto, permisos por operación y revocación cuando
                lo necesites.
              </p>
            </article>
            <article className="route-stop">
              <div className="mini-usage" data-ui>
                <span>Consumo de ejemplo</span>
                <strong>
                  128 <small>/ 1.000 peticiones</small>
                </strong>
                <div className="mini-meter">
                  <i />
                </div>
              </div>
              <h3>Crece con visibilidad</h3>
              <p>
                Cada petición cuenta. Consulta tu historial y cambia de plan
                desde el mismo lugar.
              </p>
            </article>
          </div>
          <div className="integration-code reveal" data-ui>
            <span>Una cabecera. Tres posibilidades.</span>
            <pre>{`fetch("https://maps-api.nexode.app/v1/search?q=Lima", {\n  headers: { "X-API-Key": "TU_API_KEY" }\n})`}</pre>
            <a href={`${appURL}/app/docs`}>
              Ver documentación <ArrowUpRight size={18} />
            </a>
          </div>
        </section>
        <section className="pricing-section reveal-group" id="planes">
          <div className="section-intro reveal">
            <h2>
              Un plan para
              <br />
              cada recorrido.
            </h2>
            <p>
              Elige por peticiones, sin calcular créditos. Scale elimina la
              cuota mensual.
            </p>
          </div>
          <div className="pricing-grid">
            {plans.length ? (
              plans.map((p) => (
                <article
                  className={`price-column reveal ${p.id === "launch" ? "recommended" : ""}`}
                  key={p.id}
                >
                  <h3>{p.name}</h3>
                  <div className="price">
                    {p.priceCents === 0 ? "Gratis" : `$${p.priceCents / 100}`}
                    <span>
                      {p.priceCents > 0 ? "USD / mes" : "para empezar"}
                    </span>
                  </div>
                  <p className="price-allowance">
                    {p.monthlyLimit === 0
                      ? "Peticiones ilimitadas"
                      : `${number(p.monthlyLimit)} peticiones / mes`}
                  </p>
                  <ul>
                    <li>
                      <Check size={17} />
                      Búsqueda, resolución y geocodificación
                    </li>
                    <li>
                      <Check size={17} />
                      {p.rpm} peticiones por minuto
                    </li>
                    <li>
                      <Check size={17} />
                      Claves con permisos e historial
                    </li>
                    <li>
                      <Check size={17} />
                      {p.id === "free"
                        ? "Sin tarjeta de crédito"
                        : "Suscripción mensual con Stripe"}
                    </li>
                  </ul>
                  <a
                    className={`button ${p.id === "launch" ? "" : "secondary"}`}
                    href={`${appURL}/signup?plan=${p.id}`}
                  >
                    {p.id === "free" ? "Empieza gratis" : `Elige ${p.name}`}
                    <ArrowRight size={17} />
                  </a>
                </article>
              ))
            ) : (
              <p className="notice">
                Los planes se están cargando.{" "}
                <a href={`${appURL}/signup`}>Puedes crear tu cuenta gratis.</a>
              </p>
            )}
          </div>
          <p className="pricing-note reveal">
            Una petición autenticada a la API equivale a una unidad, también
            desde caché o si devuelve un error. Las peticiones rechazadas por
            clave, permisos o cuota no consumen unidades. No hay cargos
            automáticos por excedentes.
          </p>
        </section>
        <section className="faq-section reveal-group" id="preguntas">
          <h2 className="reveal">Antes de partir.</h2>
          <div className="faq-list reveal">
            {[
              [
                "¿Qué significa ilimitado?",
                "Scale no tiene cuota mensual de peticiones. Mantiene un límite de 300 peticiones por minuto y las protecciones de concurrencia del servicio. No significa rendimiento o disponibilidad ilimitados.",
              ],
              [
                "¿De dónde vienen las direcciones?",
                "Mapora consulta Photon con datos de OpenStreetMap y mantiene una caché propia. La cobertura depende de esos datos y del proveedor. No es Google Places ni una verificación física de cada dirección.",
              ],
              [
                "¿Qué sucede al agotar mi cuota?",
                "La API responde con HTTP 429 y no cobra excedentes. Puedes cambiar de plan en facturación o esperar al siguiente período.",
              ],
              [
                "¿Cómo se cobran los planes?",
                "Launch y Scale se cobran en dólares estadounidenses mediante Stripe, cada mes. Puedes gestionar tus facturas, tarjeta y cancelación desde tu panel. El plan de pago se activa al confirmar Stripe el estado de la suscripción.",
              ],
              [
                "¿Puedo cambiar mis claves?",
                "Sí. Puedes crear hasta diez claves activas, elegir sus permisos y revocarlas. La clave completa solo se muestra al crearla.",
              ],
            ].map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <ChevronDown size={20} />
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="closing reveal-group">
          <h2 className="reveal">
            ¿A dónde va
            <br />
            tu próxima idea?
          </h2>
          <a className="button" href={`${appURL}/signup`}>
            Dale un punto de partida <ArrowRight size={18} />
          </a>
        </section>
      </main>
      <footer className="landing-footer">
        <div className="footer-word" aria-hidden="true">
          mapora<span>.</span>
        </div>
        <div className="footer-links">
          <Logo />
          <a href={`${appURL}/app/docs`}>Documentación</a>
          <a href={`${appURL}/login`}>Mi cuenta</a>
          <a href="/legal">Condiciones y privacidad</a>
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
          >
            © OpenStreetMap contributors
          </a>
        </div>
        <div className="footer-bottom">
          <span>Mapora © {new Date().getFullYear()}</span>
          <span>Encuentra tu próximo punto.</span>
        </div>
      </footer>
    </div>
  );
}
