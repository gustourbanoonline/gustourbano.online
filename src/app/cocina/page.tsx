 "use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Order } from "@/lib/types";
const labels:Record<string,string>={pending:"Nuevo",confirmed:"Pago confirmado",preparing:"En preparación",ready:"Listo",on_delivery:"En camino",delivered:"Entregado",cancelled:"Cancelado"};
export default function Kitchen(){const [orders,setOrders]=useState<Order[]>([]);const [user,setUser]=useState<any>(null);const [err,setErr]=useState("");
 const load=async()=>{if(!supabase)return;const {data:{user}}=await supabase.auth.getUser();setUser(user);if(!user)return;const {data,error}=await supabase.from("orders").select("*").in("status",["confirmed","preparing","ready"]).order("created_at");if(error)setErr(error.message);if(data)setOrders(data);};
 useEffect(()=>{load();if(!supabase)return;const channel=supabase.channel("kitchen-orders").on("postgres_changes",{event:"*",schema:"public",table:"orders"},()=>load()).subscribe();const timer=setInterval(load,15000);return()=>{supabase.removeChannel(channel);clearInterval(timer)}},[]);
 const move=async(id:string,status:string)=>{await supabase?.from("orders").update({status,updated_at:new Date().toISOString()}).eq("id",id);load();};
 if(!supabase)return <main className="wrap section">Configurá Supabase.</main>;
 if(!user)return <main className="wrap section"><div className="panel"><h2>Acceso de cocina</h2><p>Iniciá sesión con un usuario autorizado.</p><Link className="btn" href="/login">Ingresar</Link></div></main>;
 return <main className="wrap section"><div className="sectionHead"><div><div className="logo">GUSTO <span>URBANO.</span></div><h2>Pantalla de cocina</h2><p>Pedidos confirmados y en preparación.</p></div><Link href="/admin">Administración</Link></div>{err&&<div className="note">{err}</div>}<div className="orders">{orders.map(o=><article className="orderCard" key={o.id}><h2>#{o.order_number}</h2><span className="status">{labels[o.status]||o.status}</span><p className="muted">{new Date(o.created_at).toLocaleTimeString("es-UY",{hour:"2-digit",minute:"2-digit"})} · {o.neighborhood}</p><h3>{o.customer_name}</h3><ul>{o.items?.map((it,i)=><li key={i}><strong>{it.quantity} × {it.name}</strong>{it.note&&<div>{it.note}</div>}</li>)}</ul>{o.notes&&<div className="note">Indicaciones: {o.notes}</div>}<div className="actions">{o.status!=="preparing"&&<button className="green" onClick={()=>move(o.id,"preparing")}>Comenzar preparación</button>}{o.status!=="ready"&&<button onClick={()=>move(o.id,"ready")}>Marcar listo</button>}</div></article>)}</div>{!orders.length&&<div className="empty">No hay pedidos confirmados para preparar.</div>}</main>;
}
