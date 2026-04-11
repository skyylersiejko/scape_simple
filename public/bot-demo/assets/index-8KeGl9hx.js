(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))t(i);new MutationObserver(i=>{for(const l of i)if(l.type==="childList")for(const n of l.addedNodes)n.tagName==="LINK"&&n.rel==="modulepreload"&&t(n)}).observe(document,{childList:!0,subtree:!0});function a(i){const l={};return i.integrity&&(l.integrity=i.integrity),i.referrerPolicy&&(l.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?l.credentials="include":i.crossOrigin==="anonymous"?l.credentials="omit":l.credentials="same-origin",l}function t(i){if(i.ep)return;i.ep=!0;const l=a(i);fetch(i.href,l)}})();const C="/bot-demo/cards/",p={nest_of_swarm:{id:"nest_of_swarm",name:"Nest of Swarm",type:"ancient",isAncient:!0,description:"Create two 1/1 Insect being Tokens.",imageUrl:`${C}nest_of_swarm.png`},misty_isle:{id:"misty_isle",name:"Misty Isle",type:"ancient",isAncient:!0,description:"Prevent all damage until end of turn.",imageUrl:`${C}misty_isle.png`},smoldering_volcano:{id:"smoldering_volcano",name:"Smoldering Volcano",type:"ancient",isAncient:!0,description:"Deal 3 damage to any target.",imageUrl:`${C}smoldering_volcanoe.png`},cavern_of_the_see:{id:"cavern_of_the_see",name:"Cavern of the See",type:"ancient",isAncient:!0,description:"Look at target player's hand. Select a card and have them recycle it.",imageUrl:`${C}cavern_of_the_see.png`},field_of_imagination:{id:"field_of_imagination",name:"Field of Imagination",type:"ancient",isAncient:!0,description:"RECYCLE: Shuffle your hand into your deck and draw that many cards.",imageUrl:`${C}field_of_imagination.png`},landscape:{id:"landscape",name:"Landscape",type:"landscape",description:"SACRIFICE: Gain 1 Will-Power.",imageUrl:`${C}landscape.png`},spike:{id:"spike",name:"Spike",type:"spell",spellType:"spike",cost:3,dots:3,description:"Deal 4 damage to any target.",imageUrl:`${C}spike.png`},cancel:{id:"cancel",name:"Cancel",type:"spell",spellType:"cancel",cost:3,dots:3,description:"Counter target spell or being.",imageUrl:`${C}cancel.png`},ignite:{id:"ignite",name:"Ignite",type:"spell",spellType:"ignite",cost:1,dots:1,description:"Deal 2 damage to any target.",imageUrl:`${C}ignite.png`},grow:{id:"grow",name:"Grow",type:"spell",spellType:"grow",cost:3,dots:3,description:"Search your deck for a landscape and put it in play exhausted. Choose a new Ancient.",imageUrl:`${C}grow.png`},insect:{id:"insect",name:"Insect",type:"being",power:1,toughness:1,cost:1,dots:1,description:"Sacrifice or play from your yard as part of a ritual.",imageUrl:`${C}being_one.png`},merfolk:{id:"merfolk",name:"Merfolk",type:"being",power:2,toughness:2,cost:2,dots:2,description:"Sacrifice or play from your yard as part of a ritual.",imageUrl:`${C}being_two.png`},pondus:{id:"pondus",name:"Pondus",type:"being",power:3,toughness:3,cost:3,dots:3,description:"Sacrifice or play from your yard as part of a ritual.",imageUrl:`${C}being_three.png`},cephalodon:{id:"cephalodon",name:"Cephalodon",type:"being",power:4,toughness:4,cost:4,dots:4,description:"Sacrifice or play from your yard as part of a ritual.",imageUrl:`${C}being_four.png`},shroon:{id:"shroon",name:"Shroon",type:"being",power:5,toughness:5,cost:5,dots:5,description:"Sacrifice or play from your yard as part of a ritual.",imageUrl:`${C}being_five.png`},wasp:{id:"wasp",name:"Wasp",type:"being",power:2,toughness:3,cost:2,dots:2,isFlyer:!0,description:"May attack without exhausting. Cannot be blocked by beings without flying.",imageUrl:`${C}being_flyer.png`}},be=7,ve=25,xe=3,ke=10,Pe=5;for(let s=1;s<=12;s++){const e=Math.max(1,s-2),a=`evolved_${s}`;p[a]={id:a,name:`Evolved (${s}/${e})`,type:"being",power:s,toughness:e,cost:s,dots:Math.min(s,5),description:`Evolved from a Landscape. ${s}/${e} being.`}}p.flyer_token={id:"flyer_token",name:"Storm Flyer",type:"being",power:3,toughness:1,cost:3,dots:3,isFlyer:!0,description:"Created by the Storm Flyer ritual. Has flying.",imageUrl:`${C}being_flyer.png`};function we(){const s=[];for(let e=0;e<24;e++)s.push("landscape");for(let e=0;e<4;e++)s.push("insect");for(let e=0;e<4;e++)s.push("merfolk");for(let e=0;e<4;e++)s.push("pondus");for(let e=0;e<4;e++)s.push("cephalodon");for(let e=0;e<4;e++)s.push("shroon");for(let e=0;e<4;e++)s.push("wasp");for(let e=0;e<4;e++)s.push("ignite");for(let e=0;e<4;e++)s.push("cancel");for(let e=0;e<4;e++)s.push("grow");for(let e=0;e<4;e++)s.push("spike");return s}const F=["nest_of_swarm","misty_isle","smoldering_volcano","cavern_of_the_see","field_of_imagination"];function J(){return typeof crypto<"u"&&typeof crypto.randomUUID=="function"?`ci_${crypto.randomUUID()}`:`ci_${Date.now()}_${Math.random().toString(36).slice(2)}`}function U(s,e){return{id:J(),defId:s,exhausted:!1,counters:0,owner:e}}function Q(s){const e=[...s];for(let a=e.length-1;a>0;a--){const t=Math.floor(Math.random()*(a+1));[e[a],e[t]]=[e[t],e[a]]}return e}function se(s){const e={};return s.forEach((a,t)=>{e[a.id]=t+1}),{stackOrder:e,passOrder:{}}}function Se(s,e,a,t=100,i=100){const l=o=>{const r=Q(we()).map(u=>U(u,o)),c=r.splice(0,be);return{uid:o,willPower:ve,hand:c,deck:r,battlefield:[],limbo:[],yard:[],exile:[],ancient:null,attackers:[],blockers:{},ready:!1,landscapeCountThisTurn:0,ritualZone:[],igniteBoost:0}},n=Math.random()<.5?e:a;return{id:s,player1:e,player2:a,currentTurn:n,phase:"replenish",combatStep:"none",p1State:l(e),p2State:l(a),stack:[],log:["Game started!"],startedAt:Date.now(),turnNumber:1,p1LandscapesThisTurn:0,p2LandscapesThisTurn:0,p1ConsecutiveTurnsNoLandscape:0,p2ConsecutiveTurnsNoLandscape:0,p1ConsecutiveTurnsNoSpell:0,p2ConsecutiveTurnsNoSpell:0,p1FieldOfImaginationSacCount:0,p2FieldOfImaginationSacCount:0,priorityPlayer:n,p1TurnCount:n===e?1:0,p2TurnCount:n===a?1:0,p1Rank:t,p2Rank:i,stackHistoryPlays:[],seq:0}}function y(s,e){return s.player1===e?s.p1State:s.p2State}function O(s,e){return s.player1===e?s.p2State:s.p1State}function x(s,e,a){return s.player1===e?{...s,p1State:a}:{...s,p2State:a}}function P(s,e){return{...s,log:[...(s.log||[]).slice(-49),e]}}function X(s,e,a){const t=y(s,e),i=U(a,e);return x(s,e,{...t,ancient:i})}function $(s,e){if(s.currentTurn!==e)return s;const a=["replenish","draw","play1","combat","play2","end"],t=a.indexOf(s.phase);if(s.phase==="combat"){if(s.combatStep==="none")return{...s,combatStep:"pre",priorityPlayer:e,stackPassedOnce:!1,stackPassPriority:void 0};if(s.combatStep==="pre")return{...s,combatStep:"attackers",priorityPlayer:e,stackPassedOnce:!1,stackPassPriority:void 0};if(s.combatStep==="attackers"){const i=s.player1===e?s.player2:s.player1,l=y(s,e),n=y(s,i);if(!(l.attackers.length>0&&n.battlefield.some(d=>{const r=p[d.defId];return!r||r.type!=="being"||d.exhausted?!1:l.attackers.some(c=>{const u=l.battlefield.find(f=>f.id===c);return!((u?p[u.defId]:null)?.isFlyer&&!r.isFlyer)})}))){const d={...s,combatStep:"pre-damage",priorityPlayer:e,stackPassedOnce:!1,stackPassPriority:void 0};if(d.pendingDamageChoice)return d;const r=d.currentTurn,c=d.player1===r?d.player2:d.player1,u=y(d,r),h=y(d,c);return u.attackers.some(m=>{if(Object.values(h.blockers).includes(m))return!1;const b=u.battlefield.find(S=>S.id===m);return b?(p[b.defId]?.power??0)>0:!1})?{...d,pendingDamageChoice:!0}:{...ee(d),combatStep:"none",phase:"play2",priorityPlayer:e,stackPassedOnce:!1,stackPassPriority:void 0}}return{...s,combatStep:"blocks",priorityPlayer:i,stackPassedOnce:!1,stackPassPriority:void 0}}if(s.combatStep==="blocks")return{...s,combatStep:"pre-damage",priorityPlayer:e,stackPassedOnce:!1,stackPassPriority:void 0};if(s.combatStep==="pre-damage"){if(s.pendingDamageChoice)return s;const i=s.currentTurn,l=s.player1===i?s.player2:s.player1,n=y(s,i),o=y(s,l);return n.attackers.some(c=>{if(Object.values(o.blockers).includes(c))return!1;const h=n.battlefield.find(f=>f.id===c);return h?(p[h.defId]?.power??0)>0:!1})?{...s,pendingDamageChoice:!0}:{...ee(s),combatStep:"none",phase:"play2",priorityPlayer:e,stackPassedOnce:!1,stackPassPriority:void 0}}}if(t<a.length-1){const i=a[t+1];if(i==="combat"){const n=s.stack.length>0?M(s):s;return y(n,e).battlefield.filter(r=>{const c=p[r.defId];return!c||c.type!=="being"||c.id==="wasp"&&r.summonedThisTurn?!1:!r.exhausted||c.isFlyer}).length===0?{...n,phase:"play2",combatStep:"none",priorityPlayer:e}:{...n,phase:i,priorityPlayer:e}}let l={...s,phase:i,priorityPlayer:e,stackPassedOnce:!1,stackPassPriority:void 0};return i==="replenish"?l=oe(s):i==="draw"&&(l=Ie(l,e)),l}return oe(s)}function Te(s,e){const a=y(s,e),t=a.battlefield.map(i=>({...i,exhausted:!1,summonedThisTurn:!1}));return x(s,e,{...a,battlefield:t,landscapeCountThisTurn:0})}function Ie(s,e){return z(s,e,1)}function z(s,e,a){let t=y(s,e);const i=[],l=[...t.deck];for(let o=0;o<a&&l.length!==0;o++)i.push(l.shift());t={...t,hand:[...t.hand,...i],deck:l};let n=x(s,e,t);return n=P(n,`${e} drew ${i.length} card(s).`),n}function A(s,e,a,t,i=0){if(s.winner)return s;let l=y(s,e);const n=l.hand.findIndex(u=>u.id===a);if(n===-1)return s;const o=l.hand[n],d=p[o.defId];if(!d)return s;const r=s.player1===e?s.player2:s.player1;let c=s;if(d.type==="landscape"){if(s.currentTurn!==e||s.phase!=="play1"&&s.phase!=="play2")return s;const u=s.player1===e,h=u?s.p1LandscapesThisTurn:s.p2LandscapesThisTurn,f=u?s.p1TurnCount:s.p2TurnCount,g=Math.min(f,xe);if(h>=g)return s;const m=[...l.hand];m.splice(n,1);const v=[...l.battlefield,{...o,exhausted:!1}];return l={...l,hand:m,battlefield:v},c=x(c,e,l),c=u?{...c,p1LandscapesThisTurn:c.p1LandscapesThisTurn+1}:{...c,p2LandscapesThisTurn:c.p2LandscapesThisTurn+1},c=P(c,`${e} played a Landscape.`),R(c)}if(d.type==="being"){if(s.currentTurn!==e||s.phase!=="play1"&&s.phase!=="play2")return s;const u=(d.cost??0)+i,h=l.battlefield.filter(I=>p[I.defId]?.type==="landscape"&&!I.exhausted);if(h.length<u)return s;const f=[...l.hand];f.splice(n,1);const g={...o,summonedThisTurn:!0},m=[...l.limbo,g],v=h.slice(0,u).map(I=>I.id),b=l.battlefield.map(I=>v.includes(I.id)?{...I,exhausted:!0}:I);l={...l,hand:f,battlefield:b,limbo:m},c=x(c,e,l);const S={id:J(),cardInstanceId:o.id,cardDefId:o.defId,playerId:e},T=[...c.stack,S];c={...c,stack:T,priorityPlayer:r,stackPassedOnce:!1,stackPassPriority:se(T)};const L=[...c.stackHistoryPlays,{defId:o.defId,playerId:e}];return c={...c,stackHistoryPlays:L},c.stack.length>4&&(c={...c,stackWarPlayer:e}),c=P(c,`${e} played ${d.name} (exhausted ${u} landscape(s)) — on stack.`),c}if(d.type==="spell"){const u=d.cost??0;if(l.willPower<u)return s;const h=[...l.hand];h.splice(n,1);const f=[...l.limbo,{...o}];l={...l,hand:h,willPower:l.willPower-u,limbo:f},c=x(c,e,l);const g={id:J(),cardInstanceId:o.id,cardDefId:o.defId,playerId:e,target:t},m=[...c.stack,g];c={...c,stack:m,priorityPlayer:r,stackPassedOnce:!1,stackPassPriority:se(m)};const v=[...c.stackHistoryPlays,{defId:o.defId,playerId:e}];return c={...c,stackHistoryPlays:v},c.stack.length>4&&(c={...c,stackWarPlayer:e}),c=P(c,`${e} cast ${d.name}${t?` → ${t}`:""} — on stack.`),c}return s}function $e(s){if(s.stack.length===0)return s;const e=[...s.stack],a=e.pop();let t={...s,stack:e};const i=p[a.cardDefId];if(!i)return{...t,priorityPlayer:t.currentTurn};const l=y(t,a.playerId),n=l.limbo.findIndex(o=>o.id===a.cardInstanceId);if(i.type==="being"){if(n!==-1){const o=[...l.limbo],d=o.splice(n,1)[0],r=[...l.battlefield,{...d,summonedThisTurn:!0}];t=x(t,a.playerId,{...y(t,a.playerId),limbo:o,battlefield:r}),t=P(t,`${i.name} entered the battlefield.`)}}else if(i.type==="spell"){if(n!==-1){const o=[...l.limbo],d=o.splice(n,1)[0],r=[...l.yard,d];t=x(t,a.playerId,{...y(t,a.playerId),limbo:o,yard:r})}t=pe(t,a.playerId,a.cardDefId,a.target),t=P(t,`${i.name} resolved.`)}return t={...t,priorityPlayer:t.currentTurn},R(t)}function M(s){const e=[...s.stackHistoryPlays],a=s.stackWarPlayer;let t=s;for(;t.stack.length>0;)t=$e(t);if(t=Ue(t,e),a){t=z(t,a,1);const i=`⚔ STACK WAR: ${a} draws a card for playing the last card!`;t=P(t,i),t={...t,pendingRitualPopup:i}}return t={...t,stackHistoryPlays:[],stackWarPlayer:void 0,stackPassedOnce:!1,stackPassPriority:void 0},t}function pe(s,e,a,t){const i=p[a];if(!i)return s;let l=s;const n=y(s,e);if(i.spellType==="ignite"){const o=n.igniteBoost??0,d=2+o;if(l=H(l,e,t,d),o>0){const r=y(l,e);l=x(l,e,{...r,igniteBoost:0}),l=P(l,`Ignite dealt ${d} damage (ritual boost: +${o})!`)}}else if(i.spellType==="spike"){const o=O(s,e),d={};for(const c of o.battlefield)p[c.defId]?.type==="being"&&(d[c.defId]=d[c.defId]??[],d[c.defId].push(c));const r=Object.values(d).find(c=>c.length>=3);if(r&&t&&r.some(c=>c.id===t)){for(const c of r)c.id!==t&&(l=H(l,e,c.id,4));l=P(l,`Spike AoE ritual: hit all ${p[r[0].defId]?.name??"beings"} except one!`)}else l=H(l,e,t,4)}else if(i.spellType==="cancel"){if(n.yard.length>=5&&l.stack.length>0){const o=s.player1===e?s.player2:s.player1,d=O(l,e),r=[...d.exile,...d.yard];l=x(l,o,{...d,yard:[],exile:r});const c=[...l.stack];if(c.length>0){const u=c.pop();l={...l,stack:c};const h=y(l,u.playerId),f=h.limbo.findIndex(m=>m.id===u.cardInstanceId);if(f!==-1){const m=[...h.limbo],v=m.splice(f,1)[0],b=[...h.yard,v];l=x(l,u.playerId,{...h,limbo:m,yard:b})}const g=`🚫 5-YARD RITUAL: Exiled opponent's graveyard & countered ${p[u.cardDefId]?.name??"unknown"}!`;l=P(l,g),l={...l,pendingRitualPopup:g}}}else if(l.stack.length>0){const o=[...l.stack],d=o.pop();l={...l,stack:o};const r=y(l,d.playerId),c=r.limbo.findIndex(h=>h.id===d.cardInstanceId);if(c!==-1){const h=[...r.limbo],f=h.splice(c,1)[0],g=[...r.yard,f];l=x(l,d.playerId,{...r,limbo:h,yard:g})}const u=p[d.cardDefId];l=P(l,`Cancel countered ${u?.name??"unknown"}.`)}}else if(i.spellType==="grow"){const o=y(l,e),d=o.deck.findIndex(r=>p[r.defId]?.type==="landscape");if(d!==-1){const r=[...o.deck],c={...r.splice(d,1)[0],exhausted:!0},u=[...o.battlefield,c];l=x(l,e,{...o,deck:r,battlefield:u,needsNewAncient:!0}),l=R(l)}}return l}function H(s,e,a,t){if(!a)return s;const i=s.player1===e?s.player2:s.player1;if(a==="opponent"||a===i){const r=O(s,e);return x(s,i,{...r,willPower:Math.max(0,r.willPower-t)})}const l=O(s,e),n=l.battlefield.findIndex(r=>r.id===a);if(n!==-1){const r=[...l.battlefield],c={...r[n],counters:r[n].counters+t},u=p[c.defId];if(u?.toughness!==void 0&&c.counters>=u.toughness){r.splice(n,1);const h=[...l.yard,c];return x(s,i,{...l,battlefield:r,yard:h})}return r[n]=c,x(s,i,{...l,battlefield:r})}const o=y(s,e),d=o.battlefield.findIndex(r=>r.id===a);if(d!==-1){const r=[...o.battlefield],c={...r[d],counters:r[d].counters+t},u=p[c.defId];if(u?.toughness!==void 0&&c.counters>=u.toughness){r.splice(d,1);const h=[...o.yard,c];return x(s,e,{...o,battlefield:r,yard:h})}return r[d]=c,x(s,e,{...o,battlefield:r})}return s}function W(s,e,a){if(s.currentTurn!==e||s.combatStep!=="attackers")return s;const t=y(s,e),i=t.battlefield.find(d=>d.id===a);if(!i)return s;const l=p[i.defId];if(!l||l.type!=="being"||i.exhausted&&!l.isFlyer||l.id==="wasp"&&i.summonedThisTurn)return s;const n=[...t.attackers],o=n.indexOf(a);return o!==-1?n.splice(o,1):n.push(a),x(s,e,{...t,attackers:n})}function re(s,e,a,t){if(s.currentTurn===e||s.combatStep!=="blocks")return s;const i=y(s,e),l=i.battlefield.find(h=>h.id===a);if(!l||l.exhausted)return s;const n=p[l.defId];if(!n||n.type!=="being")return s;const o=s.player1===e?s.player2:s.player1,d=y(s,o);if(!d.attackers.includes(t))return s;const r=d.battlefield.find(h=>h.id===t);if((r?p[r.defId]:null)?.isFlyer&&!n.isFlyer)return s;const u={...i.blockers,[a]:t};return x(s,e,{...i,blockers:u})}function ee(s,e="additive"){const a=s.currentTurn,t=s.player1===a?s.player2:s.player1,i=y(s,a),l=y(s,t);let n=[...i.battlefield],o=[...l.battlefield],d=[...i.yard],r=[...l.yard],c=l.willPower;const u=[];for(const f of i.attackers){const g=n.find(b=>b.id===f);if(!g)continue;const m=p[g.defId];if(!m)continue;const v=Object.entries(l.blockers).filter(([,b])=>b===f).map(([b])=>b);if(v.length===0)u.push(m.power??0);else{let b=g.counters??0;for(const T of v){const L=o.findIndex(Z=>Z.id===T);if(L===-1)continue;const I=o[L],B=p[I.defId];if(!B)continue;const q=(I.counters??0)+(m.power??0);b+=B.power??0,B.toughness!==void 0&&q>=B.toughness?(r.push({...I,counters:q}),o.splice(L,1)):o[L]={...I,counters:q}}const S=n.findIndex(T=>T.id===f);S!==-1&&(m.toughness!==void 0&&b>=m.toughness?(d.push({...g,counters:b}),n.splice(S,1)):n[S]={...g,counters:b})}}if(u.length>0){let f;e==="multiplicative"?f=u.reduce((g,m)=>g*m,1):f=u.reduce((g,m)=>g+m,0),c=Math.max(0,c-f)}n=n.map(f=>i.attackers.includes(f.id)&&!p[f.defId]?.isFlyer?{...f,exhausted:!0}:f);let h=x(s,a,{...i,battlefield:n,yard:d,attackers:[],blockers:{}});return h=x(h,t,{...l,battlefield:o,yard:r,willPower:c,blockers:{}}),R(P(h,"Combat resolved."))}function j(s,e,a){if(!s.pendingDamageChoice||s.currentTurn!==e)return s;const t=P(s,`${e} chose ${a} unblocked damage.`);return{...ee(t,a),combatStep:"none",phase:"play2",priorityPlayer:e,pendingDamageChoice:void 0}}function Ce(s,e,a){const t=y(s,e),i=t.battlefield.findIndex(c=>c.id===a);if(i===-1)return s;const l=t.battlefield[i];if(p[l.defId]?.type!=="landscape")return s;const n=[...t.battlefield];n.splice(i,1);const o=[...t.yard,l],d=t.willPower+1;let r=x(s,e,{...t,battlefield:n,yard:o,willPower:d});return r=P(r,`${e} sacrificed a Landscape for 1 WP.`),r}function G(s,e,a){if(s.phase!=="play1"&&s.phase!=="play2"||s.priorityPlayer!==e)return s;const t=y(s,e);if(!t.ancient||t.ancient.exhausted)return s;const i=p[t.ancient.defId];if(!i)return s;const l=s.player1===e?s.player2:s.player1;let n=x(s,e,{...t,ancient:{...t.ancient,exhausted:!0}});switch(i.id){case"nest_of_swarm":{const o=U("insect",e),d=U("insect",e),r=y(n,e);n=x(n,e,{...r,battlefield:[...r.battlefield,o,d]});break}case"misty_isle":{n=P(n,`${e} used Misty Isle — damage prevented this turn.`);break}case"smoldering_volcano":{n=H(n,e,a,3);break}case"cavern_of_the_see":{if(a){const o=y(n,l),d=o.hand.findIndex(r=>r.id===a);if(d!==-1){const r=[...o.hand],c=r.splice(d,1)[0],u=Q([...o.deck,c]);n=x(n,l,{...o,hand:r,deck:u}),n=P(n,`${e} used Cavern of the See — opponent recycled a card.`)}}else n=P(n,`${e} used Cavern of the See.`);break}case"field_of_imagination":{const o=y(n,e),d=o.hand.length,r=Q([...o.deck,...o.hand]);n=x(n,e,{...o,hand:[],deck:r}),n=z(n,e,d),n=s.player1===e?{...n,p1FieldOfImaginationSacCount:n.p1FieldOfImaginationSacCount+1}:{...n,p2FieldOfImaginationSacCount:n.p2FieldOfImaginationSacCount+1};break}}return n=P(n,`${e} used Ancient: ${i.name}.`),n={...n,priorityPlayer:l},R(n)}function oe(s){const e=s.currentTurn,a=s.player1===e?s.player2:s.player1;let i=s.stack.length>0?M(s):s;const n=s.player1===a?{p1TurnCount:s.p1TurnCount+1}:{p2TurnCount:s.p2TurnCount+1};i={...i,...n,currentTurn:a,phase:"replenish",combatStep:"none",pendingDamageChoice:void 0,stackPassedOnce:!1,stackPassPriority:void 0,turnNumber:i.turnNumber+1,p1LandscapesThisTurn:s.player1===a?0:i.p1LandscapesThisTurn,p2LandscapesThisTurn:s.player2===a?0:i.p2LandscapesThisTurn,priorityPlayer:a,stack:[]};const o=s.player1,d=s.player2,r=y(i,o),c=y(i,d);(r.attackers.length>0||Object.keys(r.blockers).length>0)&&(i=x(i,o,{...r,attackers:[],blockers:{}})),(c.attackers.length>0||Object.keys(c.blockers).length>0)&&(i=x(i,d,{...c,attackers:[],blockers:{}}));const u=h=>{const f=y(i,h),g=f.battlefield.map(m=>p[m.defId]?.type==="being"&&m.counters>0?{...m,counters:0}:m);i=x(i,h,{...f,battlefield:g})};return u(o),u(d),i=Te(i,a),i=P(i,`--- Turn ${i.turnNumber}: ${a} ---`),i}function R(s){if(s.p1State.willPower<=0&&s.p2State.willPower<=0){const t=s.stackHistoryPlays.length>0?s.stackHistoryPlays[s.stackHistoryPlays.length-1].playerId:s.currentTurn,i=`⚡ FINAL BLOW: Both players at 0 WP! ${t} wins!`;return P({...s,winner:t},i)}const e=(t,i)=>{if(i.battlefield.filter(r=>p[r.defId]?.type==="landscape").length>=ke||O(s,t).willPower<=0||(s.player1===t?s.p1FieldOfImaginationSacCount:s.p2FieldOfImaginationSacCount)>=Pe)return t},a=e(s.player1,s.p1State)??e(s.player2,s.p2State);return a?P({...s,winner:a},`${a} WINS!`):s}function Ee(s,e){const a=y(s,e);if(!a.ancient)return s;const t=[...a.yard,a.ancient];let i=x(s,e,{...a,ancient:null,yard:t});return i=P(i,`${e} sacrificed their Ancient.`),i}function Le(s,e,a){const t=y(s,e),i=t.battlefield.findIndex(c=>c.id===a);if(i===-1)return s;const l=t.battlefield[i],n=p[l.defId];if(!n||n.type!=="landscape"&&n.type!=="being")return s;const o=[...t.battlefield];o.splice(i,1);const d=[...t.ritualZone,l];let r=x(s,e,{...t,battlefield:o,ritualZone:d});return r=P(r,`${e} placed ${n.name} in the Ritual Zone (${d.length} card(s)).`),ue(r,e)}function Ae(s,e,a){const t=y(s,e),i=t.hand.findIndex(c=>c.id===a);if(i===-1)return s;const l=t.hand[i],n=p[l.defId];if(!n||n.type!=="spell")return s;const o=[...t.hand];o.splice(i,1);const d=[...t.ritualZone,l];let r=x(s,e,{...t,hand:o,ritualZone:d});return r=P(r,`${e} placed ${n.name} in the Ritual Zone (${d.length} card(s)).`),ue(r,e)}function Oe(s,e,a){const t=y(s,e),i=t.ritualZone.findIndex(r=>r.id===a);if(i===-1)return s;const l=[...t.ritualZone],n=l.splice(i,1)[0],o=[...t.battlefield,{...n,exhausted:!1}];let d=x(s,e,{...t,battlefield:o,ritualZone:l});return d=P(d,`${e} returned a Landscape from the Ritual Zone to the battlefield.`),d}function Y(s,e){const a=p[s.defId];return!(!a||e.defId!==void 0&&s.defId!==e.defId||e.cardType!==void 0&&a.type!==e.cardType||e.spellType!==void 0&&a.spellType!==e.spellType||e.isFlyer!==void 0&&!!a.isFlyer!==e.isFlyer||e.exactPower!==void 0&&a.power!==e.exactPower)}const ne=[{name:"Landscape Draw",sequence:[{cardType:"landscape"},{cardType:"landscape"}]},{name:"Ignite Surge",sequence:[{cardType:"landscape"},{cardType:"landscape"},{defId:"merfolk"},{cardType:"spell",spellType:"ignite"}]},{name:"Primal Ignite",sequence:[{cardType:"landscape"},{cardType:"landscape"},{defId:"insect"},{defId:"insect"},{cardType:"spell",spellType:"ignite"}]},{name:"Flock Control",sequence:[{cardType:"being",isFlyer:!0},{cardType:"being",isFlyer:!0}]},{name:"Void Cancel",sequence:[{cardType:"spell",spellType:"cancel"}],yardCondition:s=>s.yard.length>=5}];function le(s){return s.length===0?[]:ne.filter(e=>s.length>=e.sequence.length?!1:e.sequence.slice(0,s.length).every((a,t)=>Y(s[t],a))).map(e=>e.name)}function de(s,e,a){const t=y(s,e),i=t.ritualZone.length;for(const l of ne)if(!(i>=l.sequence.length||!l.sequence.slice(0,i).every((o,d)=>Y(t.ritualZone[d],o)))&&Y(a,l.sequence[i]))return!0;return!1}function ue(s,e){const a=y(s,e),t=a.ritualZone;if(t.length===0)return s;for(const i of ne){if(t.length<i.sequence.length||!i.sequence.every((c,u)=>Y(t[u],c))||i.yardCondition&&!i.yardCondition(a))continue;const n=t.slice(0,i.sequence.length),o=t.slice(i.sequence.length),d=[...a.yard,...n];let r=x(s,e,{...a,ritualZone:o,yard:d});switch(i.name){case"Landscape Draw":{r=z(r,e,1);const c="🌿 LANDSCAPE RITUAL: Sacrificed 2 landscapes, drew 1 card!";r=P(r,`${e} completed Landscape Draw ritual.`),r={...r,pendingRitualPopup:c};break}case"Ignite Surge":case"Primal Ignite":{const c=`🔥 ${i.name.toUpperCase()}: Ignite charges with +1 bonus damage! Choose a target.`;r=P(r,`${e} completed ${i.name} ritual — ritual ignite pending!`),r={...r,pendingRitualTarget:{ritualName:i.name,uid:e,igniteBoost:1},pendingRitualPopup:c};break}case"Flock Control":{const c="🦅 FLOCK CONTROL: Sacrifice two flyers — choose an opponent being to gain control of!";r=P(r,`${e} completed Flock Control ritual — target selection pending!`),r={...r,pendingRitualTarget:{ritualName:"Flock Control",uid:e},pendingRitualPopup:c};break}case"Void Cancel":{const c=s.player1===e?s.player2:s.player1,u=O(r,e),h=[...u.exile,...u.yard];r=x(r,c,{...u,yard:[],exile:h});const f="🚫 VOID CANCEL: 5-card yard threshold met — opponent's graveyard exiled!";r=P(r,`${e} completed Void Cancel — exiled opponent's yard.`),r={...r,pendingRitualPopup:f};break}}return r}return s}function Re(s,e,a){const t=s.pendingRitualTarget;if(!t||t.uid!==e)return s;let i={...s,pendingRitualTarget:void 0};if(t.ritualName==="Ignite Surge"||t.ritualName==="Primal Ignite"){const n=2+(t.igniteBoost??1);i=H(i,e,a,n),i=P(i,`${e} Ritual Ignite deals ${n} damage to target!`)}else if(t.ritualName==="Flock Control"){const l=s.player1===e?s.player2:s.player1,n=O(i,e),o=n.battlefield.findIndex(d=>d.id===a);if(o!==-1){const d={...n.battlefield[o],owner:e},r=[...n.battlefield];r.splice(o,1),i=x(i,l,{...n,battlefield:r});const c=y(i,e);i=x(i,e,{...c,battlefield:[...c.battlefield,d]}),i=z(i,e,1),i=P(i,`${e} gained control of ${p[d.defId]?.name??"being"} and drew a card!`)}}return R(i)}function De(s,e){const a=p[s.defId];return!(!a||e.defId!==void 0&&s.defId!==e.defId||e.spellType!==void 0&&a.spellType!==e.spellType||e.isFlyer!==void 0&&!!a.isFlyer!==e.isFlyer||e.exactPower!==void 0&&a.power!==e.exactPower)}const Be=[{name:"Double Cancel Spike",sequence:[{spellType:"cancel"},{spellType:"cancel"},{spellType:"spike"}]},{name:"Power Summon",sequence:[{exactPower:5},{spellType:"spike"},{spellType:"grow"}]},{name:"Flame Wave",sequence:[{spellType:"ignite"},{spellType:"ignite"},{spellType:"grow"}]},{name:"Storm Flyer",sequence:[{isFlyer:!0},{spellType:"cancel"},{spellType:"ignite"}]},{name:"Ancient Stasis",sequence:[{spellType:"grow"},{spellType:"grow"}],requiresDifferentPlayers:!0},{name:"Knowledge Draw",sequence:[{spellType:"grow"},{spellType:"cancel"}]}];function ze(s){if(s.length<2)return null;for(const e of Be){const a=e.sequence.length;if(!(s.length<a))for(let t=0;t<=s.length-a;t++){const i=s.slice(t,t+a);if(e.sequence.every((n,o)=>De(i[o],n))&&!(e.requiresDifferentPlayers&&new Set(i.map(o=>o.playerId)).size<2))return e}}return null}function Ue(s,e){const a=ze(e);if(!a)return s;let t=s;const i=s.player1,l=s.player2;switch(a.name){case"Double Cancel Spike":{const n=e.filter(o=>p[o.defId]?.spellType==="spike");if(n.length>0){const d=n[n.length-1].playerId===i?l:i,r=y(t,d);t=x(t,d,{...r,willPower:Math.max(0,r.willPower-2)});const c="⚡ DOUBLE CANCEL SPIKE: Spike deals +2 bonus damage!";t=P(t,c),t={...t,pendingRitualPopup:c}}break}case"Power Summon":{const n=e.filter(o=>p[o.defId]?.spellType==="grow");if(n.length>0){const o=n[n.length-1].playerId,d=U("merfolk",o),r=y(t,o);t=x(t,o,{...r,battlefield:[...r.battlefield,d]});const c="⭐ POWER SUMMON: A Merfolk token enters the battlefield!";t=P(t,c),t={...t,pendingRitualPopup:c}}break}case"Flame Wave":{const n=e.filter(o=>p[o.defId]?.spellType==="grow");if(n.length>0){const d=n[n.length-1].playerId===i?l:i,r=y(t,d),c=r.battlefield.findIndex(h=>p[h.defId]?.type==="landscape");if(c!==-1){const h=[...r.battlefield],f=h.splice(c,1)[0],g=[...r.yard,f];t=x(t,d,{...r,battlefield:h,yard:g})}const u="🔥 FLAME WAVE: Opponent's landscape is destroyed!";t=P(t,u),t={...t,pendingRitualPopup:u}}break}case"Storm Flyer":{const n=e.filter(o=>p[o.defId]?.spellType==="ignite");if(n.length>0){const o=n[n.length-1].playerId,d=U("flyer_token",o),r=y(t,o);t=x(t,o,{...r,battlefield:[...r.battlefield,d]});const c="⚡ STORM FLYER: A 3/1 flyer token enters the battlefield!";t=P(t,c),t={...t,pendingRitualPopup:c}}break}case"Ancient Stasis":{const n=y(t,i),o=y(t,l);t=x(t,i,{...n,needsNewAncient:!1}),t=x(t,l,{...o,needsNewAncient:!1});const d="🌀 ANCIENT STASIS: Both Grow spells cancel — neither player re-selects their Ancient!";t=P(t,d),t={...t,pendingRitualPopup:d};break}case"Knowledge Draw":{t=z(t,i,1),t=z(t,l,1);const n="📖 KNOWLEDGE DRAW: Grow + Cancel ritual — each player draws a card!";t=P(t,n),t={...t,pendingRitualPopup:n};break}}return R(t)}function Ne(s,e,a,t){if(s.phase!=="play1"&&s.phase!=="play2"||s.currentTurn!==e)return s;const i=y(s,e),l=i.yard.findIndex(v=>v.id===a);if(l===-1)return s;const n=i.yard[l],o=p[n.defId];if(!o||o.type!=="being")return s;const d=o.power??0,r=t.map(v=>i.battlefield.find(b=>b.id===v)).filter(Boolean);if(r.length!==t.length||!r.every(v=>p[v.defId]?.type==="being")||r.reduce((v,b)=>v+(p[b.defId]?.power??0),0)!==d)return s;const u=i.battlefield.filter(v=>!t.includes(v.id));let h=[...i.yard];h.splice(h.findIndex(v=>v.id===a),1),h=[...h,...r];const f={...n,exhausted:!0,summonedThisTurn:!0,counters:0};let g=x(s,e,{...i,battlefield:[...u,f],yard:h});const m=`🌱 CULTIVATE: ${o.name} summoned from yard (exhausted, cannot attack)!`;return g=P(g,m),g={...g,pendingRitualPopup:m},R(g)}function Me(s,e,a,t,i){if(s.phase!=="play1"&&s.phase!=="play2"||s.currentTurn!==e)return s;const l=y(s,e),n=l.yard.findIndex(S=>S.id===a);if(n===-1)return s;const o=l.yard[n],d=p[o.defId];if(!d||d.type!=="spell")return s;const r=d.cost??0,c=t.map(S=>l.battlefield.find(T=>T.id===S)).filter(Boolean);if(c.length!==t.length||c.length<r)return s;const u=l.battlefield.filter(S=>!t.includes(S.id));let h=[...l.yard];h.splice(h.findIndex(S=>S.id===a),1),h=[...h,...c];const f=[...l.exile,o],g=2*r,m=Math.max(0,l.willPower-g);let v=x(s,e,{...l,battlefield:u,yard:h,exile:f,willPower:m});v=pe(v,e,o.defId,i);const b=`📚 STUDY: ${d.name} cast from yard! ${e} takes ${g} WP damage (spell exiled).`;return v=P(v,b),v={...v,pendingRitualPopup:b},R(v)}function qe(s,e,a,t){if(s.phase!=="play1"&&s.phase!=="play2"||s.currentTurn!==e)return s;const i=y(s,e),l=i.battlefield.filter(f=>p[f.defId]?.type==="landscape");if(a>l.length||a<=0||a>i.willPower)return s;const n=i.battlefield.findIndex(f=>f.id===t);if(n===-1||p[i.battlefield[n].defId]?.type!=="landscape")return s;const o=`evolved_${a}`,d=U(o,e);d.exhausted=!0,d.summonedThisTurn=!0;const r=[...i.battlefield];r.splice(n,1,d);const c=Math.max(1,a-2);let u=x(s,e,{...i,battlefield:r,willPower:i.willPower-a});const h=`🌀 EVOLVE: Landscape transformed into ${a}/${c} being! Spent ${a} WP.`;return u=P(u,h),u={...u,pendingRitualPopup:h},R(u)}function _e(s,e,a,t){if(s.phase!=="play1"&&s.phase!=="play2"||s.currentTurn!==e)return s;const i=y(s,e),l=i.battlefield.findIndex(m=>m.id===a);if(l===-1)return s;const n=i.battlefield[l];if(p[n.defId]?.type!=="being")return s;const o=i.yard.findIndex(m=>m.id===t);if(o===-1)return s;const d=i.yard[o];if(p[d.defId]?.type!=="landscape")return s;const r=[...i.battlefield];r.splice(l,1);const c=[...i.yard];c.splice(o,1);const u=[...c,n],h=[...i.hand,d];let f=x(s,e,{...i,battlefield:r,yard:u,hand:h});const g=`🌿 NOURISH: ${p[n.defId]?.name} sacrificed — Landscape returned to hand!`;return f=P(f,g),f={...f,pendingRitualPopup:g},f}function He(s,e){if(s.phase!=="play1"&&s.phase!=="play2"||s.currentTurn!==e)return s;const a=y(s,e);if(a.yard.length<10)return s;const t=[...a.exile,...a.yard];let i=x(s,e,{...a,yard:[],exile:t,willPower:1});const l="💀 LAST BREATH: Exile your entire yard — WP set to 1. Desperate times!";return i=P(i,l),i={...i,pendingRitualPopup:l},i}function Fe(s,e,a){if(s.phase!=="play1"&&s.phase!=="play2"||s.priorityPlayer!==e||a.length<2)return s;const t=y(s,e);if(!t.ancient)return s;const i=a.map(r=>t.battlefield.find(c=>c.id===r)).filter(Boolean);if(i.length<2||!i.every(r=>p[r.defId]?.type==="landscape"))return s;const l=t.battlefield.filter(r=>!a.slice(0,2).includes(r.id)),n=[...t.yard,t.ancient,...i.slice(0,2)];let o=x(s,e,{...t,battlefield:l,yard:n,ancient:null});o=z(o,e,3);const d="🌟 ANCIENT SACRIFICE: Drew 3 cards. You must discard 1 card.";return o=P(o,d),o={...o,pendingRitualPopup:d},o}const ce=10,_=3,w="bot_opponent";class We{container;currentUser;onNav;gameState;selectedCard=null;botRunning=!1;blockDragPos=null;mouseMoveHandler=null;spAwarded=!1;priorityPromiseResolve=null;priorityTimeoutId=null;waitingOnPlayer=!1;playerInactivityTimerId=null;botAutoPassScheduled=!1;gamePhase="ancient-selection";showGraveyard=null;showNewAncient=!1;showRitualModal=!1;showSettings=!1;dragCardId=null;handOrder=[];phaseBreakpoint=null;showBreakpointPicker=!1;breakpointHitPhase=null;gamePaused=!1;ritualPopupTimerId=null;priorityTimerEndMs=null;priorityCountdownInterval=null;turnPopupVisible=!1;turnPopupIsMyTurn=!1;turnPopupTimerId=null;spacebarHandler=null;constructor(e,a){this.currentUser=e,this.onNav=a,this.container=document.createElement("div"),this.container.className="game-screen",this.gameState=Se("local_bot_game",e.uid,w),this.handOrder=y(this.gameState,e.uid).hand.map(t=>t.id),this.mouseMoveHandler=t=>{this.blockDragPos={x:t.clientX,y:t.clientY},this.updateBlockLinesSVG()},document.addEventListener("mousemove",this.mouseMoveHandler),this.spacebarHandler=t=>{if(t.code==="Space"&&!t.repeat){if(t.preventDefault(),this.turnPopupVisible){this.dismissTurnPopup();return}(!this.botRunning||this.waitingOnPlayer)&&this.handlePassPriority()}},document.addEventListener("keydown",this.spacebarHandler),this.render()}getElement(){return this.container}setState(e){const a=this.currentUser.uid,t=y(this.gameState,a).hand.map(r=>r.id),i=y(e,a).hand.map(r=>r.id);for(const r of i)this.handOrder.includes(r)||this.handOrder.push(r);this.handOrder=this.handOrder.filter(r=>i.includes(r));const l=this.handOrder.filter(r=>t.includes(r)&&i.includes(r)),n=this.handOrder.filter(r=>!l.includes(r));this.handOrder=[...l,...n],this.clearPlayerInactivityTimer(),this.waitingOnPlayer&&this.gameState.priorityPlayer===a&&e.priorityPlayer!==a&&setTimeout(()=>this.resolvePlayerPriority(),500);const o=this.gameState.currentTurn!==e.currentTurn,d=this.gameState.phase!==e.phase;if(this.gameState=e,this.render(),d&&this.phaseBreakpoint&&e.phase===this.phaseBreakpoint&&e.currentTurn===a&&!e.winner&&(this.breakpointHitPhase=e.phase,this.clearPlayerInactivityTimer(),this.clearPriorityCountdown(),this.render()),e.pendingRitualPopup&&(this.showRitualPopupToast(e.pendingRitualPopup),this.gameState={...e,pendingRitualPopup:void 0}),o&&!e.winner&&this.showTurnPopupFor(e),!this.botRunning&&!this.waitingOnPlayer&&this.maybeBotTurn(),!e.winner){if(!this.botRunning&&!this.waitingOnPlayer&&e.currentTurn===a&&e.phase==="combat"&&e.combatStep==="blocks"){this.botDeclareBlockersAndAdvance();return}if(!this.botRunning&&!this.waitingOnPlayer&&e.currentTurn===a&&e.priorityPlayer!==a&&e.combatStep!=="blocks"&&e.stack.length===0){this.botAutoPassPriority();return}e.currentTurn===a&&e.priorityPlayer===a&&!this.waitingOnPlayer&&this.startPlayerInactivityTimer()}}showRitualPopupToast(e){this.container.querySelector("#ritual-toast")?.remove(),this.ritualPopupTimerId!==null&&clearTimeout(this.ritualPopupTimerId);const a=document.createElement("div");a.id="ritual-toast",a.className="ritual-toast",a.innerHTML=`
      <div class="ritual-toast-icon">🔮</div>
      <div class="ritual-toast-msg">${e}</div>
      <div class="ritual-toast-sub">RITUAL ACTIVATED</div>
    `,this.container.appendChild(a),this.ritualPopupTimerId=setTimeout(()=>{a.classList.add("ritual-toast-fade"),setTimeout(()=>a.remove(),600),this.ritualPopupTimerId=null},3500)}maybeShowRitualPopup(e){return e.pendingRitualPopup?(this.showRitualPopupToast(e.pendingRitualPopup),{...e,pendingRitualPopup:void 0}):e}showTurnPopupFor(e){const a=this.currentUser.uid;this.turnPopupTimerId!==null&&clearTimeout(this.turnPopupTimerId),this.turnPopupVisible=!0,this.turnPopupIsMyTurn=e.currentTurn===a,this.render(),this.turnPopupTimerId=setTimeout(()=>{this.dismissTurnPopup()},3e3)}dismissTurnPopup(){this.turnPopupTimerId!==null&&(clearTimeout(this.turnPopupTimerId),this.turnPopupTimerId=null),this.turnPopupVisible=!1,this.render()}buildTurnPopup(){const e=this.turnPopupIsMyTurn?"yours":"bots",a=this.turnPopupIsMyTurn?"⚔ YOUR TURN":"🤖 BOT'S TURN",t=this.turnPopupIsMyTurn?'<button id="btn-turn-popup-yield" class="btn-gold" style="font-size:8px;padding:5px 10px">🔴 Stop at Play 1</button>':"";return`
      <div class="turn-popup-overlay" id="turn-popup-overlay">
        <div class="turn-popup">
          <div class="turn-popup-title ${e}">${a}</div>
          <div class="turn-popup-hint">SPACE or click Okay to continue</div>
          <div class="turn-popup-buttons">
            <button id="btn-turn-popup-okay" class="btn-green" style="font-size:9px;padding:6px 14px">Okay</button>
            ${t}
          </div>
        </div>
      </div>
    `}maybeBotTurn(){this.gameState.currentTurn===w&&(this.gameState.winner||this.botRunning||(this.botRunning=!0,setTimeout(()=>this.runBotTurnAsync(),600)))}delay(e){return new Promise(a=>setTimeout(a,e))}waitForPlayerPriority(e=3e4){return new Promise(a=>{this.waitingOnPlayer=!0,this.priorityPromiseResolve=t=>{this.waitingOnPlayer=!1,a(t)},this.startPriorityCountdown(e),this.priorityTimeoutId=setTimeout(()=>{if(this.priorityPromiseResolve){this.clearPriorityCountdown();const t=this.priorityPromiseResolve;this.priorityPromiseResolve=null,this.waitingOnPlayer=!1,t(this.gameState)}},e),this.render()})}resolvePlayerPriority(){if(this.priorityPromiseResolve){this.priorityTimeoutId!==null&&(clearTimeout(this.priorityTimeoutId),this.priorityTimeoutId=null),this.clearPriorityCountdown();const e=this.priorityPromiseResolve;this.priorityPromiseResolve=null,this.waitingOnPlayer=!1,e(this.gameState)}}startPlayerInactivityTimer(){if(this.clearPlayerInactivityTimer(),this.gameState.winner||this.gamePaused||this.breakpointHitPhase)return;const e=this.gameState,a=this.currentUser.uid;(e.phase==="replenish"||e.phase==="draw")&&e.currentTurn===a?this.playerInactivityTimerId=setTimeout(()=>{this.playerInactivityTimerId=null;const i=this.gameState;if(i.currentTurn!==a||i.winner||this.gamePaused||this.breakpointHitPhase)return;const l=$(i,a);l!==i&&this.setState(l)},1e3):(this.startPriorityCountdown(3e4),this.playerInactivityTimerId=setTimeout(()=>{this.playerInactivityTimerId=null,this.clearPriorityCountdown();const i=this.gameState;if(i.currentTurn!==a||i.winner||i.priorityPlayer!==a||this.waitingOnPlayer||this.botRunning||this.gamePaused||this.breakpointHitPhase)return;const l=$(i,a);if(l!==i)this.setState(l);else if(i.pendingDamageChoice&&i.currentTurn===a){const n=j(i,a,"additive");n!==i&&this.setState(n)}},3e4))}clearPlayerInactivityTimer(){this.playerInactivityTimerId!==null&&(clearTimeout(this.playerInactivityTimerId),this.playerInactivityTimerId=null)}startPriorityCountdown(e){this.clearPriorityCountdown(),this.priorityTimerEndMs=Date.now()+e,this.priorityCountdownInterval=setInterval(()=>{const a=this.priorityTimerEndMs?Math.max(0,this.priorityTimerEndMs-Date.now()):0,t=this.container.querySelector("#priority-timer");t&&(t.textContent=`⏱ ${Math.ceil(a/1e3)}s`,a<=5e3?t.style.color="var(--red)":t.style.color="var(--gold)"),a<=0&&this.clearPriorityCountdown()},250)}clearPriorityCountdown(){this.priorityCountdownInterval!==null&&(clearInterval(this.priorityCountdownInterval),this.priorityCountdownInterval=null),this.priorityTimerEndMs=null}botAutoPassPriority(){if(this.botAutoPassScheduled)return;this.botAutoPassScheduled=!0;const e=1500;this.startPriorityCountdown(e),setTimeout(()=>{this.botAutoPassScheduled=!1,this.clearPriorityCountdown();const a=this.gameState,t=this.currentUser.uid;a.currentTurn!==t||a.priorityPlayer===t||this.botRunning||a.winner||(this.gameState={...a,priorityPlayer:t,stackPassedOnce:!1,stackPassPriority:void 0},this.render(),this.startPlayerInactivityTimer())},e)}botChooseDamageMode(e){const a=y(e,w),t=O(e,w),i=a.attackers.filter(o=>!Object.values(t.blockers).includes(o)).map(o=>{const d=a.battlefield.find(r=>r.id===o);return d?p[d.defId]?.power??0:0}).filter(o=>o>0);if(i.length<=1)return"additive";const l=i.reduce((o,d)=>o+d,0);return i.reduce((o,d)=>o*d,1)>=l?"multiplicative":"additive"}async botDeclareBlockersAndAdvance(){if(!this.botRunning){this.botRunning=!0;try{await this.delay(1e3);let e=this.gameState;const a=this.currentUser.uid;if(e.currentTurn!==a||e.combatStep!=="blocks"||e.winner){this.botRunning=!1;return}const t=y(e,w),i=y(e,a),l=t.battlefield.filter(n=>p[n.defId]?.type==="being"&&!n.exhausted);for(const n of[...i.attackers]){if(l.length===0)break;const o=i.battlefield.find(u=>u.id===n),d=o?p[o.defId]:null,r=l.findIndex(u=>{const h=p[u.defId];return!(d?.isFlyer&&!h?.isFlyer)});if(r===-1)continue;const[c]=l.splice(r,1);e=re(e,w,c.id,n)}this.gameState=e,this.render(),await this.delay(600),e=$(this.gameState,a),e=$(e,a),this.gameState=e,this.render()}catch(e){console.warn("Bot blocking error:",e)}this.botRunning=!1,this.startPlayerInactivityTimer()}}async runBotTurnAsync(){let e=this.gameState;try{if(e.phase==="replenish"&&(e=$(e,w)),e.phase==="draw"&&(e=$(e,w)),this.gameState=e,this.render(),await this.delay(400),e.phase==="play1"&&(e=await this.botPlayPhase(e),e=$(e,w),this.gameState=e,this.render(),await this.delay(400)),e.phase==="combat"){e=$(e,w),e=$(e,w);const a=y(e,w);for(const t of a.battlefield){const i=p[t.defId];i?.type==="being"&&(!t.exhausted||i.isFlyer)&&!(i.id==="wasp"&&t.summonedThisTurn)&&(e=W(e,w,t.id))}if(this.gameState=e,this.render(),await this.delay(400),e=$(e,w),this.gameState=e,this.render(),await this.delay(400),e.combatStep==="blocks"&&(e=await this.waitForPlayerPriority(3e4),e=$(e,w),e=$(e,w)),e.pendingDamageChoice){const t=this.botChooseDamageMode(e);e=j(e,w,t)}this.gameState=e,this.render(),await this.delay(400)}e.phase==="play2"&&(e=await this.botPlayPhase(e),e=$(e,w),this.gameState=e,this.render(),await this.delay(300)),e.phase==="end"&&(e=$(e,w),this.gameState=e,this.render())}catch(a){console.warn("Bot turn error:",a)}this.botRunning=!1,this.render(),this.gameState.winner||(this.showTurnPopupFor(this.gameState),this.startPlayerInactivityTimer())}async botPlayPhase(e){const a=y(e,w),t=e.player1===w,i=t?e.p1LandscapesThisTurn:e.p2LandscapesThisTurn,l=t?e.p1TurnCount:e.p2TurnCount,n=Math.min(l,3);let o=i;for(const h of[...a.hand]){if(o>=n)break;if(p[h.defId]?.type==="landscape"){const f=A(e,w,h.id);f!==e&&(e=f,o++,this.gameState=e,this.render(),await this.delay(500))}}const r=y(e,w).hand.filter(h=>p[h.defId]?.type==="being").sort((h,f)=>(p[h.defId]?.cost??0)-(p[f.defId]?.cost??0));for(const h of r){const f=A(e,w,h.id);f!==e&&(e=f,this.gameState=e,this.render(),await this.delay(400),e.stack.length>0&&(e=await this.waitForPlayerPriority(3e4),e=this.maybeShowRitualPopup(M(e)),this.gameState=e,this.render(),await this.delay(400)))}const u=y(e,w).hand.filter(h=>p[h.defId]?.type==="spell").sort((h,f)=>(p[h.defId]?.cost??0)-(p[f.defId]?.cost??0));for(const h of u){const f=p[h.defId];if(!f||!f.cost||y(e,w).willPower<(f.cost??0))continue;let m;if(f.spellType==="ignite"||f.spellType==="spike"){const S=y(e,this.currentUser.uid).battlefield.filter(T=>p[T.defId]?.type==="being");S.length>0?m=S.sort((L,I)=>(p[I.defId]?.power??0)-(p[L.defId]?.power??0))[0].id:m="opponent"}else if(f.spellType==="grow")m=void 0;else if(f.spellType==="cancel")continue;const v=A(e,w,h.id,m);v!==e&&(e=v,this.gameState=e,this.render(),await this.delay(400),e.stack.length>0&&(e=await this.waitForPlayerPriority(3e4),e=this.maybeShowRitualPopup(M(e)),this.gameState=e,this.render(),await this.delay(400)))}return e}render(){if(this.gamePhase==="ancient-selection"){this.renderAncientSelection();return}this.renderGame()}renderAncientSelection(){const e=F.map(a=>{const t=p[a];if(!t)return"";const i=t.imageUrl?`<img src="${t.imageUrl}" alt="${t.name}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'" />`:"";return`
        <div class="ancient-select-card" data-id="${a}">
          <div class="ancient-select-img">${i}<span class="ancient-select-emoji">⭐</span></div>
          <div class="ancient-select-name">${t.name}</div>
          <div class="ancient-select-desc">${t.description}</div>
        </div>
      `}).join("");this.container.innerHTML=`
      <div class="ancient-selection-screen">
        <div class="ancient-selection-header">
          <h1 class="ancient-selection-title">⭐ CHOOSE YOUR ANCIENT ⭐</h1>
          <p class="ancient-selection-subtitle">Double-click your Ancient during the game to use its ability. Choose wisely.</p>
        </div>
        <div class="ancient-selection-grid">
          ${e}
        </div>
      </div>
    `,this.container.querySelectorAll(".ancient-select-card").forEach(a=>{a.addEventListener("click",()=>{const t=a.dataset.id;let i=X(this.gameState,this.currentUser.uid,t);const l=F[Math.floor(Math.random()*F.length)];i=X(i,w,l),i=$(i,this.currentUser.uid),i=$(i,this.currentUser.uid),this.handOrder=y(i,this.currentUser.uid).hand.map(n=>n.id),this.gamePhase="playing",this.setState(i)})})}renderGame(){const e=this.gameState,a=this.currentUser.uid,t=y(e,a),i=O(e,a),l=e.currentTurn===a,n=e.priorityPlayer===a,o=i.battlefield.filter(k=>p[k.defId]?.type==="landscape"),d=i.battlefield.filter(k=>p[k.defId]?.type==="being"),r=t.battlefield.filter(k=>p[k.defId]?.type==="landscape"),c=t.battlefield.filter(k=>p[k.defId]?.type==="being"),u=e.player1===a,h=u?e.p1TurnCount:e.p2TurnCount,f=Math.min(h,3),g=u?e.p1LandscapesThisTurn:e.p2LandscapesThisTurn,m=this.handOrder.filter(k=>t.hand.some(E=>E.id===k)).map(k=>t.hand.find(E=>E.id===k)),v=Array(i.hand.length).fill(0).map(()=>'<div class="card-back"><div class="card-back-inner">?</div></div>').join(""),b=le(t.ritualZone),S=b.length>0?`<div class="ritual-hint-active">${b.map(k=>`✨ ${k}`).join("<br>")}</div>`:"",T=b.length>0,L=b.length>0?"?":"2",I=e.phase==="combat"&&e.combatStep==="blocks"&&!l,B={replenish:"untapping & refresh",draw:"drawing a card",play1:"play cards · summon beings",combat:"combat",play2:"play cards · summon beings",end:"wrapping up"},q=e.phase==="combat"?`COMBAT · ${e.combatStep.toUpperCase()}`:e.phase.toUpperCase().replace("PLAY1","PLAY 1").replace("PLAY2","PLAY 2"),Z=B[e.phase]??e.phase,fe=e.phase==="combat"?`Combat · ${e.combatStep}`:Z,V=this.priorityTimerEndMs?Math.max(0,Math.ceil((this.priorityTimerEndMs-Date.now())/1e3)):null,ye=V!==null?`<span id="priority-timer" class="priority-timer" style="color:${V<=5?"var(--red)":"var(--gold)"}">⏱ ${V}s</span>`:'<span id="priority-timer" class="priority-timer" style="display:none"></span>',ie=i.willPower<=5?"#ff4466":i.willPower<=10?"#ff7700":"var(--red)",ae=t.willPower<=5?"var(--red)":t.willPower<=10?"#ff7700":"var(--gold)";this.container.innerHTML=`
      ${this.buildInfoBar(e,t,i,l,n,ye)}

      <div class="game-area">
        <!-- Opponent area -->
        <div class="opponent-area ${n?"":"priority-active"}">
          ${n?"":'<div class="priority-field-label priority-field-bot">⚡ BOT HAS PRIORITY</div>'}
          <!-- Opponent hand centered -->
          <div class="opp-hand-row opp-hand-center">
            <div class="opp-wp-circle" style="--wp-color:${ie}">
              <span class="wp-value" style="color:${ie}">${i.willPower}</span>
            </div>
            <span class="zone-label">🤖 HAND (${i.hand.length})</span>
            <div class="opp-hand-cards">${v}</div>
          </div>
          <div class="area-row">
            <div class="ancient-col">
              ${i.ancient?this.buildCardEl(i.ancient,!1,!0):this.buildEmptyAncient()}
              <div class="zone-label">ANCIENT</div>
            </div>
            <div style="display:flex;flex-direction:column;flex:1;gap:3px;min-width:0;">
              <div class="landscape-col">
                <div class="zone-label">🌿 (${o.length})</div>
                <div class="landscape-zone opp-landscape-zone" id="opp-landscapes">
                  ${o.map(k=>this.buildCardEl(k,!1,!1)).join("")}
                </div>
              </div>
              <div class="opp-being-col">
                <div class="zone-label">🤖 BEINGS</div>
                <div class="battlefield-zone opp-being-zone ${I&&this.selectedCard?"block-targets-active":""}" id="opp-being-zone">
                  ${d.map(k=>{const E=e.p1State.attackers.includes(k.id)||e.p2State.attackers.includes(k.id);let D=I&&this.selectedCard&&E;if(D&&this.selectedCard){const N=t.battlefield.find(ge=>ge.id===this.selectedCard),me=N?p[N.defId]:null;p[k.defId]?.isFlyer&&!me?.isFlyer&&(D=!1)}return this.buildCardEl(k,!!D,!1,E)}).join("")}
                  ${i.limbo.filter(k=>p[k.defId]?.type==="being").map(k=>this.buildCardEl(k,!1,!1,!1,!0)).join("")}
                </div>
              </div>
            </div>
            <div class="yard-col">
              <button class="yard-btn" id="btn-opp-yard">🪦 ${i.yard.length}</button>
              <div style="font-size:7px;color:var(--text-dim)">YARD</div>
            </div>
          </div>
        </div>

        <!-- Center phase banner -->
        <div class="center-phase-banner">
          <span class="center-phase-text">${q}</span>
          ${l?'<span class="center-turn-label turn-yours">⚔ YOUR TURN</span>':'<span class="center-turn-label turn-bot">🤖 BOT TURN</span>'}
          <span class="center-phase-desc">${fe}</span>
        </div>

        <!-- Player area -->
        <div class="player-area ${n?"priority-active":""}">
          ${n?'<div class="priority-field-label priority-field-player">⚡ YOUR PRIORITY</div>':""}
          <div class="player-main-row">
            <!-- Left: Ancient -->
            <div class="ancient-col">
              ${t.ancient?this.buildCardEl(t.ancient,l,!0):this.buildEmptyAncient()}
              <div class="zone-label">ANCIENT</div>
              ${l&&t.ancient&&!t.ancient.exhausted?'<span style="font-size:7px;color:var(--gold)">(dbl-click · right-click sac)</span>':""}
              ${t.ancient?"":'<div style="font-size:7px;color:var(--text-dim)">SACRIFICED</div>'}
            </div>

            <!-- Center: Beings + Landscape stacked -->
            <div class="player-zones-col">
              ${e.phase==="combat"&&e.combatStep==="attackers"&&l?`
              <div class="zone-label" style="color:var(--red)">⚔ ATTACK ZONE</div>
              <div class="attack-zone" id="attack-zone" data-drop="attack">
                ${t.attackers.map(k=>{const E=t.battlefield.find(D=>D.id===k);return E?this.buildCardEl(E,!0,!1,!0):""}).join("")}
                ${t.attackers.length===0?'<div class="drop-hint">Drag beings here</div>':""}
              </div>`:""}
              ${I?`
              <div class="zone-label" style="color:var(--cyan)">🛡 Click your being → click attacker to block (multiple beings can block the same attacker)</div>`:""}

              <div class="zone-label">🐉 BEINGS ${l&&(e.phase==="play1"||e.phase==="play2")?`<span style="color:var(--green-dim);font-size:7px">(drag from hand · 🌿${r.filter(k=>!k.exhausted).length} free)</span>`:""}</div>
              <div class="battlefield-zone my-being-zone" id="my-being-zone"
                   data-drop="being"
                   ondragover="event.preventDefault()" ondragleave="" ondrop="">
                ${c.map(k=>{const E=this.selectedCard===k.id&&I,D=t.blockers[k.id],N=l&&(e.phase==="play1"||e.phase==="play2");return this.buildCardEl(k,l||I,!1,t.attackers.includes(k.id),!1,E,!!D,N)}).join("")}
                ${t.limbo.filter(k=>p[k.defId]?.type==="being").map(k=>this.buildCardEl(k,!1,!1,!1,!0)).join("")}
              </div>

              <div class="zone-label">🌿 LANDS (${r.length}) · ${g}/${f} ${l&&(e.phase==="play1"||e.phase==="play2")?'<span style="color:var(--green-dim);font-size:7px">(drag from hand · right-click sac)</span>':""}</div>
              <div class="landscape-zone my-landscape-zone" id="my-landscapes"
                   data-drop="landscape"
                   ondragover="event.preventDefault()" ondrop="">
                ${r.map(k=>this.buildCardEl(k,l,!1,!1,!1,!1,!1,!0)).join("")}
              </div>
            </div>

            <!-- Right: Ritual + Yard -->
            <div class="player-side-col">
              <div class="ritual-col">
                <div class="zone-label ritual-zone-label">🔮 RITUAL</div>
                ${S}
                <div class="ritual-zone ${T?"ritual-zone-forming":""}" id="ritual-zone" data-drop="ritual">
                  ${t.ritualZone.map((k,E)=>`
                    <div class="ritual-card-slot" data-ritual-idx="${E}">
                      <span class="ritual-pos">${E+1}</span>
                      ${this.buildCardEl(k,!1,!1)}
                    </div>
                  `).join("")}
                  ${t.ritualZone.length===0?'<div class="ritual-hint">Drag 🌿/🐉/✨<br>to form rituals</div>':""}
                </div>
                <div style="font-size:7px;color:var(--text-dim);text-align:center">${t.ritualZone.length}/${L}</div>
              </div>
              <div class="yard-col">
                <button class="yard-btn" id="btn-my-yard">🪦 ${t.yard.length}</button>
                <div style="font-size:7px;color:var(--text-dim)">YARD</div>
                <div style="font-size:7px;color:var(--text-dim)">EXL: ${t.exile.length}</div>
              </div>
            </div>
          </div>

          <!-- Action bar -->
          ${this.buildActionBar(e,l,n)}
        </div>
      </div>

      <!-- Hand area -->
      <div class="hand-area" id="hand-area" data-drop="hand">
        <div class="hand-label">HAND (${m.length}) — drag to reorder · drag to zone to play · SPACE = pass priority</div>
        <div class="hand-cards" id="hand-cards">
          ${m.map((k,E)=>{const D=p[k.defId],N=l||n&&D?.type==="spell";return this.buildHandCardEl(k,N,E)}).join("")}
        </div>
      </div>

      <!-- Log bar -->
      <div class="log-bar">
        <div class="game-log" id="game-log">
          ${(e.log||[]).slice(-6).map(k=>`<div class="game-log-entry">&gt; ${k}</div>`).join("")}
        </div>
      </div>

      ${e.winner?this.buildWinOverlay(e.winner,a):""}
      ${this.botRunning&&!this.waitingOnPlayer?'<div class="bot-thinking">🤖 Bot thinking...</div>':""}

      ${this.buildStackPopup(e,a)}
      ${this.buildRitualZonePopup(e,a)}
      ${this.showGraveyard?this.buildGraveyardPopup(e):""}
      ${this.showNewAncient?this.buildAncientChoicePopup():""}
      ${e.pendingRitualTarget&&e.pendingRitualTarget.uid===a?this.buildRitualTargetPopup(e,a):""}
      ${e.pendingDamageChoice&&e.currentTurn===a?this.buildDamageChoiceModal(e):""}
      ${this.showRitualModal?this.buildRitualModal(e,a):""}
      ${this.turnPopupVisible?this.buildTurnPopup():""}
      ${this.showSettings?this.buildSettingsModal():""}
      ${this.showBreakpointPicker?this.buildBreakpointPickerPopup():""}
      ${this.breakpointHitPhase?this.buildBreakpointHitPopup():""}
      ${this.gamePaused?this.buildPauseOverlay():""}

      <!-- Player WP circle floating over field bottom-center -->
      <div class="my-wp-circle" style="--wp-color:${ae}">
        <span class="wp-value" style="color:${ae}">${t.willPower}</span>
      </div>
    `;const K=this.container.querySelector("#game-log");K&&(K.scrollTop=K.scrollHeight),this.attachGameListeners(),this.updateBlockLinesSVG()}buildInfoBar(e,a,t,i,l,n){const o=["replenish","draw","play1","combat","play2","end"],d=e.phase==="combat"?` [${e.combatStep.toUpperCase()}]`:"",r=l?'<span class="priority-mine">⚡ YOUR PRIORITY</span>':'<span class="priority-bot">⚡ BOT PRIORITY</span>',c=this.phaseBreakpoint?`🔴 STOP @ ${this.phaseBreakpoint.toUpperCase()}`:"⏸ SET STOP",u=this.phaseBreakpoint?"btn-danger":"btn-gold",h=i?`<span style="font-family:'Press Start 2P',monospace;font-size:7px;color:var(--green);background:rgba(0,255,65,0.1);padding:2px 6px;border:1px solid var(--green)">⚔ YOUR TURN</span>`:`<span style="font-family:'Press Start 2P',monospace;font-size:7px;color:var(--red);background:rgba(255,45,85,0.1);padding:2px 6px;border:1px solid var(--red)">🤖 BOT TURN</span>`;return`
      <div class="game-info-bar">
        <div class="player-stats">
          <span class="wp-label-opp">BOT</span>
          <span style="font-size:9px;color:var(--text-dim)">H:${t.hand.length} D:${t.deck.length}</span>
        </div>
        <div class="phase-col">
          <div class="phase-indicator">
            ${o.map(f=>`<span class="phase-step ${e.phase===f?"active":""}">${f.slice(0,4).toUpperCase()}</span>`).join("")}
            <span style="color:var(--text-dim);font-size:7px">${d}</span>
          </div>
          <div class="turn-info">
            ${h}
            ${r}
            ${n}
            <button id="btn-stop-auto" class="${u}" style="font-size:7px;padding:2px 6px;margin-left:4px">${c}</button>
          </div>
        </div>
        <div class="player-stats">
          <span style="font-size:9px;color:var(--text-dim)">H:${a.hand.length} D:${a.deck.length}</span>
          <span class="wp-label-player">YOU</span>
          <button id="btn-settings" class="btn-settings" title="Settings">⚙</button>
        </div>
      </div>
    `}buildActionBar(e,a,t){if(!a&&!this.waitingOnPlayer||this.botRunning&&!this.waitingOnPlayer)return"";const i=this.currentUser.uid,l=y(e,i),n=[],o=[];if(this.waitingOnPlayer)n.push('<button id="btn-pass-priority" class="btn-gold pulse-anim">⚡ Pass Priority (bot waiting)</button>');else if(a&&t){if(e.phase==="combat"&&e.combatStep==="attackers"){const d=l.battlefield.filter(r=>{const c=p[r.defId];return c?.type==="being"&&(!r.exhausted||c.isFlyer)&&!l.attackers.includes(r.id)&&!(c.id==="wasp"&&r.summonedThisTurn)});d.length>0&&n.push(`<button id="btn-attack-all" class="btn-danger" style="font-size:11px;padding:8px 16px">⚔ Attack with All (${d.length})</button>`),o.push('<button id="btn-done-attackers" class="btn-danger" style="font-size:11px;padding:8px 16px">✅ Done Declaring Attackers</button>')}else e.phase==="combat"&&e.combatStep==="blocks"||(e.phase==="combat"&&e.combatStep==="pre"?o.push('<button id="btn-next-phase" class="btn-green">▶ Enter Attackers Phase</button>'):e.phase==="combat"&&e.combatStep==="none"?o.push('<button id="btn-next-phase" class="btn-green">▶ Enter Combat</button>'):(n.push('<button id="btn-pass-priority" class="btn-gold">⚡ Pass Priority</button>'),o.push('<button id="btn-next-phase" class="btn-green">▶ Next Phase</button>'),o.push('<button id="btn-end-turn">⏩ End Turn</button>')));(e.phase==="play1"||e.phase==="play2")&&(n.push('<button id="btn-rituals" class="btn-gold" style="font-size:9px;padding:6px 10px">🔮 Rituals</button>'),l.yard.length>=10&&n.push('<button id="btn-last-breath" class="btn-danger" style="font-size:9px;padding:6px 8px">💀 Last Breath</button>'))}return!a&&e.phase==="combat"&&e.combatStep==="blocks"&&o.push('<button id="btn-done-blocks" class="btn-green">🛡 Done Blocking</button>'),n.length===0&&o.length===0?"":`
      <div class="action-bar">
        <div class="action-bar-left">${n.join("")}</div>
        <div class="action-bar-right">${o.join("")}</div>
      </div>
    `}buildStackPopup(e,a){if(!(e.stack.length>0||this.waitingOnPlayer))return"";const i=[...e.stack].reverse().map((n,o)=>{const d=p[n.cardDefId],r=o===0,c=d?{being:"🐉",landscape:"🌿",spell:"✨",ancient:"⭐"}[d.type]??"?":"?",u=d?.imageUrl?`<img src="${d.imageUrl}" alt="${d.name}" class="stack-card-img" onerror="this.style.display='none'" />`:`<div class="stack-card-img-placeholder">${c}</div>`;return`
        <div class="stack-entry ${r?"stack-top":""}">
          <div class="stack-entry-row">
            <div class="stack-card-preview">${u}</div>
            <div class="stack-entry-info">
              <span class="stack-badge">${e.stack.length-o}</span>
              <span>${d?.name??"?"} (${n.playerId===a?"YOU":"BOT"})</span>
              ${n.target?`<span style="color:var(--text-dim);font-size:9px">→ ${n.target}</span>`:""}
            </div>
          </div>
        </div>
      `}).join("");return`
      <div class="stack-popup">
        <div class="stack-title">📚 STACK</div>
        ${e.priorityPlayer===a?'<div class="priority-banner-player">⚡ You have priority — respond or pass</div>':'<div class="priority-banner-bot">⚡ Bot has priority</div>'}
        <div class="stack-list">${i||'<div style="color:var(--text-dim);font-size:9px">Empty</div>'}</div>
        ${this.waitingOnPlayer?'<button id="btn-pass-in-stack" class="btn-gold w-full mt-8">⚡ Pass Priority</button>':""}
      </div>
    `}buildRitualZonePopup(e,a){const t=y(e,a);if(t.ritualZone.length===0)return"";const i=le(t.ritualZone),l=i.length>0,n=t.ritualZone.map((d,r)=>{const c=p[d.defId],u={being:"🐉",landscape:"🌿",ancient:"⭐",spell:"✨"}[c?.type??""]||"?";return`
        <div class="ritual-popup-entry">
          <span class="ritual-pos">${r+1}</span>
          <span>${u} ${c?.name??"?"}</span>
        </div>
      `}).join(""),o=l?`<div style="font-size:8px;color:var(--gold);margin-top:4px;font-family:'Press Start 2P',monospace">${i.map(d=>`✨ ${d}`).join("<br>")}</div>`:"";return`
      <div class="ritual-zone-popup ${l?"ritual-zone-popup-forming":""}">
        <div class="ritual-popup-title">🔮 RITUAL (${t.ritualZone.length})</div>
        <div class="ritual-popup-list">${n}</div>
        ${o}
        <div style="font-size:7px;color:var(--text-dim);margin-top:4px">Right-click card to remove</div>
      </div>
    `}buildGraveyardPopup(e){const a=this.showGraveyard==="opp",t=a?O(e,this.currentUser.uid):y(e,this.currentUser.uid);return`
      <div class="overlay" id="graveyard-overlay">
        <div class="modal" style="max-width:560px;width:90vw">
          <div class="modal-title">🪦 ${a?"🤖 Bot Graveyard":"My Graveyard"} (${t.yard.length} cards)</div>
          <div class="graveyard-grid">
            ${t.yard.length===0?'<div style="color:var(--text-dim);font-size:11px">Empty graveyard</div>':t.yard.map(l=>this.buildCardEl(l,!1,!1)).join("")}
          </div>
          <button id="btn-close-yard" class="btn-green w-full mt-8">Close</button>
        </div>
      </div>
    `}buildAncientChoicePopup(){return`
      <div class="overlay" id="ancient-choice-overlay">
        <div class="modal">
          <div class="modal-title" style="color:var(--gold)">🌱 Grow: Choose New Ancient</div>
          <p style="font-size:10px;color:var(--text-dim);margin-bottom:12px">A Landscape entered play. Choose your new Ancient:</p>
          <div class="ancient-choice-grid">
            ${F.map(e=>{const a=p[e];return`<button class="btn-ancient-choice" data-defid="${e}">${a?.name}<br><span style="font-size:8px;color:var(--text-dim)">${a?.description}</span></button>`}).join("")}
          </div>
        </div>
      </div>
    `}buildEmptyAncient(){return'<div style="width:112px;height:158px;border:1px dashed var(--border);display:flex;align-items:center;justify-content:center;font-size:9px;color:var(--text-dim);text-align:center">NO<br>ANCIENT</div>'}buildCardEl(e,a,t,i=!1,l=!1,n=!1,o=!1,d=!1){const r=p[e.defId];if(!r)return"";const c={being:"🐉",landscape:"🌿",ancient:"⭐",spell:"✨"}[r.type]||"?",u=`card-${r.type}`,h=e.exhausted?"exhausted":"",f=this.selectedCard===e.id||n?"selected":"",g=i?"attacker":"",m=l?"on-stack":"",v=e.summonedThisTurn&&r.id==="wasp"?"summoning-sick":"",b=o?"blocker":"",S=r.dots?Array(r.dots).fill('<span class="dot"></span>').join(""):"",T=d||r.type==="landscape"&&a,L=r.imageUrl?`<img src="${r.imageUrl}" alt="${r.name}" onerror="this.style.display='none'" />`:`<div class="card-image-placeholder">${c}</div>`,I=r.type==="being"?`<div class="card-stats"><span class="card-power">${r.power}</span><span class="card-toughness">${r.toughness}</span>${e.counters>0?`<span style="color:var(--red);font-size:8px">-${e.counters}</span>`:""}${e.summonedThisTurn&&r.id==="wasp"?'<span title="Cannot attack this turn" style="font-size:8px">😴</span>':""}</div>`:r.type==="spell"?`<div class="card-stats"><span class="card-cost">${r.cost}WP</span></div>`:(r.type==="landscape",""),B=t?"width:112px;height:158px":"";return`
      <div class="card ${u} ${h} ${f} ${g} ${b} ${m} ${v} tooltip-container"
           data-id="${e.id}" data-def="${e.defId}"
           draggable="${T?"true":"false"}"
           style="${!a&&!T?"cursor:default;":""}${B}"
           >
        <div class="card-dots">${S}</div>
        <div class="card-image">${L}</div>
        <div class="card-name">${r.name}</div>
        ${I}
        ${l?'<div class="stack-badge-small">STACK</div>':""}
        ${n?'<div class="block-select-indicator">🛡→</div>':""}
        <div class="tooltip">${r.name}<br><span style="color:var(--text-dim)">${r.description}</span></div>
      </div>
    `}buildHandCardEl(e,a,t){const i=p[e.defId];if(!i)return"";const l={being:"🐉",landscape:"🌿",ancient:"⭐",spell:"✨"}[i.type]||"?",n=`card-${i.type}`,o=this.selectedCard===e.id?"selected":"",d=i.dots?Array(i.dots).fill('<span class="dot"></span>').join(""):"",r=i.imageUrl?`<img src="${i.imageUrl}" alt="${i.name}" onerror="this.style.display='none'" />`:`<div class="card-image-placeholder">${l}</div>`,c=i.type==="being"?`<div class="card-stats"><span class="card-power">${i.power}</span><span class="card-toughness">${i.toughness}</span><span style="color:var(--green-dim);font-size:7px">🌿${i.cost}</span></div>`:i.type==="spell"?`<div class="card-stats"><span class="card-cost">${i.cost}WP</span></div>`:"";return`
      <div class="card ${n} ${o} hand-card tooltip-container"
           data-id="${e.id}" data-def="${e.defId}" data-hand-index="${t}"
           draggable="${a?"true":"false"}"
           style="${a?"":"cursor:default;"}">
        <div class="card-dots">${d}</div>
        <div class="card-image">${r}</div>
        <div class="card-name">${i.name}</div>
        ${c}
        <div class="tooltip">${i.name}<br><span style="color:var(--text-dim)">${i.description}</span></div>
      </div>
    `}buildWinOverlay(e,a){const t=e===a;let i="";if(t&&!this.spAwarded){const n=this.currentUser.uid.startsWith("guest_"),o=this.currentUser.botWins??0;if(!n&&o<_){this.spAwarded=!0;const d=o+1;this.currentUser={...this.currentUser,botWins:d,sp:(this.currentUser.sp??0)+ce};const r=_-d,c=r===1?"1 rewarded win remaining":`${r} rewarded wins remaining`;i=`<div style="margin-bottom:12px;color:var(--gold);font-size:11px">+${ce} SP earned! ${r>0?`(${c})`:"(Bot SP limit reached)"}</div>`}else!n&&o>=_&&(i=`<div style="margin-bottom:12px;font-size:10px;color:var(--text-dim)">No SP reward — bot win limit reached (${_}/${_})</div>`)}return`
      <div class="overlay" id="win-overlay">
        <div class="modal" style="text-align:center">
          <div class="modal-title" style="${t?"color:var(--gold)":"color:var(--red)"}">
            ${t?"🏆 VICTORY!":"💀 DEFEAT!"}
          </div>
          <p style="margin-bottom:8px;font-size:12px;color:var(--text-dim)">${t?"You defeated the bot!":"The bot won this time!"}</p>
          ${i}
          <button id="btn-back-lobby" class="btn-green" style="width:100%">Return to Lobby</button>
        </div>
      </div>
    `}buildRitualTargetPopup(e,a){const t=e.pendingRitualTarget,i=a===e.player1?e.p2State:e.p1State;if(t.ritualName==="Ignite Surge"||t.ritualName==="Primal Ignite"){const n=2+(t.igniteBoost??1),o=i.battlefield.filter(d=>p[d.defId]?.type==="being").map(d=>`<button class="btn-target" data-target="${d.id}">${p[d.defId]?.name} (${p[d.defId]?.power}/${p[d.defId]?.toughness})</button>`).join("");return`
        <div class="overlay" id="ritual-target-overlay">
          <div class="modal" style="text-align:center;max-width:320px">
            <div class="modal-title" style="color:var(--red)">🔥 ${t.ritualName}</div>
            <p style="font-size:10px;color:var(--text-dim);margin-bottom:12px">Ritual Ignite deals ${n} damage. Choose a target.</p>
            <button class="btn-target" data-target="opponent" style="background:var(--red);border-color:var(--red);width:100%;margin-bottom:4px">🎯 ScapeBot</button>
            ${o}
            <button id="btn-cancel-ritual-target" class="btn-danger" style="width:100%;margin-top:8px">Cancel</button>
          </div>
        </div>
      `}return t.ritualName==="Flock Control"?`
        <div class="overlay" id="ritual-target-overlay">
          <div class="modal" style="text-align:center;max-width:320px">
            <div class="modal-title" style="color:var(--cyan)">🦅 Flock Control</div>
            <p style="font-size:10px;color:var(--text-dim);margin-bottom:12px">Choose an opponent being to gain control of. You also draw a card.</p>
            ${i.battlefield.filter(n=>p[n.defId]?.type==="being").map(n=>`<button class="btn-target" data-target="${n.id}">${p[n.defId]?.name} (${p[n.defId]?.power}/${p[n.defId]?.toughness})</button>`).join("")||'<div style="color:var(--text-dim);font-size:10px">No opponent beings</div>'}
            <button id="btn-cancel-ritual-target" class="btn-danger" style="width:100%;margin-top:8px">Cancel</button>
          </div>
        </div>
      `:""}buildDamageChoiceModal(e){const a=e.currentTurn,t=y(e,a),i=O(e,a),l=t.attackers.filter(d=>!Object.values(i.blockers).includes(d)).map(d=>{const r=t.battlefield.find(c=>c.id===d);return r?p[r.defId]?.power??0:0}).filter(d=>d>0),n=l.reduce((d,r)=>d+r,0),o=l.reduce((d,r)=>d*r,1);return`
      <div class="overlay" id="damage-choice-overlay">
        <div class="modal" style="text-align:center;max-width:380px">
          <div class="modal-title" style="color:var(--red)">⚔ UNBLOCKED DAMAGE</div>
          <p style="font-size:10px;color:var(--text-dim);margin-bottom:4px">
            ${l.length} unblocked attacker(s). Choose how their damage is calculated:
          </p>
          <div style="font-size:9px;color:var(--text-dim);margin-bottom:12px">
            Powers: [${l.join(", ")}]
          </div>
          <div style="display:flex;gap:8px">
            <button id="btn-damage-additive" class="btn-green" style="flex:1;padding:10px">
              <div style="font-family:'Press Start 2P',monospace;font-size:8px">➕ ADDITIVE</div>
              <div style="font-size:14px;font-weight:bold;margin-top:6px;color:var(--green)">${n} dmg</div>
              <div style="font-size:8px;color:var(--text-dim);margin-top:2px">${l.join(" + ")} = ${n}</div>
            </button>
            <button id="btn-damage-multiplicative" class="btn-danger" style="flex:1;padding:10px">
              <div style="font-family:'Press Start 2P',monospace;font-size:8px">✖ MULTIPLICATIVE</div>
              <div style="font-size:14px;font-weight:bold;margin-top:6px;color:var(--red)">${o} dmg</div>
              <div style="font-size:8px;color:var(--text-dim);margin-top:2px">${l.join(" × ")} = ${o}</div>
            </button>
          </div>
          <div style="font-size:8px;color:var(--text-dim);margin-top:8px">Timer will auto-select additive if you don't choose.</div>
        </div>
      </div>
    `}buildRitualModal(e,a){const t=y(e,a),i=t.battlefield.filter(b=>p[b.defId]?.type==="being"),l=t.battlefield.filter(b=>p[b.defId]?.type==="landscape"),n=t.yard.filter(b=>p[b.defId]?.type==="being"),o=t.yard.filter(b=>p[b.defId]?.type==="spell"),d=t.yard.filter(b=>p[b.defId]?.type==="landscape"),r=n.length>0&&i.length>0,c=o.length>0&&(i.length>0||l.length>0),u=l.length>0&&t.willPower>0,h=i.length>0&&d.length>0,f=!!t.ancient&&l.length>=2;return`
      <div class="overlay" id="ritual-modal-overlay">
        <div class="modal" style="max-width:480px;width:90vw;overflow-y:auto;max-height:90vh">
          <div class="modal-title" style="color:var(--gold)">🔮 RITUALS</div>
          <p style="font-size:9px;color:var(--text-dim);margin-bottom:12px">Global rituals available during your play phase:</p>
          <div style="display:flex;flex-direction:column;gap:6px">
            ${[{name:"CULTIVATE",desc:"Sacrifice beings (equal total power) → summon a being from yard (exhausted)",can:r,id:"btn-ritual-cultivate"},{name:"STUDY",desc:"Sacrifice beings/landscapes (= spell cost) → cast spell from yard (you take 2x damage)",can:c,id:"btn-ritual-study"},{name:"EVOLVE",desc:"Spend WP ≤ landscape count → transform a landscape into a WP/WP-2 being",can:u,id:"btn-ritual-evolve"},{name:"NOURISH",desc:"Sacrifice a being → return a landscape from yard to hand",can:h,id:"btn-ritual-nourish"},{name:"SAC ANCIENT + 2 LANDS",desc:"Sacrifice ancient + 2 landscapes → draw 3 cards, discard 1",can:f,id:"btn-ritual-sac-ancient"}].map(b=>`
      <button id="${b.id}" class="btn-gold" style="text-align:left;padding:6px 8px;opacity:${b.can?"1":"0.4"}" ${b.can?"":"disabled"}>
        <div style="font-size:9px;font-family:'Press Start 2P',monospace;color:var(--gold)">${b.name}</div>
        <div style="font-size:8px;color:var(--text-dim);margin-top:2px">${b.desc}</div>
      </button>
    `).join("")}
          </div>
          
      <div style="margin-top:10px;border-top:1px solid var(--border);padding-top:8px">
        <div style="font-size:8px;font-family:'Press Start 2P',monospace;color:var(--purple-bright);margin-bottom:6px">PASSIVE RITUALS</div>
        <div style="font-size:8px;color:var(--text-dim);line-height:1.6">
          <b style="color:var(--text)">FINAL BLOW</b>: Both at 0 WP → last stack card player wins<br>
          <b style="color:var(--text)">STACK WAR</b>: 5+ cards on stack → last player draws a card<br>
          <b style="color:var(--text)">LAST BREATH</b>: 10+ yard cards → exile yard, set WP to 1<br>
          <b style="color:var(--text)">STACK RITUALS</b>: cancel/cancel/spike, grow/cancel, ignite/ignite/grow, flyer/cancel/ignite, grow+grow (diff players), being5/spike/grow<br>
          <b style="color:var(--text)">ACTION RITUALS</b> (drag to ritual zone): 2 lands, 2 lands+merfolk+ignite, 2 lands+2 insect+ignite, 2 flyers, cancel (5+ yard)
        </div>
      </div>
    
          <button id="btn-close-ritual-modal" class="btn-green w-full mt-8">Close</button>
        </div>
      </div>
    `}buildSettingsModal(){const e=this.gamePaused?"▶ Resume Game":"⏸ Pause Game";return`
      <div class="overlay" id="settings-overlay">
        <div class="modal" style="max-width:320px;text-align:center">
          <div class="modal-title" style="color:var(--cyan)">⚙ SETTINGS</div>
          <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:12px">
            <button id="btn-settings-pause" class="${this.gamePaused?"btn-green":"btn-gold"}" style="width:100%;padding:10px;font-size:10px">${e}</button>
            <button id="btn-settings-lobby" class="btn-green" style="width:100%;padding:10px;font-size:10px">🏠 Exit to Lobby<br><span style="font-size:8px;color:var(--text-dim)">(game stays active)</span></button>
            <button id="btn-settings-concede" class="btn-danger" style="width:100%;padding:10px;font-size:10px">🏳 Concede</button>
            <button id="btn-settings-bug" class="btn-gold" style="width:100%;padding:10px;font-size:10px">🐛 Report a Bug</button>
          </div>
          <button id="btn-settings-close" class="btn-green w-full">✕ Close</button>
        </div>
      </div>
    `}buildBreakpointPickerPopup(){const e=[{id:"replenish",label:"REPLENISH",desc:"Untap & refresh"},{id:"draw",label:"DRAW",desc:"Draw a card"},{id:"play1",label:"PLAY 1",desc:"Play cards before combat"},{id:"combat",label:"COMBAT",desc:"Attack & block"},{id:"play2",label:"PLAY 2",desc:"Play cards after combat"},{id:"end",label:"END",desc:"End of turn"}],a=this.phaseBreakpoint;return`
      <div class="overlay" id="breakpoint-picker-overlay">
        <div class="modal" style="max-width:340px;text-align:center">
          <div class="modal-title" style="color:var(--gold)">🔴 SET PHASE BREAKPOINT</div>
          <p style="font-size:9px;color:var(--text-dim);margin-bottom:12px;line-height:1.5">
            Choose a phase. When you reach it on your turn, the game will pause and notify you.
          </p>
          <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">
            ${e.map(t=>{const i=a===t.id,l=i?"btn-danger":"btn-gold",n=i?" ✓ ACTIVE":"";return`<button class="bp-phase-btn ${l}" data-phase="${t.id}" style="text-align:left;padding:7px 10px;opacity:1">
                <div style="font-size:9px;font-family:'Press Start 2P',monospace">${t.label}${n}</div>
                <div style="font-size:8px;color:var(--text-dim);margin-top:2px">${t.desc}</div>
              </button>`}).join("")}
          </div>
          ${a?'<button id="btn-bp-clear" class="btn-danger w-full" style="margin-bottom:8px">✕ Clear Breakpoint</button>':""}
          <button id="btn-bp-close" class="btn-green w-full">Close</button>
        </div>
      </div>
    `}buildBreakpointHitPopup(){return`
      <div class="overlay breakpoint-hit-overlay" id="breakpoint-hit-overlay">
        <div class="modal" style="max-width:360px;text-align:center">
          <div style="font-size:36px;margin-bottom:8px">🔴</div>
          <div class="modal-title" style="color:var(--gold)">PHASE BREAKPOINT</div>
          <p style="font-size:12px;color:var(--text);margin:12px 0;font-family:'Press Start 2P',monospace;letter-spacing:1px">${{replenish:"REPLENISH",draw:"DRAW",play1:"PLAY 1",combat:"COMBAT",play2:"PLAY 2",end:"END"}[this.breakpointHitPhase??""]??this.breakpointHitPhase??""}</p>
          <p style="font-size:9px;color:var(--text-dim);margin-bottom:16px">The game has paused at your breakpoint. Take your time.</p>
          <div style="display:flex;gap:8px">
            <button id="btn-bp-hit-continue" class="btn-green" style="flex:1;padding:10px">▶ Continue</button>
            <button id="btn-bp-hit-clear" class="btn-gold" style="flex:1;padding:10px">✕ Clear & Continue</button>
          </div>
        </div>
      </div>
    `}buildPauseOverlay(){return`
      <div class="overlay pause-overlay" id="pause-overlay">
        <div class="modal" style="max-width:320px;text-align:center">
          <div style="font-size:40px;margin-bottom:8px">⏸</div>
          <div class="modal-title" style="color:var(--cyan)">GAME PAUSED</div>
          <p style="font-size:9px;color:var(--text-dim);margin:12px 0">Open ⚙ Settings to resume the game.</p>
          <button id="btn-pause-settings" class="btn-gold" style="width:100%;padding:10px;margin-bottom:8px">⚙ Open Settings</button>
        </div>
      </div>
    `}updateBlockLinesSVG(){const e=this.gameState,a=this.currentUser.uid;if(this.container.querySelector("#block-svg")?.remove(),!(e.phase==="combat"&&e.combatStep==="blocks"&&e.currentTurn!==a))return;const i=y(e,a),l=!!this.selectedCard&&i.battlefield.some(g=>g.id===this.selectedCard),n=Object.keys(i.blockers).length>0;if(!l&&!n)return;const o=document.createElementNS("http://www.w3.org/2000/svg","svg");o.id="block-svg",o.setAttribute("style","position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:150"),o.setAttribute("xmlns","http://www.w3.org/2000/svg");const d=g=>{const m=this.container.querySelector(`[data-id="${g}"]`);if(!m)return null;const v=m.getBoundingClientRect();return{x:v.left+v.width/2,y:v.top+v.height/2}},r="#00ffff",c="3",u="6",h="8",f=(g,m,v,b,S="8,4")=>{const T=document.createElementNS("http://www.w3.org/2000/svg","line");return T.setAttribute("x1",String(g)),T.setAttribute("y1",String(m)),T.setAttribute("x2",String(v)),T.setAttribute("y2",String(b)),T.setAttribute("stroke",r),T.setAttribute("stroke-width",c),T.setAttribute("stroke-linecap","round"),S&&T.setAttribute("stroke-dasharray",S),T};if(l&&this.selectedCard){const g=d(this.selectedCard);if(g&&this.blockDragPos){o.appendChild(f(g.x,g.y,this.blockDragPos.x,this.blockDragPos.y,"6,4"));const m=document.createElementNS("http://www.w3.org/2000/svg","circle");m.setAttribute("cx",String(this.blockDragPos.x)),m.setAttribute("cy",String(this.blockDragPos.y)),m.setAttribute("r",u),m.setAttribute("fill",r),m.setAttribute("opacity","0.7"),o.appendChild(m)}}for(const[g,m]of Object.entries(i.blockers)){const v=d(g),b=d(m);if(v&&b){o.appendChild(f(v.x,v.y,b.x,b.y,""));const S=document.createElementNS("http://www.w3.org/2000/svg","circle");S.setAttribute("cx",String(b.x)),S.setAttribute("cy",String(b.y)),S.setAttribute("r",h),S.setAttribute("fill","none"),S.setAttribute("stroke",r),S.setAttribute("stroke-width","2"),o.appendChild(S)}}this.container.appendChild(o)}attachGameListeners(){const e=this.gameState,a=this.currentUser.uid,t=y(e,a),i=e.currentTurn===a,l=e.priorityPlayer===a;if(e.winner){this.container.querySelector("#btn-back-lobby")?.addEventListener("click",()=>{this.onNav("lobby")});return}this.container.querySelector("#btn-back-lobby")?.addEventListener("click",()=>{this.onNav("lobby")}),this.container.querySelector("#btn-settings")?.addEventListener("click",()=>{this.showSettings=!0,this.render()}),this.container.querySelector("#btn-settings-close")?.addEventListener("click",()=>{this.showSettings=!1,this.render()}),this.container.querySelector("#settings-overlay")?.addEventListener("click",n=>{n.target===this.container.querySelector("#settings-overlay")&&(this.showSettings=!1,this.render())}),this.container.querySelector("#btn-settings-lobby")?.addEventListener("click",()=>{this.showSettings=!1,this.onNav("lobby")}),this.container.querySelector("#btn-settings-concede")?.addEventListener("click",()=>{confirm("🏳 Concede this game? This will count as a loss.")&&(this.showSettings=!1,this.gameState={...this.gameState,winner:w},this.render())}),this.container.querySelector("#btn-settings-pause")?.addEventListener("click",()=>{this.gamePaused=!this.gamePaused,this.showSettings=!1,this.gamePaused?(this.clearPlayerInactivityTimer(),this.clearPriorityCountdown()):e.currentTurn===a&&e.priorityPlayer===a&&!this.waitingOnPlayer&&this.startPlayerInactivityTimer(),this.render()}),this.container.querySelector("#btn-settings-bug")?.addEventListener("click",()=>{this.showSettings=!1,this.render(),setTimeout(()=>{const n=document.createElement("div");n.className="overlay",n.id="bug-report-overlay",n.innerHTML=`
          <div class="modal" style="max-width:380px;text-align:center">
            <div class="modal-title" style="color:var(--gold)">🐛 Report a Bug</div>
            <p style="font-size:10px;color:var(--text-dim);margin-bottom:12px;line-height:1.6">To report a bug, please describe the issue and submit it via the GitHub Issues page or email the developer.</p>
            <p style="font-size:9px;color:var(--cyan);margin-bottom:16px">Include: what happened, what you expected, and any relevant game state details.</p>
            <button id="btn-bug-close" class="btn-green w-full">Close</button>
          </div>
        `,this.container.appendChild(n),n.querySelector("#btn-bug-close")?.addEventListener("click",()=>n.remove()),n.addEventListener("click",o=>{o.target===n&&n.remove()})},0)}),this.container.querySelector("#btn-stop-auto")?.addEventListener("click",()=>{this.showBreakpointPicker=!0,this.render()}),this.container.querySelectorAll(".bp-phase-btn").forEach(n=>{n.addEventListener("click",()=>{const o=n.dataset.phase;this.phaseBreakpoint=o,this.showBreakpointPicker=!1,this.render()})}),this.container.querySelector("#btn-bp-clear")?.addEventListener("click",()=>{this.phaseBreakpoint=null,this.showBreakpointPicker=!1,this.render(),e.currentTurn===a&&e.priorityPlayer===a&&!this.waitingOnPlayer&&this.startPlayerInactivityTimer()}),this.container.querySelector("#btn-bp-close")?.addEventListener("click",()=>{this.showBreakpointPicker=!1,this.render()}),this.container.querySelector("#breakpoint-picker-overlay")?.addEventListener("click",n=>{n.target===this.container.querySelector("#breakpoint-picker-overlay")&&(this.showBreakpointPicker=!1,this.render())}),this.container.querySelector("#btn-bp-hit-continue")?.addEventListener("click",()=>{this.breakpointHitPhase=null,this.render(),e.currentTurn===a&&e.priorityPlayer===a&&!this.waitingOnPlayer&&this.startPlayerInactivityTimer()}),this.container.querySelector("#btn-bp-hit-clear")?.addEventListener("click",()=>{this.breakpointHitPhase=null,this.phaseBreakpoint=null,this.render(),e.currentTurn===a&&e.priorityPlayer===a&&!this.waitingOnPlayer&&this.startPlayerInactivityTimer()}),this.container.querySelector("#btn-pause-settings")?.addEventListener("click",()=>{this.showSettings=!0,this.render()}),this.container.querySelector("#btn-next-phase")?.addEventListener("click",()=>{if(!i||this.botRunning&&!this.waitingOnPlayer)return;const n=$(e,a);n!==e&&this.setState(n)}),this.container.querySelector("#btn-end-turn")?.addEventListener("click",()=>{if(!i||this.botRunning&&!this.waitingOnPlayer)return;const n=e.stack.length>0?M(e):e;if(n.stack.length===0&&(n.phase!=="combat"||n.combatStep==="none")){const o=$({...n,phase:"end",combatStep:"none",pendingDamageChoice:void 0},a);this.setState(o)}else this.setState({...n,phase:"end",combatStep:"none",pendingDamageChoice:void 0,stackPassedOnce:!1,stackPassPriority:void 0,priorityPlayer:w})}),this.container.querySelector("#btn-pass-priority")?.addEventListener("click",()=>{this.botRunning&&!this.waitingOnPlayer||this.handlePassPriority()}),this.container.querySelector("#btn-pass-in-stack")?.addEventListener("click",()=>{this.botRunning&&!this.waitingOnPlayer||this.handlePassPriority()}),this.container.querySelector("#btn-done-attackers")?.addEventListener("click",()=>{if(!i||this.botRunning&&!this.waitingOnPlayer)return;const n=$(e,a);this.setState(n)}),this.container.querySelector("#btn-attack-all")?.addEventListener("click",()=>{if(!i||this.botRunning&&!this.waitingOnPlayer)return;let n=e;const o=y(n,a);for(const d of o.battlefield){const r=p[d.defId];r?.type==="being"&&(!d.exhausted||r.isFlyer)&&!o.attackers.includes(d.id)&&(n=W(n,a,d.id))}n!==e&&this.setState(n)}),this.container.querySelector("#btn-done-blocks")?.addEventListener("click",()=>{i||this.waitingOnPlayer&&this.resolvePlayerPriority()}),this.container.querySelector("#btn-my-yard")?.addEventListener("click",()=>{this.showGraveyard="mine",this.render()}),this.container.querySelector("#btn-opp-yard")?.addEventListener("click",()=>{this.showGraveyard="opp",this.render()}),this.container.querySelector("#btn-close-yard")?.addEventListener("click",()=>{this.showGraveyard=null,this.render()}),this.container.querySelector("#graveyard-overlay")?.addEventListener("click",n=>{n.target===this.container.querySelector("#graveyard-overlay")&&(this.showGraveyard=null,this.render())}),this.container.querySelectorAll(".btn-ancient-choice").forEach(n=>{n.addEventListener("click",()=>{const o=n.dataset.defid,d=X(this.gameState,a,o),c={...y(d,a),needsNewAncient:!1},u=d.player1===a?{...d,p1State:c}:{...d,p2State:c};this.showNewAncient=!1,this.setState(u)})}),this.attachHandDragDrop(),this.container.querySelector("#hand-cards")?.querySelectorAll(".hand-card").forEach(n=>{n.addEventListener("click",()=>{if(!l||!i&&!this.isSpellInstant(n.dataset.def??""))return;const o=n.dataset.id;this.handleHandCardClick(e,t,o,a)})}),this.attachDropZone("#my-being-zone","being"),this.attachDropZone("#my-landscapes","landscape"),this.container.querySelector("#my-being-zone")?.querySelectorAll(".card").forEach(n=>{n.addEventListener("click",()=>{const o=n.dataset.id;this.handleBattlefieldBeingClick(e,t,o,a,!0)})}),this.container.querySelector("#opp-being-zone")?.querySelectorAll(".card").forEach(n=>{n.addEventListener("click",()=>{const o=n.dataset.id;this.handleBattlefieldBeingClick(e,t,o,a,!1)})}),this.attachDropZone("#attack-zone","attack"),this.container.querySelector("#my-landscapes")?.querySelectorAll(".card").forEach(n=>{n.addEventListener("contextmenu",o=>{o.preventDefault();const d=n.dataset.id,r=t.battlefield.find(c=>c.id===d);if(r&&p[r.defId]?.type==="landscape"){const c=Ce(e,a,d);c!==e&&this.setState(c)}}),n.addEventListener("dragstart",o=>{this.dragCardId=n.dataset.id,n.classList.add("dragging"),o.dataTransfer&&(o.dataTransfer.effectAllowed="move",o.dataTransfer.setData("text/plain",n.dataset.id))}),n.addEventListener("dragend",()=>{n.classList.remove("dragging"),this.container.querySelectorAll(".drag-over").forEach(o=>o.classList.remove("drag-over"))})}),this.container.querySelectorAll(".card[data-def]").forEach(n=>{const o=n.dataset.def,d=n.dataset.id,r=p[o];r?.isAncient&&l&&t.ancient?.id===d&&!t.ancient?.exhausted&&n.addEventListener("dblclick",()=>{const c=p[t.ancient?.defId??""];if(c?.id==="smoldering_volcano")this.showAncientTargetPicker(e,a);else if(c?.id==="cavern_of_the_see")this.showCavernOfSeaModal(e,a);else{const u=G(e,a);u!==e&&this.setState(u)}}),r?.isAncient&&t.ancient?.id===d&&n.addEventListener("contextmenu",c=>{if(c.preventDefault(),confirm("Sacrifice your Ancient? This cannot be undone.")){const u=Ee(e,a);u!==e&&this.setState(u)}})}),this.attachDropZone("#ritual-zone","ritual"),this.container.querySelector("#ritual-zone")?.querySelectorAll(".card").forEach(n=>{n.addEventListener("contextmenu",o=>{o.preventDefault();const d=n.dataset.id,r=Oe(e,a,d);r!==e&&this.setState(r)})}),this.container.querySelector("#my-being-zone")?.querySelectorAll(".card").forEach(n=>{n.addEventListener("dragstart",o=>{this.dragCardId=n.dataset.id,n.classList.add("dragging"),o.dataTransfer&&(o.dataTransfer.effectAllowed="move",o.dataTransfer.setData("text/plain",n.dataset.id))}),n.addEventListener("dragend",()=>{n.classList.remove("dragging"),this.container.querySelectorAll(".drag-over").forEach(o=>o.classList.remove("drag-over"))})}),this.container.querySelector("#ritual-target-overlay")?.querySelectorAll(".btn-target").forEach(n=>{n.addEventListener("click",()=>{const o=n.dataset.target,d=Re(this.gameState,a,o);d!==this.gameState?this.setState(d):this.render()})}),this.container.querySelector("#btn-cancel-ritual-target")?.addEventListener("click",()=>{const n={...this.gameState,pendingRitualTarget:void 0};this.gameState=n,this.render()}),this.container.querySelector("#btn-damage-additive")?.addEventListener("click",()=>{const n=j(this.gameState,a,"additive");n!==this.gameState&&this.setState(n)}),this.container.querySelector("#btn-damage-multiplicative")?.addEventListener("click",()=>{const n=j(this.gameState,a,"multiplicative");n!==this.gameState&&this.setState(n)}),this.container.querySelector("#btn-rituals")?.addEventListener("click",()=>{this.showRitualModal=!0,this.render()}),this.container.querySelector("#btn-close-ritual-modal")?.addEventListener("click",()=>{this.showRitualModal=!1,this.render()}),this.container.querySelector("#ritual-modal-overlay")?.addEventListener("click",n=>{n.target===this.container.querySelector("#ritual-modal-overlay")&&(this.showRitualModal=!1,this.render())}),this.container.querySelector("#btn-last-breath")?.addEventListener("click",()=>{if(!(!i||this.botRunning&&!this.waitingOnPlayer)&&confirm("💀 LAST BREATH: Exile your entire yard and set WP to 1?")){const n=He(e,a);n!==e&&this.setState(n)}}),this.container.querySelector("#btn-ritual-cultivate")?.addEventListener("click",()=>{this.showRitualModal=!1,this.showCultivateModal()}),this.container.querySelector("#btn-ritual-study")?.addEventListener("click",()=>{this.showRitualModal=!1,this.showStudyModal()}),this.container.querySelector("#btn-ritual-evolve")?.addEventListener("click",()=>{this.showRitualModal=!1,this.showEvolveModal()}),this.container.querySelector("#btn-ritual-nourish")?.addEventListener("click",()=>{this.showRitualModal=!1,this.showNourishModal()}),this.container.querySelector("#btn-ritual-sac-ancient")?.addEventListener("click",()=>{this.showRitualModal=!1,this.showSacAncientModal()}),this.container.querySelector("#btn-turn-popup-okay")?.addEventListener("click",()=>{this.dismissTurnPopup()}),this.container.querySelector("#btn-turn-popup-yield")?.addEventListener("click",()=>{this.phaseBreakpoint="play1",this.dismissTurnPopup()}),t.needsNewAncient&&!this.showNewAncient&&(this.showNewAncient=!0,this.render())}isSpellInstant(e){return p[e]?.type==="spell"}attachHandDragDrop(){const e=this.container.querySelector("#hand-cards");e&&e.querySelectorAll(".hand-card").forEach(a=>{a.addEventListener("dragstart",t=>{this.dragCardId=a.dataset.id,a.classList.add("dragging"),t.dataTransfer&&(t.dataTransfer.effectAllowed="move",t.dataTransfer.setData("text/plain",a.dataset.id))}),a.addEventListener("dragend",()=>{a.classList.remove("dragging"),this.dragCardId=null,this.container.querySelectorAll(".drag-over").forEach(t=>t.classList.remove("drag-over"))}),a.addEventListener("dragover",t=>{t.preventDefault(),this.dragCardId&&this.dragCardId!==a.dataset.id&&a.classList.add("drag-over-card")}),a.addEventListener("dragleave",()=>{a.classList.remove("drag-over-card")}),a.addEventListener("drop",t=>{t.preventDefault(),t.stopPropagation(),a.classList.remove("drag-over-card");const i=this.dragCardId,l=a.dataset.id;if(!i||i===l)return;const n=this.handOrder.indexOf(i),o=this.handOrder.indexOf(l);if(n!==-1&&o!==-1){const d=[...this.handOrder];d.splice(n,1),d.splice(o,0,i),this.handOrder=d,this.dragCardId=null,this.render()}})})}attachDropZone(e,a){const t=this.container.querySelector(e);t&&(t.addEventListener("dragover",i=>{i.preventDefault(),t.classList.add("drag-over")}),t.addEventListener("dragleave",()=>{t.classList.remove("drag-over")}),t.addEventListener("drop",i=>{i.preventDefault(),i.stopPropagation(),t.classList.remove("drag-over");const l=this.dragCardId??i.dataTransfer?.getData("text/plain")??"";l&&(this.handleCardDropToZone(l,a),this.dragCardId=null)}))}handleCardDropToZone(e,a){const t=this.gameState,i=this.currentUser.uid,l=y(t,i),n=t.currentTurn===i,o=t.priorityPlayer===i;if(a==="ritual"){const c=l.battlefield.find(h=>h.id===e);if(c){const h=p[c.defId]?.type;if(h==="landscape"||h==="being"){if(!de(t,i,c))return;const f=Le(t,i,e);f!==t&&this.setState(f);return}}const u=l.hand.find(h=>h.id===e);if(u&&p[u.defId]?.type==="spell"){if(!de(t,i,u))return;const h=Ae(t,i,e);h!==t&&this.setState(h);return}}if(a==="attack"&&t.phase==="combat"&&t.combatStep==="attackers"&&n){const c=l.battlefield.find(u=>u.id===e);if(c&&p[c.defId]?.type==="being"){const u=W(t,i,e);u!==t&&this.setState(u);return}}const d=l.hand.find(c=>c.id===e);if(!d)return;const r=p[d.defId];if(r&&o&&!(!n&&r.type!=="spell")){if(a==="landscape"&&r.type==="landscape"){const c=A(t,i,e);c!==t&&this.setState(c)}else if(a==="being"&&r.type==="being")if(d.defId==="wasp")this.showWaspPaymentModal(t,i,e);else{const c=A(t,i,e);c!==t&&(this.setState(c),c.stack.length>0&&this.triggerBotStackResponse())}else if(a==="attack"&&r.type==="being"&&t.phase==="combat"&&t.combatStep==="attackers")if(d.defId==="wasp")this.showWaspPaymentModal(t,i,e);else{const c=A(t,i,e);c!==t&&(this.setState(c),c.stack.length>0&&this.triggerBotStackResponse())}else if(r.type==="spell")if(r.spellType==="ignite"||r.spellType==="spike")this.showTargetPicker(t,i,e);else{const c=A(t,i,e);c!==t&&(this.setState(c),c.stack.length>0&&this.triggerBotStackResponse())}}}handlePassPriority(){const e=this.gameState,a=this.currentUser.uid;if(this.waitingOnPlayer){this.resolvePlayerPriority();return}if(e.stack.length>0){if(e.priorityPlayer!==a)return;const t={};e.stack.forEach((r,c)=>{t[r.id]=c+1});const l=!!e.stackPassPriority&&e.stack.length===Object.keys(e.stackPassPriority.stackOrder).length&&e.stack.every((r,c)=>e.stackPassPriority.stackOrder[r.id]===c+1)?e.stackPassPriority:{stackOrder:t,passOrder:{}};if(l.passOrder[a]!==void 0)return;const n={...l.passOrder,[a]:Object.keys(l.passOrder).length+1},o={...l,passOrder:n};n[a]!==void 0&&n[w]!==void 0?(this.setState(M(this.gameState)),this.startPlayerInactivityTimer()):(this.gameState={...e,priorityPlayer:w,stackPassedOnce:!0,stackPassPriority:o},this.render(),this.triggerBotStackResponse());return}if(e.currentTurn===a&&e.priorityPlayer===a){const t=$(e,a);t!==e&&this.setState(t)}}handleHandCardClick(e,a,t,i){const l=a.hand.find(d=>d.id===t);if(!l)return;const n=p[l.defId];if(!n)return;if(this.selectedCard===t){this.selectedCard=null,this.render();return}if(n.type==="spell"&&(n.spellType==="ignite"||n.spellType==="spike")){this.selectedCard=t,this.render(),this.showTargetPicker(e,i,t);return}if(n.type==="being"&&n.id==="wasp"){this.selectedCard=null,this.showWaspPaymentModal(e,i,t);return}this.selectedCard=null;const o=A(e,i,t);o!==e&&(this.setState(o),o.stack.length>0&&this.triggerBotStackResponse())}triggerBotStackResponse(){setTimeout(()=>{const e=this.gameState;if(e.stack.length===0)return;if(!this.botTryRespond()){const t=this.currentUser.uid,i={};e.stack.forEach((d,r)=>{i[d.id]=r+1});const n=!!e.stackPassPriority&&e.stack.length===Object.keys(e.stackPassPriority.stackOrder).length&&e.stack.every((d,r)=>e.stackPassPriority.stackOrder[d.id]===r+1)?e.stackPassPriority:{stackOrder:i,passOrder:{}},o=n.passOrder[w]===void 0?{...n.passOrder,[w]:Object.keys(n.passOrder).length+1}:n.passOrder;this.gameState={...e,priorityPlayer:t,stackPassedOnce:!0,stackPassPriority:{...n,passOrder:o}},this.render()}},1200)}botTryRespond(){const e=this.gameState,a=this.currentUser.uid,t=y(e,w);if(e.priorityPlayer!==w||e.stack.length===0)return!1;const i=e.stack[e.stack.length-1],l=p[i.cardDefId];if(i.playerId!==a)return!1;if(l?.type!=="being"){const n=t.hand.find(o=>p[o.defId]?.spellType==="cancel");if(n&&t.willPower>=(p[n.defId]?.cost??0)){const o=A(e,w,n.id);if(o!==e)return this.gameState=o,this.render(),setTimeout(()=>{const d=this.gameState;d.priorityPlayer!==a&&(this.gameState={...d,priorityPlayer:a},this.render())},600),!0}}return!1}handleBattlefieldBeingClick(e,a,t,i,l){if(e.phase!=="combat")return;const n=e.currentTurn===i;if(l&&e.combatStep==="attackers"&&n){const o=W(e,i,t);o!==e&&this.setState(o)}else if(!l&&e.combatStep==="blocks"&&!n){if(this.selectedCard){const o=re(e,i,this.selectedCard,t);o!==e?(this.selectedCard=null,this.setState(o)):(this.selectedCard=null,this.updateBlockLinesSVG(),this.render())}}else l&&e.combatStep==="blocks"&&!n&&(this.selectedCard=this.selectedCard===t?null:t,this.updateBlockLinesSVG(),this.render())}showTargetPicker(e,a,t){const i=a===e.player1?e.p2State:e.p1State,l=document.createElement("div");l.className="overlay",l.id="target-overlay";const n=i.battlefield.filter(o=>p[o.defId]?.type==="being").map(o=>`<button class="btn-target" data-target="${o.id}">${p[o.defId]?.name??o.defId} (${p[o.defId]?.power}/${p[o.defId]?.toughness})</button>`).join("");l.innerHTML=`
      <div class="modal" style="text-align:center;max-width:320px">
        <div class="modal-title" style="color:var(--green)">⚡ Choose a Target</div>
        <p style="font-size:10px;color:var(--text-dim);margin-bottom:12px">Click a target or cancel.</p>
        <div style="margin-bottom:8px">
          <button class="btn-target" data-target="opponent" style="background:var(--red);border-color:var(--red);width:100%;margin-bottom:4px">🎯 ScapeBot</button>
          ${n}
        </div>
        <button id="btn-cancel-target" class="btn-danger" style="width:100%;margin-top:8px">Cancel</button>
      </div>
    `,this.container.appendChild(l),l.querySelectorAll(".btn-target").forEach(o=>{o.addEventListener("click",()=>{const d=o.dataset.target??"";l.remove();const r=A(e,a,t,d);this.selectedCard=null,r!==e?(this.setState(r),r.stack.length>0&&this.triggerBotStackResponse()):this.render()})}),l.querySelector("#btn-cancel-target")?.addEventListener("click",()=>{l.remove(),this.selectedCard=null,this.render()})}showAncientTargetPicker(e,a){const t=a===e.player1?e.p2State:e.p1State,i=document.createElement("div");i.className="overlay";const l=t.battlefield.filter(n=>p[n.defId]?.type==="being").map(n=>`<button class="btn-target" data-target="${n.id}">${p[n.defId]?.name}</button>`).join("");i.innerHTML=`
      <div class="modal" style="text-align:center;max-width:320px">
        <div class="modal-title" style="color:var(--red)">🌋 Smoldering Volcano</div>
        <p style="font-size:10px;color:var(--text-dim);margin-bottom:12px">Deal 3 damage to any target.</p>
        <button class="btn-target" data-target="opponent" style="background:var(--red);border-color:var(--red);width:100%;margin-bottom:4px">🎯 ScapeBot</button>
        ${l}
        <button id="btn-cancel-anc" style="width:100%;margin-top:8px">Cancel</button>
      </div>
    `,this.container.appendChild(i),i.querySelectorAll(".btn-target").forEach(n=>{n.addEventListener("click",()=>{const o=n.dataset.target;i.remove();const d=G(e,a,o);d!==e&&this.setState(d)})}),i.querySelector("#btn-cancel-anc")?.addEventListener("click",()=>i.remove())}showCavernOfSeaModal(e,a){const t=a===e.player1?e.p2State:e.p1State,i=document.createElement("div");i.className="overlay",i.id="cavern-overlay";const l=t.hand.map(n=>{const o=p[n.defId];if(!o)return"";const d={being:"🐉",landscape:"🌿",ancient:"⭐",spell:"✨"}[o.type]||"?",r=o.type==="being"?` (${o.power}/${o.toughness})`:o.type==="spell"?` (${o.cost}WP)`:"";return`<button class="btn-target cavern-card-btn" data-id="${n.id}" style="margin-bottom:5px;text-align:left;padding:7px 12px">
        <span style="font-size:12px">${d}</span>
        <span style="font-size:10px;margin-left:6px">${o.name}${r}</span>
        <span style="font-size:8px;color:var(--text-dim);display:block;margin-top:2px;padding-left:20px">${o.description}</span>
      </button>`}).join("");i.innerHTML=`
      <div class="modal" style="max-width:380px;width:90vw">
        <div class="modal-title" style="color:var(--cyan)">🔮 Cavern of the See</div>
        <p style="font-size:9px;color:var(--text-dim);margin-bottom:12px">Opponent's hand (${t.hand.length} cards). Select one card to recycle back into their deck.</p>
        <div style="display:flex;flex-direction:column;gap:2px;max-height:320px;overflow-y:auto;margin-bottom:10px">
          ${t.hand.length===0?`<div style="color:var(--text-dim);font-size:10px;text-align:center;padding:12px">Opponent's hand is empty</div>`:l}
        </div>
        ${t.hand.length===0?'<button id="btn-cavern-use-empty" class="btn-green w-full">Use Without Effect</button>':""}
        <button id="btn-cavern-cancel" class="btn-danger w-full mt-8">Cancel</button>
      </div>
    `,this.container.appendChild(i),i.querySelectorAll(".cavern-card-btn").forEach(n=>{n.addEventListener("click",()=>{const o=n.dataset.id;i.remove();const d=G(this.gameState,a,o);d!==this.gameState&&this.setState(d)})}),i.querySelector("#btn-cavern-use-empty")?.addEventListener("click",()=>{i.remove();const n=G(this.gameState,a);n!==this.gameState&&this.setState(n)}),i.querySelector("#btn-cavern-cancel")?.addEventListener("click",()=>i.remove()),i.addEventListener("click",n=>{n.target===i&&i.remove()})}showWaspPaymentModal(e,a,t){const i=y(e,a),l=i.battlefield.filter(r=>p[r.defId]?.type==="landscape"&&!r.exhausted),n=l.length>=2&&i.hand.length>=2,o=l.length>=3,d=document.createElement("div");d.className="overlay",d.id="wasp-payment-overlay",d.innerHTML=`
      <div class="modal" style="text-align:center;max-width:340px;width:90vw">
        <div class="modal-title" style="color:var(--gold)">🐝 Play Wasp (2/3 Flyer)</div>
        <p style="font-size:10px;color:var(--text-dim);margin-bottom:14px">Choose how to summon the Wasp:</p>
        <div style="display:flex;flex-direction:column;gap:8px">
          <button id="btn-wasp-discard" class="btn-green" style="text-align:left;padding:8px;opacity:${n?"1":"0.4"}" ${n?"":"disabled"}>
            <div style="font-size:9px;font-family:'Press Start 2P',monospace;color:var(--green)">OPTION A</div>
            <div style="font-size:8px;color:var(--text-dim);margin-top:2px">Exhaust 2 Landscapes + discard a card</div>
          </button>
          <button id="btn-wasp-extra" class="btn-gold" style="text-align:left;padding:8px;opacity:${o?"1":"0.4"}" ${o?"":"disabled"}>
            <div style="font-size:9px;font-family:'Press Start 2P',monospace;color:var(--gold)">OPTION B</div>
            <div style="font-size:8px;color:var(--text-dim);margin-top:2px">Exhaust 3 Landscapes</div>
          </button>
          <button id="btn-wasp-cancel" class="btn-danger" style="width:100%;margin-top:4px">Cancel</button>
        </div>
      </div>
    `,this.container.appendChild(d),d.querySelector("#btn-wasp-discard")?.addEventListener("click",()=>{n&&(d.remove(),this.showWaspDiscardThenPlay(e,a,t))}),d.querySelector("#btn-wasp-extra")?.addEventListener("click",()=>{if(!o)return;d.remove();const r=A(this.gameState,a,t,void 0,1);r!==this.gameState&&(this.setState(r),r.stack.length>0&&this.triggerBotStackResponse())}),d.querySelector("#btn-wasp-cancel")?.addEventListener("click",()=>d.remove())}showWaspDiscardThenPlay(e,a,t){const l=y(e,a).hand.filter(d=>d.id!==t),n=document.createElement("div");n.className="overlay",n.id="wasp-discard-overlay";const o=l.map(d=>{const r=p[d.defId];if(!r)return"";const c={being:"🐉",landscape:"🌿",ancient:"⭐",spell:"✨"}[r.type]||"?",u=r.type==="being"?` (${r.power}/${r.toughness})`:r.type==="spell"?` (${r.cost}WP)`:"";return`<button class="btn-target wasp-discard-btn" data-id="${d.id}" style="margin-bottom:4px;text-align:left;padding:7px 12px">
          <span style="font-size:12px">${c}</span>
          <span style="font-size:10px;margin-left:6px">${r.name}${u}</span>
        </button>`}).filter(d=>d).join("");n.innerHTML=`
      <div class="modal" style="max-width:320px;width:90vw;text-align:center">
        <div class="modal-title" style="color:var(--gold)">🗑 DISCARD A CARD (Wasp Cost)</div>
        <p style="font-size:9px;color:var(--text-dim);margin-bottom:10px">Choose 1 card to discard as part of the Wasp's alternate cost.</p>
        <div style="display:flex;flex-direction:column;gap:2px;max-height:280px;overflow-y:auto;margin-bottom:8px">
          ${o||'<div style="color:var(--text-dim);font-size:10px">No cards to discard</div>'}
        </div>
        <button id="btn-wasp-discard-cancel" class="btn-danger w-full mt-8">Cancel</button>
      </div>
    `,this.container.appendChild(n),n.querySelectorAll(".wasp-discard-btn").forEach(d=>{d.addEventListener("click",()=>{const r=d.dataset.id;n.remove();let c=e;const u=y(c,a),h=u.hand.findIndex(g=>g.id===r);if(h!==-1){const g=[...u.hand],m=g.splice(h,1)[0],v=[...u.yard,m];c=c.player1===a?{...c,p1State:{...u,hand:g,yard:v}}:{...c,p2State:{...u,hand:g,yard:v}}}const f=A(c,a,t);f!==c&&(this.setState(f),f.stack.length>0&&this.triggerBotStackResponse())})}),n.querySelector("#btn-wasp-discard-cancel")?.addEventListener("click",()=>n.remove())}showCultivateModal(){const e=this.gameState,a=this.currentUser.uid,t=y(e,a),i=t.yard.filter(r=>p[r.defId]?.type==="being"),l=t.battlefield.filter(r=>p[r.defId]?.type==="being"),n=document.createElement("div");n.className="overlay",n.id="cultivate-overlay";const o=i.map(r=>{const c=p[r.defId];return`<option value="${r.id}">${c?.name} (${c?.power}/${c?.toughness}) — costs ${c?.power} power to summon</option>`}).join(""),d=l.map(r=>{const c=p[r.defId];return`<label style="display:flex;gap:6px;align-items:center;font-size:10px;margin-bottom:4px"><input type="checkbox" class="sac-being-cb" value="${r.id}"> ${c?.name} (${c?.power}/${c?.toughness})</label>`}).join("");n.innerHTML=`
      <div class="modal" style="max-width:400px;width:90vw">
        <div class="modal-title" style="color:var(--green)">🌱 CULTIVATE</div>
        <p style="font-size:9px;color:var(--text-dim);margin-bottom:10px">Sacrifice beings with total power equal to a yard being's power to summon it exhausted.</p>
        <div style="margin-bottom:10px">
          <div style="font-size:9px;color:var(--text-dim);margin-bottom:4px">Choose yard being to summon:</div>
          <select id="cultivate-yard-select" style="width:100%;background:var(--bg3);color:var(--text);border:1px solid var(--border);padding:4px;font-size:10px">${o}</select>
        </div>
        <div style="margin-bottom:10px">
          <div style="font-size:9px;color:var(--text-dim);margin-bottom:4px">Check beings to sacrifice (total power must match):</div>
          <div>${d}</div>
        </div>
        <div style="display:flex;gap:8px">
          <button id="btn-cultivate-confirm" class="btn-green" style="flex:1">Summon</button>
          <button id="btn-cultivate-cancel" class="btn-danger" style="flex:1">Cancel</button>
        </div>
      </div>
    `,this.container.appendChild(n),n.querySelector("#btn-cultivate-confirm")?.addEventListener("click",()=>{const r=n.querySelector("#cultivate-yard-select")?.value??"",c=Array.from(n.querySelectorAll(".sac-being-cb:checked")).map(h=>h.value),u=Ne(this.gameState,a,r,c);n.remove(),u!==this.gameState&&this.setState(u)}),n.querySelector("#btn-cultivate-cancel")?.addEventListener("click",()=>n.remove())}showStudyModal(){const e=this.gameState,a=this.currentUser.uid,t=y(e,a),i=t.yard.filter(r=>p[r.defId]?.type==="spell"),l=t.battlefield.filter(r=>{const c=p[r.defId]?.type;return c==="being"||c==="landscape"}),n=document.createElement("div");n.className="overlay",n.id="study-overlay";const o=i.map(r=>{const c=p[r.defId];return`<option value="${r.id}">${c?.name} (cost:${c?.cost}) — sacrifice ${c?.cost} beings/lands</option>`}).join(""),d=l.map(r=>{const c=p[r.defId];return`<label style="display:flex;gap:6px;align-items:center;font-size:10px;margin-bottom:4px"><input type="checkbox" class="sac-card-cb" value="${r.id}"> [${c?.type}] ${c?.name}</label>`}).join("");n.innerHTML=`
      <div class="modal" style="max-width:420px;width:90vw">
        <div class="modal-title" style="color:var(--purple-bright)">📚 STUDY</div>
        <p style="font-size:9px;color:var(--text-dim);margin-bottom:10px">Cast a spell from your yard. Sacrifice beings/landscapes equal to its cost. You take 2x damage.</p>
        <div style="margin-bottom:10px">
          <div style="font-size:9px;color:var(--text-dim);margin-bottom:4px">Choose spell to cast:</div>
          <select id="study-spell-select" style="width:100%;background:var(--bg3);color:var(--text);border:1px solid var(--border);padding:4px;font-size:10px">${o}</select>
        </div>
        <div style="margin-bottom:10px">
          <div style="font-size:9px;color:var(--text-dim);margin-bottom:4px">Check to sacrifice (need: equal to spell cost):</div>
          <div>${d}</div>
        </div>
        <div style="display:flex;gap:8px">
          <button id="btn-study-confirm" class="btn-green" style="flex:1">Cast</button>
          <button id="btn-study-cancel" class="btn-danger" style="flex:1">Cancel</button>
        </div>
      </div>
    `,this.container.appendChild(n),n.querySelector("#btn-study-confirm")?.addEventListener("click",()=>{const r=n.querySelector("#study-spell-select")?.value??"",c=Array.from(n.querySelectorAll(".sac-card-cb:checked")).map(h=>h.value),u=Me(this.gameState,a,r,c);n.remove(),u!==this.gameState&&this.setState(u)}),n.querySelector("#btn-study-cancel")?.addEventListener("click",()=>n.remove())}showEvolveModal(){const e=this.gameState,a=this.currentUser.uid,t=y(e,a),i=t.battlefield.filter(d=>p[d.defId]?.type==="landscape"),l=Math.min(i.length,t.willPower),n=document.createElement("div");n.className="overlay",n.id="evolve-overlay";const o=i.map(d=>{const r=p[d.defId];return`<option value="${d.id}">${r?.name}</option>`}).join("");n.innerHTML=`
      <div class="modal" style="max-width:380px;width:90vw">
        <div class="modal-title" style="color:var(--cyan)">🌀 EVOLVE</div>
        <p style="font-size:9px;color:var(--text-dim);margin-bottom:10px">Spend WP (≤ landscape count: ${i.length}) to transform a landscape into a WP/WP-2 being.</p>
        <div style="margin-bottom:8px">
          <div style="font-size:9px;color:var(--text-dim);margin-bottom:4px">WP to spend (1–${l}):</div>
          <input id="evolve-wp-input" type="number" min="1" max="${l}" value="1" style="width:80px;background:var(--bg3);color:var(--text);border:1px solid var(--border);padding:4px;font-size:12px">
        </div>
        <div style="margin-bottom:10px">
          <div style="font-size:9px;color:var(--text-dim);margin-bottom:4px">Choose landscape to transform:</div>
          <select id="evolve-land-select" style="width:100%;background:var(--bg3);color:var(--text);border:1px solid var(--border);padding:4px;font-size:10px">${o}</select>
        </div>
        <div style="display:flex;gap:8px">
          <button id="btn-evolve-confirm" class="btn-green" style="flex:1">Evolve</button>
          <button id="btn-evolve-cancel" class="btn-danger" style="flex:1">Cancel</button>
        </div>
      </div>
    `,this.container.appendChild(n),n.querySelector("#btn-evolve-confirm")?.addEventListener("click",()=>{const d=parseInt(n.querySelector("#evolve-wp-input")?.value??"1",10),r=n.querySelector("#evolve-land-select")?.value??"",c=qe(this.gameState,a,d,r);n.remove(),c!==this.gameState&&this.setState(c)}),n.querySelector("#btn-evolve-cancel")?.addEventListener("click",()=>n.remove())}showNourishModal(){const e=this.gameState,a=this.currentUser.uid,t=y(e,a),i=t.battlefield.filter(r=>p[r.defId]?.type==="being"),l=t.yard.filter(r=>p[r.defId]?.type==="landscape"),n=document.createElement("div");n.className="overlay",n.id="nourish-overlay";const o=i.map(r=>{const c=p[r.defId];return`<option value="${r.id}">${c?.name} (${c?.power}/${c?.toughness})</option>`}).join(""),d=l.map(r=>{const c=p[r.defId];return`<option value="${r.id}">${c?.name}</option>`}).join("");n.innerHTML=`
      <div class="modal" style="max-width:360px;width:90vw">
        <div class="modal-title" style="color:var(--green)">🌿 NOURISH</div>
        <p style="font-size:9px;color:var(--text-dim);margin-bottom:10px">Sacrifice a being to return a landscape from your yard to hand.</p>
        <div style="margin-bottom:8px">
          <div style="font-size:9px;color:var(--text-dim);margin-bottom:4px">Sacrifice being:</div>
          <select id="nourish-being-select" style="width:100%;background:var(--bg3);color:var(--text);border:1px solid var(--border);padding:4px;font-size:10px">${o}</select>
        </div>
        <div style="margin-bottom:10px">
          <div style="font-size:9px;color:var(--text-dim);margin-bottom:4px">Return landscape from yard:</div>
          <select id="nourish-land-select" style="width:100%;background:var(--bg3);color:var(--text);border:1px solid var(--border);padding:4px;font-size:10px">${d}</select>
        </div>
        <div style="display:flex;gap:8px">
          <button id="btn-nourish-confirm" class="btn-green" style="flex:1">Nourish</button>
          <button id="btn-nourish-cancel" class="btn-danger" style="flex:1">Cancel</button>
        </div>
      </div>
    `,this.container.appendChild(n),n.querySelector("#btn-nourish-confirm")?.addEventListener("click",()=>{const r=n.querySelector("#nourish-being-select")?.value??"",c=n.querySelector("#nourish-land-select")?.value??"",u=_e(this.gameState,a,r,c);n.remove(),u!==this.gameState&&this.setState(u)}),n.querySelector("#btn-nourish-cancel")?.addEventListener("click",()=>n.remove())}showSacAncientModal(){const e=this.gameState,a=this.currentUser.uid,i=y(e,a).battlefield.filter(o=>p[o.defId]?.type==="landscape"),l=document.createElement("div");l.className="overlay",l.id="sac-ancient-overlay";const n=i.map(o=>{const d=p[o.defId];return`<label style="display:flex;gap:6px;align-items:center;font-size:10px;margin-bottom:4px"><input type="checkbox" class="sac-land-cb" value="${o.id}"> ${d?.name}</label>`}).join("");l.innerHTML=`
      <div class="modal" style="max-width:360px;width:90vw">
        <div class="modal-title" style="color:var(--gold)">⭐ SAC ANCIENT + 2 LANDSCAPES</div>
        <p style="font-size:9px;color:var(--text-dim);margin-bottom:10px">Sacrifice your Ancient and 2 Landscapes → draw 3 cards, discard 1.</p>
        <div style="margin-bottom:10px">
          <div style="font-size:9px;color:var(--text-dim);margin-bottom:4px">Check exactly 2 landscapes to sacrifice:</div>
          <div>${n}</div>
        </div>
        <div style="display:flex;gap:8px">
          <button id="btn-sac-ancient-confirm" class="btn-gold" style="flex:1">Sacrifice</button>
          <button id="btn-sac-ancient-cancel" class="btn-danger" style="flex:1">Cancel</button>
        </div>
      </div>
    `,this.container.appendChild(l),l.querySelector("#btn-sac-ancient-confirm")?.addEventListener("click",()=>{const o=Array.from(l.querySelectorAll(".sac-land-cb:checked")).map(r=>r.value);if(o.length!==2){alert("Select exactly 2 landscapes.");return}const d=Fe(this.gameState,a,o);l.remove(),d!==this.gameState&&(this.setState(d),setTimeout(()=>this.showDiscardModal(),400))}),l.querySelector("#btn-sac-ancient-cancel")?.addEventListener("click",()=>l.remove())}showDiscardModal(){const e=this.gameState,a=this.currentUser.uid,t=y(e,a),i=document.createElement("div");i.className="overlay",i.id="discard-overlay";const l=t.hand.map(n=>{const o=p[n.defId];return`<button class="btn-target discard-card-btn" data-id="${n.id}" style="margin-bottom:4px">[${o?.type}] ${o?.name}</button>`}).join("");i.innerHTML=`
      <div class="modal" style="max-width:320px;width:90vw;text-align:center">
        <div class="modal-title" style="color:var(--gold)">🗑 DISCARD A CARD</div>
        <p style="font-size:9px;color:var(--text-dim);margin-bottom:10px">Choose 1 card from your hand to discard.</p>
        ${l}
      </div>
    `,this.container.appendChild(i),i.querySelectorAll(".discard-card-btn").forEach(n=>{n.addEventListener("click",()=>{const o=n.dataset.id,d=y(this.gameState,a),r=d.hand.findIndex(c=>c.id===o);if(r!==-1){const c=[...d.hand],u=c.splice(r,1)[0],h=[...d.yard,u],f=this.gameState.player1===a?{...this.gameState,p1State:{...d,hand:c,yard:h}}:{...this.gameState,p2State:{...d,hand:c,yard:h}};i.remove(),this.setState(f)}})})}destroy(){this.priorityTimeoutId!==null&&clearTimeout(this.priorityTimeoutId),this.ritualPopupTimerId!==null&&clearTimeout(this.ritualPopupTimerId),this.turnPopupTimerId!==null&&clearTimeout(this.turnPopupTimerId),this.clearPlayerInactivityTimer(),this.clearPriorityCountdown(),this.mouseMoveHandler&&(document.removeEventListener("mousemove",this.mouseMoveHandler),this.mouseMoveHandler=null),this.spacebarHandler&&(document.removeEventListener("keydown",this.spacebarHandler),this.spacebarHandler=null)}}const te=document.getElementById("app"),je="/bot-demo/cards/Scape_logo.png";function he(){te.innerHTML=`
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:24px;background:rgba(51, 0, 51);">
      <img src="${je}" alt="Scape" style="max-width:min(420px,80vw);height:auto;" />
      <button id="btn-play" style="
        font-family:'Press Start 2P',monospace;
        font-size:14px;
        padding:16px 48px;
        background:var(--gold,#ffd700);
        color:#000;
        border:2px solid var(--gold,#ffd700);
        cursor:pointer;
      ">Start</button>
    </div>
  `,document.getElementById("btn-play").addEventListener("click",Ge)}function Ge(){const s={uid:`guest_${Date.now()}`,username:"Player",rank:100,wins:0,losses:0,online:!0,lastSeen:Date.now(),friends:[],avatarColor:"#00ff88"},e=new We(s,a=>{a==="lobby"&&he()});te.innerHTML="",te.appendChild(e.getElement())}he();
