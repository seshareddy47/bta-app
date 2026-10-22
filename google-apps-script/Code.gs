// Deploy this bound to your Google Sheet (Extensions > Apps Script) as a Web App.
// See README.md in this folder for step-by-step deployment instructions.

var KEY_COLUMN = 'Service No';

function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var data = sheet.getDataRange().getValues();
  if (data.length === 0) return jsonResponse({ ok: true, rows: [] });

  var headers = data[0].map(String);
  var rows = data.slice(1)
    .filter(function (r) { return r.some(function (cell) { return cell !== ''; }); })
    .map(function (r) {
      var obj = {};
      headers.forEach(function (h, i) {
        obj[h] = r[i] !== undefined && r[i] !== null ? String(r[i]) : '';
      });
      return obj;
    });

  return jsonResponse({ ok: true, rows: rows });
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

    if (body.action === 'upsert') {
      upsertRow(sheet, body.row);
    } else if (body.action === 'delete') {
      deleteRowByKey(sheet, body.serviceNo);
    } else {
      return jsonResponse({ ok: false, error: 'Unknown action: ' + body.action });
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function getHeaders(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
}

function upsertRow(sheet, row) {
  var headers = getHeaders(sheet);
  if (headers.length === 0) {
    headers = Object.keys(row);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  var values = headers.map(function (h) { return row[h] !== undefined ? row[h] : ''; });
  var keyIndex = headers.indexOf(KEY_COLUMN);

  if (keyIndex === -1) {
    sheet.appendRow(values);
    return;
  }

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][keyIndex]).trim() === String(row[KEY_COLUMN]).trim()) {
      sheet.getRange(i + 1, 1, 1, values.length).setValues([values]);
      return;
    }
  }
  sheet.appendRow(values);
}

function deleteRowByKey(sheet, serviceNo) {
  var headers = getHeaders(sheet);
  var keyIndex = headers.indexOf(KEY_COLUMN);
  if (keyIndex === -1) return;

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][keyIndex]).trim() === String(serviceNo).trim()) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
