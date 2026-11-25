import {useEffect,useRef} from 'react';

// Let touch scrolling cancel a long press before it opens the action menu.
export default function AdminCalendarSlot({onBook,onActions,...props}) {
  const press=useRef(null),suppressClick=useRef(false);
  function cancel(){if(press.current)clearTimeout(press.current.timer);press.current=null;}
  useEffect(()=>cancel,[]);
  return <button {...props}
    onPointerDown={e=>{
      cancel();suppressClick.current=false;
      if(e.pointerType==='mouse'||!e.isPrimary||props.disabled)return;
      const point={x:e.clientX,y:e.clientY};
      press.current={...point,timer:setTimeout(()=>{press.current=null;suppressClick.current=true;onActions(point)},550)};
    }}
    onPointerMove={e=>{if(press.current&&Math.hypot(e.clientX-press.current.x,e.clientY-press.current.y)>10)cancel()}}
    onPointerUp={cancel} onPointerCancel={cancel} onPointerLeave={cancel}
    onContextMenu={e=>{e.preventDefault();cancel();if(props.disabled||suppressClick.current)return;suppressClick.current=true;onActions({x:e.clientX,y:e.clientY})}}
    onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')suppressClick.current=false;if(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10')){e.preventDefault();const rect=e.currentTarget.getBoundingClientRect();onActions({x:rect.left+rect.width/2,y:rect.top+rect.height/2})}}}
    onClick={e=>{if(suppressClick.current){e.preventDefault();suppressClick.current=false;return;}onBook()}}/>;
}
