import {BookingDbError} from './bookingDb.js';
export function revisionFilter(revision) {
 if(!Number.isSafeInteger(revision)||revision<1)throw new BookingDbError(409,'revision_required','Az adat időközben megváltozhatott. Töltsd be a friss állapotot. / Reload the latest record before saving.');
 return `eq.${revision}`;
}
export function revisionConflict(){throw new BookingDbError(409,'revision_conflict','Időközben más módosította az adatot. Töltsd be újra; a módosításod nem írta felül. / Another editor changed this record. Reload before saving.');}
