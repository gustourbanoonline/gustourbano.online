# GUSTO URBANO

Aplicación web gastronómica inicial para delivery en Montevideo.

## Requisitos
- Node.js 20.9 o superior
- Proyecto Supabase
- Windows 10/11, macOS o Linux

## Instalación en Windows
1. Descomprimir el ZIP en `C:\GUSTO-URBANO`.
2. Abrir PowerShell en esa carpeta.
3. Ejecutar:

```powershell
npm install
Copy-Item .env.example .env.local
```

4. Crear un proyecto en https://supabase.com
5. En Supabase > SQL Editor, ejecutar completo el archivo `supabase/schema.sql`.
6. Copiar la URL del proyecto y la clave `anon public` a `.env.local`.
7. Crear un usuario administrador en Supabase > Authentication > Users.
8. En Supabase > SQL Editor, ejecutar:
```sql
insert into public.profiles (id, role) values ('UUID_DEL_USUARIO_ADMIN', 'admin') on conflict (id) do update set role = 'admin';
```
9. Ejecutar:
```powershell
npm run dev
```
10. Abrir http://localhost:3000

## Secciones
- `/` tienda y carrito
- `/admin` administración, pedidos, productos y tarifas
- `/cocina` pantalla de cocina
- `/login` acceso de administrador

## Configuración inicial obligatoria
En `/admin` iniciar sesión con el usuario administrador creado en Supabase. Configurar los datos PREX, las tarifas y los productos.

## PREX personal
El sistema utiliza transferencia manual:
- El cliente ve los datos PREX configurados.
- Adjunta comprobante.
- El pedido queda como `payment_pending`.
- El administrador verifica el ingreso en PREX y marca el pago como confirmado.
- Nunca se confirma un pago solo por una imagen o comprobante.

## Tarifas
Las tarifas se administran desde el panel por zona. La configuración inicial incluye Centro, Cordón, Pocitos, Unión, Prado, Carrasco y Otras zonas. Se pueden editar y agregar zonas. Para cubrir Montevideo completo, configurar la tarifa de "Otras zonas" y revisar las zonas habilitadas.

## Importante
Esta es una primera versión funcional de base para instalar y configurar. Antes de publicar en internet:
- Completar credenciales Supabase.
- Configurar cuenta PREX real.
- Crear usuario administrador y proteger sus credenciales.
- Revisar tarifas, zonas, menú, alérgenos y condiciones de venta.
- Publicar en HTTPS (por ejemplo Vercel).
- Realizar pruebas de compra, comprobantes, cocina y permisos.
- Configurar políticas y monitoreo de Supabase.

No contiene integración automática con PREX ni confirmación bancaria automática.
