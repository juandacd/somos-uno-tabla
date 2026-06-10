# ⚽ Somos Uno · Tabla Mundial 2026

Tabla de posiciones estilo Mundial FIFA 2026 para la reunión de jóvenes **Somos Uno Medellín**.

- **`index.html`** → tabla pública (se actualiza sola cada 30 s).
- **`admin.html`** → panel de líderes para cargar los resultados.
- **Backend** → un Google Sheet, expuesto como API con Google Apps Script.

Todo es **HTML/CSS/JS puro**: sin Node, sin build, sin servidor. Se publica en **GitHub Pages**.

---

## 🧠 Cómo funciona

```
admin.html  ──(POST: guarda resultados)──►  Apps Script  ──►  Google Sheet
index.html  ◄─(GET: lee cada 30 s)───────  Apps Script  ◄──  Google Sheet
```

El sistema de puntajes (en `js/data.js`, **no se cambia**):

| Concepto | Puntos |
|---|---|
| 1° en tarima | 1000 |
| 2° en tarima | 700 |
| 3° en tarima | 500 |
| 4°, 5°, 6° en tarima | 200 c/u |
| Bono de participación (1 selección por semana) | 500 |

4 semanas (S1–S4) · 6 selecciones.

---

## 1️⃣ Crear el Google Sheet + publicar el Apps Script

### Paso 1 — Crear la hoja de cálculo
1. Entra a [sheets.new](https://sheets.new) (con la cuenta de Google que vas a usar).
2. Ponle un nombre, por ejemplo **`Somos Uno – Tabla Mundial`**.

### Paso 2 — Pegar el código del Apps Script
1. En el menú del Sheet: **Extensiones → Apps Script**.
2. Borra el contenido de `Code.gs` y pega **todo** el contenido del archivo
   [`apps-script/Code.gs`](apps-script/Code.gs) de este proyecto.
3. (Opcional) Cambia la contraseña en la línea
   `var ADMIN_PASSWORD = 'somosuno2026';` — debe ser **igual** a la de `js/config.js`.
4. Guarda con el ícono 💾 (o `Ctrl/Cmd + S`).

### Paso 3 — Crear las hojas automáticamente
1. Arriba, en el selector de funciones, elige **`setup`** y pulsa **▶ Ejecutar**.
2. Google pedirá permisos la primera vez:
   - **Revisar permisos → elige tu cuenta → Configuración avanzada →
     "Ir a (nombre del proyecto) (no seguro)" → Permitir.**
3. Vuelve al Sheet: ahora tendrás dos pestañas, **`Resultados`** y **`Config`**, ya con
   los encabezados y la S1 de ejemplo.

### Paso 4 — Publicar como aplicación web (API)
1. En el editor de Apps Script: **Implementar → Nueva implementación**.
2. Engranaje ⚙ → tipo **"Aplicación web"**.
3. Configura:
   - **Descripción:** lo que quieras (ej. `API tabla`).
   - **Ejecutar como:** *Yo* (tu cuenta).
   - **Quién tiene acceso:** **Cualquier persona** ← importante.
4. **Implementar** → copia la **URL de la aplicación web** (termina en **`/exec`**).

> Si más adelante editas el código, usa **Implementar → Administrar implementaciones →
> ✏️ editar → Versión: Nueva versión** para que los cambios queden activos en la misma URL.

---

## 2️⃣ Conectar la app a tu Sheet

Abre **[`js/config.js`](js/config.js)** y pega tu URL:

```js
window.SU_CONFIG = {
  apiUrl: 'https://script.google.com/macros/s/AKfycb..../exec',  // ← tu URL /exec
  adminPassword: 'somosuno2026',   // ← igual a la del Apps Script
  pollMs: 30000,
};
```

Eso es lo **único** que necesitas configurar. Listo. ✅

---

## 3️⃣ Probar en local (opcional)

Abrir el `index.html` con doble clic **no** funciona bien por las políticas del navegador.
Levanta un servidor local rápido en la carpeta del proyecto:

```bash
# con Python
python -m http.server 5500
# o con Node
npx serve .
```

Luego abre `http://localhost:5500/index.html` y `http://localhost:5500/admin.html`.

---

## 4️⃣ Subir a GitHub Pages

1. Crea un repositorio en GitHub (público) y sube **todos** los archivos del proyecto:
   ```bash
   git init
   git add .
   git commit -m "Tabla Mundial Somos Uno"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
   git push -u origin main
   ```
   > También puedes arrastrar los archivos en **github.com → Add file → Upload files**.

2. En el repo: **Settings → Pages**.
3. En **Build and deployment → Source**, elige **Deploy from a branch**.
4. Branch: **`main`** · carpeta: **`/ (root)`** → **Save**.
5. Espera ~1 minuto. Tu sitio quedará en:
   ```
   https://TU-USUARIO.github.io/TU-REPO/
   ```
   - Tabla pública: `…/index.html`
   - Panel líderes: `…/admin.html`

---

## 🕹️ Uso del panel (admin.html)

1. Entra con la **contraseña** (`somosuno2026` por defecto).
2. Elige la **semana** en las pestañas (S1–S4). Puedes editar semanas anteriores.
3. **Orden de tarima:** arrastra ⠿ o usa ▲▼ para dejar las 6 selecciones del 1° al 6°.
4. **Bono de participación:** toca la selección que gana los +500 (toca de nuevo para quitar).
5. **💾 Guardar semana** → escribe en Google Sheets.
6. La tabla pública se actualiza sola en ~30 s (o al recargar / volver a la pestaña).

> **¿Cambiar la "semana en curso"?** Abre la pestaña **`Config`** del Sheet y cambia el
> valor de `currentWeek` (1–4). El hero y los chips "EN VIVO" se ajustan solos.

---

## 🗂️ Estructura del Sheet

**Hoja `Resultados`**

| Semana | Pos1 | Pos2 | Pos3 | Pos4 | Pos5 | Pos6 | Participacion |
|--------|------|------|------|------|------|------|---------------|
| S1 | colombia | brasil | espana | argentina | portugal | francia | |
| S2 | | | | | | | |
| S3 | | | | | | | |
| S4 | | | | | | | |

- `Pos1…Pos6` = **id** de la selección en ese puesto.
- IDs válidos: `espana`, `portugal`, `francia`, `argentina`, `colombia`, `brasil`.
- Una fila se considera "no jugada" hasta que tenga las **6** posiciones llenas.

**Hoja `Config`**

| Clave | Valor |
|-------|-------|
| currentWeek | 2 |

---

## ❓ Problemas comunes

| Síntoma | Solución |
|---|---|
| La tabla muestra solo la S1 de ejemplo | Falta pegar la `apiUrl` en `js/config.js` o la URL no termina en `/exec`. |
| "Contraseña incorrecta" al guardar | `adminPassword` en `config.js` ≠ `ADMIN_PASSWORD` en `Code.gs`. |
| No guarda / error de red | La implementación debe ser **"Cualquier persona"**. Vuelve a publicar **Nueva versión**. |
| Cambié el código y no surte efecto | Apps Script → **Administrar implementaciones → Nueva versión**. |
| "Sin conexión con la nube" | Revisa la URL y que el Sheet tenga las hojas `Resultados` y `Config` (corre `setup`). |

---

Hecho con cariño para **#SomosUno · #EncuentroDeNaciones26** 🇪🇸🇵🇹🇫🇷🇦🇷🇨🇴🇧🇷
