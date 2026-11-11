-- BEÁLLÍTÁSI PÉLDA, NEM A SZALON VALÓDI ÁRLISTÁJA VAGY MUNKAIDEJE!
-- Csak akkor futtasd, ha a neveket, árakat és nyitvatartást ellenőrizted.
-- Az active alapból false; ezzel nem jelennek meg hamis foglalható idősávok.

-- 1) Szolgáltatások (a jelenlegi látványterv mintanevei és mintaárai):
insert into public.booking_services(id,name,description,duration_minutes,price_huf,active,sort_order) values
('ferfi-hajvagas','Férfi hajvágás','Precíz vágás',45,5500,false,1),
('skin-fade','Skin fade','Tiszta átmenetek',45,6000,false,2),
('haj-es-szakall','Haj és szakáll','Haj- és szakállvágás',60,8000,false,3),
('szakalligazitas','Szakálligazítás','Szakállformázás',30,3500,false,4)
on conflict(id) do nothing;

-- 2) A barber neve TÉNYLEGES személy legyen. Az alábbi sor csak példa:
-- insert into public.booking_staff (id,name,role,active,sort_order)
-- values ('barber-azonosito','Valódi név','Barber',false,1);

-- 3) Az adott barber valós munkarendje. 0=vasárnap, 1=hétfő, ..., 6=szombat.
-- Nyitás/zárás helyett ténylegesen foglalható, szünetektől mentes munkaórákat adj meg.
-- Példa munkanap: 09:00-12:00, majd 13:00-18:00:
-- insert into public.booking_hours(staff_id,weekday,opens,closes) values
-- ('barber-azonosito',1,'09:00','12:00'),
-- ('barber-azonosito',1,'13:00','18:00');

-- 4) Kivétel / szabadság (UTC-offsetet kötelező figyelembe venni):
-- insert into public.booking_time_off(staff_id,starts_at,ends_at,reason)
-- values ('barber-azonosito','2026-12-24 00:00:00+01','2026-12-27 00:00:00+01','Ünnepnapok');

-- 5) Miután MINDEN valós adatot ellenőriztél:
-- update public.booking_services set active=true where id in ('ferfi-hajvagas','skin-fade', 'haj-es-szakall','szakalligazitas');
-- update public.booking_staff set active=true where id='barber-azonosito';
