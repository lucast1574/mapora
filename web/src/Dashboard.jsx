import React, { useState, lazy, Suspense } from "react";
import {
  LayoutDashboard,
  KeyRound,
  ChartNoAxesCombined,
  CreditCard,
  BookOpen,
  UserRound,
  Users,
  Settings2,
  Menu,
  X,
  ArrowUpRight,
  MapPinned,
  Compass,
  Fence,
  FileSpreadsheet,
} from "lucide-react";
import { Logo, Notice } from "./ui";
import Avatar from "./Avatar";
import { useData } from "./useData";
import { Overview, Usage } from "./pages/Usage";
import Keys from "./pages/Keys";
import Billing from "./pages/Billing";
import Profile from "./pages/Profile";
import Docs from "./pages/Docs";
import Admin from "./pages/Admin";
import Maps from "./pages/Maps";
const Explore = lazy(() => import("./pages/Explore"));
const Coverage = lazy(() => import("./pages/Coverage"));
const Batch = lazy(() => import("./pages/Batch"));
import { siteURL } from "./client";
const links = [
  ["", "Resumen", LayoutDashboard],
  ["keys", "API keys", KeyRound],
  ["explore", "Explorar", Compass],
  ["maps", "Mapas", MapPinned],
  ["coverage", "Zonas de cobertura", Fence],
  ["batch", "Importar direcciones", FileSpreadsheet],
  ["usage", "Consumo", ChartNoAxesCombined],
  ["billing", "Plan y facturación", CreditCard],
  ["docs", "Documentación", BookOpen],
];
export default function Dashboard() {
  const { data: user, error, setData: setUser } = useData("/console/session");
  const [menu, setMenu] = useState(false);
  const page = location.pathname.split("/")[2] || "";
  if (!user)
    return (
      <div className="page-loading">
        <Logo />
        <Notice error>{error}</Notice>
        <p>Cargando tu cuenta…</p>
      </div>
    );
  const items = [
    ...links,
    ...(user.role === "admin" ? [["admin", "Administración", Users]] : []),
  ];
  return (
    <div className="app-frame">
      <aside className={`sidebar ${menu ? "is-open" : ""}`}>
        <div className="sidebar-brand">
          <Logo />
          <button
            className="icon-button mobile-only"
            aria-label="Cerrar navegación"
            onClick={() => setMenu(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace">
          <Avatar name={user.name} src={user.avatarUrl} />
          <div>
            <strong>{user.name}</strong>
            <span>
              {user.role === "admin" ? "Administración" : "Cuenta personal"}
            </span>
          </div>
        </div>
        <nav aria-label="Panel">
          {items.map(([path, label, Icon]) => (
            <a
              href={`/app${path ? "/" + path : ""}`}
              className={page === path ? "active" : ""}
              key={path}
              aria-current={page === path ? "page" : undefined}
            >
              <Icon size={18} />
              {label}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <a href="/app/profile" className={page === "profile" ? "active" : ""}>
            <UserRound size={18} />
            Mi perfil
          </a>
          <a href={siteURL || "/"} target="_blank" rel="noreferrer">
            Sitio de Mapora
            <ArrowUpRight size={15} />
          </a>
        </div>
      </aside>
      {menu && (
        <button
          className="nav-backdrop"
          aria-label="Cerrar menú"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="app-body">
        <header className="app-topbar">
          <button
            className="icon-button mobile-only"
            onClick={() => setMenu(true)}
            aria-label="Abrir navegación"
          >
            <Menu size={20} />
          </button>
          <span>
            Mapora <span className="slash">/</span>{" "}
            {items.find((v) => v[0] === page)?.[1] ||
              (page === "profile" ? "Mi perfil" : "Panel")}
          </span>
          <a href="/app/profile" className="account-shortcut">
            <span>{user.name}</span>
            <Avatar name={user.name} src={user.avatarUrl} small />
          </a>
        </header>
        <main className="app-sheet">
          <Suspense fallback={<div role="status">Cargando herramienta…</div>}>
            {page === "explore" ? (
              <Explore />
            ) : page === "coverage" ? (
              <Coverage />
            ) : page === "batch" ? (
              <Batch />
            ) : page === "keys" ? (
              <Keys />
            ) : page === "maps" ? (
              <Maps />
            ) : page === "usage" ? (
              <Usage />
            ) : page === "billing" ? (
              <Billing />
            ) : page === "profile" ? (
              <Profile user={user} onUpdate={setUser} />
            ) : page === "docs" ? (
              <Docs />
            ) : page === "admin" && user.role === "admin" ? (
              <Admin />
            ) : (
              <Overview user={user} />
            )}
          </Suspense>
        </main>
        <div className="app-footnote">
          Mapora · Datos geográficos de{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
          >
            OpenStreetMap
          </a> · <a href="/service-status">Estado del servicio</a>
        </div>
      </div>
    </div>
  );
}
