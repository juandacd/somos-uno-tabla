/* =====================================================================
   SOMOS UNO · TABLA MUNDIAL — Configuración
   ---------------------------------------------------------------------
   ⚠️  ÚNICO archivo que necesitas editar para conectar la app a tu
       Google Sheet. Sigue el README.md paso a paso.
   ===================================================================== */
window.SU_CONFIG = {
  /* Pega aquí la URL del despliegue de tu Google Apps Script.
     Termina en /exec  (NO en /dev). Ejemplo:
     'https://script.google.com/macros/s/AKfycb.../exec'            */
  apiUrl: 'https://script.google.com/macros/s/AKfycbwFWzufB0Gt3C1hpAFyU2W3LaW7pnPGNjOLJc8Y7k4qnQ-lAOzZOjvD9abdw2AVorkr/exec',

  /* Contraseña del panel de líderes (admin.html).
     Debe ser EXACTAMENTE la misma que pusiste en el Apps Script.   */
  adminPassword: 'somosuno2026',

  /* Cada cuántos milisegundos refresca la tabla pública (30s). */
  pollMs: 30000,
};
