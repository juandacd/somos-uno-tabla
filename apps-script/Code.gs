/* =====================================================================
   SOMOS UNO · TABLA MUNDIAL — Google Apps Script (backend / API)
   ---------------------------------------------------------------------
   Expone el Google Sheet como una mini-API:
     • GET  → devuelve los resultados de las 4 semanas + la semana en curso
     • POST → guarda (o edita) los resultados de UNA semana

   Estructura de hojas que usa (créala con setup() una sola vez):

   Hoja "Resultados"
   ┌────────┬──────┬─────┬──────┬───────────────┬────────┐
   │ Semana │ Pos1 │ ... │ Pos6 │ Participacion │ Puntos │
   ├────────┼──────┼─────┼──────┼───────────────┼────────┤
   │ S1     │ ...  │ ... │ ...  │ ...           │        │
   │ S2     │      │     │      │               │        │
   │ S3     │      │     │      │               │        │
   │ S4     │      │     │      │               │        │
   └────────┴──────┴─────┴──────┴───────────────┴────────┘
   · Pos1..Pos6  = id de la selección en ese puesto. Celdas vacías = no jugada.
   · Participacion = id que gana el bono de +500 esa semana.
   · Puntos = (opcional) JSON con puntos personalizados por equipo para
     semanas especiales, ej: {"portugal":700,"brasil":700,...}. Si está
     lleno, manda sobre el puntaje por puesto.

   Hoja "Config"
   ┌─────────────┬───────┐
   │ Clave       │ Valor │
   ├─────────────┼───────┤
   │ currentWeek │ 2     │
   └─────────────┴───────┘
   ===================================================================== */

/* 🔒 Debe coincidir con adminPassword de js/config.js */
var ADMIN_PASSWORD = 'somosuno2026';

var SHEET_RESULTS = 'Resultados';
var SHEET_CONFIG  = 'Config';
var WEEKS = ['S1', 'S2', 'S3', 'S4'];

/* ---------------------------------------------------------------------
   GET — leer datos
   --------------------------------------------------------------------- */
function doGet(e) {
  try {
    return json({ ok: true, currentWeek: getCurrentWeek(), results: readResults() });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/* ---------------------------------------------------------------------
   POST — escribir datos
   Body (text/plain con JSON):
   { password, week, order:[6 ids], participation:id|null, currentWeek?:n }
   --------------------------------------------------------------------- */
function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    if (body.password !== ADMIN_PASSWORD) {
      return json({ ok: false, error: 'Contraseña incorrecta.' });
    }
    if (WEEKS.indexOf(body.week) === -1) {
      return json({ ok: false, error: 'Semana no válida.' });
    }

    writeWeek(body.week, body.order || [], body.participation || '', body.points || null);

    if (body.currentWeek) setCurrentWeek(body.currentWeek);

    return json({ ok: true, currentWeek: getCurrentWeek(), results: readResults() });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/* ---------------------------------------------------------------------
   Lectura / escritura del Sheet
   --------------------------------------------------------------------- */
function readResults() {
  var sheet = ss().getSheetByName(SHEET_RESULTS);
  var rows = sheet.getDataRange().getValues();   // incluye encabezado
  var out = { S1: null, S2: null, S3: null, S4: null };

  for (var r = 1; r < rows.length; r++) {
    var week = String(rows[r][0]).trim();
    if (WEEKS.indexOf(week) === -1) continue;

    var order = [];
    for (var c = 1; c <= 6; c++) {
      var id = String(rows[r][c] || '').trim();
      if (id) order.push(id);
    }
    var part = String(rows[r][7] || '').trim();

    // Columna 9 (índice 8): puntos personalizados en JSON (opcional)
    var pointsRaw = String(rows[r][8] || '').trim();
    var points = null;
    if (pointsRaw) { try { points = JSON.parse(pointsRaw); } catch (e) { points = null; } }

    if (points) {
      // Semana especial: se considera jugada por tener puntos personalizados
      out[week] = { order: order, participation: part || null, points: points };
    } else {
      // Semana normal sin orden completo => "no jugada" (null)
      out[week] = order.length === 6 ? { order: order, participation: part || null } : null;
    }
  }
  return out;
}

function writeWeek(week, order, participation, points) {
  var sheet = ss().getSheetByName(SHEET_RESULTS);
  var rows = sheet.getDataRange().getValues();
  var targetRow = -1;

  for (var r = 1; r < rows.length; r++) {
    if (String(rows[r][0]).trim() === week) { targetRow = r + 1; break; } // 1-based
  }
  if (targetRow === -1) {                       // no existía: la agregamos
    sheet.appendRow([week, '', '', '', '', '', '', '']);
    targetRow = sheet.getLastRow();
  }

  var line = [week];
  for (var i = 0; i < 6; i++) line.push(order[i] || '');
  line.push(participation || '');
  line.push(points ? JSON.stringify(points) : '');
  sheet.getRange(targetRow, 1, 1, 9).setValues([line]);
}

/* ---------------------------------------------------------------------
   Config (semana en curso)
   --------------------------------------------------------------------- */
function getCurrentWeek() {
  var sheet = ss().getSheetByName(SHEET_CONFIG);
  if (!sheet) return 2;
  var rows = sheet.getDataRange().getValues();
  for (var r = 1; r < rows.length; r++) {
    if (String(rows[r][0]).trim() === 'currentWeek') {
      var n = parseInt(rows[r][1], 10);
      return (n >= 1 && n <= 4) ? n : 2;
    }
  }
  return 2;
}

function setCurrentWeek(n) {
  n = parseInt(n, 10);
  if (!(n >= 1 && n <= 4)) return;
  var sheet = ss().getSheetByName(SHEET_CONFIG);
  var rows = sheet.getDataRange().getValues();
  for (var r = 1; r < rows.length; r++) {
    if (String(rows[r][0]).trim() === 'currentWeek') {
      sheet.getRange(r + 1, 2).setValue(n);
      return;
    }
  }
  sheet.appendRow(['currentWeek', n]);
}

/* ---------------------------------------------------------------------
   Utilidades
   --------------------------------------------------------------------- */
function ss() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------------------------------------------------------------------
   ⚙️ setup() — ejecútalo UNA vez desde el editor para crear las hojas
   con los encabezados y datos de ejemplo correctos.
   --------------------------------------------------------------------- */
function setup() {
  var book = ss();

  // Hoja Resultados
  var res = book.getSheetByName(SHEET_RESULTS) || book.insertSheet(SHEET_RESULTS);
  res.clear();
  res.getRange(1, 1, 1, 9).setValues([
    ['Semana', 'Pos1', 'Pos2', 'Pos3', 'Pos4', 'Pos5', 'Pos6', 'Participacion', 'Puntos']
  ]);
  res.getRange(2, 1, 4, 9).setValues([
    // Semana 1 de ejemplo (puedes borrarla y volverla a poner desde el panel)
    ['S1', 'colombia', 'brasil', 'espana', 'argentina', 'portugal', 'francia', '', ''],
    ['S2', '', '', '', '', '', '', '', ''],
    ['S3', '', '', '', '', '', '', '', ''],
    ['S4', '', '', '', '', '', '', '', ''],
  ]);
  res.getRange(1, 1, 1, 9).setFontWeight('bold');
  res.setFrozenRows(1);

  // Hoja Config
  var cfg = book.getSheetByName(SHEET_CONFIG) || book.insertSheet(SHEET_CONFIG);
  cfg.clear();
  cfg.getRange(1, 1, 1, 2).setValues([['Clave', 'Valor']]);
  cfg.getRange(2, 1, 1, 2).setValues([['currentWeek', 2]]);
  cfg.getRange(1, 1, 1, 2).setFontWeight('bold');
  cfg.setFrozenRows(1);

  // Borra cualquier hoja sobrante "Hoja 1" / "Sheet1"
  ['Hoja 1', 'Hoja1', 'Sheet1'].forEach(function (name) {
    var s = book.getSheetByName(name);
    if (s && book.getSheets().length > 1) book.deleteSheet(s);
  });

  SpreadsheetApp.getActive().toast('Listo: hojas Resultados y Config creadas.');
}
