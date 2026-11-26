const PIXELS_PER_MINUTE=88/30;
// One shared linear time axis: a 90 minute event is exactly twice a 45 minute event.
// Concurrent appointments for different staff get separate lanes, without stretching time.
export function buildCalendarLayout(days,byDay,startHour,endHour,minuteOf){
 const position=minute=>Math.max(0,Math.min((endHour-startHour)*60,minute-startHour*60))*PIXELS_PER_MINUTE;
 const rows=Array.from({length:(endHour-startHour)*4},(_,i)=>({minute:startHour*60+i*15,top:i*15*PIXELS_PER_MINUTE,height:15*PIXELS_PER_MINUTE}));
 const positions=new Map(),events=new Map();
 for(const day of days){
  const entries=[...(byDay.get(day)||[])].sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at));
  const laneEnds=[],assignments=[];
  for(const booking of entries){
   const start=Date.parse(booking.starts_at),end=Date.parse(booking.ends_at);
   let lane=laneEnds.findIndex(until=>until<=start);if(lane===-1)lane=laneEnds.length;
   laneEnds[lane]=end;assignments.push({booking,lane});
  }
  for(const {booking,lane} of assignments){
   const top=position(minuteOf(booking.starts_at));
   const height=(Date.parse(booking.ends_at)-Date.parse(booking.starts_at))/60000*PIXELS_PER_MINUTE;
   positions.set(booking.id,top);events.set(booking.id,{top,height,left:`calc(${lane*100/laneEnds.length}% + 2px)`,width:`calc(${100/laneEnds.length}% - 4px)`});
  }
 }
 return {rows,height:(endHour-startHour)*60*PIXELS_PER_MINUTE,positions,events,position};
}
