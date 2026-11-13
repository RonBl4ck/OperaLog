/**
 * OperaLog - Backend Google Apps Script para Google Sheets
 * Hojas requeridas: Turnos_Capacidad, Catalogos, Usuarios_Contratas, Auditoria_Cambios
 */

const SHEETS = {
  TURNOS: 'Turnos_Capacidad',
  CATALOGOS: 'Catalogos',
  USUARIOS: 'Usuarios_Contratas',
  AUDITORIA: 'Auditoria_Cambios',
};

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Hoja no encontrada: ' + name);
  return sheet;
}

function normalizeDateValue(val) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return val !== undefined && val !== null ? String(val).trim() : '';
}

function sheetToObjects(sheetName) {
  const sheet = getSheet(sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(h => String(h).trim());
  return values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      const val = row[i];
      if (val instanceof Date) {
        obj[h] = h === 'fecha'
          ? Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd')
          : val.toISOString();
      } else {
        obj[h] = val !== undefined && val !== null ? String(val).trim() : '';
      }
    });
    return obj;
  });
}

function doGet(e) {
  try {
    const action = (e.parameter.action || '').trim();

    if (action === 'listUsers') {
      const users = sheetToObjects(SHEETS.USUARIOS)
        .filter(u => String(u.activo).toUpperCase() === 'TRUE')
        .map(u => ({
          usuario: u.usuario,
          rol: u.rol,
          contratista: u.contratista,
          nombre_mostrar: u.nombre_mostrar,
        }));
      return jsonResponse({ ok: true, users });
    }

    if (action === 'getCatalogs') {
      const catalogs = sheetToObjects(SHEETS.CATALOGOS)
        .map(c => ({
          tipo: c.tipo,
          frente: c.frente,
          valor: c.valor,
          orden: Number(c.orden) || 1,
          activo: String(c.activo).toUpperCase() === 'TRUE',
        }))
        .filter(c => c.activo);
      return jsonResponse({ ok: true, catalogs });
    }

    if (action === 'getContratas') {
      const users = sheetToObjects(SHEETS.USUARIOS);
      const contratas = [...new Set(
        users.filter(u => u.rol === 'CONTRATA' && String(u.activo).toUpperCase() === 'TRUE').map(u => u.contratista)
      )];
      return jsonResponse({ ok: true, contratas });
    }

    if (action === 'login') {
      const usuario = (e.parameter.usuario || '').trim().toLowerCase();
      const pin = (e.parameter.pin || '').trim();
      const users = sheetToObjects(SHEETS.USUARIOS);
      const found = users.find(
        u => u.usuario.toLowerCase() === usuario && u.pin === pin && u.activo.toUpperCase() === 'TRUE'
      );
      if (!found) {
        return jsonResponse({ ok: false, error: 'Credenciales inválidas o usuario inactivo.' });
      }
      const catalogs = sheetToObjects(SHEETS.CATALOGOS)
        .map(c => ({
          tipo: c.tipo,
          frente: c.frente,
          valor: c.valor,
          orden: Number(c.orden) || 1,
          activo: String(c.activo).toUpperCase() === 'TRUE',
        }))
        .filter(c => c.activo);
      const contratas = [...new Set(
        users.filter(u => u.rol === 'CONTRATA' && u.activo.toUpperCase() === 'TRUE').map(u => u.contratista)
      )];
      return jsonResponse({
        ok: true,
        user: {
          usuario: found.usuario,
          rol: found.rol,
          contratista: found.contratista,
          nombre_mostrar: found.nombre_mostrar,
        },
        catalogs,
        contratas,
      });
    }

    if (action === 'getAllCatalogs') {
      const catalogs = sheetToObjects(SHEETS.CATALOGOS).map(c => ({
        tipo: c.tipo,
        frente: c.frente,
        valor: c.valor,
        orden: Number(c.orden) || 1,
        activo: String(c.activo).toUpperCase() === 'TRUE',
      }));
      return jsonResponse({ ok: true, catalogs });
    }

    if (action === 'getTurn') {
      const fecha = (e.parameter.fecha || '').trim();
      const contratista = (e.parameter.contratista || '').trim();
      const rol = (e.parameter.rol || 'CONTRATA').trim();
      const allRows = sheetToObjects(SHEETS.TURNOS);
      const filtered = allRows.filter(r => {
        if (r.fecha !== fecha) return false;
        if (rol === 'ADMIN' && (contratista === 'ALL' || !contratista)) return true;
        return r.contratista === contratista;
      });
      return jsonResponse({ ok: true, rows: filtered });
    }

    if (action === 'getLastTurn') {
      const fecha = (e.parameter.fecha || '').trim();
      const contratista = (e.parameter.contratista || '').trim();
      const allRows = sheetToObjects(SHEETS.TURNOS).filter(
        r => r.contratista === contratista && r.fecha < fecha
      );
      if (allRows.length === 0) {
        return jsonResponse({ ok: true, rows: [], sourceDate: null });
      }
      const dates = [...new Set(allRows.map(r => r.fecha))].sort();
      const lastDate = dates[dates.length - 1];
      const rows = allRows.filter(r => r.fecha === lastDate);
      return jsonResponse({ ok: true, rows, sourceDate: lastDate });
    }

    return jsonResponse({ ok: false, error: 'Acción GET no soportada: ' + action });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    if (action === 'saveTurn') {
      if (body.rol === 'ADMIN') {
        return jsonResponse({
          ok: false,
          error: 'El perfil ADMIN es solo de lectura y no puede modificar turnos de contratistas.',
        });
      }
      const { usuario, contratista, fecha, rows } = body;
      if (!fecha || !contratista || !Array.isArray(rows)) {
        return jsonResponse({ ok: false, error: 'Payload inválido para saveTurn.' });
      }

      const sheet = getSheet(SHEETS.TURNOS);
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const nowIso = new Date().toISOString();

      const keptRows = data.slice(1).filter(r => {
        const rowFecha = normalizeDateValue(r[1]);
        const rowContrata = String(r[2]).trim();
        return !(rowFecha === fecha && rowContrata === contratista);
      });

      const newRows = rows.map((item, idx) => [
        item.id || `${fecha}_${contratista}_${item.frente}_${idx + 1}`,
        fecha,
        contratista,
        item.frente || '',
        item.nombres || '',
        item.usuario_ssam || '',
        item.celular || '',
        item.actividad || '',
        item.skill || '',
        item.horario || '',
        nowIso,
        usuario || '',
      ]);

      const finalData = [headers, ...keptRows, ...newRows];
      sheet.clearContents();
      if (finalData.length > 0) {
        sheet.getRange(1, 1, finalData.length, headers.length).setValues(finalData);
      }

      const auditSheet = getSheet(SHEETS.AUDITORIA);
      auditSheet.appendRow([nowIso, usuario, contratista, fecha, 'SAVE_TURN', newRows.length]);

      return jsonResponse({ ok: true, savedCount: newRows.length });
    }

    if (action === 'saveCatalog') {
      if (body.rol !== 'ADMIN') {
        return jsonResponse({ ok: false, error: 'Solo ADMIN puede modificar catálogos.' });
      }
      const sheet = getSheet(SHEETS.CATALOGOS);
      const headers = sheet.getRange(1, 1, 1, 5).getValues()[0];
      const newRows = (body.items || []).map(c => [
        c.tipo,
        c.frente,
        c.valor,
        Number(c.orden) || 1,
        c.activo ? 'TRUE' : 'FALSE',
      ]);
      sheet.clearContents();
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      if (newRows.length > 0) {
        sheet.getRange(2, 1, newRows.length, headers.length).setValues(newRows);
      }
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ ok: false, error: 'Acción POST no soportada: ' + action });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  } finally {
    lock.releaseLock();
  }
}
