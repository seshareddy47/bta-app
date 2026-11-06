import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteServiceRecord, loadServiceData, technicianName, technicianOptions, toServicePayload } from '../src/utils/serviceOperations.ts';

test('service payload preserves notes and technicians without sending serial or audit fields', () => {
  const payload = toServicePayload({
    id: 'one', serialNo: 'SN-1', serviceNo: '', area: '', modelNumber: '',
    technicianId1: 't1', technicianName1: 'First', technicianId2: 't2', technicianName2: 'Second',
    invoiceDate: '', attendedDate: '', notes: 'Existing notes', status: 'urgent',
    createdByName: 'Creator', updatedAt: '2026-01-01',
  });
  assert.equal(payload.serviceNo, null);
  assert.equal(payload.notes, 'Existing notes');
  assert.equal(payload.technicianId2, 't2');
  assert.equal(payload.technicianName2, 'Second');
  assert.equal(payload.status, 'urgent');
  assert.equal('serialNo' in payload, false);
  assert.equal('updatedAt' in payload, false);
  assert.equal('createdByName' in payload, false);
});

test('only assigned inactive technicians remain selectable and retain their stored names', () => {
  const technicians = [
    { id: 'one', name: 'Renamed', status: 'inactive' },
    { id: 'two', name: 'Other inactive', status: 'inactive' },
    { id: 'three', name: 'Active', status: 'active' },
  ];
  assert.deepEqual(technicianOptions(technicians, 'one', 'Original', ''), [
    { id: 'one', label: 'Renamed (Inactive)' },
    { id: 'three', label: 'Active' },
  ]);
  assert.equal(technicianName('one', 'one', 'Original', technicians), 'Original');
  assert.equal(technicianName('', 'one', 'Original', technicians), '');
  assert.equal(technicianName('three', 'one', 'Original', technicians), 'Active');
  assert.deepEqual(technicianOptions([], 'one', 'Original', ''), [
    { id: 'one', label: 'Original (Unavailable)' },
  ]);
  assert.deepEqual(technicianOptions(technicians, 'one', 'Original', 'one'), [
    { id: 'three', label: 'Active' },
  ]);
});

function clientForLoad(serviceResult, technicianResult) {
  return {
    from(table) {
      return table === 'services'
        ? { select: () => serviceResult }
        : { select: () => ({ eq: () => technicianResult }) };
    },
  };
}

test('service loading succeeds independently of a technician query failure', async () => {
  const result = await loadServiceData(clientForLoad(
    Promise.resolve({ data: [{ id: 'one' }], error: null }),
    Promise.reject(new Error('technicians unavailable')),
  ));
  assert.deepEqual(result.services, [{ id: 'one' }]);
  assert.match(result.error, /technicians unavailable/);
});

test('service load failure is distinct from an empty successful result and can be retried', async () => {
  const technicians = Promise.resolve({ data: [], error: null });
  const failed = await loadServiceData(clientForLoad(
    Promise.resolve({ data: null, error: { message: 'connection failed' } }), technicians,
  ));
  assert.equal(failed.services, undefined);
  assert.match(failed.error, /connection failed/);
  const retried = await loadServiceData(clientForLoad(
    Promise.resolve({ data: [], error: null }), technicians,
  ));
  assert.deepEqual(retried.services, []);
  assert.equal(retried.error, undefined);
});

function clientForDelete(result, calls) {
  return {
    from(table) {
      calls.push(['from', table]);
      return {
        delete() {
          calls.push(['delete']);
          return {
            eq(column, value) {
              calls.push(['eq', column, value]);
              return { select: (fields) => {
                calls.push(['select', fields]);
                return { maybeSingle: () => result };
              } };
            },
          };
        },
      };
    },
  };
}

test('delete executes for the immutable id and requires a returned row', async () => {
  const calls = [];
  const result = await deleteServiceRecord(clientForDelete(
    Promise.resolve({ data: { id: 'service-id' }, error: null }), calls,
  ), 'service-id');
  assert.deepEqual(result, { success: true });
  assert.deepEqual(calls, [['from', 'services'], ['delete'], ['eq', 'id', 'service-id'], ['select', 'id']]);
});

test('delete reports errors and missing rows instead of success', async () => {
  for (const response of [
    Promise.resolve({ data: null, error: { message: 'delete denied' } }),
    Promise.resolve({ data: null, error: null }),
    Promise.reject(new Error('offline')),
  ]) {
    const result = await deleteServiceRecord(clientForDelete(response, []), 'service-id');
    assert.equal(result.success, false);
    assert.ok(result.error);
  }
});

test('confirmed deletion stays deleted on reload; a failed deletion leaves the record', async () => {
  let rows = [{ id: 'one' }, { id: 'two' }];
  const client = {
    from(table) {
      if (table === 'employees') return { select: () => ({ eq: async () => ({ data: [], error: null }) }) };
      return {
        select: async () => ({ data: [...rows], error: null }),
        delete: () => ({ eq: (_column, id) => ({ select: () => ({ maybeSingle: async () => {
          if (id === 'two') return { data: null, error: { message: 'denied' } };
          rows = rows.filter((row) => row.id !== id);
          return { data: { id }, error: null };
        } }) }) }),
      };
    },
  };
  assert.equal((await deleteServiceRecord(client, 'one')).success, true);
  assert.equal((await deleteServiceRecord(client, 'two')).success, false);
  assert.deepEqual((await loadServiceData(client)).services, [{ id: 'two' }]);
});
