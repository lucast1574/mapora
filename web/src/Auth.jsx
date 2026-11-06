import React, { useState } from "react";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { Logo, Button, Notice } from "./ui";
import { api, siteURL } from "./client";
export default function Auth() {
  const mode = location.pathname.slice(1);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const resetToken = new URLSearchParams(location.search).get("token") || "";
  const title =
    {
      login: "Vuelve a tu punto.",
      signup: "Tu próximo punto.",
      forgot: "Retoma el camino.",
      reset: "Una nueva contraseña.",
    }[mode] || "Accede a Mapora";
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const f = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (mode === "signup") {
        await api("/console/signup", "POST", {
          name: f.name,
          email: f.email,
          password: f.password,
        });
        location.assign("/app/keys");
      } else if (mode === "login") {
        await api("/console/login", "POST", {
          email: f.email,
          password: f.password,
        });
        location.assign("/app");
      } else if (mode === "forgot") {
        const v = await api("/console/forgot", "POST", { email: f.email });
        setMessage(v.message);
      } else {
        await api("/console/reset", "POST", {
          token: resetToken,
          password: f.password,
        });
        history.replaceState(null, "", "/reset");
        setMessage("Contraseña actualizada. Ya puedes iniciar sesión.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-brand">
        <Logo />
        <a href={siteURL || "/"}>
          <ArrowLeft size={16} />
          Volver a Mapora
        </a>
      </div>
      <main className="auth-main">
        <div className="auth-form-wrap">
          <h1>{title}</h1>
          <p>
            {mode === "signup"
              ? "1.000 peticiones al mes para empezar. Sin tarjeta."
              : mode === "forgot"
                ? "Te enviaremos un enlace para definir una contraseña nueva."
                : "Tus claves, tu consumo y tu próxima integración."}
          </p>
          <Notice error>{error}</Notice>
          <Notice>{message}</Notice>
          <form onSubmit={submit}>
            {mode === "signup" && (
              <label>
                Tu nombre
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={100}
                  autoComplete="name"
                  placeholder="¿Cómo te llamas?"
                />
              </label>
            )}
            {mode !== "reset" && (
              <label>
                Correo electrónico
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="tu@empresa.com"
                />
              </label>
            )}
            {mode !== "forgot" && (
              <label>
                {mode === "reset" ? "Nueva contraseña" : "Contraseña"}
                <input
                  name="password"
                  type="password"
                  required
                  minLength={mode === "login" ? 1 : 12}
                  maxLength={72}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  placeholder={
                    mode === "login"
                      ? "Tu contraseña"
                      : "Al menos 12 caracteres"
                  }
                />
              </label>
            )}
            <Button busy={busy}>
              {mode === "signup"
                ? "Crear cuenta"
                : mode === "login"
                  ? "Iniciar sesión"
                  : mode === "forgot"
                    ? "Enviar enlace"
                    : "Guardar contraseña"}
              <ArrowRight size={17} />
            </Button>
          </form>
          <div className="auth-links">
            {mode === "login" ? (
              <>
                <a href="/forgot">Olvidé mi contraseña</a>
                <span>
                  ¿Primera vez? <a href="/signup">Crea tu cuenta</a>
                </span>
              </>
            ) : (
              <a href="/login">Ya tengo cuenta. Iniciar sesión</a>
            )}
          </div>
          <p className="auth-legal">
            Al crear una cuenta aceptas las{" "}
            <a href={`${siteURL}/legal`}>
              condiciones de servicio y privacidad
            </a>
            .
          </p>
        </div>
        <aside className="auth-art">
          <svg viewBox="0 0 500 600" aria-hidden="true">
            <path d="M-40 450H160Q230 450 230 370V240Q230 160 310 160H550" />
            <path d="M-40 200H80Q130 200 130 260V490Q130 550 190 550H550" />
            <circle cx="230" cy="330" r="22" />
            <circle cx="310" cy="160" r="12" />
          </svg>
          <div>
            <span>Una dirección es un comienzo.</span>
            <strong>
              Haz que
              <br />
              llegue más lejos.
            </strong>
          </div>
        </aside>
      </main>
    </div>
  );
}
