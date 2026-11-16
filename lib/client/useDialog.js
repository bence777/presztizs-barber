import {useEffect,useRef} from 'react';
export default function useDialog(open,onClose) {
  const ref=useRef(null),close=useRef(onClose);close.current=onClose;
  useEffect(()=>{
    if(!open||!ref.current)return;
    const previous=document.activeElement,overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const focusable=()=>[...ref.current.querySelectorAll('button,input,select,textarea,a[href]')].filter(el=>!el.disabled&&el.offsetParent!==null);
    (focusable()[0]||ref.current).focus();
    function keydown(e){
      if(e.key==='Escape'){e.preventDefault();close.current();}
      if(e.key==='Tab'){
        const els=focusable(),first=els[0],last=els[els.length-1];
        if(!els.length){e.preventDefault();return;}
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
        if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      }
    }
    document.addEventListener('keydown',keydown);
    return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',keydown);previous?.focus()};
  },[open]);
  return ref;
}
