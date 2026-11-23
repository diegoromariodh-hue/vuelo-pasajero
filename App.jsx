import logoVuelo from "./logoVuelo.png";
import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  ArrowRight,
  Bell,
  Bike,
  Car,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  LogOut,
  MapPin,
  MessageCircle,
  Navigation,
  PhoneCall,
  RefreshCcw,
  Share2,
  ShieldCheck,
  Star,
  User,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import "./App.css";

const LOGO_URL = logoVuelo;
const SUPPORT_EMAIL = "soporte@vuelonicaragua.online";
const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;

const ACTIVE_RIDE_STATUSES = [
  "searching",
  "negotiating",
  "confirmed",
  "driver_on_way",
  "driver_arrived",
  "in_progress",
];

function firstName(name) {
  return name?.trim()?.split(" ")?.[0] || "Conductor";
}

function formatDateTime(value) {
  if (!value) return "Lo antes posible";
  return new Date(value).toLocaleString("es-NI", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusLabel(status) {
  const labels = {
    searching: "Buscando conductor",
    negotiating: "Recibiendo ofertas",
    confirmed: "Viaje confirmado",
    driver_on_way: "Conductor en camino",
    driver_arrived: "Conductor llegó",
    in_progress: "Viaje iniciado",
    completed: "Viaje finalizado",
    cancelled: "Cancelado",
  };
  return labels[status] || status;
}

function isOfferExpired(offer) {
  if (!offer?.expires_at) return false;
  return new Date(offer.expires_at).getTime() < Date.now();
}

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [settings, setSettings] = useState(null);
  const [adCard, setAdCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(window.location.pathname === "/reset-password" ? "reset-password" : "home");
  const [toast, setToast] = useState("");

  useEffect(() => {
    init();

    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (_event === "PASSWORD_RECOVERY") setView("reset-password");
      if (newSession?.user) loadProfile(newSession.user.id);
      else setProfile(null);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  async function init() {
    setLoading(true);

    const { data } = await supabase.auth.getSession();
    setSession(data.session);

    await loadSettings();
    await loadActiveAd();

    if (data.session?.user) {
      await loadProfile(data.session.user.id);
    }

    setLoading(false);
  }

  async function loadSettings() {
    const { data } = await supabase
      .from("platform_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    setSettings(data || null);
  }

  async function loadActiveAd() {
    const { data } = await supabase
      .from("platform_ads")
      .select("sponsor_name,title,description,image_url,cta_text,cta_url")
      .eq("is_active", true)
      .eq("placement", "passenger_home")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setAdCard(data || null);
  }

  async function loadProfile(userId) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone, vuelo_id, rating, city, is_active, avatar_url")
      .eq("id", userId)
      .single();

    setProfile(data || null);
  }

  function notify(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3200);
  }

  if (loading) return <Loading />;

  if (view === "reset-password") return <ResetPasswordScreen />;

  if (!session) return <AuthScreen />;

  if (profile?.is_active === false) {
    return (
      <div className="center-screen">
        <div className="blocked-card">
          <img src={LOGO_URL} alt="Vuelo" />
          <h1>Cuenta temporalmente desactivada</h1>
          <p>Por seguridad, esta cuenta no puede usar Vuelo en este momento. Puedes contactar a soporte para más información.</p>
          <button onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {toast && <div className="toast" role="status">✅ {toast}</div>}

      <header className="topbar">
        <div className="brand">
          <img src={LOGO_URL} alt="Vuelo" />
          <div>
            <strong>Vuelo</strong>
            <span>Pasajero</span>
          </div>
        </div>

        <button className="icon-btn" onClick={() => supabase.auth.signOut()}>
          <LogOut size={19} />
        </button>
      </header>

      <main>
        {view === "home" && (
          <Home
            profile={profile}
            settings={settings}
            adCard={adCard}
            goRequest={() => setView("request")}
            goOffers={() => setView("offers")}
            notify={notify}
          />
        )}

        {view === "request" && (
          <RequestRide
            profile={profile}
            notify={notify}
            onCreated={() => setView("offers")}
          />
        )}

        {view === "offers" && <Offers notify={notify} />}
        {view === "history" && <History notify={notify} />}
        {view === "profile" && <Profile profile={profile} />}
      </main>

      <nav className="bottom-nav" aria-label="Navegación de pasajero">
        <button className={view === "home" ? "active" : ""} aria-current={view === "home" ? "page" : undefined} onClick={() => setView("home")}>
          <MapPin size={20} /> Inicio
        </button>
        <button className={view === "request" ? "active" : ""} aria-current={view === "request" ? "page" : undefined} onClick={() => setView("request")}>
          <Navigation size={20} /> Viaje
        </button>
        <button className={view === "offers" ? "active" : ""} aria-current={view === "offers" ? "page" : undefined} onClick={() => setView("offers")}>
          <Wallet size={20} /> Ofertas
        </button>
        <button className={view === "history" ? "active" : ""} aria-current={view === "history" ? "page" : undefined} onClick={() => setView("history")}>
          <Clock size={20} /> Historial
        </button>
        <button className={view === "profile" ? "active" : ""} aria-current={view === "profile" ? "page" : undefined} onClick={() => setView("profile")}>
          <User size={20} /> Perfil
        </button>
      </nav>
    </div>
  );
}

function Loading() {
  return (
    <div className="center-screen">
      <RefreshCcw className="spin" />
      <p>Cargando Vuelo...</p>
    </div>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState("login");
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSending(true);
    setMsg("");

    const cleanEmail = email.trim().toLowerCase();

    if (mode === "register") {
      if (!acceptTerms) {
        setMsg("Debes aceptar los Términos y Condiciones para crear tu cuenta.");
        setSending(false);
        return;
      }

      if (whatsapp.trim().length < 8) {
        setMsg("Ingresa un número de WhatsApp activo y válido.");
        setSending(false);
        return;
      }

      const { error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: whatsapp.trim(),
            role: "passenger",
            accepted_terms: true,
            accepted_terms_at: new Date().toISOString(),
          },
        },
      });

      if (error) setMsg(error.message);
      else setMsg("Registro creado. Revisa tu correo para verificar tu cuenta.");
    } else if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(
        recoveryEmail.trim().toLowerCase(),
        { redirectTo: `${APP_URL}/reset-password` }
      );

      if (error) setMsg(error.message);
      else setMsg("Si existe una cuenta asociada a este correo, te enviaremos instrucciones para restablecer tu contraseña.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (error) setMsg(error.message);
    }

    setSending(false);
  }

  return (
    <div className="auth-screen">
      {showTerms && <PassengerTermsModal close={() => setShowTerms(false)} />}
      <form className="auth-card" onSubmit={submit}>
        <img src={LOGO_URL} alt="Vuelo" />
        <h1>
          {mode === "login"
            ? "Bienvenido a Vuelo"
            : mode === "register"
            ? "Crear cuenta"
            : "Recuperar contraseña"}
        </h1>

        <p>
          {mode === "forgot"
            ? "Escribe tu correo y te enviaremos instrucciones para restablecer tu contraseña."
            : "Muévete por Ometepe en vehículo o motocicleta, negocia tu tarifa y confirma tu viaje con confianza."}
        </p>

        {msg && <div className="message">{msg}</div>}

        {mode === "register" && (
          <>
            <label>Nombre completo</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />

            <label>Número de WhatsApp activo</label>
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="Ej: 50588888888"
              required
            />

            <label className="terms-check passenger-terms-check">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                required
              />
              <span>
                He leído y acepto los{" "}
                <button type="button" className="terms-link" onClick={() => setShowTerms(true)}>
                  Términos y Condiciones
                </button>
                {" "}de Vuelo.
              </span>
            </label>

            <div className="support-note verify-note">
              🔒 Para proteger a nuestra comunidad, Vuelo podrá contactarte por WhatsApp o correo electrónico
              para verificar usuarios reales y prevenir el uso indebido de la plataforma.
            </div>
          </>
        )}

        {mode === "forgot" ? (
          <>
            <label>Correo electrónico</label>
            <input
              type="email"
              value={recoveryEmail}
              onChange={(e) => setRecoveryEmail(e.target.value)}
              required
            />

            <div className="support-note">
              ¿No tienes acceso a tu correo? Escríbenos a{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> para ayudarte a recuperar tu cuenta de forma segura.
            </div>
          </>
        ) : (
          <>
            <label>Correo electrónico</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

            <label>Contraseña</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </>
        )}

        <button disabled={sending || (mode === "register" && !acceptTerms)}>
          {sending
            ? "Procesando..."
            : mode === "login"
            ? "Ingresar"
            : mode === "register"
            ? "Registrarme"
            : "Enviar correo de recuperación"}
        </button>

        {mode === "login" && (
          <button type="button" className="link-btn" onClick={() => setMode("forgot")}>
            ¿Olvidaste tu contraseña?
          </button>
        )}

        <button
          type="button"
          className="link-btn"
          onClick={() => {
            setMsg("");
            setAcceptTerms(false);
            setMode(mode === "login" ? "register" : "login");
          }}
        >
          {mode === "login" ? "Crear cuenta nueva" : "Volver a iniciar sesión"}
        </button>
      </form>
    </div>
  );
}


function PassengerTermsModal({ close }) {
  return (
    <div className="terms-overlay">
      <div className="terms-modal">
        <button className="terms-close" type="button" onClick={close}>
          <X size={20} />
        </button>

        <img src={LOGO_URL} alt="Vuelo" />
        <span className="terms-eyebrow">Términos y Condiciones</span>
        <h1>Uso de Vuelo para pasajeros</h1>
        <p className="terms-updated">Última actualización: junio 2026</p>

        <div className="terms-block">
          <h2>1. Naturaleza de la plataforma</h2>
          <p>
            Vuelo es una plataforma tecnológica que permite a conductores independientes ofrecer servicios
            de transporte y a usuarios encontrar opciones de movilidad disponibles. Vuelo no presta directamente
            servicios de transporte, no opera vehículos y no emplea conductores.
          </p>
        </div>

        <div className="terms-block">
          <h2>2. Relación entre usuario y conductor</h2>
          <p>
            Cada viaje es acordado directamente entre el usuario y el conductor. La aceptación del viaje,
            la tarifa, el punto de recogida, el destino y la prestación del servicio son responsabilidad
            de las partes directamente involucradas.
          </p>
        </div>

        <div className="terms-block">
          <h2>3. Tarifas y pagos</h2>
          <p>
            Las tarifas son propuestas, negociadas o aceptadas entre pasajero y conductor antes de confirmar
            el viaje. Los pagos se realizan directamente entre ambas partes, principalmente en efectivo.
            Durante esta etapa, Vuelo no administra, retiene ni procesa pagos de los viajes.
          </p>
        </div>

        <div className="terms-block">
          <h2>4. Verificación de usuarios reales</h2>
          <p>
            Para proteger a la comunidad, Vuelo podrá contactar a los usuarios por WhatsApp o correo electrónico
            para validar información, verificar autenticidad de la cuenta, prevenir fraudes o evitar el uso indebido
            de la plataforma.
          </p>
        </div>

        <div className="terms-block">
          <h2>5. Seguridad e incidentes</h2>
          <p>
            En caso de accidentes, incidentes, conflictos o situaciones ocurridas durante un viaje, la responsabilidad
            corresponderá a las partes directamente involucradas, conforme a la legislación aplicable en Nicaragua.
            Vuelo podrá colaborar con las autoridades competentes cuando sea necesario.
          </p>
        </div>

        <div className="terms-block">
          <h2>6. Conducta del usuario</h2>
          <p>
            No se permite lenguaje ofensivo, amenazas, acoso, fraude, discriminación, solicitudes falsas,
            uso indebido de la plataforma o cualquier comportamiento que afecte la seguridad de conductores,
            pasajeros o la comunidad.
          </p>
        </div>

        <div className="terms-block">
          <h2>7. Cancelaciones, retrasos y disponibilidad</h2>
          <p>
            Vuelo no garantiza disponibilidad permanente de conductores ni tiempos exactos de respuesta.
            La plataforma no será responsable por retrasos, cancelaciones, clima, cierres de vía, fallas técnicas,
            falta de conectividad o situaciones fuera de su control.
          </p>
        </div>

        <div className="terms-block">
          <h2>8. Objetos personales</h2>
          <p>
            Vuelo no será responsable por pérdida, daño u olvido de objetos personales durante los viajes.
            La plataforma podrá facilitar reportes internos, sin garantizar la recuperación de artículos.
          </p>
        </div>

        <div className="terms-block">
          <h2>9. Suspensión de cuentas</h2>
          <p>
            Vuelo podrá suspender, restringir o desactivar cuentas que incumplan estas condiciones,
            representen un riesgo para la comunidad, utilicen información falsa o hagan uso fraudulento
            o indebido de la plataforma.
          </p>
        </div>

        <div className="terms-block">
          <h2>10. Soporte</h2>
          <p>
            El canal oficial de soporte es <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
            Para emergencias, el usuario debe comunicarse directamente con las autoridades correspondientes.
          </p>
        </div>

        <button className="terms-accept-btn" type="button" onClick={close}>
          Entendido
        </button>
      </div>
    </div>
  );
}

function ResetPasswordScreen() {
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);

  async function updatePassword(e) {
    e.preventDefault();
    setMsg("");

    if (password.length < 6) {
      setMsg("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (password !== password2) {
      setMsg("Las contraseñas no coinciden.");
      return;
    }

    setSending(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMsg(error.message);
    } else {
      setMsg("Contraseña actualizada. Ya puedes iniciar sesión con tu nueva contraseña.");
      setTimeout(async () => {
        await supabase.auth.signOut();
        window.history.replaceState({}, "", "/");
        window.location.reload();
      }, 1800);
    }

    setSending(false);
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={updatePassword}>
        <img src={LOGO_URL} alt="Vuelo" />
        <h1>Nueva contraseña</h1>
        <p>Ingresa una nueva contraseña para recuperar el acceso a tu cuenta de Vuelo.</p>

        {msg && <div className="message">{msg}</div>}

        <label>Nueva contraseña</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />

        <label>Confirmar contraseña</label>
        <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} required />

        <button disabled={sending}>
          {sending ? "Actualizando..." : "Actualizar contraseña"}
        </button>

        <div className="support-note">
          ¿Necesitas ayuda? Escríbenos a{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </div>
      </form>
    </div>
  );
}

function Home({ profile, settings, adCard, goRequest, goOffers, notify }) {
  const firstName = profile?.full_name?.split(" ")[0] || "Pasajero";

  async function shareApp() {
    const shareData = {
      title: "Vuelo Nicaragua",
      text: "Prueba Vuelo para moverte en Ometepe.",
      url: APP_URL,
    };

    if (navigator.share) {
      await navigator.share(shareData);
      return;
    }

    await navigator.clipboard.writeText(APP_URL);
    notify("Enlace de la app copiado.");
  }

  return (
    <section className="page">
      <div className="welcome-card">
        <div>
          <span>Hola {firstName}</span>
          <h1>¿A dónde vamos hoy?</h1>
          <p>Solicita un viaje en Ometepe, elige vehículo o motocicleta y negocia una tarifa justa.</p>
        </div>
        <button onClick={goRequest}>
          Solicitar viaje <ArrowRight size={18} />
        </button>
      </div>

      <InstallReminder notify={notify} />

      <div className="emergency-card">
        <h3>Reportes y emergencias</h3>
        <p>
          Para reportes de la app escribe a <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          En una emergencia llama directamente a las autoridades.
        </p>
        <div className="emergency-actions">
          <a href="tel:118"><PhoneCall size={18} /> Policía Nacional 118</a>
          <a href="tel:115"><PhoneCall size={18} /> Bomberos 115</a>
        </div>
      </div>

      <div className="share-card">
        <div>
          <h3>Comparte Vuelo</h3>
          <p>Invita a otras personas a usar la app y ayúdanos a crecer en Ometepe.</p>
        </div>
        <button onClick={shareApp}><Share2 size={18} /> Compartir app</button>
      </div>

      <div className="commission-card">
        <div className="icon"><ShieldCheck /></div>
        <div>
          <h2>0% de comisión en lanzamiento</h2>
          <p>
            {settings?.passenger_message ||
              "Los pasajeros pagan únicamente el precio acordado con el conductor. Vuelo no añade cargos adicionales."}
          </p>
        </div>
      </div>

      {settings?.community_message && (
        <div className="community-card">
          <h3>Hecho en Ometepe, para Ometepe</h3>
          <p>{settings.community_message}</p>
        </div>
      )}

      {adCard ? (
        <a className="ad-card" href={adCard.cta_url || "#"} target="_blank" rel="noreferrer">
          {adCard.image_url && <img src={adCard.image_url} alt={adCard.title} />}
          <div>
            <span>{adCard.sponsor_name ? `Publicidad · ${adCard.sponsor_name}` : "Publicidad"}</span>
            <h3>{adCard.title}</h3>
            <p>{adCard.description}</p>
            <strong>{adCard.cta_text || "Ver más"} <ExternalLink size={15} /></strong>
          </div>
        </a>
      ) : (
        <div className="ad-placeholder">
          <span>Espacio publicitario disponible</span>
          <h3>Tu negocio puede aparecer aquí</h3>
          <p>Este espacio está reservado para negocios locales, hoteles, restaurantes, tours o servicios de Ometepe.</p>
        </div>
      )}

      <div className="quick-grid">
        <InfoCard icon={<Car />} title="Vehículo" text="Ideal para equipaje, familias o viajes cómodos." />
        <InfoCard icon={<Bike />} title="Motocicleta" text="Rápido y práctico para moverte dentro de la isla." />
        <InfoCard icon={<MessageCircle />} title="Chat interno" text="Próximamente: comunícate sin compartir tu número." />
        <InfoCard icon={<Clock />} title="Historial" text="Consulta y valora tus viajes finalizados." />
      </div>
    </section>
  );
}

function InstallReminder({ notify }) {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;

    const dismissedAt = Number(localStorage.getItem("vuelo_install_dismissed") || 0);
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const dismissedRecently = dismissedAt && Date.now() - dismissedAt < sevenDays;

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    if (!standalone && !dismissedRecently) setShow(true);

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!standalone && !dismissedRecently) setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function installNow() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setShow(false);
        notify("Vuelo se está instalando en tu pantalla de inicio.");
      }
      setDeferredPrompt(null);
      return;
    }

    if (isIOS) {
      notify("En iPhone: toca Compartir y luego Agregar a pantalla de inicio.");
    } else {
      notify("Abre el menú del navegador y toca Agregar a pantalla de inicio.");
    }
  }

  function dismiss() {
    localStorage.setItem("vuelo_install_dismissed", String(Date.now()));
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="install-card">
      <button className="install-close" onClick={dismiss}>
        <X size={16} />
      </button>

      <div className="install-icon">
        <Download size={24} />
      </div>

      <div>
        <h3>Instala Vuelo</h3>
        <p>
          Agrega Vuelo a tu pantalla de inicio para acceder más rápido y recibir notificaciones importantes sobre tus viajes.
        </p>
        {isIOS && (
          <small>
            En iPhone: toca <Share2 size={13} /> Compartir → Agregar a pantalla de inicio.
          </small>
        )}

        <div className="install-actions">
          <button onClick={installNow}>Instalar ahora</button>
          <button className="later" onClick={dismiss}>Más tarde</button>
        </div>
      </div>
    </div>
  );
}

function RequestRide({ profile, notify, onCreated }) {
  const [form, setForm] = useState({
    pickup_municipality: "Altagracia",
    pickup_address: "",
    pickup_reference: "",
    pickup_lat: null,
    pickup_lng: null,
    destination_municipality: "Moyogalpa",
    destination_address: "",
    destination_reference: "",
    vehicle_type_requested: "car",
    passenger_count: "",
    ride_mode: "immediate",
    requested_departure_at: "",
    passenger_offer: "",
    passenger_notes: "",
  });

  const [gettingGps, setGettingGps] = useState(false);
  const [sending, setSending] = useState(false);

  const hasLocationInput = useMemo(() => {
    return (
      form.pickup_address.trim() !== "" ||
      form.destination_address.trim() !== "" ||
      form.pickup_lat !== null
    );
  }, [form.pickup_address, form.destination_address, form.pickup_lat]);

  const isOmetepe = ["Altagracia", "Moyogalpa"].includes(form.pickup_municipality)
    && ["Altagracia", "Moyogalpa"].includes(form.destination_municipality);

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function useGPS() {
    setGettingGps(true);

    if (!navigator.geolocation) {
      alert("Tu navegador no permite usar GPS.");
      setGettingGps(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { data: covered, error } = await supabase.rpc("vuelo_in_ometepe", {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        if (error || !covered) {
          setForm((prev) => ({ ...prev, pickup_lat: null, pickup_lng: null }));
          setGettingGps(false);
          notify(error ? "No pudimos verificar el GPS. Podés indicar una dirección en Ometepe." : "Este punto GPS está fuera de Ometepe. Indicá una dirección dentro de la isla.");
          return;
        }
        setForm((prev) => ({
          ...prev,
          pickup_lat: pos.coords.latitude,
          pickup_lng: pos.coords.longitude,
        }));
        setGettingGps(false);
        notify("Ubicación GPS agregada correctamente. Ahora escribe la dirección completa y referencia.");
      },
      () => {
        setGettingGps(false);
        alert("No se pudo obtener tu ubicación. Puedes escribir la referencia manualmente.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function getDepartureInfo() {
    const now = new Date();

    if (form.ride_mode === "immediate") {
      const immediateTime = new Date(now.getTime() + 35 * 60 * 1000);
      return {
        ok: true,
        value: immediateTime.toISOString(),
        label: "Viaje inmediato"
      };
    }

    if (!form.requested_departure_at) {
      return {
        ok: false,
        message: "Selecciona la hora de salida para tu viaje programado."
      };
    }

    const selected = new Date(form.requested_departure_at);
    const diffMinutes = (selected.getTime() - now.getTime()) / 60000;

    if (diffMinutes < 120) {
      return {
        ok: false,
        message: "El viaje programado debe ser al menos 2 horas después de la hora actual."
      };
    }

    if (diffMinutes > 17 * 60) {
      return {
        ok: false,
        message: "Solo puedes programar viajes con menos de 17 horas de anticipación."
      };
    }

    return {
      ok: true,
      value: selected.toISOString(),
      label: "Viaje programado"
    };
  }

  async function submit(e) {
    e.preventDefault();

    if (gettingGps) return;

    if (!hasLocationInput || !isOmetepe) {
      alert("Lo sentimos. Aún no contamos con conductores disponibles en esta zona. Gracias por confiar en Vuelo. Estamos construyendo esta plataforma junto a nuestra comunidad para llegar cada vez a más personas.");
      return;
    }

    if (!form.pickup_address.trim() || !form.pickup_reference.trim()) {
      alert("Aunque uses GPS, debes escribir la dirección completa y una referencia del punto de recogida.");
      return;
    }

    if (!form.destination_reference.trim()) {
      alert("Agrega una referencia del punto donde quieres ir para ayudar al conductor.");
      return;
    }

    if (form.vehicle_type_requested === "car" && !form.passenger_count) {
      alert("Indica cuántas personas van en el vehículo.");
      return;
    }

    const departure = getDepartureInfo();

    if (!departure.ok) {
      alert(departure.message);
      return;
    }

    setSending(true);

    const { data: activeRide } = await supabase
      .from("rides")
      .select("id,status")
      .eq("passenger_id", profile.id)
      .in("status", ACTIVE_RIDE_STATUSES)
      .maybeSingle();

    if (activeRide) {
      setSending(false);
      notify("Ya tienes un viaje activo. Cancela o finaliza ese viaje antes de solicitar otro.");
      onCreated();
      return;
    }

    const passengerInfo =
      form.vehicle_type_requested === "car" && form.passenger_count
        ? `Personas en vehículo: ${form.passenger_count}. `
        : "";

    const { error } = await supabase.from("rides").insert([
      {
        passenger_id: profile.id,
        vehicle_type_requested: form.vehicle_type_requested,
        pickup_address: `${form.pickup_municipality}, ${form.pickup_address}`,
        pickup_lat: form.pickup_lat,
        pickup_lng: form.pickup_lng,
        destination_address: `${form.destination_municipality}, ${form.destination_address}`,
        destination_reference: form.destination_reference || null,
        requested_departure_at: departure.value,
        passenger_count: form.vehicle_type_requested === "car" ? Number(form.passenger_count) : null,
        passenger_offer: Number(form.passenger_offer),
        passenger_notes: `${form.pickup_reference ? "Referencia de recogida: " + form.pickup_reference + ". " : ""}${passengerInfo}${departure.label ? "Tipo: " + departure.label + ". " : ""}${form.passenger_notes || ""}`,
        status: "searching",
      },
    ]);

    setSending(false);

    if (error?.code === "23505" && error.message.includes("vuelo_one_active_ride_per_passenger")) {
      notify("Ya tenés una solicitud activa. Revisala antes de pedir otro viaje.");
      onCreated();
    } else if (error) {
      alert(error.message);
    } else {
      notify("Solicitud de viaje creada. Estamos buscando conductores.");
      onCreated();
    }
  }

  const canSubmit =
    hasLocationInput &&
    isOmetepe &&
    form.pickup_address.trim() &&
    form.pickup_reference.trim() &&
    form.destination_address.trim() &&
    form.destination_reference.trim() &&
    form.passenger_offer &&
    (form.vehicle_type_requested !== "car" || form.passenger_count) &&
    (form.ride_mode === "immediate" || form.requested_departure_at);

  return (
    <section className="page">
      <div className="section-title">
        <h1>Solicitar viaje</h1>
        <p>Usa GPS si quieres, pero siempre escribe dirección completa y referencias para ayudar al conductor.</p>
      </div>

      <form className="ride-form" onSubmit={submit}>
        <button type="button" className="gps-btn" onClick={useGPS} disabled={gettingGps}>
          <Navigation size={18} />
          {gettingGps ? "Obteniendo ubicación..." : "Usar mi ubicación actual"}
        </button>

        {form.pickup_lat && (
          <div className="gps-ok">
            GPS agregado: {form.pickup_lat.toFixed(5)}, {form.pickup_lng.toFixed(5)}. Es obligatorio escribir dirección completa y referencia.
          </div>
        )}

        <p>Viajes dentro de Ometepe. <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a></p>
        <label>Municipio de recogida</label>
        <select
          value={form.pickup_municipality}
          onChange={(e) => setField("pickup_municipality", e.target.value)}
          required
        >
          <option value="Altagracia">Altagracia</option>
          <option value="Moyogalpa">Moyogalpa</option>
        </select>

        <label>Dirección completa de recogida</label>
        <input
          value={form.pickup_address}
          onChange={(e) => setField("pickup_address", e.target.value)}
          placeholder="Ej: Urbaite, del instituto 200 metros al norte..."
          required
        />

        <label>Referencia obligatoria de recogida</label>
        <input
          value={form.pickup_reference}
          onChange={(e) => setField("pickup_reference", e.target.value)}
          placeholder="Ej: Frente a la iglesia, casa verde, camisa azul..."
          required
        />

        <label>Municipio del destino</label>
        <select
          value={form.destination_municipality}
          onChange={(e) => setField("destination_municipality", e.target.value)}
          required
        >
          <option value="Altagracia">Altagracia</option>
          <option value="Moyogalpa">Moyogalpa</option>
        </select>

        <label>Destino</label>
        <input
          value={form.destination_address}
          onChange={(e) => setField("destination_address", e.target.value)}
          placeholder="Ej: Del parque de Moyogalpa, 20 metros al oeste..."
          required
        />

        <label>Referencia del destino</label>
        <input
          value={form.destination_reference}
          onChange={(e) => setField("destination_reference", e.target.value)}
          placeholder="Ej: entrada principal, recepción, frente al restaurante..."
          required
        />

        <label>Hora de salida</label>
        <div className="transport-toggle">
          <button
            type="button"
            className={form.ride_mode === "immediate" ? "selected" : ""}
            onClick={() => {
              setField("ride_mode", "immediate");
              setField("requested_departure_at", "");
            }}
          >
            Viaje inmediato
          </button>
          <button
            type="button"
            className={form.ride_mode === "scheduled" ? "selected" : ""}
            onClick={() => setField("ride_mode", "scheduled")}
          >
            Programar
          </button>
        </div>

        {form.ride_mode === "immediate" && (
          <div className="gps-ok">
            Tu solicitud será para salir lo antes posible. Usaremos un margen aproximado de 35 minutos.
          </div>
        )}

        {form.ride_mode === "scheduled" && (
          <>
            <input
              type="datetime-local"
              value={form.requested_departure_at}
              min={new Date(Date.now() + 120 * 60 * 1000).toISOString().slice(0, 16)}
              max={new Date(Date.now() + 17 * 60 * 60 * 1000).toISOString().slice(0, 16)}
              onChange={(e) => setField("requested_departure_at", e.target.value)}
              required
            />
            <div className="gps-ok">
              Puedes programar viajes entre 2 horas y 17 horas antes de la salida.
            </div>
          </>
        )}

        <label>Tipo de transporte</label>
        <div className="transport-toggle">
          <button type="button" className={form.vehicle_type_requested === "car" ? "selected" : ""} onClick={() => setField("vehicle_type_requested", "car")}>
            <Car size={20} /> Vehículo
          </button>
          <button type="button" className={form.vehicle_type_requested === "motorcycle" ? "selected" : ""} onClick={() => setField("vehicle_type_requested", "motorcycle")}>
            <Bike size={20} /> Motocicleta
          </button>
        </div>

        {form.vehicle_type_requested === "car" && (
          <>
            <label>¿Cuántas personas van?</label>
            <input
              type="number"
              min="1"
              max="8"
              value={form.passenger_count}
              onChange={(e) => setField("passenger_count", e.target.value)}
              placeholder="Ej: 3"
              required
            />
          </>
        )}

        <label>Tu oferta inicial en córdobas</label>
        <input
          type="number"
          min="1"
          value={form.passenger_offer}
          onChange={(e) => setField("passenger_offer", e.target.value)}
          placeholder="Ej: 150"
          required
        />

        <label>Notas adicionales</label>
        <textarea
          value={form.passenger_notes}
          onChange={(e) => setField("passenger_notes", e.target.value)}
          placeholder="Ej: llevo equipaje, viajo con niño, tengo una maleta..."
        />

        {hasLocationInput && !isOmetepe && (
          <div className="out-zone">
            <strong>Lo sentimos.</strong> Aún no contamos con conductores disponibles en esta zona.
            Gracias por confiar en Vuelo. Estamos construyendo esta plataforma junto a nuestra comunidad para llegar cada vez a más personas. 💚
          </div>
        )}

        <button disabled={sending || gettingGps || !canSubmit}>
          {sending ? "Buscando conductores..." : "Buscar conductor"}
        </button>
      </form>
    </section>
  );
}

function Offers({ notify }) {
  const [offers, setOffers] = useState([]);
  const [selectedRide, setSelectedRide] = useState(null);
  const [driverCards, setDriverCards] = useState({});
  const [confirmedDriver, setConfirmedDriver] = useState(null);
  const [lastRideStatus, setLastRideStatus] = useState(null);

  useEffect(() => {
    loadMyRides();

    const channel = supabase
      .channel("passenger-realtime-offers")
      .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, () => {
        loadMyRides();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "ride_offers" }, () => {
        loadMyRides();
      })
      .subscribe();

    const interval = setInterval(() => {
      loadMyRides();
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  async function loadMyRides() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    const { data } = await supabase
      .from("rides")
      .select("*")
      .eq("passenger_id", userData.user.id)
      .in("status", ACTIVE_RIDE_STATUSES)
      .order("requested_at", { ascending: false })
      .limit(1);

    if (data?.[0]) {
      if (lastRideStatus && lastRideStatus !== data[0].status) {
        notify(statusLabel(data[0].status));
      }
      setLastRideStatus(data[0].status);
      setSelectedRide(data[0]);
      await loadOffers(data[0]);
      if (data[0].driver_id) await loadConfirmedDriver(data[0].driver_id);
      else setConfirmedDriver(null);
    } else {
      setSelectedRide(null);
      setLastRideStatus(null);
      setOffers([]);
      setDriverCards({});
      setConfirmedDriver(null);
    }
  }

  async function loadDriverCards(driverIds) {
    if (!driverIds?.length) return {};

    const { data } = await supabase
      .from("driver_public_cards")
      .select("*")
      .in("driver_id", driverIds);

    const map = {};
    (data || []).forEach((driver) => {
      map[driver.driver_id] = driver;
    });

    setDriverCards(map);
    return map;
  }

  async function loadConfirmedDriver(driverId) {
    const { data } = await supabase
      .from("driver_public_cards")
      .select("*")
      .eq("driver_id", driverId)
      .maybeSingle();

    setConfirmedDriver(data || null);
  }

  async function loadOffers(ride) {
    const { data } = await supabase
      .from("ride_offers")
      .select("*")
      .eq("ride_id", ride.id)
      .order("created_at", { ascending: false });

    const visibleOffers =
      ride.status === "confirmed" || ride.status === "driver_on_way" || ride.status === "driver_arrived" || ride.status === "in_progress"
        ? (data || []).filter((offer) => offer.status === "accepted")
        : (data || []).filter((offer) =>
            offer.status !== "rejected" &&
            offer.status !== "cancelled_by_driver" &&
            offer.status !== "expired" &&
            !isOfferExpired(offer)
          );

    setOffers(visibleOffers);

    const ids = [...new Set(visibleOffers.map((offer) => offer.driver_id).filter(Boolean))];
    await loadDriverCards(ids);
  }

  async function cancelRide() {
    if (!selectedRide) return;

    if (!["searching", "negotiating"].includes(selectedRide.status)) {
      notify("Este viaje ya fue confirmado. Para cancelaciones, escribe a soporte.");
      return;
    }

    const confirmCancel = window.confirm("¿Deseas cancelar esta solicitud de viaje?");
    if (!confirmCancel) return;

    const { data: cancelled, error } = await supabase
      .from("rides")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancellation_reason: "Cancelado por el pasajero antes de aceptar oferta",
      })
      .eq("id", selectedRide.id)
      .in("status", ["searching", "negotiating"])
      .select("id")
      .maybeSingle();

    if (error) {
      alert(error.message);
      return;
    }

    notify(cancelled ? "Solicitud cancelada." : "El viaje cambió. Revisá su estado actualizado.");
    loadMyRides();
  }

  async function rejectOffer(offer) {
    const { error } = await supabase.from("ride_offers")
      .update({ status: "rejected" }).eq("id", offer.id).eq("status", "pending");
    if (error) notify(error.message);
    await loadMyRides();
  }

  async function confirmOffer(offer) {
    if (isOfferExpired(offer)) {
      await supabase.from("ride_offers").update({ status: "expired" }).eq("id", offer.id);
      notify("Esta oferta ya expiró. Espera una nueva oferta del conductor.");
      loadMyRides();
      return;
    }

    const confirm = window.confirm(`¿Confirmas este viaje por C$${offer.amount}? Al confirmar, el conductor podrá dirigirse al punto de recogida.`);
    if (!confirm) return;

    const { error } = await supabase.rpc("vuelo_confirm_offer", { p_offer_id: offer.id });

    if (error) {
      notify(error.message);
      await loadMyRides();
      return;
    }

    notify("Viaje confirmado correctamente.");
    loadMyRides();
  }

  return (
    <section className="page">
      <div className="section-title">
        <h1>Ofertas y viaje activo</h1>
        <p>Recibe ofertas, confirma conductor y da seguimiento a tu viaje.</p>
      </div>

      {!selectedRide && (
        <div className="empty-card">
          <Wallet size={36} />
          <h2>No tienes viajes activos</h2>
          <p>Solicita un viaje para empezar a recibir ofertas.</p>
        </div>
      )}

      {selectedRide && (
        <div className="active-ride-card">
          <span className={`ride-status-badge status-${selectedRide.status}`}>
            {statusLabel(selectedRide.status)}
          </span>

          <h2>{selectedRide.pickup_address} → {selectedRide.destination_address}</h2>
          <p>Oferta inicial: C${selectedRide.passenger_offer}</p>

          {selectedRide.requested_departure_at && (
            <p>Salida: <strong>{formatDateTime(selectedRide.requested_departure_at)}</strong></p>
          )}

          {selectedRide.destination_reference && (
            <p>Referencia destino: <strong>{selectedRide.destination_reference}</strong></p>
          )}

          {selectedRide.passenger_count && (
            <p>Personas en vehículo: <strong>{selectedRide.passenger_count}</strong></p>
          )}

          {["searching", "negotiating"].includes(selectedRide.status) && (
            <button className="cancel-ride-btn" onClick={cancelRide}>
              Cancelar solicitud
            </button>
          )}

          {selectedRide.driver_id && ["confirmed", "driver_on_way", "driver_arrived", "in_progress"].includes(selectedRide.status) && (
            <RideTrackingMap key={selectedRide.id} ride={selectedRide} />
          )}

          {confirmedDriver && (
            <div className="driver-confirmed-card">
              {confirmedDriver.avatar_url ? (
                <img src={confirmedDriver.avatar_url} alt="Conductor" />
              ) : (
                <div>{firstName(confirmedDriver.full_name)[0]}</div>
              )}

              <section>
                <h3>{firstName(confirmedDriver.full_name)}</h3>
                <p>{confirmedDriver.vuelo_id || confirmedDriver.driver_code || "DRV-000000"} · ⭐ {confirmedDriver.rating || "5.00"}</p>
                <p>Placa: <strong>{confirmedDriver.plate_number || "No registrada"}</strong></p>
                <p>Color: <strong>{confirmedDriver.vehicle_color || "No registrado"}</strong></p>
                <p>Vehículo: <strong>{[confirmedDriver.vehicle_brand, confirmedDriver.vehicle_model].filter(Boolean).join(" ") || "No registrado"}</strong></p>
              </section>
            </div>
          )}
        </div>
      )}

      <div className="offers-list">
        {offers.length === 0 && selectedRide && ["searching", "negotiating"].includes(selectedRide.status) && (
          <div className="empty-card">
            <Clock size={34} />
            <h2>Buscando conductores...</h2>
            <p>Las ofertas aparecerán aquí en cuanto un conductor responda.</p>
          </div>
        )}

        {offers.map((offer) => {
          const driver = driverCards[offer.driver_id];

          return (
            <div className="offer-card" key={offer.id}>
              <div>
                <span>{offer.status === "accepted" ? "Oferta aceptada" : "Oferta del conductor"}</span>

                {driver && (
                  <div className="driver-mini-card">
                    {driver.avatar_url ? (
                      <img src={driver.avatar_url} alt="Conductor" />
                    ) : (
                      <div>{firstName(driver.full_name)[0]}</div>
                    )}
                    <section>
                      <strong>{firstName(driver.full_name)}</strong>
                      <small>{driver.vuelo_id || driver.driver_code || "DRV-000000"} · ⭐ {driver.rating || "5.00"}</small>
                      <small>Placa: {driver.plate_number || "No registrada"} · Color: {driver.vehicle_color || "No registrado"}</small>
                    </section>
                  </div>
                )}

                <h3>C${offer.amount}</h3>
                <p>{offer.message || "El conductor está disponible para realizar el viaje."}</p>
                <small>Tiempo aproximado: {offer.estimated_arrival_minutes || "5–15"} min</small>
                {offer.expires_at && (
                  <small>Vence: {new Date(offer.expires_at).toLocaleTimeString("es-NI", { hour: "2-digit", minute: "2-digit" })}</small>
                )}
              </div>

              {selectedRide && ["searching", "negotiating"].includes(selectedRide.status) && offer.status === "pending" && (
                <div className="offer-actions">
                  <button onClick={() => confirmOffer(offer)}>Aceptar C${offer.amount}</button>
                  <button className="offer-reject" onClick={() => rejectOffer(offer)}>Rechazar oferta</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button className="refresh-btn" onClick={loadMyRides}>
        <RefreshCcw size={18} /> Actualizar
      </button>
    </section>
  );
}

function RideTrackingMap({ ride }) {
  const container = useRef(null);
  const mapState = useRef(null);
  const [location, setLocation] = useState(null);
  const [mapIssue, setMapIssue] = useState(false);
  const [locationIssue, setLocationIssue] = useState(false);
  const [now, setNow] = useState(Date.now());
  const { id, pickup_lat: pickupLat, pickup_lng: pickupLng } = ride;

  useEffect(() => {
    let active = true;
    let pending = false;
    async function refresh() {
      if (pending || document.hidden) return;
      pending = true;
      const { data, error } = await supabase.rpc("vuelo_latest_driver_location", { p_ride: id });
      pending = false;
      if (!active) return;
      setNow(Date.now());
      setLocationIssue(Boolean(error));
      if (!error) setLocation(data?.[0] || null);
    }
    refresh();
    const timer = window.setInterval(refresh, 8000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [id]);

  useEffect(() => {
    const leaflet = window.L;
    if (!leaflet) {
      setMapIssue(true);
      return;
    }
    const map = leaflet.map(container.current, { scrollWheelZoom: false }).setView([11.50, -85.58], 12);
    const tiles = leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    tiles.on("tileerror", () => setMapIssue(true));
    tiles.on("tileload", () => setMapIssue(false));
    const pickup = pickupLat != null && pickupLng != null ? [Number(pickupLat), Number(pickupLng)] : null;
    if (pickup) {
      leaflet.circleMarker(pickup, { radius: 8, color: "#fff", weight: 2, fillColor: "#1d4ed8", fillOpacity: 1 })
        .bindTooltip("Punto de recogida").addTo(map);
      map.setView(pickup, 15);
    }
    mapState.current = { map, pickup, driver: null };
    return () => {
      map.remove();
      mapState.current = null;
    };
  }, [pickupLat, pickupLng]);

  useEffect(() => {
    const state = mapState.current;
    if (!state) return;
    if (!location) {
      state.driver?.remove();
      state.driver = null;
      return;
    }
    const position = [Number(location.lat), Number(location.lng)];
    if (state.driver) state.driver.setLatLng(position);
    else {
      state.driver = window.L.circleMarker(position, { radius: 9, color: "#fff", weight: 2, fillColor: "#067451", fillOpacity: 1 })
        .bindTooltip("Conductor").addTo(state.map);
      if (state.pickup) state.map.fitBounds([state.pickup, position], { padding: [24, 24], maxZoom: 16 });
      else state.map.setView(position, 15);
    }
  }, [location, pickupLat, pickupLng]);

  const seconds = location ? Math.max(0, Math.floor((now - Date.parse(location.created_at)) / 1000)) : 0;
  const updated = seconds >= 60
    ? "Última ubicación hace " + Math.floor(seconds / 60) + " min"
    : "Actualizado hace " + seconds + " s";

  return (
    <section aria-label="Seguimiento del conductor" style={{ marginTop: 16 }}>
      <h3>Ubicación del conductor</h3>
      <p role="status">{location ? updated : "Esperando que el conductor comparta su ubicación."}</p>
      {locationIssue && <p>No pudimos actualizar la ubicación.</p>}
      <div ref={container} aria-label="Mapa del viaje"
        style={{ height: 280, borderRadius: 16, overflow: "hidden", background: "#e2e8f0", isolation: "isolate" }} />
      {mapIssue && <p>El mapa no pudo cargar por completo.</p>}
      <p>{pickupLat != null && pickupLng != null ? "● Azul: punto de recogida · " : ""}● Verde: conductor</p>
    </section>
  );
}

function History({ notify }) {
  const [rides, setRides] = useState([]);
  const [driverCards, setDriverCards] = useState({});
  const [ratingDrafts, setRatingDrafts] = useState({});
  const [ratingStars, setRatingStars] = useState({});
  const [submittedRatings, setSubmittedRatings] = useState({});

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    const { data } = await supabase
      .from("rides")
      .select("*")
      .eq("passenger_id", userData.user.id)
      .in("status", ["completed", "cancelled"])
      .order("requested_at", { ascending: false })
      .limit(50);

    setRides(data || []);

    const rideIds = (data || []).map((ride) => ride.id);

    if (rideIds.length) {
      const { data: ratingData } = await supabase
        .from("ride_ratings")
        .select("ride_id,rating,comment")
        .in("ride_id", rideIds);

      const submittedMap = {};
      const starsMap = {};
      const draftMap = {};

      (ratingData || []).forEach((rating) => {
        submittedMap[rating.ride_id] = true;
        starsMap[rating.ride_id] = rating.rating;
        draftMap[rating.ride_id] = rating.comment || "";
      });

      setSubmittedRatings(submittedMap);
      setRatingStars((prev) => ({ ...prev, ...starsMap }));
      setRatingDrafts((prev) => ({ ...prev, ...draftMap }));
    }

    const driverIds = [...new Set((data || []).map((ride) => ride.driver_id).filter(Boolean))];

    if (driverIds.length) {
      const { data: cards } = await supabase
        .from("driver_public_cards")
        .select("*")
        .in("driver_id", driverIds);

      const map = {};
      (cards || []).forEach((driver) => {
        map[driver.driver_id] = driver;
      });

      setDriverCards(map);
    }
  }

  function setDraft(rideId, value) {
    setRatingDrafts((prev) => ({ ...prev, [rideId]: value }));
  }

  function selectStars(rideId, stars) {
    if (submittedRatings[rideId]) return;
    setRatingStars((prev) => ({ ...prev, [rideId]: stars }));
  }

  async function submitRating(ride) {
    if (!ride?.driver_id) {
      notify("Este viaje no tiene conductor asignado para valorar.");
      return;
    }

    const stars = ratingStars[ride.id];

    if (!stars) {
      notify("Selecciona una calificación de 1 a 5 estrellas.");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    const { error } = await supabase.from("ride_ratings").upsert(
      [
        {
          ride_id: ride.id,
          passenger_id: userData.user.id,
          driver_id: ride.driver_id,
          rating: stars,
          comment: ratingDrafts[ride.id] || null,
        },
      ],
      { onConflict: "ride_id,passenger_id" }
    );

    if (error) {
      alert(error.message);
      return;
    }

    setSubmittedRatings((prev) => ({ ...prev, [ride.id]: true }));
    notify("Gracias por valorar tu viaje.");
  }

  return (
    <section className="page">
      <div className="section-title">
        <h1>Historial</h1>
        <p>Consulta tus viajes finalizados o cancelados y valora la experiencia.</p>
      </div>

      {rides.length === 0 && (
        <div className="empty-card">
          <Clock size={34} />
          <h2>Aún no tienes historial</h2>
          <p>Tus viajes finalizados aparecerán aquí.</p>
        </div>
      )}

      <div className="history-list">
        {rides.map((ride) => {
          const driver = driverCards[ride.driver_id];

          return (
            <div className="history-item-card" key={ride.id}>
              <span className={`ride-status-badge status-${ride.status}`}>
                {statusLabel(ride.status)}
              </span>

              <h3>{ride.pickup_address} → {ride.destination_address}</h3>
              <p>Salida: {formatDateTime(ride.requested_departure_at || ride.requested_at)}</p>
              <p>Total: C${ride.final_price || ride.passenger_offer || 0}</p>

              {driver && (
                <p>
                  Conductor: <strong>{firstName(driver.full_name)}</strong> · {driver.vuelo_id || driver.driver_code}
                </p>
              )}

              {ride.status === "completed" && (
                <div className="rating-box">
                  <label>{submittedRatings[ride.id] ? "Valoración enviada" : "Valorar viaje y conductor"}</label>
                  <div className="rating-stars">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        className={(ratingStars[ride.id] || 0) >= star ? "star-selected" : ""}
                        onClick={() => selectStars(ride.id, star)}
                        disabled={submittedRatings[ride.id]}
                      >
                        <Star size={20} fill={(ratingStars[ride.id] || 0) >= star ? "currentColor" : "none"} /> {star}
                      </button>
                    ))}
                  </div>

                  {!submittedRatings[ride.id] && (
                    <>
                      <textarea
                        placeholder="Comentario opcional..."
                        value={ratingDrafts[ride.id] || ""}
                        onChange={(e) => setDraft(ride.id, e.target.value)}
                      />
                      <button className="send-rating-btn" type="button" onClick={() => submitRating(ride)}>
                        Enviar valoración
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button className="refresh-btn" onClick={loadHistory}>
        <RefreshCcw size={18} /> Actualizar historial
      </button>
    </section>
  );
}

function Profile({ profile }) {
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "");
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");

  async function uploadAvatar(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMsg("Selecciona una imagen válida.");
      return;
    }

    if (file.size > 1024 * 1024) {
      setMsg("La imagen debe pesar máximo 1 MB.");
      return;
    }

    setUploading(true);
    setMsg("");

    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${profile.id}/avatar-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const publicUrl = publicData.publicUrl;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", profile.id);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      setMsg("Foto de perfil actualizada correctamente.");
    } catch (error) {
      setMsg(error.message || "No se pudo subir la foto.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="page">
      <div className="profile-card">
        {avatarUrl ? (
          <img className="profile-photo" src={avatarUrl} alt="Foto de perfil" />
        ) : (
          <div className="avatar">{profile?.full_name?.[0] || "V"}</div>
        )}

        <h1>{profile?.full_name || "Pasajero Vuelo"}</h1>
        <p>{profile?.email}</p>
        <p>{profile?.phone || "WhatsApp no registrado"}</p>

        <label className="upload-avatar-btn">
          <Upload size={18} />
          {uploading ? "Subiendo foto..." : "Cambiar foto de perfil"}
          <input
            type="file"
            accept="image/*"
            onChange={uploadAvatar}
            disabled={uploading}
          />
        </label>

        {msg && <div className="message profile-message">{msg}</div>}

        <div className="profile-grid">
          <div><strong>{profile?.vuelo_id || "PAS-000000"}</strong><span>ID Vuelo</span></div>
          <div><strong>{profile?.rating || "5.00"}</strong><span>Calificación</span></div>
          <div><strong>{profile?.city || "Ometepe"}</strong><span>Ciudad</span></div>
        </div>
      </div>
    </section>
  );
}

function InfoCard({ icon, title, text }) {
  return (
    <div className="info-card">
      <div>{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
