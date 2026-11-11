// A foglalórendszer a szolgáltatásokat és a barbereket a Supabase-ből tölti be.
// Az árak itt már NEM konfigurálhatók: Supabase > booking_services.
export const formatPrice = (amount) => `${new Intl.NumberFormat("hu-HU").format(amount)} Ft`;
