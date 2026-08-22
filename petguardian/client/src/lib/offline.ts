/**
 * Offline emergency snapshots. A small, non-sensitive-as-possible copy of each
 * plan's emergency-critical data is cached on-device so the emergency card is
 * reachable instantly, with no network and no login. Stored in localStorage,
 * which persists in the iOS WKWebView.
 */
import type { FullPlanResponse } from './types';

const KEY = 'petguardian_emergency_v1';

export interface EmergencySnapshot {
  planId: string;
  planName: string;
  savedAt: string;
  owner: { name: string; phone: string; email: string; address: string };
  pets: Array<{
    name: string;
    species: string;
    microchip: string;
    medications: string;
    allergies: string;
    vetPhone: string;
    emergencyVetPhone: string;
  }>;
  contacts: Array<{ role: string; name: string; phone: string; email: string }>;
}

const s = (v: unknown) => (v == null ? '' : String(v));

export function buildSnapshot(data: FullPlanResponse): EmergencySnapshot {
  const p = data.plan;
  return {
    planId: p.id,
    planName: p.name,
    savedAt: new Date().toISOString(),
    owner: {
      name: s(p.settlor_full_name),
      phone: s(p.settlor_phone),
      email: s(p.settlor_email),
      address: s(p.settlor_address),
    },
    pets: data.pets.map((pet) => ({
      name: s(pet.name),
      species: s(pet.species),
      microchip: s(pet.microchip),
      medications: s(pet.medications),
      allergies: s(pet.allergies),
      vetPhone: s(pet.vet_phone),
      emergencyVetPhone: s(pet.emergency_vet_phone),
    })),
    contacts: [
      ...data.caregivers.map((c) => ({ role: c.role, name: s(c.full_name), phone: s(c.phone), email: s(c.email) })),
      ...data.trustees.map((t) => ({ role: t.role.replace('_', ' '), name: s(t.full_name), phone: s(t.phone), email: s(t.email) })),
    ],
  };
}

export function loadAllSnapshots(): Record<string, EmergencySnapshot> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

export function saveSnapshot(snap: EmergencySnapshot): void {
  try {
    const all = loadAllSnapshots();
    all[snap.planId] = snap;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable */
  }
}

export function removeSnapshot(planId: string): void {
  try {
    const all = loadAllSnapshots();
    delete all[planId];
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}
