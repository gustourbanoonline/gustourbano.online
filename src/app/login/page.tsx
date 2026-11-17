 "use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
export default function Login(){const [email,setEmail]=useState("");const [password,setPassword]=useState("");const [error,setError]=useState("");const [busy,setBusy]=useState(false);const router=useRouter();
 const go=async()=>{if(!supabase){setError("Configurá Supabase primero.");return;}setBusy(true);const {error}=await supabase.auth.signInWithPassword({email,password});setBusy(false);if(error)setError(error.message);else router.push("/admin");};
 return <main className="wrap"><div className="login panel"><div className="logo">GUSTO <span>URBANO.</span></div><h2>Administración</h2><p className="muted">Ingresá con tu usuario administrador.</p><div className="field"><label>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)}/></div><div className="field"><label>Contraseña</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)}/></div>{error&&<div className="note">{error}</div>}<button className="btn" disabled={busy} onClick={go}>{busy?"Ingresando...":"Ingresar"}</button><p className="small"><a href="/">Volver a la tienda</a></p></div></main>;
}
