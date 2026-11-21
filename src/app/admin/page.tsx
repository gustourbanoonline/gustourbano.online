"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Order, Product, Zone } from "@/lib/types";

const money = (n: number) =>
  new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
    maximumFractionDigits: 0,
  }).format(n);

const emptyProduct = {
  name: "",
  category: "Pizzas",
  description: "",
  price: "",
};

export default function Admin() {
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [msg, setMsg] = useState("");
  const [newProduct, setNewProduct] = useState(emptyProduct);
  const [productImage, setProductImage] = useState<File | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState("");
  const [savingProduct, setSavingProduct] = useState(false);
  const [newZone, setNewZone] = useState({ name: "", fee: "" });
  const [tab, setTab] = useState("orders");

  const load = async () => {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    setUser(currentUser);

    if (!currentUser) return;

    const [o, p, z, s] = await Promise.all([
      supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("products").select("*").order("category"),
      supabase.from("delivery_zones").select("*").order("name"),
      supabase.from("settings").select("*").eq("id", 1).single(),
    ]);

    if (o.error) setMsg(`Error al cargar pedidos: ${o.error.message}`);
    else if (o.data) setOrders(o.data);

    if (p.error) setMsg(`Error al cargar productos: ${p.error.message}`);
    else if (p.data) setProducts(p.data);

    if (z.error) setMsg(`Error al cargar zonas: ${z.error.message}`);
    else if (z.data) setZones(z.data);

    if (s.error) setMsg(`Error al cargar configuración: ${s.error.message}`);
    else if (s.data) setSettings(s.data);
  };

  const loadOrders = async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) setMsg(`Error al actualizar pedidos: ${error.message}`);
    else if (data) setOrders(data);
  };

  useEffect(() => {
    void load();

    const channel = supabase
      .channel("admin-orders-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          void loadOrders();
        }
      )
      .subscribe();

    const refreshInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadOrders();
      }
    }, 15000);

    return () => {
      window.clearInterval(refreshInterval);
      void supabase.removeChannel(channel);
    };
  }, []);

  const updateOrder = async (id: string, patch: any) => {
    const { error } = await supabase
      .from("orders")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);

    setMsg(error?.message || "Pedido actualizado correctamente.");
    if (!error) await load();
  };

  const resetProductForm = () => {
    setNewProduct(emptyProduct);
    setProductImage(null);
    setEditingProductId(null);
    setCurrentImageUrl("");
  };

  const uploadProductImage = async (file: File) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      throw new Error("La foto debe ser JPG, PNG o WEBP.");
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error("La foto no puede superar los 5 MB.");
    }

    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${crypto.randomUUID()}.${extension}`;

    const { error } = await supabase.storage
      .from("product-images")
      .upload(path, file, { upsert: false });

    if (error) throw error;

    const { data } = supabase.storage
      .from("product-images")
      .getPublicUrl(path);

    return data.publicUrl;
  };

  const saveProduct = async () => {
    if (!newProduct.name.trim() || !newProduct.price || Number(newProduct.price) < 0) {
      setMsg("Completá el nombre y un precio válido para el producto.");
      return;
    }

    setSavingProduct(true);
    setMsg("");

    try {
      let imageUrl = currentImageUrl;

      if (productImage) {
        imageUrl = await uploadProductImage(productImage);
      }

      const productData = {
        name: newProduct.name.trim(),
        category: newProduct.category,
        description: newProduct.description.trim(),
        price: Number(newProduct.price),
        image_url: imageUrl || null,
      };

      const result = editingProductId
        ? await supabase
            .from("products")
            .update(productData)
            .eq("id", editingProductId)
        : await supabase.from("products").insert(productData);

      if (result.error) throw result.error;

      setMsg(
        editingProductId
          ? "Producto actualizado correctamente."
          : "Producto agregado correctamente."
      );
      resetProductForm();
      await load();
    } catch (error: unknown) {
      setMsg(error instanceof Error ? `${error.message} | Detalle: ${JSON.stringify(error)}` : JSON.stringify(error));
    } finally {
      setSavingProduct(false);
    }
  };

  const editProduct = (product: Product) => {
    setEditingProductId(product.id);
    setNewProduct({
      name: product.name,
      category: product.category,
      description: product.description || "",
      price: String(product.price),
    });
    setCurrentImageUrl(product.image_url || "");
    setProductImage(null);
    setMsg(`Editando: ${product.name}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveZone = async () => {
    if (!newZone.name.trim() || newZone.fee === "") {
      setMsg("Completá el nombre y la tarifa de la zona.");
      return;
    }

    const { error } = await supabase.from("delivery_zones").insert({
      name: newZone.name.trim(),
      fee: Number(newZone.fee),
    });

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg("Zona agregada correctamente.");
    setNewZone({ name: "", fee: "" });
    await load();
  };

  const saveSettings = async () => {
    const { error } = await supabase
      .from("settings")
      .update({
        bank_name: settings.bank_name,
        bank_holder: settings.bank_holder,
        bank_account_type: settings.bank_account_type,
        bank_currency: settings.bank_currency,
        bank_account_number: settings.bank_account_number,
        bank_instructions: settings.bank_instructions,
        whatsapp: settings.whatsapp,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);

    setMsg(error?.message || "Configuración bancaria guardada.");
  };

  const signout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const openProof = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("payment-proofs")
      .createSignedUrl(path, 300);

    if (error || !data?.signedUrl) {
      setMsg("No se pudo abrir el comprobante.");
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  if (!user) {
    return (
      <main className="wrap section">
        <div className="panel">
          <h2>Acceso requerido</h2>
          <p>Iniciá sesión para administrar el negocio.</p>
          <Link className="btn" href="/login">
            Ingresar
          </Link>
        </div>
      </main>
    );
  }

  const pending = orders.filter(
    (order) => order.payment_status === "payment_pending"
  ).length;

  const paidTotal = orders
    .filter((order) => order.payment_status === "paid")
    .reduce((sum, order) => sum + order.total, 0);

  return (
    <main className="wrap section">
      <div className="sectionHead">
        <div>
          <div className="logo">
            GUSTO <span>URBANO.</span>
          </div>
          <h2>Panel administrativo</h2>
          <p>Gestión del negocio y delivery en Montevideo.</p>
        </div>
        <button className="btn dark" onClick={signout}>
          Salir
        </button>
      </div>

      <div className="stats">
        <div className="stat">
          <span className="muted">Pedidos</span>
          <strong>{orders.length}</strong>
        </div>
        <div className="stat">
          <span className="muted">Pagos pendientes</span>
          <strong>{pending}</strong>
        </div>
        <div className="stat">
          <span className="muted">Ventas pagadas</span>
          <strong>{money(paidTotal)}</strong>
        </div>
      </div>

      <nav className="adminNav">
        {[
          ["orders", "Pedidos"],
          ["products", "Productos"],
          ["zones", "Tarifas delivery"],
          ["settings", "Datos bancarios"],
        ].map(([value, label]) => (
          <button
            key={value}
            className={`chip ${tab === value ? "active" : ""}`}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
        <Link href="/cocina">Pantalla cocina →</Link>
      </nav>

      {msg && <div className="note">{msg}</div>}

      {tab === "orders" && (
        <>
          <h2>Pedidos recibidos</h2>
          <div className="orders">
            {orders.map((order) => (
              <article className="orderCard" key={order.id}>
                <h3>
                  Pedido #{order.order_number} · {money(order.total)}
                </h3>
                <span className="status">
                  {order.payment_status === "paid"
                    ? "PAGO CONFIRMADO"
                    : order.payment_status === "rejected"
                      ? "PAGO RECHAZADO"
                      : "PAGO PENDIENTE"}
                </span>
                <p>
                  <strong>{order.customer_name}</strong> · {order.customer_phone}
                </p>
                <p>{order.address}, {order.neighborhood}</p>
                <p className="muted">
                  {new Date(order.created_at).toLocaleString("es-UY")}
                </p>
                <ul>
                  {order.items?.map((item, index) => (
                    <li key={index}>
                      {item.quantity} × {item.name} — {money(item.price)}{" "}
                      {item.note}
                    </li>
                  ))}
                </ul>
                {order.notes && <p>Notas: {order.notes}</p>}
                <p>
                  Subtotal {money(order.subtotal)} · Envío {money(order.delivery_fee)}
                </p>
                <p className="small">
                  Método de pago:{" "}
                  {order.payment_method === "bank_transfer"
                    ? "Transferencia bancaria"
                    : order.payment_method}
                </p>
                <div className="actions">
                  {order.payment_proof && (
                    <button onClick={() => openProof(order.payment_proof)}>
                      Ver comprobante
                    </button>
                  )}
                  {order.payment_status !== "paid" && (
                    <button
                      className="green"
                      onClick={() =>
                        updateOrder(order.id, {
                          payment_status: "paid",
                          status: "confirmed",
                        })
                      }
                    >
                      Confirmar pago verificado
                    </button>
                  )}
                  {order.payment_status !== "rejected" && (
                    <button
                      onClick={() =>
                        updateOrder(order.id, { payment_status: "rejected" })
                      }
                    >
                      Rechazar pago
                    </button>
                  )}
                  <button onClick={() => updateOrder(order.id, { status: "preparing" })}>
                    Preparando
                  </button>
                  <button onClick={() => updateOrder(order.id, { status: "ready" })}>
                    Listo
                  </button>
                  <button onClick={() => updateOrder(order.id, { status: "on_delivery" })}>
                    En camino
                  </button>
                  <button onClick={() => updateOrder(order.id, { status: "delivered" })}>
                    Entregado
                  </button>
                </div>
              </article>
            ))}
          </div>
          {!orders.length && <div className="empty">Todavía no hay pedidos.</div>}
        </>
      )}

      {tab === "products" && (
        <>
          <h2>Productos</h2>
          <div className="panel">
            <h3>{editingProductId ? "Editar producto" : "Agregar producto"}</h3>
            <div className="grid2">
              <div className="field">
                <label>Nombre</label>
                <input
                  value={newProduct.name}
                  onChange={(event) =>
                    setNewProduct({ ...newProduct, name: event.target.value })
                  }
                />
              </div>
              <div className="field">
                <label>Categoría</label>
                <select
                  value={newProduct.category}
                  onChange={(event) =>
                    setNewProduct({ ...newProduct, category: event.target.value })
                  }
                >
                  {["Pizzas", "Hamburguesas", "Empanadas", "Bebidas", "Combos"].map(
                    (item) => (
                      <option key={item}>{item}</option>
                    )
                  )}
                </select>
              </div>
              <div className="field">
                <label>Descripción</label>
                <input
                  value={newProduct.description}
                  onChange={(event) =>
                    setNewProduct({ ...newProduct, description: event.target.value })
                  }
                />
              </div>
              <div className="field">
                <label>Precio UYU</label>
                <input
                  type="number"
                  min="0"
                  value={newProduct.price}
                  onChange={(event) =>
                    setNewProduct({ ...newProduct, price: event.target.value })
                  }
                />
              </div>
            </div>

            <div className="field">
              <label>Fotografía del producto (JPG, PNG o WEBP, máximo 5 MB)</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) =>
                  setProductImage(event.target.files?.[0] || null)
                }
              />
              {productImage && (
                <span className="small">Foto seleccionada: {productImage.name}</span>
              )}
            </div>

            {(productImage || currentImageUrl) && (
              <div style={{ margin: "12px 0" }}>
                <img
                  src={productImage ? URL.createObjectURL(productImage) : currentImageUrl}
                  alt="Vista previa del producto"
                  style={{
                    width: 150,
                    height: 120,
                    objectFit: "cover",
                    borderRadius: 12,
                  }}
                />
              </div>
            )}

            <div className="actions">
              <button className="btn" onClick={saveProduct} disabled={savingProduct}>
                {savingProduct
                  ? "Guardando..."
                  : editingProductId
                    ? "Guardar cambios"
                    : "Agregar producto"}
              </button>
              {editingProductId && (
                <button className="btn light" onClick={resetProductForm}>
                  Cancelar edición
                </button>
              )}
            </div>
          </div>

          <div className="orders" style={{ marginTop: 16 }}>
            {products.map((product) => (
              <div className="orderCard" key={product.id}>
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    style={{
                      width: "100%",
                      height: 150,
                      objectFit: "cover",
                      borderRadius: 12,
                      marginBottom: 10,
                    }}
                  />
                ) : null}
                <strong>{product.name}</strong>
                <p>{product.category} · {money(product.price)}</p>
                <div className="actions">
                  <button className="btn light" onClick={() => editProduct(product)}>
                    Editar
                  </button>
                  <button
                    className="btn light"
                    onClick={async () => {
                      const { error } = await supabase
                        .from("products")
                        .update({ active: !product.active })
                        .eq("id", product.id);
                      setMsg(error?.message || "Producto actualizado.");
                      if (!error) await load();
                    }}
                  >
                    {product.active ? "Desactivar" : "Activar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "zones" && (
        <>
          <h2>Tarifas de delivery</h2>
          <p className="muted">
            Editá el precio de cada zona. Para barrios no listados, agregá la
            zona o usá Otras zonas.
          </p>
          {zones.map((zone) => (
            <div className="cartrow" key={zone.id}>
              <strong>{zone.name}</strong>
              <input
                aria-label={`Tarifa de ${zone.name}`}
                type="number"
                min="0"
                defaultValue={zone.fee}
                style={{ maxWidth: 130, padding: 9 }}
                onBlur={async (event) => {
                  const { error } = await supabase
                    .from("delivery_zones")
                    .update({ fee: Number(event.target.value) })
                    .eq("id", zone.id);
                  setMsg(error?.message || "Tarifa guardada.");
                  if (!error) await load();
                }}
              />
              <button
                className="btn light"
                onClick={async () => {
                  const { error } = await supabase
                    .from("delivery_zones")
                    .update({ active: !zone.active })
                    .eq("id", zone.id);
                  setMsg(error?.message || "Zona actualizada.");
                  if (!error) await load();
                }}
              >
                {zone.active ? "Desactivar" : "Activar"}
              </button>
            </div>
          ))}
          <div className="panel" style={{ marginTop: 18 }}>
            <h3>Nueva zona</h3>
            <div className="grid2">
              <div className="field">
                <label>Nombre</label>
                <input
                  value={newZone.name}
                  onChange={(event) =>
                    setNewZone({ ...newZone, name: event.target.value })
                  }
                />
              </div>
              <div className="field">
                <label>Tarifa UYU</label>
                <input
                  type="number"
                  min="0"
                  value={newZone.fee}
                  onChange={(event) =>
                    setNewZone({ ...newZone, fee: event.target.value })
                  }
                />
              </div>
            </div>
            <button className="btn" onClick={saveZone}>
              Agregar zona
            </button>
          </div>
        </>
      )}

      {tab === "settings" && (
        <>
          <h2>Datos para transferencias bancarias</h2>
          <div className="panel">
            {[
              ["bank_name", "Banco"],
              ["bank_holder", "Titular de la cuenta"],
              ["bank_account_type", "Tipo de cuenta"],
              ["bank_currency", "Moneda"],
              ["bank_account_number", "Número de cuenta"],
              ["whatsapp", "WhatsApp del negocio"],
            ].map(([key, label]) => (
              <div className="field" key={key}>
                <label>{label}</label>
                <input
                  value={settings[key] || ""}
                  onChange={(event) =>
                    setSettings({ ...settings, [key]: event.target.value })
                  }
                />
              </div>
            ))}
            <div className="field">
              <label>Instrucciones de pago</label>
              <textarea
                value={settings.bank_instructions || ""}
                onChange={(event) =>
                  setSettings({ ...settings, bank_instructions: event.target.value })
                }
              />
            </div>
            <button className="btn" onClick={saveSettings}>
              Guardar configuración bancaria
            </button>
            <p className="small">
              Los datos bancarios se mostrarán en la tienda para que los
              clientes puedan realizar la transferencia. Los pagos deben
              verificarse manualmente antes de confirmarlos.
            </p>
          </div>
        </>
      )}
    </main>
  );
}
