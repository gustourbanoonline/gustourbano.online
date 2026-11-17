 "use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { CartLine, Product, Zone } from "@/lib/types";

const money=(n:number)=>new Intl.NumberFormat("es-UY",{style:"currency",currency:"UYU",maximumFractionDigits:0}).format(n);
const icons:Record<string,string>={Pizzas:"🍕",Hamburguesas:"🍔",Empanadas:"🥟",Bebidas:"🥤",Combos:"🍟"};
export default function Home(){
 const [products,setProducts]=useState<Product[]>([]);
 const [zones,setZones]=useState<Zone[]>([]);
 const [settings,setSettings]=useState<any>({});
 const [category,setCategory]=useState("Todos");
 const [cart,setCart]=useState<CartLine[]>([]);
 const [form,setForm]=useState({name:"",phone:"",address:"",neighborhood:"",notes:""});
 const [proof,setProof]=useState<File|null>(null);
 const [sent,setSent]=useState<string|null>(null);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 useEffect(()=>{(async()=>{
  if(!supabase){setMessage("Falta configurar Supabase. Seguí las instrucciones del README.");return;}
  const [p,z,s]=await Promise.all([supabase.from("products").select("*").eq("active",true).order("category"),supabase.from("delivery_zones").select("*").eq("active",true).order("name"),supabase.from("settings").select("*").eq("id",1).single()]);
  if(p.data)setProducts(p.data);if(z.data)setZones(z.data);if(s.data)setSettings(s.data);
 })()},[]);
 const categories=["Todos",...Array.from(new Set(products.map(p=>p.category)))];
 const shown=category==="Todos"?products:products.filter(p=>p.category===category);
 const subtotal=cart.reduce((s,l)=>s+l.product.price*l.quantity,0);
 const zone=zones.find(z=>z.name===form.neighborhood);
 const fee=zone?.fee??(zones.find(z=>z.name==="Otras zonas")?.fee??0);
 const total=subtotal+fee;
 const add=(p:Product)=>setCart(old=>{const x=old.find(l=>l.product.id===p.id);return x?old.map(l=>l.product.id===p.id?{...l,quantity:l.quantity+1}:l):[...old,{product:p,quantity:1,note:""}]});
 const change=(id:string,d:number)=>setCart(old=>old.map(l=>l.product.id===id?{...l,quantity:l.quantity+d}:l).filter(l=>l.quantity>0));
 const submit=async()=>{
  setMessage("");
  if(!supabase){setMessage("Configurá Supabase antes de realizar pedidos.");return;}
  if(!cart.length||!form.name||!form.phone||!form.address||!form.neighborhood){setMessage("Completá tus datos y agregá productos al carrito.");return;}
  if(!proof){setMessage("Adjuntá el comprobante de transferencia PREX.");return;}
  setBusy(true);
  try{
   const ext=proof.name.split(".").pop()?.toLowerCase()||"jpg";
   const path=`${crypto.randomUUID()}.${ext}`;
   const upload=await supabase.storage.from("payment-proofs").upload(path,proof,{upsert:false});
   if(upload.error)throw upload.error;
   const items=cart.map(l=>({name:l.product.name,quantity:l.quantity,price:l.product.price,note:l.note}));
   const {data,error}=await supabase.from("orders").insert({customer_name:form.name,customer_phone:form.phone,address:form.address,neighborhood:form.neighborhood,notes:form.notes,items,subtotal,delivery_fee:fee,total,payment_method:"prex_transfer",payment_status:"payment_pending",payment_proof:path,status:"pending"}).select("order_number").single();
   if(error)throw error;
   setSent(String(data.order_number));setCart([]);setProof(null);setForm({name:"",phone:"",address:"",neighborhood:"",notes:""});
  }catch(e:any){setMessage(e.message||"No se pudo enviar el pedido. Revisá la configuración.");}
  finally{setBusy(false);}
 };
 return <><div className="top"><div className="wrap"><span>🚴 Delivery en todo Montevideo</span><span>Pedidos online · Pago por PREX</span></div></div>
 <header className="nav"><div className="wrap navin"><div className="logo">GUSTO <span>URBANO.</span></div><div className="navlinks"><a href="#menu">Menú</a><a href="#pedido">Cómo pedir</a><a className="btn" href="#pedido">Mi pedido ({cart.reduce((s,l)=>s+l.quantity,0)})</a></div></div></header>
 <section className="hero"><div className="wrap heroGrid"><div><div className="eyebrow">El sabor que mueve la ciudad</div><h1>Tu antojo.<br/><span>Nuestro delivery.</span></h1><p>Pizzas, hamburguesas y empanadas para disfrutar donde estés. Elegí tus favoritos y recibí en tu casa.</p><a href="#menu" className="btn">Ver menú</a></div><div className="heroVisual">🍕 🍔 🥟</div></div></section>
 <main className="wrap"><section className="section" id="menu"><div className="sectionHead"><div><h2>Elegí algo rico</h2><p>Preparado al momento, directo a tu puerta.</p></div></div><div className="categories">{categories.map(c=><button key={c} className={`chip ${category===c?"active":""}`} onClick={()=>setCategory(c)}>{c}</button>)}</div>
 {message&&<div className="note">{message}</div>}
 <div className="products">{shown.map(p=><article className="product" key={p.id}><div className="productPic">{icons[p.category]||"🍽️"}</div><div className="productBody"><h3>{p.name}</h3><p>{p.description}</p><div className="productFoot"><span className="price">{money(p.price)}</span><button className="add" onClick={()=>add(p)} aria-label="Agregar">+</button></div></div></article>)}</div>
 {!products.length&&<div className="empty">El menú se mostrará aquí cuando se configure la conexión con Supabase.</div>}
 </section>
 <section className="section" id="pedido"><div className="sectionHead"><div><h2>Finalizá tu pedido</h2><p>Completá tus datos y adjuntá el comprobante PREX.</p></div></div>
 {sent?<div className="panel"><h2>¡Pedido recibido!</h2><p>Tu número de pedido es <strong>#{sent}</strong>.</p><p>El equipo verificará la transferencia en PREX antes de confirmar la preparación.</p><button className="btn" onClick={()=>setSent(null)}>Volver a la tienda</button></div>:
 <div className="grid2"><div className="panel"><h3>1. Tus datos</h3>
 {(["name","phone","address"] as const).map((k)=><div className="field" key={k}><label>{k==="name"?"Nombre y apellido":k==="phone"?"Teléfono / WhatsApp":"Dirección completa"}</label><input value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} placeholder={k==="name"?"Tu nombre":k==="phone"?"09X XXX XXX":"Calle, número y apartamento"}/></div>)}
 <div className="field"><label>Barrio / zona</label><select value={form.neighborhood} onChange={e=>setForm({...form,neighborhood:e.target.value})}><option value="">Seleccionar zona</option>{zones.map(z=><option key={z.id} value={z.name}>{z.name} — {money(z.fee)}</option>)}</select><span className="small">Si tu barrio no aparece, consultá por la zona antes de pagar.</span></div>
 <div className="field"><label>Indicaciones para el delivery</label><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Aclaraciones, timbre, referencias..."/></div>
 <h3>2. Transferencia PREX</h3><div className="note"><strong>Titular:</strong> {settings.prex_holder||"Configurar en administración"}<br/><strong>Alias:</strong> {settings.prex_alias||"Configurar en administración"}<br/><strong>Cuenta:</strong> {settings.prex_account||"Configurar en administración"}<br/><br/>{settings.prex_instructions||"Transferí el total y adjuntá el comprobante."}</div>
 <div className="field"><label>Comprobante de transferencia (imagen o PDF, máx. 5 MB)</label><input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={e=>setProof(e.target.files?.[0]||null)}/></div>
 <button className="btn" disabled={busy||!cart.length} onClick={submit}>{busy?"Enviando pedido...":"Enviar pedido"}</button>
 <p className="small">El pedido queda pendiente hasta verificar la acreditación real en PREX. No envíes datos sensibles de tu cuenta.</p>
 </div>
 <div className="cartbox"><h3>Tu carrito</h3>{cart.length?cart.map(l=><div className="cartrow" key={l.product.id}><div><strong>{l.product.name}</strong><div className="small">{money(l.product.price)} c/u</div><div className="actions"><button onClick={()=>change(l.product.id,-1)}>-</button><span>{l.quantity}</span><button onClick={()=>change(l.product.id,1)}>+</button></div></div><strong>{money(l.product.price*l.quantity)}</strong></div>):<div className="empty">Todavía no agregaste productos.</div>}
 <div className="total"><span>Subtotal</span><strong>{money(subtotal)}</strong></div><div className="total"><span>Delivery ({form.neighborhood||"zona sin elegir"})</span><strong>{money(fee)}</strong></div><div className="total big"><span>Total</span><strong>{money(total)}</strong></div><div className="note">Las tarifas de envío se configuran desde el panel administrativo. La zona seleccionada determina el costo mostrado.</div></div></div>}
 </section></main>
 <footer className="footer"><div className="wrap"><div className="logo">GUSTO <span>URBANO.</span></div><p>El sabor que mueve la ciudad. Delivery en Montevideo.</p><p>© {new Date().getFullYear()} GUSTO URBANO</p></div></footer></>;
}
