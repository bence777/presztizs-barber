import {defineConfig,globalIgnores} from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
export default defineConfig([
 ...nextVitals,
 globalIgnores(['.next*/**','tests/fixtures/**']),
 {rules:{'react-hooks/set-state-in-effect':'off','react-hooks/refs':'off','react-hooks/purity':'off','react-hooks/immutability':'off','react-hooks/preserve-manual-memoization':'off'}},
 {files:['pages/admin/eszkozok.jsx','pages/eszkozeim.jsx','components/AdminDashboard.jsx','components/AdminIdentityGate.jsx','components/BookingManageList.jsx','components/BookingManagePage.jsx','components/GuestIdentity.jsx'],rules:{'@next/next/no-html-link-for-pages':'off'}},
]);
