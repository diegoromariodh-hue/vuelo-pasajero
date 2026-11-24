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
const APP_URL = "https://misviajes.vuelonicaragua.online/";

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
  const [view, setView] = useState(() => window.location.pathname === "/reset-password" ? "reset-password" : (sessionStorage.getItem("vuelo-passenger-view") || "home"));
  const [toast, setToast] = useState("");

  const [switchingMode, setSwitchingMode] = useState(false);
  const [handoffError, setHandoffError] = useState("");
  const [handoffAttempted, setHandoffAttempted] = useState(false);

  async function switchMode() {
    if (switchingMode) return;
    setSwitchingMode(true);
    setHandoffError("");
    try {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) throw new Error("Tu sesión venció. Cerrá sesión e ingresá nuevamente.");
      const currentSession = refreshed.session;
      if (!currentSession?.access_token) throw new Error("Iniciá sesión nuevamente.");
      const res = await fetch(import.meta.env.VITE_SUPABASE_URL + "/functions/v1/vuelo-mode-handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
          "Authorization": "Bearer " + currentSession.access_token },
        body: JSON.stringify({ action: "create", destination: "driver" })
      });
      const payload = await res.json();
      if (!res.ok || !payload.url) throw new Error(payload.error || "No se pudo cambiar de modo.");
      window.location.assign(payload.url);
    } catch (error) {
      setHandoffError(error.message || "No se pudo cambiar de modo.");
      setSwitchingMode(false);
    }
  }

  async function redeemModeHandoff() {
    const query = new URLSearchParams(window.location.search);
    const code = query.get("vuelo_handoff");
    if (!code) return;
    setHandoffAttempted(true);
    window.history.replaceState({}, "", window.location.pathname);
    try {
      const res = await fetch(import.meta.env.VITE_SUPABASE_URL + "/functions/v1/vuelo-mode-handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY },
        body: JSON.stringify({ action: "redeem", destination: "passenger", code })
      });
      const payload = await res.json();
      if (!res.ok || !payload.token_hash) throw new Error(payload.error || "No se pudo recuperar la sesión.");
      const { error } = await supabase.auth.verifyOtp({ token_hash: payload.token_hash, type: "magiclink" });
      if (error) throw error;
      setHandoffError("");
    } catch (error) {
      setHandoffError(error.message || "El cambio de modo falló. Podés iniciar sesión normalmente.");
    }
  }


  useEffect(() => {
    if (view !== "reset-password") sessionStorage.setItem("vuelo-passenger-view", view);
  }, [view]);

  useEffect(() => {
    (async () => { await redeemModeHandoff(); await init(); })();

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

  if (!session && handoffAttempted && handoffError) return <div className="center-screen"><div className="blocked-card" style={{maxWidth:420,padding:24,margin:"24px auto",textAlign:"center"}}><h2>No se pudo cambiar de modo</h2><p role="alert">{handoffError}</p><p>Tu sesión de la otra aplicación no se ha modificado.</p><button type="button" onClick={() => window.location.assign("https://conductor.vuelonicaragua.online/")}>Regresar al modo anterior</button><button type="button" onClick={() => {setHandoffAttempted(false);setHandoffError("");}}>Iniciar sesión aquí</button></div></div>;

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
      {toast && <div className="toast" role="status">{toast}</div>}

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

      <PostRideSurvey key={session.user.id} userId={session.user.id} notify={notify} />

      <main>
        {view !== "request" && <NotificationInbox key={session.user.id} userId={session.user.id} onNavigate={setView} />}
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
            onCreated={() => { setView("offers"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          />
        )}

        {view === "offers" && <Offers notify={notify} userId={session.user.id} />}
        {view === "history" && <History notify={notify} />}
        {view === "profile" && <Profile profile={profile} onSwitchMode={switchMode} switchingMode={switchingMode} handoffError={handoffError} />}
        <p className="page"><a href="https://vuelonicaragua.online/#privacidad" target="_blank" rel="noreferrer" style={{color:"#067451",textDecoration:"underline"}}>Aviso de privacidad</a></p>
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

function RideChat({ rideId, userId }) {
  const [messages,setMessages]=useState([]);
  const [draft,setDraft]=useState("");
  const [sending,setSending]=useState(false);
  const [readError,setReadError]=useState(false);
  const [sendError,setSendError]=useState("");
  const pending=React.useRef(null);
  const logRef=React.useRef(null);
  const nearEnd=React.useRef(true);
  const lastSeen=React.useRef(null);
  const [newCount,setNewCount]=useState(0);
  useEffect(()=>{nearEnd.current=true;lastSeen.current=null;setNewCount(0);},[rideId]);
  useEffect(()=>{
    const log=logRef.current;
    if(!log || !messages.length) return;
    const latest=messages[messages.length-1];
    if(nearEnd.current || latest.sender_id===userId){
      log.scrollTop=log.scrollHeight;
      setNewCount(0);
    }else if(lastSeen.current && latest.id!==lastSeen.current){
      const index=messages.findIndex(item=>item.id===lastSeen.current);
      setNewCount(count=>count+messages.slice(index+1).filter(item=>item.sender_id!==userId).length);
    }
    lastSeen.current=latest.id;
  },[messages,userId]);
  function jumpToLatest(){
    nearEnd.current=true;
    if(logRef.current) logRef.current.scrollTop=logRef.current.scrollHeight;
    setNewCount(0);
  }

  useEffect(()=>{
    let active=true;
    let version=0;
    async function load() {
      const current=++version;
      const {data,error}=await supabase.from("ride_messages")
        .select("id,sender_id,message,created_at").eq("ride_id",rideId)
        .order("created_at",{ascending:false}).order("id",{ascending:false}).limit(50);
      if (!active || current!==version) return;
      setReadError(Boolean(error));
      if (!error) setMessages((data||[]).reverse());
    }
    const channel=supabase.channel("ride-chat:"+rideId)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"ride_messages",filter:"ride_id=eq."+rideId},load)
      .subscribe((status)=>{if(status==="SUBSCRIBED") void load();});
    const timer=window.setInterval(()=>{if(!document.hidden) void load();},6000);
    void load();
    return ()=>{
      active=false;
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  },[rideId]);

  async function send(event) {
    event.preventDefault();
    const message=draft.trim();
    if (!message || sending) return;
    if (pending.current?.message!==message) pending.current={message,id:crypto.randomUUID()};
    setSending(true);
    setSendError("");
    try {
      const {error}=await supabase.rpc("vuelo_send_ride_message",{p_ride:rideId,p_message:message,p_id:pending.current.id});
      if (error) {
        setSendError(error.message);
        return;
      }
      const id=pending.current.id;
      setMessages((previous)=>previous.some((item)=>item.id===id)?previous:[...previous,{id,message,sender_id:userId}]);
      pending.current=null;
      setDraft("");
    } catch {
      setSendError("No se pudo confirmar el envío. Podés volver a intentarlo.");
    } finally {
      setSending(false);
    }
  }

  return <section className="rating-box ride-chat" aria-label="Chat del viaje">
    <h3>Chat del viaje</h3>
    {readError && <p role="status">No pudimos actualizar el chat.</p>}
    {messages.length===0 && !readError && <p>Usá este chat para coordinar la recogida.</p>}
    {messages.length>0 && <ul role="log" aria-label="Mensajes" className="ride-chat-log" ref={logRef} onScroll={()=>{const el=logRef.current;if(!el)return;nearEnd.current=el.scrollHeight-el.scrollTop-el.clientHeight<48;if(nearEnd.current)setNewCount(0);}}>
      {messages.map((item)=><li key={item.id} className={"ride-chat-bubble"+(item.sender_id===userId?" mine":"")}>
        <strong>{item.sender_id===userId?"Vos":"Conductor"}</strong>
        <div>{item.message}</div>
        {item.created_at && <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleTimeString("es-NI",{hour:"numeric",minute:"2-digit"})}</time>}
      </li>)}
    </ul>}
    {newCount>0 && <button type="button" className="ride-chat-latest" onClick={jumpToLatest}>Ver mensajes nuevos ({newCount}) ↓</button>}
    <form onSubmit={send}>
      <div className="ride-chat-quick">
        {["Estoy en el punto","Te espero en…","¿Dónde estás?"].map((message)=><button key={message} type="button" disabled={sending}
          onClick={()=>setDraft(message)}>{message}</button>)}
      </div>
      <textarea aria-label="Mensaje del viaje" placeholder="Escribí un mensaje" maxLength={500}
        value={draft} onChange={(event)=>setDraft(event.target.value)} disabled={sending} />
      {sendError && <p role="alert">{sendError}</p>}
      <button type="submit" className="send-rating-btn" disabled={sending || !draft.trim()}>
        {sending?"Enviando…":"Enviar mensaje"}
      </button>
    </form>
  </section>;
}

function NotificationInbox({userId,onNavigate}) {
  const destinations = { offer:"offers", ride_status:"offers", chat:"offers", completed:"history", cancelled:"offers" };
  const [items,setItems]=useState([]);
  const [errorText,setErrorText]=useState("");
  const [loading,setLoading]=useState(true);
  const [onlyUnread,setOnlyUnread]=useState(false);
  useEffect(()=>{
    let active=true;
    let request=0;
    async function refresh() {
      const current=++request;
      const {data,error}=await supabase.from("vuelo_notifications")
        .select("id,kind,title,body,read_at,created_at,ride_id").eq("recipient",userId)
        .order("id",{ascending:false}).limit(20);
      if (!active || current!==request) return;
      if (error) setErrorText("No se pudieron actualizar los avisos.");
      else {setErrorText("");setItems(data||[]);}
      setLoading(false);
    }
    const channel=supabase.channel("vuelo-inbox:"+userId)
      .on("postgres_changes",{event:"*",schema:"public",table:"vuelo_notifications",filter:"recipient=eq."+userId},refresh)
      .subscribe((status)=>{if(status==="SUBSCRIBED") void refresh();});
    const timer=window.setInterval(()=>{if(!document.hidden) void refresh();},15000);
    document.addEventListener("visibilitychange",refresh);
    void refresh();
    return ()=>{
      active=false;window.clearInterval(timer);
      document.removeEventListener("visibilitychange",refresh);
      void supabase.removeChannel(channel);
    };
  },[userId]);

  async function open(item) {
    if (!item.read_at) {
      const read_at=new Date().toISOString();
      const {error}=await supabase.from("vuelo_notifications").update({read_at}).eq("id",item.id);
      if (error) {setErrorText("No se pudo marcar el aviso como leído. Volvé a intentarlo.");return;}
      setItems(previous=>previous.map(entry=>entry.id===item.id?{...entry,read_at}:entry));
    }
    const destination=destinations[item.kind];
    if(destination) onNavigate(destination);
  }

  const uniqueItems=Array.from(new Map(items.map(item=>[item.id,item])).values());
  const unread=uniqueItems.filter(item=>!item.read_at);
  const visibleItems=onlyUnread?unread:uniqueItems;
  return <section className="page notification-panel" aria-label="Centro de notificaciones">
    <details className="notification-drawer">
      <summary className="notification-summary">
        <span className="notification-summary-main"><strong>Notificaciones</strong><small>{loading?"Actualizando avisos":unread.length?unread.length+" sin leer":"Estás al día"}</small></span>
        <span className="notification-count" aria-label={unread.length+" notificaciones sin leer"}>{unread.length || ""}</span>
        <span className="notification-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div className="notification-content" aria-live="polite">
        {errorText && <p className="notification-error" role="alert">{errorText}</p>}
        {loading && !items.length && <p className="notification-empty">Cargando notificaciones…</p>}
        {!loading && !items.length && !errorText && <p className="notification-empty">Todavía no tenés avisos. Te mostraremos aquí las novedades de tus viajes.</p>}
        {items.length>0 && <div className="notification-filters"><button type="button" aria-pressed={!onlyUnread} onClick={()=>setOnlyUnread(false)}>Todos</button><button type="button" aria-pressed={onlyUnread} onClick={()=>setOnlyUnread(true)}>Sin leer ({unread.length})</button></div>}
        {onlyUnread && !unread.length && items.length>0 && <p className="notification-empty">No tenés avisos pendientes.</p>}
        {visibleItems.map(item=><article className={"notification-item"+(!item.read_at?" is-unread":"")} key={item.id}>
          <span className={"notification-dot "+(item.read_at?"is-read":"")} aria-hidden="true"/>
          <div className="notification-item-copy">
            <div className="notification-item-heading"><strong>{item.title}</strong>{!item.read_at&&<span className="notification-new">Nuevo</span>}</div>
            <p>{item.body}</p>
            <small>{item.created_at?new Date(item.created_at).toLocaleString("es-NI",{dateStyle:"short",timeStyle:"short"}):""}</small>
          </div>
          {(destinations[item.kind]||(!item.read_at&&item.kind==="admin"))&&<button className="notification-action" type="button" onClick={()=>open(item)}>
            {destinations[item.kind]?(item.kind==="request"?"Ver solicitud":item.kind==="chat"?"Abrir chat":item.kind==="completed"?"Ver historial":"Ver viaje"):"Marcar leído"}
          </button>}
        </article>)}
      </div>
    </details>
  </section>;
}
function PostRideSurvey({ userId, notify }) {
  const [tripId, setTripId] = useState(null);
  const dismissed = React.useRef(new Set());
  const dialog = React.useRef(null);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    let active = true;
    let loading = false;
    let refreshQueued = false;

    async function refresh() {
      if (!active || document.hidden) return;
      if (loading) {
        refreshQueued = true;
        return;
      }
      loading = true;
      try {
        const ownerId = userId;
        const recent = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: trips, error } = await supabase.from("rides").select("id")
          .eq("passenger_id", ownerId)
          .eq("status", "completed")
          .not("driver_id", "is", null)
          .gte("completed_at", recent).order("completed_at", { ascending: false }).limit(10);
        if (error || !trips?.length || !active) return;
        const { data: ratings, error: ratingsError } = await supabase.from("ride_ratings")
          .select("ride_id").eq("passenger_id", ownerId)
          .in("ride_id", trips.map(({ id }) => id));
        if (!active || ratingsError) return;
        const rated = new Set(ratings.map(({ ride_id }) => ride_id));
        const pending = trips.find(({ id }) => !rated.has(id) && !dismissed.current.has(id));
        if (pending) setTripId((current) => current || pending.id);
      } finally {
        loading = false;
        if (refreshQueued) {
          refreshQueued = false;
          void refresh();
        }
      }
    }

    const channel = supabase.channel("post-ride-survey:" + userId)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rides" }, ({ new: row }) => {
        if (row.status === "completed") void refresh();
      }).subscribe();
    const timer = window.setInterval(refresh, 12000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("vuelo-trip-completed", refresh);
    void refresh();

    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("vuelo-trip-completed", refresh);
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    if (tripId && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [tripId]);

  function close() {
    dismissed.current.add(tripId);
    setTripId(null);
    setStars(0);
    setComment("");
    setErrorText("");
  }

  async function submit(event) {
    event.preventDefault();
    if (!stars || sending) return;
    setSending(true);
    setErrorText("");
    try {
      const { error } = await supabase.rpc("vuelo_review_ride", {
        p_ride: tripId, p_rating: stars, p_comment: comment, p_as_driver: false,
      });
      if (error) {
        setErrorText("No pudimos guardar la reseña. Volvé a intentarlo.");
        return;
      }
      close();
      notify("Reseña guardada.");
    } finally {
      setSending(false);
    }
  }

  if (!tripId) return null;

  return (
    <dialog ref={dialog} className="rating-box" aria-labelledby="post-ride-title"
      onCancel={(event) => { event.preventDefault(); if (!sending) close(); }}
      style={{ width: "min(420px, calc(100% - 24px))", maxHeight: "85dvh", margin: "auto", padding: 20, border: "1px solid #cbd5e1" }}>
      <form onSubmit={submit}>
        <h2 id="post-ride-title">Calificá al conductor</h2>
        <p>¿Cómo fue tu experiencia?</p>
        <div className="rating-stars" role="group" aria-label="Calificación de 1 a 5 estrellas">
          {[1, 2, 3, 4, 5].map((value) => (
            <button key={value} type="button" aria-label={value + (value === 1 ? " estrella" : " estrellas")}
              aria-pressed={stars === value} className={stars >= value ? "star-selected" : ""}
              disabled={sending} onClick={() => setStars(value)}>
              <Star size={17} fill={stars >= value ? "currentColor" : "none"} aria-hidden="true" />
              {value}
            </button>
          ))}
        </div>
        <textarea aria-label="Comentario opcional" placeholder="Comentario opcional"
          maxLength={500} value={comment} disabled={sending} onChange={(event) => setComment(event.target.value)} />
        {errorText && <p role="alert">{errorText}</p>}
        <button type="submit" className="send-rating-btn" disabled={!stars || sending}>
          {sending ? "Guardando…" : "Enviar reseña"}
        </button>
        <button type="button" className="send-rating-btn" disabled={sending} onClick={close}
          style={{ background: "#fff", color: "#067451", border: "1px solid #cbd5e1" }}>Más tarde</button>
      </form>
    </dialog>
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
  const [receiveMarketingEmails, setReceiveMarketingEmails] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [existingAccount, setExistingAccount] = useState(false);

  const [code, setCode] = useState("");
  const [resendAfter, setResendAfter] = useState(0);
  const [clock, setClock] = useState(Date.now());

  useEffect(() => {
    if (mode !== "verify") return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [mode]);

  function showVerification(address, sent) {
    setEmail(address);
    setCode("");
    setClock(Date.now());
    setResendAfter(sent ? Date.now() + 60000 : 0);
    setMode("verify");
    setMsg(sent ? "Revisá tu correo, incluida la carpeta de spam." : "Ingresá el código que recibiste o solicitá uno nuevo.");
  }

  async function resendCode() {
    if (sending || Date.now() < resendAfter) return;
    setSending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: new URL("/", window.location.origin).href },
    });
    setSending(false);
    if (error) {
      setMsg("No pudimos reenviar el código. Esperá un momento y volvé a intentar.");
      return;
    }
    setClock(Date.now());
    setResendAfter(Date.now() + 60000);
    setMsg("Si tu cuenta está pendiente de confirmar, revisá tu correo para ver el nuevo código.");
  }


  async function submit(e) {
    e.preventDefault();
    setSending(true);
    setMsg("");
    setExistingAccount(false);

    const cleanEmail = email.trim().toLowerCase();

    if (mode === "verify") {
      const { error } = await supabase.auth.verifyOtp({ email: cleanEmail, token: code, type: "email" });
      if (error) setMsg("El código es incorrecto o venció. Revisalo o pedí uno nuevo.");
    } else if (mode === "register") {
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

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo: new URL("/", window.location.origin).href,
          data: {
            full_name: fullName.trim(),
            phone: whatsapp.trim(),
            role: "passenger",
            marketing_email_opt_in: receiveMarketingEmails,
            accepted_terms: true,
            accepted_terms_at: new Date().toISOString(),
          },
        },
      });

      if (["user_already_exists", "email_exists"].includes(error?.code)) {
        setExistingAccount(true);
        setMsg("Este correo ya tiene una cuenta en Vuelo. Podés entrar o recuperar tu contraseña.");
      } else if (error?.code === "over_email_send_rate_limit") {
        setMsg("Se alcanzó el límite temporal de correos. Volvé a intentar más tarde.");
      } else if (error?.code === "email_address_not_authorized") {
        setMsg("El servicio de correo de Vuelo no pudo enviar la verificación a esta dirección. Contactá a soporte.");
      } else if (error?.code === "weak_password") {
        setMsg("La contraseña no cumple los requisitos. Usá una más larga y difícil de adivinar.");
      } else if (error) {
        setMsg("No pudimos crear tu cuenta. Volvé a intentar o contactá a soporte.");
      } else if (!data.session) {
        showVerification(cleanEmail, true);
      }
    } else if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(
        recoveryEmail.trim().toLowerCase(),
        { redirectTo: new URL("/reset-password", window.location.origin).href }
      );

      if (error) setMsg(error.message);
      else setMsg("Si existe una cuenta asociada a este correo, te enviaremos instrucciones para restablecer tu contraseña.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (error?.code === "invalid_credentials") {
        setMsg("El correo o la contraseña no coinciden. Si ya tenés una cuenta, podés recuperar tu contraseña.");
      } else if (error?.code === "email_not_confirmed") {
        showVerification(cleanEmail, false);
      } else if (error) {
        setMsg("No pudimos iniciar sesión. Volvé a intentar.");
      }
    }

    setSending(false);
  }

  if (mode === "verify") {
    const seconds = Math.max(0, Math.ceil((resendAfter - clock) / 1000));
    return (
      <div className="auth-screen">
        <form className="auth-card" onSubmit={submit}>
          <img src={LOGO_URL} alt="Vuelo" />
          <h1>Confirmá tu correo</h1>
          <p>Ingresá el código de 6 dígitos enviado a <strong>{email}</strong>.</p>
          {msg && <div className="message" role="status">{msg}</div>}
          <label htmlFor="signup-code">Código de confirmación</label>
          <input id="signup-code" value={code} inputMode="numeric" autoComplete="one-time-code"
            maxLength={6} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            required />
          <button type="submit" disabled={sending || code.length !== 6}>
            {sending ? "Procesando…" : "Confirmar correo"}
          </button>
          <button type="button" className="link-btn" disabled={sending || seconds > 0} onClick={resendCode}>
            {seconds ? "Reenviar en " + seconds + " s" : "Reenviar código"}
          </button>
          <button type="button" className="link-btn" disabled={sending} onClick={() => { setMsg(""); setMode("login"); }}>
            Volver a iniciar sesión
          </button>
        </form>
      </div>
    );
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

        {msg && <div className="message" role="status">{msg}</div>}
        {mode === "register" && existingAccount && (
          <div>
            <button type="button" className="link-btn" onClick={() => { setMode("login"); setMsg(""); }}>
              Entrar con este correo
            </button>
            <button type="button" className="link-btn" onClick={() => { setRecoveryEmail(email.trim()); setMode("forgot"); setMsg(""); }}>
              Recuperar contraseña
            </button>
          </div>
        )}

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

        {mode === "register" && (
          <label className="terms-check passenger-terms-check">
            <input
              type="checkbox"
              checked={receiveMarketingEmails}
              onChange={(e) => setReceiveMarketingEmails(e.target.checked)}
            />
            <span>Quiero recibir novedades y promociones de VUELO por correo (opcional).</span>
          </label>
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
            setReceiveMarketingEmails(false);
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
        <p className="terms-updated">Última actualización: 23 de noviembre de 2026</p>

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
            la tarifa, el punto de recogida y el destino quedan registrados en la plataforma. Cada parte conserva los derechos y obligaciones que le corresponden por ley.
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
            En caso de accidentes, incidentes, conflictos o situaciones ocurridas durante un viaje, las responsabilidades se determinan según los hechos y la legislación aplicable en Nicaragua.
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
            El clima, los cierres de vía y la conectividad pueden afectar el viaje. Si hay un problema, podés reportarlo a soporte.
          </p>
        </div>

        <div className="terms-block">
          <h2>8. Objetos personales</h2>
          <p>
            Si olvidás un objeto o se reporta un daño o pérdida, contactá a soporte para registrar el caso y coordinar los pasos siguientes.
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
            Consultá el <a href="https://vuelonicaragua.online/#privacidad" target="_blank" rel="noreferrer">aviso de privacidad</a> para conocer cómo se usan tus datos. El canal oficial de soporte es <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
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
          <p>Elegí tu destino, seleccioná cómo viajar y acordá el precio con tu conductor.</p>
        </div>
        <button onClick={goRequest}>
          Pedir un viaje <ArrowRight size={18} />
        </button>
      </div>

      <InstallReminder notify={notify} />

      <div className="emergency-card">
        <h3>Ayuda y emergencias</h3>
        <p>
          ¿Necesitás ayuda con la app? Escribinos a <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          En una emergencia llama directamente a las autoridades.
        </p>
        <div className="emergency-actions">
          <a href="tel:118"><PhoneCall size={18} /> Policía Nacional 118</a>
          <a href="tel:115"><PhoneCall size={18} /> Bomberos 115</a>
        </div>
      </div>

      <div className="share-card">
        <div>
          <h3>Invitá a alguien</h3>
          <p>Compartí VUELO con quien necesite moverse por Ometepe.</p>
        </div>
        <button onClick={shareApp}><Share2 size={18} /> Compartir app</button>
      </div>

      <div className="commission-card">
        <div className="icon"><ShieldCheck /></div>
        <div>
          <h2>Pagás lo que acordás</h2>
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
        <InfoCard icon={<Car />} title="Vehículo" text="Más espacio para viajar con comodidad." />
        <InfoCard icon={<Bike />} title="Motocicleta" text="Una opción práctica para recorridos cortos." />
        <InfoCard icon={<MessageCircle />} title="Chat interno" text="Conversá con tu conductor al confirmar." />
        <InfoCard icon={<Clock />} title="Historial" text="Revisá tus viajes anteriores." />
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
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    pickup_municipality: "Altagracia",
    pickup_address: "",
    pickup_reference: "",
    pickup_lat: null,
    pickup_lng: null,
    destination_municipality: "Moyogalpa",
    destination_address: "",
    destination_lat: null,
    destination_lng: null,
    destination_reference: "",
    vehicle_type_requested: "car",
    passenger_count: "",
    ride_mode: "immediate",
    requested_departure_at: "",
    passenger_offer: "",
    passenger_notes: "",
  });

  const [checkingPoint, setCheckingPoint] = useState(false);
  const [showMap, setShowMap] = useState(false);
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

  async function savePoint(field, lat, lng) {
    setCheckingPoint(true);
    try {
      let validation = await supabase.rpc("vuelo_in_ometepe", { lat, lng });

      // A tab left open can retain an expired access token. Refresh once and retry
      // the protected validation instead of failing the map flow immediately.
      const authFailure = (error) =>
        error?.status === 401 ||
        error?.code === "401" ||
        /jwt.*expired|invalid jwt|unauthorized|not authenticated/i.test(error?.message || "");

      if (validation.error && authFailure(validation.error)) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshed?.session) {
          notify("Tu sesión venció. Volvé a iniciar sesión para validar el punto.");
          return false;
        }
        validation = await supabase.rpc("vuelo_in_ometepe", { lat, lng });
      }

      const { data, error } = validation;
      if (error) {
        console.error("VUELO point validation failed:", error);
        notify(authFailure(error)
          ? "Tu sesión venció. Volvé a iniciar sesión e intentá nuevamente."
          : "No pudimos validar el punto. Revisá tu conexión e intentá nuevamente.");
        return false;
      }
      if (!data) {
        notify("Marcá un punto dentro de Ometepe.");
        return false;
      }
      let addressText = "";
      let municipality = "";
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, { headers: { "Accept-Language": "es" } });
        if (response.ok) {
          const place = await response.json();
          const parts = place.address || {};
          addressText = [parts.road, parts.neighbourhood || parts.suburb, parts.village || parts.town || parts.hamlet, parts.amenity || parts.building].filter(Boolean).filter((value,index,array)=>array.indexOf(value)===index).slice(0,3).join(", ") || place.name || "";
          const municipalityName = [parts.municipality, parts.county, parts.city, parts.town, parts.village].filter(Boolean).join(" ");
          if (/moyogalpa/i.test(municipalityName)) municipality = "Moyogalpa";
          else if (/altagracia/i.test(municipalityName)) municipality = "Altagracia";
        }
      } catch (geocodeError) {
        console.warn("Reverse geocoding unavailable:", geocodeError);
      }
      setForm((previous) => ({
        ...previous,
        [field + "_lat"]: lat,
        [field + "_lng"]: lng,
        ...(addressText ? { [field + "_address"]: addressText } : {}),
        ...(municipality ? { [field + "_municipality"]: municipality } : {}),
      }));
      if (!addressText) notify("Punto guardado. Podés completar la dirección manualmente si hace falta.");
      return true;
    } finally {
      setCheckingPoint(false);
    }
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
        try {
          if (await savePoint("pickup", pos.coords.latitude, pos.coords.longitude)) {
            setShowMap(true);
            notify("Punto A marcado con tu ubicación actual.");
          }
        } finally {
          setGettingGps(false);
        }
      },
      () => {
        setGettingGps(false);
        alert("No se pudo obtener tu ubicación. Puedes escribir la referencia manualmente.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function goToStep(next) {
    if (next === 2) {
      if (!hasPickupPoint) {
        notify("Marcá el punto A de recogida en el mapa para guardar su ubicación exacta.");
        return;
      }
      if (!hasDestinationPoint) {
        notify("Marcá el punto B de destino en el mapa para guardar su ubicación exacta.");
        return;
      }
      if (!isOmetepe) {
        notify("Por ahora VUELO está disponible en Altagracia y Moyogalpa.");
        return;
      }
    }
    if (next === 3) {
      if (form.vehicle_type_requested === "car" && (!form.passenger_count || Number(form.passenger_count) < 1 || Number(form.passenger_count) > 8)) {
        notify("Indicá cuántas personas viajan (de 1 a 8).");
        return;
      }
      const departure = getDepartureInfo();
      if (!departure.ok) {
        notify(departure.message);
        return;
      }
    }
    if (next === 4 && (!form.passenger_offer || Number(form.passenger_offer) <= 0)) {
      notify("Ingresá un presupuesto mayor que cero.");
      return;
    }
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
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

    if (gettingGps || checkingPoint) return;

    if (!isOmetepe) {
      alert("Lo sentimos. Aún no contamos con conductores disponibles en esta zona. Gracias por confiar en Vuelo.");
      return;
    }
    if (!hasPickupPoint || !hasDestinationPoint) {
      alert("Para enviar la solicitud, marcá los dos puntos en el mapa: A para recogida y B para destino.");
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
        pickup_address: `${form.pickup_municipality}, ${form.pickup_address.trim() || "Punto A en el mapa"}`,
        pickup_lat: form.pickup_lat,
        pickup_lng: form.pickup_lng,
        destination_address: `${form.destination_municipality}, ${form.destination_address.trim() || "Punto B en el mapa"}`,
        destination_lat: form.destination_lat,
        destination_lng: form.destination_lng,
        destination_reference: form.destination_reference || null,
        requested_departure_at: departure.value,
        passenger_count: form.vehicle_type_requested === "car" ? Number(form.passenger_count) : 1,
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

  const hasPickupPoint = form.pickup_lat != null && form.pickup_lng != null;
  const hasDestinationPoint = form.destination_lat != null && form.destination_lng != null;

  function localDateTime(offsetHours) {
    const date = new Date(Date.now() + offsetHours * 3600000);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }

  function addressFields(field, title, letter, hasPoint) {
    return (
      <fieldset className="ride-location" data-point={letter}>
        <legend><span className="ride-point-letter">{letter}</span> {title}</legend>
        <label htmlFor={field + "-municipality"}>Municipio</label>
        <select id={field + "-municipality"} value={form[field + "_municipality"]}
          onChange={(event) => setField(field + "_municipality", event.target.value)} required>
          <option value="Altagracia">Altagracia</option>
          <option value="Moyogalpa">Moyogalpa</option>
        </select>
        <label htmlFor={field + "-address"}>Dirección{hasPoint ? " (opcional)" : ""}</label>
        <input id={field + "-address"} value={form[field + "_address"]}
          onChange={(event) => setField(field + "_address", event.target.value)}
          placeholder={field === "pickup" ? "Ej. Calle del parque" : "Ej. Entrada de Ojo de Agua"} required={!hasPoint} />
        <label htmlFor={field + "-reference"}>Referencia{hasPoint ? " (opcional)" : ""}</label>
        <input id={field + "-reference"} value={form[field + "_reference"]}
          onChange={(event) => setField(field + "_reference", event.target.value)}
          placeholder="Ej. Frente a la entrada principal" required={!hasPoint} />
      </fieldset>
    );
  }

  return (
    <section className="page">
      <div className="section-title">
        <h1>Solicitar viaje</h1>
        <p>Indicá dónde te recogemos y adónde vas. Compartiremos la ubicación exacta con el conductor al confirmar.</p>
      </div>

      <div className="ride-progress" aria-label={`Paso ${step} de 4`}>
        {[["Ruta",1],["Viaje",2],["Presupuesto",3],["Confirmar",4]].map(([label,number]) => <div key={number} className={`ride-progress-step ${step===number?"current":step>number?"complete":""}`}><span>{step>number?"✓":number}</span><b>{label}</b></div>)}
      </div>
      <form className="ride-form ride-request" noValidate onSubmit={submit}>
        {step === 1 && <section className="ride-request-group" aria-labelledby="ride-route-heading">
          <h2 id="ride-route-heading">Ruta</h2>
          <p>Elegí los puntos en el mapa o escribí las direcciones.</p>
          <div className="ride-request-options">
            <button type="button" className="ride-map-toggle" onClick={() => setShowMap(!showMap)}
              aria-expanded={showMap} aria-controls="ride-point-picker" disabled={checkingPoint || gettingGps}>
              {showMap ? "Ocultar mapa" : hasPickupPoint || hasDestinationPoint ? "Ver o cambiar en el mapa" : "Abrir mapa y marcar puntos"}
            </button>
            <button type="button" className="ride-secondary" onClick={useGPS} disabled={gettingGps || checkingPoint}>
              <Navigation size={17} aria-hidden="true" /> {gettingGps ? "Ubicándote…" : "Estoy aquí (GPS)"}
            </button>
          </div>

          {showMap && <RidePointPicker form={form} savePoint={savePoint} disabled={checkingPoint || gettingGps}
            clearPoint={(field) => setForm((previous) => ({
              ...previous, [field + "_lat"]: null, [field + "_lng"]: null,
            }))} />}
          <div className="ride-request-locations">
            {addressFields("pickup", "Recogida", "A", hasPickupPoint)}
            {addressFields("destination", "Destino", "B", hasDestinationPoint)}
          </div>
          <p className="ride-field-hint" role="status">
            {hasPickupPoint && hasDestinationPoint ? "Recogida y destino guardados en el mapa."
              : hasPickupPoint ? "Recogida guardada en el mapa."
              : hasDestinationPoint ? "Destino guardado en el mapa." : ""}
          </p>
        </section>}

        {step === 2 && <section className="ride-request-group" aria-labelledby="ride-details-heading">
          <div className="ride-step-heading"><span>2</span><div><h2 id="ride-details-heading">¿Cuándo y cómo viajás?</h2><p>Elegí el momento y el tipo de transporte.</p></div></div>
          <fieldset className="ride-request-choice">
            <legend>¿Cuándo salís?</legend>
            <div className="ride-request-options">
              {[["immediate", "Lo antes posible"], ["scheduled", "Programar"]].map(([value, label]) => (
                <button key={value} type="button" className="ride-secondary" aria-pressed={form.ride_mode === value}
                  onClick={() => setField("ride_mode", value)}>{label}</button>
              ))}
            </div>
            {form.ride_mode === "scheduled" && <>
              <label htmlFor="ride-departure">Fecha y hora de salida</label>
              <input id="ride-departure" type="datetime-local" value={form.requested_departure_at}
                min={localDateTime(2)} max={localDateTime(17)} aria-describedby="ride-departure-hint"
                onChange={(event) => setField("requested_departure_at", event.target.value)} required />
              <p className="ride-field-hint" id="ride-departure-hint">Podés programar la salida entre 2 y 17 horas a partir de ahora.</p>
            </>}
          </fieldset>
          <fieldset className="ride-request-choice">
            <legend>¿En qué viajás?</legend>
            <div className="ride-request-options">
              {[["car", "Carro", Car], ["motorcycle", "Moto", Bike]].map(([value, label, Icon]) => (
                <button key={value} type="button" className="ride-secondary" aria-pressed={form.vehicle_type_requested === value}
                  onClick={() => setField("vehicle_type_requested", value)}><Icon size={18} aria-hidden="true" />{label}</button>
              ))}
            </div>
          </fieldset>
          {form.vehicle_type_requested === "car" && <>
            <label htmlFor="ride-count">¿Cuántas personas viajan?</label>
            <input id="ride-count" type="number" min="1" max="8" inputMode="numeric" value={form.passenger_count}
              onChange={(event) => setField("passenger_count", event.target.value)} required />
          </>}
        </section>}

        {step === 3 && <section className="ride-request-group" aria-labelledby="ride-price-heading">
          <div className="ride-step-heading"><span>3</span><div><h2 id="ride-price-heading">¿Cuánto querés ofrecer?</h2><p>El precio se acuerda entre vos y el conductor.</p></div></div>
          <label htmlFor="ride-price">¿Cuánto ofrecés? (C$)</label>
          <input id="ride-price" type="number" min="1" step="0.01" inputMode="decimal" value={form.passenger_offer}
            aria-describedby="ride-price-hint" onChange={(event) => setField("passenger_offer", event.target.value)}
            placeholder="Ej. 150" required />
          <p className="ride-field-hint" id="ride-price-hint">El conductor puede aceptar o proponer otro precio. Vos decidís.</p>
          <label htmlFor="ride-notes">Notas para el conductor (opcional)</label>
          <textarea id="ride-notes" value={form.passenger_notes}
            onChange={(event) => setField("passenger_notes", event.target.value)} placeholder="Ej. Llevo equipaje" />
        </section>}

        {step === 4 && <section className="ride-request-group ride-review" aria-labelledby="ride-review-heading">
          <h2 id="ride-review-heading">Revisá tu viaje</h2>
          <p>Confirmá que los datos estén correctos antes de buscar conductor.</p>
          <div className="ride-review-list">
            <div><small>Recogida</small><strong>{form.pickup_municipality}, {form.pickup_address || "Punto A en el mapa"}</strong></div>
            <div><small>Destino</small><strong>{form.destination_municipality}, {form.destination_address || "Punto B en el mapa"}</strong></div>
            <div><small>Transporte</small><strong>{form.vehicle_type_requested === "car" ? "Carro" : "Motocicleta"}{form.vehicle_type_requested === "car" ? ` · ${form.passenger_count} persona(s)` : ""}</strong></div>
            <div><small>Horario</small><strong>{form.ride_mode === "immediate" ? "Lo antes posible" : new Date(form.requested_departure_at).toLocaleString("es-NI")}</strong></div>
            <div><small>Presupuesto ofrecido</small><strong className="ride-review-price">C$ {Number(form.passenger_offer || 0).toLocaleString("es-NI")}</strong></div>
            {form.passenger_notes && <div><small>Notas</small><strong>{form.passenger_notes}</strong></div>}
          </div>
        </section>}

        <div className="ride-wizard-actions">
          {step > 1 && <button type="button" className="ride-wizard-back" onClick={() => goToStep(step - 1)} disabled={sending}>Atrás</button>}
          {step < 4 ? <button type="button" className="ride-wizard-next" onClick={() => goToStep(step + 1)} disabled={gettingGps || checkingPoint}>Continuar</button> : <button type="submit" disabled={sending || gettingGps || checkingPoint}>
          {sending ? "Enviando solicitud…" : "Buscar conductor"}
          </button>}
        </div>
      </form>
    </section>
  );
}

function RidePointPicker({ form, savePoint, clearPoint, disabled }) {
  const host = React.useRef(null);
  const map = React.useRef(null);
  const markers = React.useRef({});
  const [target, setTarget] = useState(form.pickup_lat == null ? "pickup" : "destination");
  const [candidate, setCandidate] = useState(null);
  const [mapError, setMapError] = useState(false);
  const { pickup_lat, pickup_lng, destination_lat, destination_lng } = form;

  useEffect(() => {
    const leaflet = window.L;
    if (!leaflet) {
      setMapError(true);
      return;
    }
    const instance = leaflet.map(host.current, { scrollWheelZoom: false }).setView([11.50, -85.98], 11);
    leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(instance);
    instance.on("click", ({ latlng }) => setCandidate(latlng));
    instance.on("dragstart", () => setCandidate(null));
    map.current = instance;
    return () => { instance.remove(); map.current = null; markers.current = {}; };
  }, []);

  useEffect(() => {
    if (!map.current) return;
    const points = [
      ["pickup", pickup_lat, pickup_lng, "A", "#087a4b"],
      ["destination", destination_lat, destination_lng, "B", "#f04438"],
      ["candidate", candidate?.lat, candidate?.lng, "?", "#92400e"],
    ];
    for (const [key, lat, lng, label, color] of points) {
      markers.current[key]?.remove();
      if (lat == null || lng == null) continue;
      markers.current[key] = window.L.circleMarker([lat, lng], {
        radius: 10, color: "#fff", weight: 2, fillColor: color, fillOpacity: 1, interactive: false,
      }).bindTooltip(label, { permanent: true, direction: "top", offset: [0, -8] }).addTo(map.current);
    }
  }, [pickup_lat, pickup_lng, destination_lat, destination_lng, candidate]);

  async function confirmPoint() {
    if (!map.current || disabled) return;
    const point = candidate || map.current.getCenter();
    if (await savePoint(target, point.lat, point.lng)) {
      setCandidate(null);
      if (target === "pickup" && destination_lat == null) setTarget("destination");
    }
  }

  if (mapError) return <p>El mapa no está disponible. Podés continuar con las direcciones escritas.</p>;

  return <section id="ride-point-picker" className="ride-point-picker" aria-label="Mapa de recogida y destino">
    <div className="ride-request-options">
      <button type="button" className="ride-secondary" aria-pressed={target === "pickup"}
        disabled={disabled} onClick={() => { setTarget("pickup"); setCandidate(null); }}><span className="ride-point-letter">A</span> Recogida{pickup_lat != null ? " ✓" : ""}</button>
      <button type="button" className="ride-secondary" aria-pressed={target === "destination"}
        disabled={disabled} onClick={() => { setTarget("destination"); setCandidate(null); }}><span className="ride-point-letter" data-point="B">B</span> Destino{destination_lat != null ? " ✓" : ""}</button>
    </div>
    <div className="ride-map-instructions"><strong>{target === "pickup" ? "Marcá tu punto de recogida" : "Marcá tu destino"}</strong><span>{target === "pickup" ? "Mové el mapa hasta el lugar exacto donde te esperamos." : "Mové el mapa hasta el lugar al que querés llegar."} Después tocá “Guardar punto”.</span></div>
    <div className="ride-map-frame">
      <div className="ride-map-canvas" ref={host} aria-label="Mapa de Ometepe" />
      {!candidate && <span className="ride-map-crosshair" aria-hidden="true">+</span>}
    </div>
    <button type="button" onClick={confirmPoint} disabled={disabled}>
      {disabled ? "Validando ubicación…" : "Guardar " + (target === "pickup" ? "punto A · Recogida" : "punto B · Destino")}
    </button>
    {(target === "pickup" ? pickup_lat != null : destination_lat != null) &&
      <button type="button" className="ride-secondary ride-clear-point" disabled={disabled} onClick={() => { clearPoint(target); setCandidate(null); }}>Quitar {target === "pickup" ? "punto A" : "punto B"}</button>}
  </section>;
}

function Offers({ notify, userId }) {
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
      if (data[0].driver_id) await loadConfirmedDriver(data[0].driver_id, data[0].id);
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
      .from("driver_public_profiles")
      .select("*")
      .in("driver_id", driverIds);

    const map = {};
    (data || []).forEach((driver) => {
      map[driver.driver_id] = driver;
    });

    setDriverCards(map);
    return map;
  }

  async function loadConfirmedDriver(driverId, rideId) {
    const [{ data: driver }, { data: plate }] = await Promise.all([
      supabase.from("driver_public_profiles").select("*").eq("driver_id", driverId).maybeSingle(),
      supabase.rpc("vuelo_get_confirmed_driver_plate", { p_ride_id: rideId }),
    ]);
    setConfirmedDriver(driver ? { ...driver, plate_number: plate || null } : null);
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

    const confirmCancel = window.confirm("¿Querés cancelar la búsqueda de conductor? Podés hacerlo mientras todavía no hayas aceptado una oferta.");
    if (!confirmCancel) return;

    const { data: cancelled, error } = await supabase.rpc("vuelo_cancel_own_ride", {
      p_ride_id: selectedRide.id,
    });

    if (error) {
      alert(error.message);
      return;
    }

    notify(cancelled ? "Solicitud cancelada." : "El viaje cambió. Revisá su estado actualizado.");
    loadMyRides();
  }

  async function rejectOffer(offer) {
    const { data: rejected, error } = await supabase.rpc("vuelo_reject_own_offer", {
      p_offer_id: offer.id,
    });
    if (error) notify(error.message);
    await loadMyRides();
  }

  async function confirmOffer(offer) {
    if (isOfferExpired(offer)) {
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
          <h2>Todavía no tenés viajes activos</h2>
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
            <>
              <RideChat key={selectedRide.id} rideId={selectedRide.id} userId={userId} />
              <RideTrackingMap key={selectedRide.id} ride={selectedRide} />
            </>
          )}

          {confirmedDriver && (
            <div className="driver-confirmed-card">
              {confirmedDriver.avatar_url ? (
                <img src={confirmedDriver.avatar_url} alt="Conductor" />
              ) : (
                <div>{firstName(confirmedDriver.display_name)[0]}</div>
              )}

              <section>
                <h3>{firstName(confirmedDriver.display_name)}</h3>
                <p>{confirmedDriver.vuelo_id || confirmedDriver.driver_code || "DRV-000000"} · ⭐ {confirmedDriver.rating || "5.00"}</p>
                <p>Color: <strong>{confirmedDriver.vehicle_color || "No registrado"}</strong></p>
                {confirmedDriver.plate_number && <p>Placa: <strong>{confirmedDriver.plate_number}</strong></p>}
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
            <h2>Buscando conductores…</h2>
            <p>Te avisaremos cuando un conductor envíe una oferta.</p>
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
                      <div>{firstName(driver.display_name)[0]}</div>
                    )}
                    <section>
                      <strong>{firstName(driver.display_name)}</strong>
                      <small>{driver.vuelo_id || driver.driver_code || "DRV-000000"} · ⭐ {driver.rating || "5.00"}</small>
                      <small>Color: {driver.vehicle_color || "No registrado"} · Vehículo: {[driver.vehicle_brand, driver.vehicle_model].filter(Boolean).join(" ") || "No registrado"}</small>
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
        .from("driver_public_profiles")
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
    if (submittedRatings[ride.id]) return;
    const stars = ratingStars[ride.id];
    if (!stars) {
      notify("Seleccioná de 1 a 5 estrellas.");
      return;
    }

    const { data: savedStars, error } = await supabase.rpc("vuelo_review_ride", {
      p_ride: ride.id,
      p_rating: stars,
      p_comment: ratingDrafts[ride.id] || null,
      p_as_driver: false,
    });
    if (error) {
      notify(error.message);
      return;
    }

    setRatingStars((prev) => ({ ...prev, [ride.id]: savedStars }));
    setSubmittedRatings((prev) => ({ ...prev, [ride.id]: true }));
    notify("Reseña guardada.");
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
          <h2>Todavía no tenés viajes anteriores</h2>
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
                  Conductor: <strong>{firstName(driver.display_name)}</strong> · {driver.vuelo_id || driver.driver_code}
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
                        maxLength={500}
                        aria-label="Comentario opcional"
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

function EmailMarketingPreference({profile}){
 const [enabled,setEnabled]=useState(false),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[message,setMessage]=useState("");
 useEffect(()=>{let active=true;(async()=>{const {data,error}=await supabase.from("marketing_subscribers").select("id,unsubscribed_at").eq("user_id",profile.id).eq("audience","passenger").maybeSingle();if(!active)return;setEnabled(Boolean(data&&!data.unsubscribed_at));if(error)setMessage("No pudimos consultar tus preferencias.");setLoading(false)})();return()=>{active=false}},[profile.id]);
 async function toggle(){setSaving(true);setMessage("");const {data,error}=await supabase.functions.invoke("vuelo-marketing-preferences",{body:{action:enabled?"unsubscribe":"subscribe",audience:"passenger"}});setSaving(false);if(error){setMessage("No pudimos guardar el cambio. Intentá nuevamente.");return;}setEnabled(!enabled);setMessage(data?.message||"Preferencia actualizada.");}
 return <div className="profile-section email-preference"><h2>Novedades de VUELO</h2><p>Recibí mensajes breves, promociones y novedades. Sin saturarte.</p><button type="button" onClick={toggle} disabled={loading||saving}>{loading?"Cargando…":saving?"Guardando…":enabled?"Dejar de recibir novedades":"Quiero recibir novedades"}</button>{message&&<small role="status">{message}</small>}<small>Podés cambiar esta preferencia cuando quieras.</small></div>
}
function Profile({ profile, onSwitchMode, switchingMode, handoffError }) {
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
    <section className="page profile-page">
      <div className="profile-hero">
        <div className="profile-avatar-wrap">
          {avatarUrl ? <img className="profile-photo" src={avatarUrl} alt="Foto de perfil" /> : <div className="avatar">{profile?.full_name?.[0] || "V"}</div>}
          <label className="profile-avatar-edit" aria-label="Cambiar foto de perfil">
            <Upload size={15}/>
            <input type="file" accept="image/*" onChange={uploadAvatar} disabled={uploading}/>
          </label>
        </div>
        <h1>{profile?.full_name || "Pasajero VUELO"}</h1>
        <p>{profile?.email || "Correo no disponible"}</p>
        <span className="profile-role-pill"><User size={14}/> Cuenta de pasajero</span>
      </div>

      {msg && <div className="message profile-message" role="status">{msg}</div>}

      <div className="profile-section">
        <h2>Mi información</h2>
        <div className="profile-details">
          <div className="profile-detail-row"><span><User size={17}/> Nombre completo</span><strong>{profile?.full_name || "No registrado"}</strong></div>
          <div className="profile-detail-row"><span><MessageCircle size={17}/> WhatsApp</span><strong>{profile?.phone || "No registrado"}</strong></div>
          <div className="profile-detail-row"><span><MapPin size={17}/> Ciudad</span><strong>{profile?.city || "Ometepe"}</strong></div>
          <div className="profile-detail-row"><span><ShieldCheck size={17}/> ID VUELO</span><strong>{profile?.vuelo_id || "En proceso"}</strong></div>
          {profile?.rating != null && <div className="profile-detail-row"><span><Star size={17}/> Calificación</span><strong>{Number(profile.rating).toFixed(2)} / 5</strong></div>}
        </div>
        <label className="profile-upload-wide">
          <Upload size={17}/>
          {uploading ? "Subiendo foto…" : "Cambiar foto de perfil"}
          <input type="file" accept="image/*" onChange={uploadAvatar} disabled={uploading}/>
        </label>
      </div>

      <button className="profile-driver-cta" type="button" onClick={onSwitchMode} disabled={switchingMode}>
        <span className="profile-driver-icon"><Car size={21}/></span>
        <span className="profile-driver-copy"><strong>{switchingMode ? "Preparando modo conductor…" : "Cambiar a modo conductor"}</strong><small>Accedé a las herramientas para conducir con VUELO</small></span>
        <ArrowRight size={19}/>
      </button>
      {handoffError && <div className="profile-mode-error" role="alert">{handoffError}</div>}

      <EmailMarketingPreference profile={profile}/>

      <div className="profile-help-note">
        <ShieldCheck size={18}/>
        <span>El modo conductor está disponible para cuentas con perfil de conductor aprobado.</span>
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
