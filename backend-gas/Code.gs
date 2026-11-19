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

const EDITABLE_TURN_FIELDS = [
  'frente',
  'nombres',
  'usuario_ssam',
  'celular',
  'actividad',
  'skill',
  'horario',
];

function parseAdminEditedFieldsList(raw) {
  const tokens = String(raw || '')
    .split(/[,;|]+/)
    .map(t => t.trim().toLowerCase())
    .filter(t => EDITABLE_TURN_FIELDS.indexOf(t) !== -1);
  const unique = [];
  tokens.forEach(t => {
    if (unique.indexOf(t) === -1) {
      unique.push(t);
    }
  });
  return unique;
}

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

function parseGroups(raw, fallback) {
  const upper = String(raw || '').trim().toUpperCase();
  if (!upper) {
    return fallback === 'ALL' ? ['ALL'] : [fallback || 'BT'];
  }
  const tokens = upper
    .split(/[,;|]+/)
    .map(t => t.trim())
    .filter(Boolean);
  if (tokens.indexOf('ALL') !== -1) {
    return ['ALL'];
  }
  const valid = [];
  tokens.forEach(t => {
    if (valid.indexOf(t) === -1) {
      valid.push(t);
    }
  });
  if (valid.length > 0) return valid;
  return fallback === 'ALL' ? ['ALL'] : [fallback || 'BT'];
}

function normalizeGroup(raw, fallback) {
  const upper = String(raw || '').trim().toUpperCase();
  return upper.length > 0 ? upper : (fallback || 'BT');
}

function matchesGroup(itemGrupo, targetGrupo) {
  if (!targetGrupo || targetGrupo === 'ALL') return true;
  const normalizedItem = normalizeGroup(itemGrupo, 'BT');
  if (normalizedItem === 'ALL') return true;
  const allowed = parseGroups(targetGrupo, 'ALL');
  if (allowed.indexOf('ALL') !== -1) return true;
  return allowed.indexOf(normalizedItem) !== -1;
}

function buildContrataGroupMap(users) {
  const map = {};
  users.forEach(u => {
    if (u.rol === 'CONTRATA' && u.contratista) {
      map[u.contratista] = normalizeGroup(u.grupo, 'BT');
    }
  });
  return map;
}

function mapCatalogRow(c) {
  const tipo = String(c.tipo || '').trim().toUpperCase();
  return {
    tipo: tipo,
    frente: c.frente,
    valor: c.valor,
    orden: Number(c.orden) || 1,
    activo: String(c.activo).toUpperCase() === 'TRUE',
    grupo: normalizeGroup(c.grupo, tipo === 'HORARIO' ? 'ALL' : 'BT'),
  };
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
        .map(u => {
          const allowed = parseGroups(u.grupo, u.rol === 'ADMIN' ? 'ALL' : 'BT');
          const grupoValue = u.rol === 'ADMIN'
            ? (allowed.indexOf('ALL') !== -1 ? 'ALL' : allowed.join(','))
            : allowed[0];
          return {
            usuario: u.usuario,
            rol: u.rol,
            contratista: u.contratista,
            nombre_mostrar: u.nombre_mostrar,
            grupo: grupoValue,
          };
        });
      return jsonResponse({ ok: true, users });
    }

    if (action === 'getCatalogs') {
      const targetGrupo = e.parameter.grupo ? normalizeGroup(e.parameter.grupo, 'ALL') : 'ALL';
      const catalogs = sheetToObjects(SHEETS.CATALOGOS)
        .map(mapCatalogRow)
        .filter(c => c.activo && matchesGroup(c.grupo, targetGrupo));
      return jsonResponse({ ok: true, catalogs });
    }

    if (action === 'getContratas') {
      const targetGrupo = e.parameter.grupo ? normalizeGroup(e.parameter.grupo, 'ALL') : 'ALL';
      const users = sheetToObjects(SHEETS.USUARIOS)
        .filter(u => u.rol === 'CONTRATA' && String(u.activo).toUpperCase() === 'TRUE');
      const contrataGroupMap = buildContrataGroupMap(users);
      const allMeta = Object.keys(contrataGroupMap).map(nombre => ({
        nombre: nombre,
        grupo: contrataGroupMap[nombre],
      }));
      const contratasMeta = targetGrupo === 'ALL'
        ? allMeta
        : allMeta.filter(m => m.grupo === targetGrupo);
      const contratas = contratasMeta.map(m => m.nombre);
      return jsonResponse({ ok: true, contratas, contratasMeta });
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
      const allowedGroups = parseGroups(found.grupo, found.rol === 'ADMIN' ? 'ALL' : 'BT');
      const isAllAdmin = allowedGroups.indexOf('ALL') !== -1;
      const userGrupo = found.rol === 'ADMIN'
        ? (isAllAdmin ? 'ALL' : allowedGroups.join(','))
        : allowedGroups[0];
      const allCatalogs = sheetToObjects(SHEETS.CATALOGOS).map(mapCatalogRow);
      const catalogs = found.rol === 'ADMIN'
        ? (userGrupo === 'ALL' ? allCatalogs : allCatalogs.filter(c => matchesGroup(c.grupo, userGrupo)))
        : allCatalogs.filter(c => c.activo && matchesGroup(c.grupo, userGrupo));

      const activeContratas = users.filter(
        u => u.rol === 'CONTRATA' && String(u.activo).toUpperCase() === 'TRUE'
      );
      const contrataGroupMap = buildContrataGroupMap(activeContratas);
      const allMeta = Object.keys(contrataGroupMap).map(nombre => ({
        nombre: nombre,
        grupo: contrataGroupMap[nombre],
      }));
      const contratasMeta = userGrupo === 'ALL'
        ? allMeta
        : allMeta.filter(m => allowedGroups.indexOf(m.grupo) !== -1);
      const contratas = contratasMeta.map(m => m.nombre);

      return jsonResponse({
        ok: true,
        user: {
          usuario: found.usuario,
          rol: found.rol,
          contratista: found.contratista,
          nombre_mostrar: found.nombre_mostrar,
          grupo: userGrupo,
          ver_historico: String(found.ver_historico || '').trim().toUpperCase() === 'TRUE',
        },
        catalogs,
        contratas,
        contratasMeta,
      });
    }

    if (action === 'getAllCatalogs') {
      const targetGrupo = e.parameter.grupo ? normalizeGroup(e.parameter.grupo, 'ALL') : 'ALL';
      const catalogs = sheetToObjects(SHEETS.CATALOGOS)
        .map(mapCatalogRow)
        .filter(c => matchesGroup(c.grupo, targetGrupo));
      return jsonResponse({ ok: true, catalogs });
    }

    if (action === 'getTurn') {
      const fecha = (e.parameter.fecha || '').trim();
      const contratista = (e.parameter.contratista || '').trim();
      const rol = (e.parameter.rol || 'CONTRATA').trim();
      const targetGrupo = e.parameter.grupo ? normalizeGroup(e.parameter.grupo, 'ALL') : 'ALL';
      const contrataGroupMap = buildContrataGroupMap(sheetToObjects(SHEETS.USUARIOS));
      const allRows = sheetToObjects(SHEETS.TURNOS).map(r => ({
        ...r,
        grupo: normalizeGroup(r.grupo, contrataGroupMap[r.contratista] || 'BT'),
        admin_edited_fields: parseAdminEditedFieldsList(r.admin_edited_fields),
      }));
      const filtered = allRows.filter(r => {
        if (r.fecha !== fecha) return false;
        if (targetGrupo !== 'ALL' && r.grupo !== targetGrupo) return false;
        if (rol === 'ADMIN' && (contratista === 'ALL' || !contratista)) return true;
        return r.contratista === contratista;
      });
      return jsonResponse({ ok: true, rows: filtered });
    }

    if (action === 'getTurnsRange') {
      const fechaInicio = (e.parameter.fechaInicio || '').trim();
      const fechaFin = (e.parameter.fechaFin || '').trim();
      const contratista = (e.parameter.contratista || '').trim();
      const rol = (e.parameter.rol || 'CONTRATA').trim();
      const targetGrupo = e.parameter.grupo ? normalizeGroup(e.parameter.grupo, 'ALL') : 'ALL';
      const contrataGroupMap = buildContrataGroupMap(sheetToObjects(SHEETS.USUARIOS));
      const allRows = sheetToObjects(SHEETS.TURNOS).map(r => ({
        ...r,
        grupo: normalizeGroup(r.grupo, contrataGroupMap[r.contratista] || 'BT'),
        admin_edited_fields: parseAdminEditedFieldsList(r.admin_edited_fields),
      }));
      const filtered = allRows.filter(r => {
        if (!r.fecha) return false;
        if (fechaInicio && r.fecha < fechaInicio) return false;
        if (fechaFin && r.fecha > fechaFin) return false;
        if (targetGrupo !== 'ALL' && r.grupo !== targetGrupo) return false;
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
      const normalizedFecha = normalizeDateValue(fecha);
      const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
      if (normalizedFecha < today) {
        return jsonResponse({
          ok: false,
          error: 'No se pueden modificar ni guardar registros de días anteriores (' + normalizedFecha + ').',
        });
      }

      const sheet = getSheet(SHEETS.TURNOS);
      const data = sheet.getDataRange().getValues();
      const rawHeaders = data.length > 0
        ? data[0].map(h => String(h || '').trim())
        : [];
      const headers = rawHeaders.length > 0
        ? [...rawHeaders]
        : ['id', 'fecha', 'contratista', 'frente', 'nombres', 'usuario_ssam', 'celular', 'actividad', 'skill', 'horario', 'updated_at', 'updated_by'];
      if (headers.indexOf('grupo') === -1) {
        headers.push('grupo');
      }
      const grupoColIdx = headers.indexOf('grupo');

      const contrataGroupMap = buildContrataGroupMap(sheetToObjects(SHEETS.USUARIOS));
      const defaultTurnGrupo = normalizeGroup(body.grupo, contrataGroupMap[contratista] || 'BT');
      const nowIso = new Date().toISOString();

      const keptRows = data.slice(1)
        .filter(r => {
          const rowFecha = normalizeDateValue(r[1]);
          const rowContrata = String(r[2]).trim();
          return !(rowFecha === fecha && rowContrata === contratista);
        })
        .map(r => {
          const normalized = r.slice(0, headers.length);
          while (normalized.length < headers.length) {
            normalized.push('');
          }
          return normalized;
        });

      const newRows = rows.map((item, idx) => {
        const baseRow = [
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
        ];
        while (baseRow.length < headers.length) {
          baseRow.push('');
        }
        baseRow[grupoColIdx] = normalizeGroup(item.grupo, defaultTurnGrupo);
        return baseRow;
      });

      const finalData = [headers, ...keptRows, ...newRows];
      sheet.clearContents();
      if (finalData.length > 0) {
        sheet.getRange(1, 1, finalData.length, headers.length).setValues(finalData);
      }

      const auditSheet = getSheet(SHEETS.AUDITORIA);
      auditSheet.appendRow([nowIso, usuario, contratista, fecha, 'SAVE_TURN', newRows.length]);

      return jsonResponse({ ok: true, savedCount: newRows.length });
    }

    if (action === 'updateTurnRow') {
      const usuario = String(body.usuario || '').trim().toLowerCase();
      const id = String(body.id || '').trim();
      const contratista = String(body.contratista || '').trim();
      const normalizedFecha = normalizeDateValue(body.fecha);
      const changes = body.changes && typeof body.changes === 'object' ? body.changes : null;

      if (!usuario || !id || !contratista || !normalizedFecha || !changes) {
        return jsonResponse({ ok: false, error: 'Payload inválido para updateTurnRow.' });
      }

      const users = sheetToObjects(SHEETS.USUARIOS);
      const adminUser = users.find(
        u =>
          String(u.usuario || '').trim().toLowerCase() === usuario &&
          String(u.activo || '').trim().toUpperCase() === 'TRUE' &&
          String(u.rol || '').trim().toUpperCase() === 'ADMIN'
      );
      if (!adminUser) {
        return jsonResponse({
          ok: false,
          error: 'Solo usuarios activos con rol ADMIN pueden editar registros.',
        });
      }

      const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
      if (normalizedFecha !== today) {
        return jsonResponse({
          ok: false,
          error: 'Solo se pueden editar registros del día de hoy (' + today + ').',
        });
      }

      const allowedGroups = parseGroups(adminUser.grupo, 'ALL');
      const adminUserGrupo = allowedGroups.indexOf('ALL') !== -1 ? 'ALL' : allowedGroups.join(',');

      const sheet = getSheet(SHEETS.TURNOS);
      const data = sheet.getDataRange().getValues();
      if (data.length < 2) {
        return jsonResponse({ ok: false, error: 'No existen registros en Turnos_Capacidad.' });
      }

      const headers = data[0].map(h => String(h || '').trim());
      let headersChanged = false;
      if (headers.indexOf('grupo') === -1) {
        headers.push('grupo');
        headersChanged = true;
      }
      if (headers.indexOf('admin_edited_fields') === -1) {
        headers.push('admin_edited_fields');
        headersChanged = true;
      }
      if (headersChanged) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      }

      const idColIdx = headers.indexOf('id');
      const fechaColIdx = headers.indexOf('fecha');
      const contrataColIdx = headers.indexOf('contratista');
      const grupoColIdx = headers.indexOf('grupo');
      const updatedAtColIdx = headers.indexOf('updated_at');
      const updatedByColIdx = headers.indexOf('updated_by');
      const adminEditedColIdx = headers.indexOf('admin_edited_fields');

      let targetIndex = -1;
      for (let i = 1; i < data.length; i++) {
        const rowId = String(data[i][idColIdx] || '').trim();
        const rowFecha = normalizeDateValue(data[i][fechaColIdx]);
        const rowContrata = String(data[i][contrataColIdx] || '').trim();
        if (rowId === id && rowFecha === normalizedFecha && rowContrata === contratista) {
          targetIndex = i;
          break;
        }
      }

      if (targetIndex === -1) {
        return jsonResponse({ ok: false, error: 'No se encontró el registro especificado.' });
      }

      const contrataGroupMap = buildContrataGroupMap(users);
      const existingRow = data[targetIndex].slice(0, headers.length);
      while (existingRow.length < headers.length) {
        existingRow.push('');
      }

      const rowGrupo = normalizeGroup(
        existingRow[grupoColIdx],
        contrataGroupMap[contratista] || 'BT'
      );
      if (!matchesGroup(rowGrupo, adminUserGrupo)) {
        return jsonResponse({
          ok: false,
          error: 'No tienes permiso para editar registros del grupo ' + rowGrupo + '.',
        });
      }

      const changedFields = [];
      const diffParts = [];
      EDITABLE_TURN_FIELDS.forEach(field => {
        if (!Object.prototype.hasOwnProperty.call(changes, field)) return;
        const colIdx = headers.indexOf(field);
        if (colIdx === -1) return;
        const prevVal = String(existingRow[colIdx] !== undefined && existingRow[colIdx] !== null ? existingRow[colIdx] : '').trim();
        const nextVal = String(changes[field] !== undefined && changes[field] !== null ? changes[field] : '').trim();
        if (prevVal !== nextVal) {
          existingRow[colIdx] = nextVal;
          changedFields.push(field);
          diffParts.push(field + ': ' + (prevVal || '(vacío)') + ' -> ' + (nextVal || '(vacío)'));
        }
      });

      const existingEdited = parseAdminEditedFieldsList(existingRow[adminEditedColIdx]);
      const nowIso = new Date().toISOString();

      if (changedFields.length > 0) {
        const mergedEdited = parseAdminEditedFieldsList(
          existingEdited.concat(changedFields).join(',')
        );
        existingRow[grupoColIdx] = rowGrupo;
        existingRow[adminEditedColIdx] = mergedEdited.join(',');
        if (updatedAtColIdx !== -1) existingRow[updatedAtColIdx] = nowIso;
        if (updatedByColIdx !== -1) existingRow[updatedByColIdx] = adminUser.usuario;

        const targetRowNumber = targetIndex + 1;
        const celularColIdx = headers.indexOf('celular');
        if (celularColIdx !== -1 && changedFields.indexOf('celular') !== -1) {
          sheet.getRange(targetRowNumber, celularColIdx + 1).setNumberFormat('@');
        }
        sheet.getRange(targetRowNumber, 1, 1, headers.length).setValues([existingRow]);

        try {
          const auditSheet = getSheet(SHEETS.AUDITORIA);
          auditSheet.appendRow([
            nowIso,
            adminUser.usuario,
            contratista,
            normalizedFecha,
            'ADMIN_EDIT_ROW',
            'id=' + id + ' | ' + diffParts.join('; '),
          ]);
        } catch (auditErr) {
          // No bloquear la actualización si falla la hoja de auditoría
        }
      }

      const updatedObj = {};
      headers.forEach((h, idx) => {
        if (h === 'fecha') {
          updatedObj[h] = normalizedFecha;
        } else if (h === 'grupo') {
          updatedObj[h] = rowGrupo;
        } else if (h === 'admin_edited_fields') {
          updatedObj[h] = parseAdminEditedFieldsList(existingRow[idx]);
        } else {
          updatedObj[h] = existingRow[idx] !== undefined && existingRow[idx] !== null ? String(existingRow[idx]).trim() : '';
        }
      });

      return jsonResponse({
        ok: true,
        row: updatedObj,
        changedFields: changedFields,
      });
    }

    if (action === 'saveCatalog') {
      if (body.rol !== 'ADMIN') {
        return jsonResponse({ ok: false, error: 'Solo ADMIN puede modificar catálogos.' });
      }
      const sheet = getSheet(SHEETS.CATALOGOS);
      const headers = ['tipo', 'frente', 'valor', 'orden', 'activo', 'grupo'];
      const targetGrupoRaw = String(body.grupo || '').trim().toUpperCase();
      const isScopedGroup = targetGrupoRaw.length > 0 && targetGrupoRaw !== 'ALL';

      const sanitizedItems = (Array.isArray(body.items) ? body.items : [])
        .map((c, idx) => {
          const tipo = String(c.tipo || '').trim().toUpperCase();
          const defaultItemGrupo = isScopedGroup ? targetGrupoRaw : (tipo === 'HORARIO' ? 'ALL' : 'BT');
          return {
            tipo: tipo,
            frente: String(c.frente || 'ALL').trim().toUpperCase(),
            valor: String(c.valor || '').trim(),
            orden: Number(c.orden) || (idx + 1),
            activo: c.activo === true || String(c.activo).toUpperCase() === 'TRUE',
            grupo: normalizeGroup(c.grupo, defaultItemGrupo),
          };
        })
        .filter(c => c.tipo && c.valor);

      let finalItems = sanitizedItems;
      if (isScopedGroup) {
        const existingOtherGroups = sheetToObjects(SHEETS.CATALOGOS)
          .map(mapCatalogRow)
          .filter(c => c.tipo && c.valor && c.grupo !== targetGrupoRaw);
        finalItems = [...existingOtherGroups, ...sanitizedItems];
      }

      const newRows = finalItems.map(c => [
        c.tipo,
        c.frente,
        c.valor,
        c.orden,
        c.activo ? 'TRUE' : 'FALSE',
        c.grupo,
      ]);

      sheet.clearContents();
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      if (newRows.length > 0) {
        sheet.getRange(2, 1, newRows.length, 1).setNumberFormat('@');
        sheet.getRange(2, 2, newRows.length, 1).setNumberFormat('@');
        sheet.getRange(2, 3, newRows.length, 1).setNumberFormat('@');
        sheet.getRange(2, 6, newRows.length, 1).setNumberFormat('@');
        sheet.getRange(2, 1, newRows.length, headers.length).setValues(newRows);
      }

      try {
        const auditSheet = getSheet(SHEETS.AUDITORIA);
        auditSheet.appendRow([
          new Date().toISOString(),
          body.usuario || 'ADMIN',
          'ALL',
          '',
          'SAVE_CATALOG',
          sanitizedItems.length,
        ]);
      } catch (auditErr) {
        // No bloquear el guardado si falla la hoja de auditoría
      }

      return jsonResponse({ ok: true, items: sanitizedItems, savedCount: sanitizedItems.length });
    }

    return jsonResponse({ ok: false, error: 'Acción POST no soportada: ' + action });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  } finally {
    lock.releaseLock();
  }
}
