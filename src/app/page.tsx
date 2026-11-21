"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { CartLine, Product, Zone } from "@/lib/types";

const money = (n: number) =>
  new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
    maximumFractionDigits: 0,
  }).format(n);

const icons: Record<string, string> = {
  Pizzas: "🍕",
  Hamburguesas: "🍔",
  Empanadas: "🥟",
  Bebidas: "🥤",
  Combos: "🍟",
};

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [category, setCategory] = useState("Todos");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    neighborhood: "",
    notes: "",
  });
  const [proof, setProof] = useState<File | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!supabase) {
        setMessage("Falta configurar Supabase.");
        return;
      }

      const [p, z, s] = await Promise.all([
        supabase.from("products").select("*").eq("active", true).order("category"),
        supabase.from("delivery_zones").select("*").eq("active", true).order("name"),
        supabase.from("settings").select("*").eq("id", 1).single(),
      ]);

      if (p.data) setProducts(p.data);
      if (z.data) setZones(z.data);
      if (s.data) setSettings(s.data);

      if (p.error || z.error || s.error) {
        setMessage("No se pudieron cargar todos los datos de la tienda.");
      }
    };

    load();
  }, []);

  useEffect(() => {
    if (!selectedProduct) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedProduct(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedProduct]);

  const categories = [
    "Todos",
    ...Array.from(new Set(products.map((p) => p.category))),
  ];

  const shown =
    category === "Todos"
      ? products
      : products.filter((p) => p.category === category);

  const subtotal = cart.reduce(
    (sum, line) => sum + line.product.price * line.quantity,
    0
  );

  const zone = zones.find((z) => z.name === form.neighborhood);
  const fee = zone?.fee ?? 0;
  const total = subtotal + fee;

  const openProduct = (product: Product) => {
    setSelectedQuantity(1);
    setSelectedProduct(product);
  };

  const closeProduct = () => {
    setSelectedProduct(null);
    setSelectedQuantity(1);
  };

  const add = (product: Product, quantity = 1) => {
    setCart((old) => {
      const existing = old.find((line) => line.product.id === product.id);

      return existing
        ? old.map((line) =>
            line.product.id === product.id
              ? { ...line, quantity: line.quantity + quantity }
              : line
          )
        : [...old, { product, quantity, note: "" }];
    });
  };

  const change = (id: string, difference: number) => {
    setCart((old) =>
      old
        .map((line) =>
          line.product.id === id
            ? { ...line, quantity: line.quantity + difference }
            : line
        )
        .filter((line) => line.quantity > 0)
    );
  };

  const submit = async () => {
    setMessage("");

    if (!supabase) {
      setMessage("No está disponible la conexión con Supabase.");
      return;
    }

    if (
      !cart.length ||
      !form.name.trim() ||
      !form.phone.trim() ||
      !form.address.trim() ||
      !form.neighborhood
    ) {
      setMessage("Completá tus datos y agregá productos al carrito.");
      return;
    }

    if (!proof) {
      setMessage("Adjuntá el comprobante de transferencia bancaria.");
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];

    if (!allowedTypes.includes(proof.type)) {
      setMessage("El comprobante debe ser una imagen JPG, PNG, WEBP o PDF.");
      return;
    }

    if (proof.size > 5 * 1024 * 1024) {
      setMessage("El comprobante no puede superar los 5 MB.");
      return;
    }

    setBusy(true);

    try {
      const extension = proof.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${crypto.randomUUID()}.${extension}`;

      const upload = await supabase.storage
        .from("payment-proofs")
        .upload(path, proof, { upsert: false });

      if (upload.error) throw upload.error;

      const items = cart.map((line) => ({
        name: line.product.name,
        quantity: line.quantity,
        price: line.product.price,
        note: line.note,
      }));

      const { data, error } = await supabase.rpc("create_public_order", {
        p_customer_name: form.name.trim(),
        p_customer_phone: form.phone.trim(),
        p_address: form.address.trim(),
        p_neighborhood: form.neighborhood,
        p_notes: form.notes.trim(),
        p_items: items,
        p_subtotal: subtotal,
        p_delivery_fee: fee,
        p_total: total,
        p_payment_proof: path,
      });

      if (error) throw error;

      if (data === null || data === undefined) {
        throw new Error("El pedido se registró sin devolver un número.");
      }

      setSent(String(data));
      setCart([]);
      setProof(null);
      setForm({
        name: "",
        phone: "",
        address: "",
        neighborhood: "",
        notes: "",
      });
    } catch (error: unknown) {
      const detail =
        error instanceof Error ? error.message : "Error desconocido";

      setMessage(`No se pudo enviar el pedido: ${detail}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="top">
        <div className="wrap">
          <span>🚴 Delivery en todo Montevideo</span>
          <span>Pedidos online · Transferencia bancaria</span>
        </div>
      </div>

      <header className="nav">
        <div className="wrap navin">
          <div className="logo">
            GUSTO <span>URBANO.</span>
          </div>
          <div className="navlinks">
            <a href="#menu">Menú</a>
            <a href="#pedido">Cómo pedir</a>
            <a className="btn" href="#pedido">
              Mi pedido ({cart.reduce((sum, line) => sum + line.quantity, 0)})
            </a>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="wrap heroGrid">
          <div>
            <div className="eyebrow">El sabor que mueve la ciudad</div>
            <h1>
              Tu antojo.
              <br />
              <span>Nuestro delivery.</span>
            </h1>
            <p>
              Pizzas, hamburguesas y empanadas para disfrutar donde estés.
              Elegí tus favoritos y recibí en tu casa.
            </p>
            <a href="#menu" className="btn">
              Ver menú
            </a>
          </div>
          <div className="heroVisual">🍕 🍔 🥟</div>
        </div>
      </section>

      <main className="wrap">
        <section className="section" id="menu">
          <div className="sectionHead">
            <div>
              <h2>Elegí algo rico</h2>
              <p>Preparado al momento, directo a tu puerta.</p>
            </div>
          </div>

          <div className="categories">
            {categories.map((item) => (
              <button
                key={item}
                className={`chip ${category === item ? "active" : ""}`}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>

          {message && <div className="note">{message}</div>}

          <div className="products">
            {shown.map((product) => (
              <button
                type="button"
                className="product productSelect"
                key={product.id}
                onClick={() => openProduct(product)}
                aria-label={`Ver ${product.name}`}
              >
                {product.image_url ? (
                  <img
                    className="productPic"
                    src={product.image_url}
                    alt={product.name}
                    loading="lazy"
                  />
                ) : (
                  <div className="productPic">
                    {icons[product.category] || "🍽️"}
                  </div>
                )}
                <span className="productBody">
                  <span className="productTitle">{product.name}</span>
                  <span className="productDescription">{product.description}</span>
                  <span className="productFoot">
                    <span className="price">{money(product.price)}</span>
                    <span className="add" aria-hidden="true">
                      +
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </div>

          {!products.length && (
            <div className="empty">
              El menú se mostrará aquí cuando se carguen los productos.
            </div>
          )}
        </section>

        <section className="section" id="pedido">
          <div className="sectionHead">
            <div>
              <h2>Finalizá tu pedido</h2>
              <p>Completá tus datos y adjuntá el comprobante de transferencia.</p>
            </div>
          </div>

          {sent ? (
            <div className="panel">
              <h2>¡Pedido recibido!</h2>
              <p>
                Tu número de pedido es <strong>#{sent}</strong>.
              </p>
              <p>
                Verificaremos la acreditación bancaria antes de confirmar la
                preparación.
              </p>
              <button className="btn" onClick={() => setSent(null)}>
                Volver a la tienda
              </button>
            </div>
          ) : (
            <div className="grid2">
              <div className="panel">
                <h3>1. Tus datos</h3>

                {(["name", "phone", "address"] as const).map((key) => (
                  <div className="field" key={key}>
                    <label>
                      {key === "name"
                        ? "Nombre y apellido"
                        : key === "phone"
                          ? "Teléfono / WhatsApp"
                          : "Dirección completa"}
                    </label>
                    <input
                      value={form[key]}
                      onChange={(e) =>
                        setForm({ ...form, [key]: e.target.value })
                      }
                      placeholder={
                        key === "name"
                          ? "Tu nombre"
                          : key === "phone"
                            ? "09X XXX XXX"
                            : "Calle, número y apartamento"
                      }
                    />
                  </div>
                ))}

                <div className="field">
                  <label>Barrio / zona</label>
                  <select
                    value={form.neighborhood}
                    onChange={(e) =>
                      setForm({ ...form, neighborhood: e.target.value })
                    }
                  >
                    <option value="">Seleccionar zona</option>
                    {zones.map((item) => (
                      <option key={item.id} value={item.name}>
                        {item.name} — {money(item.fee)}
                      </option>
                    ))}
                  </select>
                  <span className="small">
                    Si tu barrio no aparece, consultá por la zona antes de
                    realizar la transferencia.
                  </span>
                </div>

                <div className="field">
                  <label>Indicaciones para el delivery</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) =>
                      setForm({ ...form, notes: e.target.value })
                    }
                    placeholder="Aclaraciones, timbre, referencias..."
                  />
                </div>

                <h3>2. Transferencia bancaria</h3>

                <div className="note">
                  <strong>Banco:</strong> {settings.bank_name || "Itaú"}
                  <br />
                  <strong>Titular:</strong>{" "}
                  {settings.bank_holder || "Configurar en administración"}
                  <br />
                  <strong>Tipo de cuenta:</strong>{" "}
                  {settings.bank_account_type || "Caja de ahorro"}
                  <br />
                  <strong>Moneda:</strong> {settings.bank_currency || "UYU"}
                  <br />
                  <strong>Número de cuenta:</strong>{" "}
                  {settings.bank_account_number || "Configurar en administración"}
                  <br />
                  <br />
                  {settings.bank_instructions ||
                    "Transferí el importe total y adjuntá el comprobante."}
                </div>

                <div className="field">
                  <label>
                    Comprobante de transferencia (imagen o PDF, máximo 5 MB)
                  </label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    onChange={(e) => setProof(e.target.files?.[0] || null)}
                  />
                  {proof && (
                    <span className="small">
                      Archivo seleccionado: {proof.name}
                    </span>
                  )}
                </div>

                <button
                  className="btn"
                  disabled={busy || !cart.length}
                  onClick={submit}
                >
                  {busy ? "Enviando pedido..." : "Enviar pedido"}
                </button>

                <p className="small">
                  El pedido quedará pendiente hasta que administración
                  verifique la acreditación real de la transferencia.
                </p>
              </div>

              <div className="cartbox">
                <h3>Tu carrito</h3>

                {cart.length ? (
                  cart.map((line) => (
                    <div className="cartrow" key={line.product.id}>
                      <div>
                        <strong>{line.product.name}</strong>
                        <div className="small">
                          {money(line.product.price)} c/u
                        </div>
                        <div className="actions">
                          <button onClick={() => change(line.product.id, -1)}>
                            -
                          </button>
                          <span>{line.quantity}</span>
                          <button onClick={() => change(line.product.id, 1)}>
                            +
                          </button>
                        </div>
                      </div>
                      <strong>
                        {money(line.product.price * line.quantity)}
                      </strong>
                    </div>
                  ))
                ) : (
                  <div className="empty">Todavía no agregaste productos.</div>
                )}

                <div className="total">
                  <span>Subtotal</span>
                  <strong>{money(subtotal)}</strong>
                </div>
                <div className="total">
                  <span>Delivery ({form.neighborhood || "zona sin elegir"})</span>
                  <strong>{money(fee)}</strong>
                </div>
                <div className="total big">
                  <span>Total</span>
                  <strong>{money(total)}</strong>
                </div>
                <div className="note">
                  La tarifa de envío depende de la zona seleccionada y se
                  configura desde el panel administrativo.
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {selectedProduct && (
        <div
          className="productModal"
          onClick={closeProduct}
          role="presentation"
        >
          <div
            className="productModalPanel"
            role="dialog"
            aria-modal="true"
            aria-label={`Detalle de ${selectedProduct.name}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="productModalClose"
              onClick={closeProduct}
              aria-label="Cerrar"
            >
              ×
            </button>

            {selectedProduct.image_url ? (
              <img
                className="productModalImage"
                src={selectedProduct.image_url}
                alt={selectedProduct.name}
              />
            ) : (
              <div className="productModalImage productModalPlaceholder">
                {icons[selectedProduct.category] || "🍽️"}
              </div>
            )}

            <div className="productModalContent">
              <div className="productModalCategory">
                {selectedProduct.category}
              </div>
              <h2>{selectedProduct.name}</h2>
              <p className="productModalDescription">
                {selectedProduct.description || "Preparado especialmente para vos."}
              </p>

              <div className="productModalPrice">
                {money(selectedProduct.price)}
              </div>

              <div className="quantityBlock">
                <span>Cantidad</span>
                <div className="quantitySelector">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedQuantity((quantity) => Math.max(1, quantity - 1))
                    }
                    aria-label="Restar una unidad"
                  >
                    −
                  </button>
                  <strong>{selectedQuantity}</strong>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedQuantity((quantity) => quantity + 1)
                    }
                    aria-label="Agregar una unidad"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="productModalTotal">
                <span>Total del producto</span>
                <strong>
                  {money(selectedProduct.price * selectedQuantity)}
                </strong>
              </div>

              <button
                type="button"
                className="btn productModalAdd"
                onClick={() => {
                  add(selectedProduct, selectedQuantity);
                  closeProduct();
                }}
              >
                Agregar al pedido
              </button>

              <button
                type="button"
                className="productModalContinue"
                onClick={closeProduct}
              >
                Seguir mirando el menú
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="footer">
        <div className="wrap">
          <div className="logo">
            GUSTO <span>URBANO.</span>
          </div>
          <p>El sabor que mueve la ciudad. Delivery en Montevideo.</p>
          <p>© {new Date().getFullYear()} GUSTO URBANO</p>
        </div>
      </footer>
    </>
  );
}