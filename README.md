# Sistema Contable

Registro de facturas de compra y venta para estudios contables paraguayos, con
extraccion automatica de datos desde imagenes y PDFs usando GPT-4o Vision.

Reemplaza al Extractor de Facturas hecho en Google Apps Script
(`D:\CLAUDE\FACTURAS`), que guardaba todo en una hoja de Google Sheets.

## Como esta armado

```
empresas (estudio contable)      ← el limite de aislamiento
  ├── usuarios
  └── contribuyentes             ← los clientes del estudio
        ├── plan_cuentas         ← categorizacion jerarquica (cuenta, denominacion, nivel, etc.)
        └── facturas ── factura_detalles
```

Un usuario **solo ve datos de su empresa**. Eso no depende del frontend: lo
garantiza Row Level Security en Postgres. El unico que atraviesa empresas es el
`super_admin`, que gestiona los estudios desde `/admindrpcs`.

**Stack:** React + TypeScript + Vite · Tailwind v4 · React Router · Supabase
(Postgres + Auth + Storage) · Vercel Serverless Functions · OpenAI GPT-4o Vision.

## Puesta en marcha

### 1. Supabase

Crear un proyecto y correr, en orden, todo `supabase/migrations/*.sql` en el
**SQL Editor**. `004_super_admin.sql` es la unica que no se corre de una: hay
que crear antes el usuario super admin en **Authentication → Users → Add user**
(marcando *Auto Confirm User*) y recien ahi correrla, cambiando el email por
el que se uso.

### 2. Variables de entorno

Copiar `.env.example` a `.env` y completar con los valores de
**Project Settings → API**.

Las `VITE_*` viajan al navegador y estan pensadas para eso. Las otras tres son
**solo del servidor**: si a alguna se le pone el prefijo `VITE_`, la clave
termina publicada dentro del bundle.

### 3. Correr

```bash
npm install
npm run dev
```

## Deploy

Vercel autodetecta Vite. Hay que cargar las cinco variables de entorno en
**Settings → Environment Variables** (las tres del servidor sin prefijo).

El `vercel.json` reescribe todo hacia `index.html` **menos** `/api/*`, para que
recargar con F5 en una ruta profunda no de 404 y las funciones sigan andando.

## PWA y versionado

La app es instalable (manifest + service worker) y cachea de forma segura:
los assets de Vite (`/assets/*`) llevan hash de contenido y se sirven
cache-first; todo lo demas (HTML, `/api/*`, Supabase) es siempre red primero,
para que los datos contables nunca queden desactualizados.

El nombre del cache del service worker incluye la version de `package.json`,
asi que **hacer una release es un solo paso**: subir el campo `"version"` de
`package.json` (o `npm version patch`) y desplegar. El build (`vite.config.ts`,
plugin `swVersionado`) genera `dist/sw.js` con esa version ya inyectada — no
hay dos archivos que mantener sincronizados a mano.

Los iconos (`public/icons/`, `public/favicon*`, `public/logo.svg`) se generan
con `node scripts/generate-icons.mjs` (necesita `npm install --no-save sharp`
antes de correrlo). Si se cambia el logo, se edita el SVG dentro de ese script
y se vuelve a correr.

## Notas

- Los montos de la factura paraguaya (`exentas`, `gravado_5`, `gravado_10`)
  vienen **con IVA incluido**: `total = exentas + gravado_5 + gravado_10`.
  `iva_total` y `subtotal` los calcula Postgres, no se cargan a mano.
- El digito verificador del RUC solo genera una **advertencia** visual; nunca
  frena el guardado.
- De los PDF se rasteriza la primera pagina para mandarla a la IA, pero a
  Storage se sube el archivo original completo.
