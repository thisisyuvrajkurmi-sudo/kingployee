/* IndexedDB data layer. Everything is stored on THIS device/browser only.
   Stores: employees, attendance (unique per employee+date), drs (metadata), files (DRS blobs), settings. */
(function (g) {
  'use strict';
  const NAME = 'employee-drs-manager', VERSION = 1;
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      if (!('indexedDB' in g)) return reject(new Error('This browser does not support IndexedDB.'));
      const r = indexedDB.open(NAME, VERSION);
      r.onupgradeneeded = () => {
        const d = r.result;
        const e = d.createObjectStore('employees', { keyPath: 'id' });
        e.createIndex('code', 'code', { unique: true });
        const a = d.createObjectStore('attendance', { keyPath: 'id' });
        a.createIndex('empDate', ['empId', 'date'], { unique: true });
        a.createIndex('date', 'date');
        a.createIndex('empId', 'empId');
        const s = d.createObjectStore('drs', { keyPath: 'id' });
        s.createIndex('empId', 'empId');
        s.createIndex('drsDate', 'drsDate');
        d.createObjectStore('files', { keyPath: 'id' });
        d.createObjectStore('settings', { keyPath: 'key' });
      };
      r.onsuccess = () => { r.result.onversionchange = () => r.result.close(); resolve(r.result); };
      r.onerror = () => { dbp = null; reject(r.error || new Error('Could not open the local database.')); };
      r.onblocked = () => { dbp = null; reject(new Error('The database is blocked by another tab. Close other tabs of this app and reload.')); };
    });
    return dbp;
  }

  const rq = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

  // Run one request in its own transaction and wait for the transaction to commit.
  async function op(store, mode, fn) {
    const db = await open();
    const t = db.transaction(store, mode);
    const done = new Promise((res, rej) => {
      t.oncomplete = () => res();
      t.onabort = () => rej(t.error || new Error('Transaction aborted'));
      t.onerror = () => rej(t.error);
    });
    done.catch(() => {});
    const v = await rq(fn(t.objectStore(store)));
    await done;
    return v;
  }

  // Run several steps atomically. fn(stores, tx) may queue requests; resolves when tx commits.
  async function multi(names, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(names, mode);
      const st = {};
      names.forEach(n => st[n] = t.objectStore(n));
      let out;
      t.oncomplete = () => resolve(out);
      t.onabort = () => reject(t.error || new Error('Transaction aborted'));
      t.onerror = () => reject(t.error);
      try { out = fn(st, t); } catch (e) { try { t.abort(); } catch (_) {} reject(e); }
    });
  }

  const all = s => op(s, 'readonly', st => st.getAll());
  const get = (s, k) => op(s, 'readonly', st => st.get(k));
  const put = (s, v) => op(s, 'readwrite', st => st.put(v));
  const del = (s, k) => op(s, 'readwrite', st => st.delete(k));
  const byIndex = (s, idx, key) => op(s, 'readonly', st => st.index(idx).getAll(IDBKeyRange.only(key)));
  const getAttendance = (empId, date) => op('attendance', 'readonly', st => st.index('empDate').get([empId, date]));

  // Insert or update attendance. The unique [empId,date] index guarantees no duplicates:
  // an existing record for that employee+date is reused (same id) and overwritten.
  function saveAttendance(recs) {
    const list = Array.isArray(recs) ? recs : [recs];
    return multi(['attendance'], 'readwrite', ({ attendance }) => {
      list.forEach(rec => {
        const gq = attendance.index('empDate').get([rec.empId, rec.date]);
        gq.onsuccess = () => attendance.put({ ...rec, id: gq.result ? gq.result.id : rec.id });
      });
    });
  }

  // Save a DRS record and its file blob together (all or nothing).
  function saveDrs(rec, fileRec) {
    return multi(['drs', 'files'], 'readwrite', ({ drs, files }) => {
      drs.put(rec);
      if (fileRec) files.put(fileRec);
    });
  }

  function deleteDrs(id) {
    return multi(['drs', 'files'], 'readwrite', ({ drs, files }) => { drs.delete(id); files.delete(id); });
  }

  // Permanent employee delete: removes the employee, their attendance AND their DRS documents.
  function deleteEmployeeCascade(id) {
    return multi(['employees', 'attendance', 'drs', 'files'], 'readwrite', ({ employees, attendance, drs, files }) => {
      employees.delete(id);
      const ak = attendance.index('empId').getAllKeys(id);
      ak.onsuccess = () => ak.result.forEach(k => attendance.delete(k));
      const dk = drs.index('empId').getAllKeys(id);
      dk.onsuccess = () => dk.result.forEach(k => { drs.delete(k); files.delete(k); });
    });
  }

  // Restore: clear every store and load the backup in ONE transaction.
  // If anything fails the transaction aborts and the existing data is left untouched.
  function replaceAll(data) {
    const names = ['employees', 'attendance', 'drs', 'files', 'settings'];
    return multi(names, 'readwrite', st => {
      names.forEach(n => st[n].clear());
      data.employees.forEach(v => st.employees.put(v));
      data.attendance.forEach(v => st.attendance.put(v));
      data.drs.forEach(v => st.drs.put(v));
      data.files.forEach(v => st.files.put(v));
      data.settings.forEach(v => st.settings.put(v));
    });
  }

  g.DB = { open, all, get, put, del, byIndex, getAttendance, saveAttendance, saveDrs, deleteDrs, deleteEmployeeCascade, replaceAll };
})(typeof window !== 'undefined' ? window : globalThis);
