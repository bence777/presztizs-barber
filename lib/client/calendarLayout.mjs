export const CALENDAR_CARD_HEIGHT=76;
const GAP=8,BASE_ROW_HEIGHT=88;
// Every booking has the same readable size. Shared half-hour rows expand only
// when simultaneous bookings need stacking, keeping all seven days aligned.
export function buildCalendarLayout(days,byDay,startHour,endHour,minuteOf){
 const count=(endHour-startHour)*2;
 const rowIndex=booking=>Math.max(0,Math.min(count-1,Math.floor((minuteOf(booking.starts_at)-startHour*60)/30)));
 const buckets=days.map(day=>{const rows=Array.from({length:count},()=>[]);for(const b of byDay.get(day)||[])rows[rowIndex(b)].push(b);return rows;});
 let offset=0;const rows=Array.from({length:count},(_,i)=>{const height=Math.max(BASE_ROW_HEIGHT,...buckets.map(day=>day[i].length*(CALENDAR_CARD_HEIGHT+GAP)+GAP));const row={minute:startHour*60+i*30,top:offset,height};offset+=height;return row;});
 const positions=new Map();for(const day of buckets)day.forEach((entries,i)=>entries.forEach((b,j)=>positions.set(b.id,rows[i].top+GAP+j*(CALENDAR_CARD_HEIGHT+GAP))));
 return {rows,height:offset,positions,position(minute){if(minute<=startHour*60)return 0;if(minute>=endHour*60)return offset;const i=Math.floor((minute-startHour*60)/30);return rows[i].top+(minute-rows[i].minute)/30*rows[i].height;}};
}
