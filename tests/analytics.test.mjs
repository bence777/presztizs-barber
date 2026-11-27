import test from 'node:test';
import assert from 'node:assert/strict';
import { setAnalyticsConsent, trackEvent } from '../lib/client/analytics.mjs';
const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');
const previousWindow=globalThis.window;const events=[];
test.beforeEach(()=>{setAnalyticsConsent(false);events.length=0;globalThis.window={dispatchEvent:event=>events.push(event.detail)};Object.defineProperty(globalThis,'navigator',{configurable:true,value:{}})});
test.after(()=>{if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;setAnalyticsConsent(false)});
test('analytics is silent until explicit consent and immediately stops after revocation',()=>{
 trackEvent('booking_started');assert.equal(events.length,0);
 setAnalyticsConsent(true);trackEvent('booking_started',{placement:'wizard'});assert.equal(events.length,1);
 setAnalyticsConsent(false);trackEvent('booking_completed');assert.equal(events.length,1);
});
test('event payloads exclude email, phone, booking IDs, management tokens and query strings',()=>{
 setAnalyticsConsent(true);trackEvent('booking_completed',{barber_id:'paliga-zoltan',service_id:'service-one',language:'hu',email:'guest@example.com',phone:'+36300000000',booking_id:'private-id',token:'secret',placement:'/?token=secret'});
 assert.deepEqual(events,[{event:'booking_completed',barber_id:'paliga-zoltan',service_id:'service-one',language:'hu'}]);
 trackEvent('unapproved_event',{language:'hu'});assert.equal(events.length,1);
});
test('browser privacy preferences suppress analytics even with consent',()=>{
 setAnalyticsConsent(true);navigator.globalPrivacyControl=true;trackEvent('phone_clicked');assert.equal(events.length,0);
 navigator.globalPrivacyControl=false;navigator.doNotTrack='1';trackEvent('directions_clicked');assert.equal(events.length,0);
});
