// SERVER ONLY. A secret key bypasses RLS: never import this in React / pages UI.
// Requires SUPABASE_SECRET_KEY=sb_secret_... (Supabase Settings > API Keys).
const ZONE = "Europe/Budapest";
const MIN_NOTICE_MS = 2 * 60 * 60 * 1000;
const MAX_ADVANCE_DAYS = 60;
const STEP_MINUTES = 30;

const clock = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

function localParts(timestamp) {
  const parts = Object.fromEntries(clock.formatToParts(new Date(timestamp)).map((p) => [p.type, p.value]));
  return { y: Number(parts.year), m: Number(parts.month), d: Number(parts.day), h: Number(parts.hour), min: Number(parts.minute) };
}
export function localDay(timestamp = Date.now()) {
  const p = localParts(timestamp);
  return `${p.y}-${String(p.m).padStart(2,"0")}-${String(p.d).padStart(2,"0")}`;
}
export function localToUtcMs(day, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [y, m, d] = day.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  if (h > 23 || min > 59 || !Number.isFinite(Date.UTC(y,m-1,d,h,min))) return null;
  let guess = Date.UTC(y,m-1,d,h,min);
  for (let attempt = 0; attempt < 4; attempt++) {
    const p = localParts(guess);
    const delta = Date.UTC(y,m-1,d,h,min) - Date.UTC(p.y,p.m-1,p.d,p.h,p.min);
    if (delta === 0) break;
    guess += delta;
  }
  const p = localParts(guess);
  return p.y === y && p.m === m && p.d === d && p.h === h && p.min === min ? guess : null;
}

// Csak publikus, lassan változó adatok: nincs vendégadat a cache-ben.
// Az azonos kulcshoz érkező párhuzamos kéréseket egyetlen DB-lekéréssé vonjuk össze.
function createShortCache(ttlMs, maxEntries = 100) {
  const entries = new Map();
  return {
    async get(key, load) {
      const cached = entries.get(key);
      if (cached && cached.until > Date.now()) return cached.promise;
      const promise = Promise.resolve().then(load);
      entries.set(key, { until: Date.now() + ttlMs, promise });
      if (entries.size > maxEntries) entries.delete(entries.keys().next().value);
      try { return await promise; }
      catch (error) {
        if (entries.get(key)?.promise === promise) entries.delete(key);
        throw error;
      }
    },
    clear() { entries.clear(); },
  };
}
const catalogCache = createShortCache(45_000);
const hoursCache = createShortCache(30_000);

function plusDays(day, n) {
  const [y,m,d] = day.split("-").map(Number);
  return new Date(Date.UTC(y,m-1,d+n)).toISOString().slice(0,10);
}
function weekday(day) { const [y,m,d] = day.split("-").map(Number); return new Date(Date.UTC(y,m-1,d)).getUTCDay(); }
function minutes(s) { const [h,m] = s.slice(0,5).split(":").map(Number); return h*60+m; }
function fmtTime(total) { return `${String(Math.floor(total/60)).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`; }
function intersects(start, end, intervals) {
  return intervals.some((range) => new Date(range.starts_at).getTime() < end && new Date(range.ends_at).getTime() > start);
}

export class BookingDbError extends Error {
  constructor(status, code, message) { super(message || "Supabase error"); this.status = status; this.code = code; }
}
export function bookingConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY?.startsWith("sb_secret_"));
}
export async function bookingDb(table, { query = {}, method = "GET", body, prefer } = {}) {
  if (!bookingConfigured()) throw new BookingDbError(503, "not_configured", "Missing SUPABASE_SECRET_KEY");
  const url = new URL(`/rest/v1/${table}`, process.env.SUPABASE_URL);
  for (const [key, value] of Object.entries(query)) if (value !== undefined) url.searchParams.set(key, value);
  const response = await fetch(url, {
    method,
    headers: {
      apikey: process.env.SUPABASE_SECRET_KEY,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
  });
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
  if (!response.ok) throw new BookingDbError(response.status, data?.code, data?.message || `DB HTTP ${response.status}`);
  return data;
}

export async function getBookingConfig({ fresh = false } = {}) {
  const load = async () => {
    const [services, barbers] = await Promise.all([
      bookingDb("booking_services", { query: {select: "id,name,description,duration_minutes,price_huf",active:"eq.true",order:"sort_order.asc,name.asc"} }),
      bookingDb("booking_staff", { query: {select:"id,name,role,image_url",active:"eq.true",order:"sort_order.asc,name.asc"} }),
    ]);
    return {
      services: services.map(s => ({ id:s.id,name:s.name,description:s.description,duration:s.duration_minutes,price:s.price_huf })),
      barbers: barbers.map(b => ({ id:b.id,name:b.name,role:b.role,image:b.image_url || null })),
    };
  };
  return fresh ? load() : catalogCache.get("public-catalog", load);
}

async function getBookingHours({ fresh = false } = {}) {
  const load = () => bookingDb("booking_hours", { query: { select: "staff_id,weekday,opens,closes" } });
  return fresh ? load() : hoursCache.get("all-staff-hours", load);
}

export async function getMonthAvailability({ serviceId, barberId, month, now = Date.now(), freshMetadata = false }) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || "")) throw new BookingDbError(400,"bad_month","Invalid month");
  const today = localDay(now);
  const latest = plusDays(today,MAX_ADVANCE_DAYS);
  if (month < today.slice(0,7) || month > latest.slice(0,7)) throw new BookingDbError(400,"out_of_range","Outside booking window");
  // A törzsadatok és munkaidők gyorsítótárból jönnek; a foglaltságot
  // mindig frissen ellenőrizzük (és mentéskor újra ellenőrizzük).
  const [config, allHours] = await Promise.all([getBookingConfig({ fresh: freshMetadata }), getBookingHours({ fresh: freshMetadata })]);
  const service = config.services.find(s => s.id === serviceId);
  const eligible = barberId === "any" ? config.barbers : config.barbers.filter(b => b.id === barberId);
  if (!service || !eligible.length) throw new BookingDbError(400,"bad_selection","Service or barber unavailable");
  const [y,m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y,m,0)).getUTCDate();
  const fromIso = new Date(Date.UTC(y,m-1,1)-86400000).toISOString();
  const untilIso = new Date(Date.UTC(y,m,lastDay+2)).toISOString();
  const eligibleIds = new Set(eligible.map(b=>b.id));
  const hours = allHours.filter(row => eligibleIds.has(row.staff_id));
  // Az összes barberre vonatkozó korábbi lekérdezés helyett csak a
  // kiválasztott munkatárs(ak) adott havi időpontjait kérjük le.
  const staffFilter = eligible.length === 1
    ? `eq.${eligible[0].id}`
    : `in.(${eligible.map(b => b.id).join(",")})`;
  const [off, appointments] = await Promise.all([
    bookingDb("booking_time_off", {query:{select:"staff_id,starts_at,ends_at",staff_id:staffFilter,starts_at:`lt.${untilIso}`,ends_at:`gt.${fromIso}`}}),
    bookingDb("booking_appointments", {query:{select:"staff_id,starts_at,ends_at",staff_id:staffFilter,status:"eq.confirmed",starts_at:`lt.${untilIso}`,ends_at:`gt.${fromIso}`}}),
  ]);
  const blockedByStaff = new Map(eligible.map(b => [b.id, []]));
  for (const interval of [...off, ...appointments]) blockedByStaff.get(interval.staff_id)?.push(interval);
  const workingByWeekday = new Map();
  for (const schedule of hours) {
    const bucket = workingByWeekday.get(schedule.weekday) || [];
    bucket.push(schedule);
    workingByWeekday.set(schedule.weekday, bucket);
  }
  const days = {};
  const candidates = {};
  for(let d=1;d<=lastDay;d++) {
    const day = `${month}-${String(d).padStart(2,"0")}`;
    if(day < today || day > latest) continue;
    const dow = weekday(day);
    const times = new Map();
    for (const schedule of workingByWeekday.get(dow) || []) {
      const begin = minutes(schedule.opens), finish = minutes(schedule.closes);
      for (let start = Math.ceil(begin/STEP_MINUTES)*STEP_MINUTES; start + service.duration <= finish; start += STEP_MINUTES) {
        const time = fmtTime(start);
        const startMs = localToUtcMs(day,time);
        if(startMs === null || startMs < now + MIN_NOTICE_MS) continue;
        const endMs = startMs + service.duration*60000;
        if(intersects(startMs,endMs,blockedByStaff.get(schedule.staff_id) || [])) continue;
        const ids = times.get(time) || [];
        if(!ids.includes(schedule.staff_id)) ids.push(schedule.staff_id);
        times.set(time,ids);
      }
    }
    if(times.size) {
      days[day] = [...times.keys()].sort().map(value=>({value,available:true}));
      candidates[day] = Object.fromEntries([...times.entries()]);
    }
  }
  return { days, candidates, config, hasWorkingHours: hours.length > 0 };
}

export async function placeBooking({userId,guestEmail,serviceId,barberId,date,time}) {
  const now=Date.now();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date||"") || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time||"")) {
    throw new BookingDbError(400,"bad_date","Invalid date/time");
  }
  const available = await getMonthAvailability({serviceId,barberId,month:date.slice(0,7),now,freshMetadata:true});
  const staffCandidates = available.candidates[date]?.[time] || [];
  if(!staffCandidates.length) throw new BookingDbError(409,"slot_taken","The selected slot is no longer available");
  const service=available.config.services.find(s=>s.id===serviceId);
  const startMs=localToUtcMs(date,time);
  if(startMs === null) throw new BookingDbError(400,"bad_date","Invalid local time");
  for (const staffId of staffCandidates) {
    try {
      const inserted=await bookingDb("booking_appointments",{
        method:"POST",prefer:"return=representation",query:{select:"id,staff_id,service_id,starts_at,ends_at,price_huf,status"},
        body:{user_id:userId,guest_email:guestEmail,staff_id:staffId,service_id:service.id,starts_at:new Date(startMs).toISOString(),ends_at:new Date(startMs+service.duration*60000).toISOString(),price_huf:service.price,status:"confirmed"},
      });
      if (!Array.isArray(inserted) || inserted.length !== 1) throw new Error("Insert had no returned booking");
      const staff=available.config.barbers.find(s=>s.id===staffId);
      return {...inserted[0],staff_name:staff?.name,service_name:service.name,local_date:date,local_time:time};
    } catch(error) {
      if(error instanceof BookingDbError && ["23P01","23505"].includes(error.code)) {
        // Another request won the race. For 'any', try a different barber.
        if(barberId === "any" && error.code === "23P01") continue;
        throw new BookingDbError(409,"slot_taken","Already reserved");
      }
      throw error;
    }
  }
  throw new BookingDbError(409,"slot_taken","Already reserved");
}
