const DB_KEY = "life-tracker-v2";
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const today = () => new Date().toISOString().slice(0,10);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now()+"-"+Math.random().toString(16).slice(2));
const money = n => new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:2}).format(Number(n||0));
const dateFR = d => new Date(d+"T12:00:00").toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"});
const state = {tasks:[],goals:[],transactions:[],sports:[],habits:[],projects:[],routines:[],reviews:[],settings:{pinHash:null}};
let planningMode="week", goalMode="active", editing=null, editingRoutineId=null, db=null, deferredInstall=null;
async function openDB(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open("LifeTrackerDB",1);
    req.onupgradeneeded=()=>{const d=req.result; if(!d.objectStoreNames.contains("state")) d.createObjectStore("state");};
    req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
  });
}
async function load(){
  try{db=await openDB(); const value=await new Promise((resolve,reject)=>{const tx=db.transaction("state","readonly");const r=tx.objectStore("state").get(DB_KEY);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);}); if(value) Object.assign(state,value);if(!Array.isArray(state.routines))state.routines=[];}
  catch(e){try{const v=localStorage.getItem(DB_KEY);if(v)Object.assign(state,JSON.parse(v));}catch(_){}}
}
async function save(){
  try{if(db) await new Promise((resolve,reject)=>{const tx=db.transaction("state","readwrite");tx.objectStore("state").put(JSON.parse(JSON.stringify(state)),DB_KEY);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});else localStorage.setItem(DB_KEY,JSON.stringify(state));}
  catch(e){toast("Erreur d'enregistrement local.");}
}
function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2400);}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function monthItems(){return state.transactions.filter(x=>x.date.slice(0,7)===today().slice(0,7));}
function monthTotals(){const a=monthItems();return {income:a.filter(x=>x.kind==="Revenu").reduce((s,x)=>s+Number(x.amount),0),expense:a.filter(x=>x.kind==="Dépense").reduce((s,x)=>s+Number(x.amount),0)};}
function startOfWeek(d=new Date()){const x=new Date(d);const day=(x.getDay()+6)%7;x.setDate(x.getDate()-day);x.setHours(0,0,0,0);return x;}
function dateKey(d){return d.toISOString().slice(0,10);}
function render(){
  const open=state.tasks.filter(t=>!t.done), due=open.filter(t=>t.date===today()).length, goals=state.goals.filter(g=>g.progress<100), totals=monthTotals();
  $("#todayLabel").textContent=new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"}).toUpperCase();
  $("#statOpen").textContent=open.length;$("#statDue").textContent=due?`${due} échéance(s) aujourd'hui`:"Aucune échéance aujourd'hui";
  $("#statGoals").textContent=goals.length;$("#statBalance").textContent=money(totals.income-totals.expense);$("#statHabits").textContent=state.routines.length;
  renderDashboardTasks();renderDailyTodo();renderDashboardGoals();renderWeekBars();renderPlanning();renderGoals();renderFinance();renderSport();renderWork();renderAssistant();
}
function taskHTML(t){return `<div class="task-row"><button class="task-check ${t.done?"done":""}" data-complete="${t.id}" aria-label="Terminer">${t.done?"✓":""}</button><div class="task-main"><div class="task-title ${t.done?"completed":""}">${esc(t.title)}</div><div class="task-meta">${dateFR(t.date)} · ${esc(t.category)}${t.repeat!=="none"?" · "+esc(t.repeatLabel):""}</div></div><span class="priority ${t.priority==="Haute"?"high":t.priority==="Normale"?"medium":""}">${esc(t.priority)}</span></div>`;}
function renderDailyTodo(){
  const host=$("#dailyTodoList"),count=$("#dailyTodoCount"),percentLabel=$("#dailyTodoPercent"),progress=$("#dailyTodoProgress");
  if(!host||!count||!percentLabel||!progress)return;
  const items=state.tasks.filter(task=>task.date===today()).sort((a,b)=>{
    if(a.done!==b.done)return a.done?1:-1;
    const rank={Haute:0,Normale:1,Basse:2};
    return (rank[a.priority]??1)-(rank[b.priority]??1);
  });
  const total=items.length,completed=items.filter(task=>task.done).length;
  const percentage=total?Math.round(completed/total*100):0;
  count.textContent=`${completed} / ${total} tâche(s) terminée(s)`;
  percentLabel.textContent=`${percentage}%`;progress.style.width=`${percentage}%`;
  host.className=total?"task-list":"task-list empty-state";
  host.innerHTML=total?items.map(taskHTML).join(""):"Aucune tâche prévue aujourd'hui. Utilise le bouton Ajouter pour commencer.";
}

function renderDashboardTasks(){const items=state.tasks.filter(t=>!t.done).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,4);$("#dashboardTasks").className=items.length?"task-list":"task-list empty-state";$("#dashboardTasks").innerHTML=items.length?items.map(taskHTML).join(""):"Aucune tâche pour le moment.";}
function renderDashboardGoals(){const items=state.goals.filter(g=>g.progress<100).slice(0,4);$("#dashboardGoals").className=items.length?"goal-list":"goal-list empty-state";$("#dashboardGoals").innerHTML=items.length?items.map(g=>`<div class="goal-mini"><div class="goal-mini-head"><strong>${esc(g.title)}</strong><span>${Math.round(g.progress)}%</span></div><div class="progress-track"><div class="progress-fill" style="width:${g.progress}%"></div></div></div>`).join(""):"Ajoute un objectif pour suivre tes progrès.";}
function renderWeekBars(){const start=startOfWeek();$("#weekRange").textContent=`${dateFR(dateKey(start))} – ${dateFR(dateKey(new Date(start.getTime()+6*86400000)))}`;let html="";for(let i=0;i<7;i++){const d=new Date(start);d.setDate(d.getDate()+i);const key=dateKey(d);const total=state.tasks.filter(t=>t.date===key).length;const done=state.tasks.filter(t=>t.date===key&&t.done).length;const pct=total?done/total*100:0;html+=`<div class="day-bar"><div class="bar-track"><div class="bar-fill" style="height:${pct||3}%"></div></div><small>${["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"][i]}</small></div>`;}$("#weekBars").innerHTML=html;}
function renderPlanning(){const filter=$("#taskFilter")?.value||"all";let list=state.tasks.filter(t=>filter==="all"||t.category===filter);const now=new Date(),start=startOfWeek(),end=new Date(start.getTime()+7*86400000);if(planningMode==="week")list=list.filter(t=>new Date(t.date+"T12:00:00")>=start&&new Date(t.date+"T12:00:00")<end);if(planningMode==="month")list=list.filter(t=>t.date.slice(0,7)===today().slice(0,7));list.sort((a,b)=>a.date.localeCompare(b.date)||a.done-b.done);$("#planningList").innerHTML=list.length?list.map(taskHTML).join(""):'<div class="empty-state">Aucune tâche dans cette période.</div>';}
function normalizeGoalTree(){
  for(const g of state.goals){
    if(!Array.isArray(g.steps))g.steps=[];
    const normalizeList=(nodes)=>nodes.map(item=>{
      const node=typeof item==="string"?{title:item}:item||{};
      node.id=node.id||uid();
      node.title=String(node.title||node.name||"Nouvelle étape");
      node.done=!!node.done;
      node.collapsed=!!node.collapsed;
      node.children=normalizeList(Array.isArray(node.children)?node.children:[]);
      return node;
    });
    g.steps=normalizeList(g.steps);
    updateGoalProgress(g);
  }
}
function walkGoalNodes(nodes,fn){for(const node of nodes||[]){fn(node);walkGoalNodes(node.children,fn);}}
function updateGoalProgress(g){let total=0,done=0;walkGoalNodes(g.steps,node=>{total++;if(node.done)done++;});if(total)g.progress=Math.round(done/total*100);return {total,done};}
function renderGoalBranch(g,node,depth=0){
  const pad=Math.min(depth*13,78),children=node.children||[];
  return `<div style="margin:7px 0 7px ${pad}px;padding:7px 8px;border-left:2px solid var(--line);background:rgba(127,150,180,.045);border-radius:8px">
    <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
      <input type="checkbox" data-branch-check="${esc(node.id)}" data-branch-goal="${esc(g.id)}" ${node.done?"checked":""} style="width:18px;height:18px;flex:0 0 auto">
      <span style="flex:1;min-width:100px;overflow-wrap:anywhere;${node.done?"text-decoration:line-through;opacity:.6":""}">${esc(node.title)}</span>
      <button type="button" data-branch-add="${esc(node.id)}" data-branch-goal="${esc(g.id)}" aria-label="Ajouter une sous-branche" title="Ajouter une sous-branche">＋</button>
      <button type="button" data-branch-edit="${esc(node.id)}" data-branch-goal="${esc(g.id)}" aria-label="Modifier">✎</button>
      <button type="button" data-branch-toggle="${esc(node.id)}" data-branch-goal="${esc(g.id)}" aria-label="Déplier ou replier">${node.collapsed?"▸":"▾"}</button>
      <button type="button" data-branch-delete="${esc(node.id)}" data-branch-goal="${esc(g.id)}" aria-label="Supprimer">×</button>
    </div>
    ${!node.collapsed?`${children.map(child=>renderGoalBranch(g,child,depth+1)).join("")}<div style="margin:5px 0 3px 23px"><button type="button" data-branch-add="${esc(node.id)}" data-branch-goal="${esc(g.id)}" style="font-size:12px">＋ Ajouter une branche ici</button></div>`:""}
  </div>`;
}
function renderGoals(){
  let list=state.goals;if(goalMode==="active")list=list.filter(g=>g.progress<100);if(goalMode==="done")list=list.filter(g=>g.progress>=100);
  $("#goalsList").innerHTML=list.length?list.map(g=>{const progress=updateGoalProgress(g);return `<article class="goal-card"><div class="goal-card-head"><div><p class="eyebrow">${esc(g.category||"PERSONNEL")}</p><h3>${esc(g.title)}</h3></div><strong>${Math.round(g.progress)}%</strong></div><p>${esc(g.details||"Aucune description.")}</p><div class="progress-track"><div class="progress-fill" style="width:${g.progress}%"></div></div><div class="goal-footer"><span>Échéance : ${g.date?dateFR(g.date):"Non définie"}</span><span>${g.progress>=100?"Terminé":"En cours"}</span></div>
  <div style="margin-top:14px"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px"><strong>Étapes et branches</strong><small>${progress.done}/${progress.total} terminées</small></div>
  ${g.steps.length?g.steps.map(node=>renderGoalBranch(g,node)).join(""):'<p class="task-meta">Aucune étape pour le moment.</p>'}
  <button type="button" data-goal-add-root="${esc(g.id)}" style="margin-top:7px">＋ Ajouter une étape</button></div>
  <div class="goal-actions" style="margin-top:12px"><button data-progress="${g.id}" data-delta="-10">− 10 %</button><button data-progress="${g.id}" data-delta="10">+ 10 %</button><button data-delete-goal="${g.id}">Supprimer</button></div></article>`;}).join(""):'<div class="panel empty-state">Aucun objectif dans cette catégorie.</div>';
}
function findGoalNode(nodes,id){for(const node of nodes||[]){if(node.id===id)return node;const found=findGoalNode(node.children,id);if(found)return found;}return null;}
function findGoalParent(nodes,id){for(const node of nodes||[]){if((node.children||[]).some(x=>x.id===id))return node;const found=findGoalParent(node.children,id);if(found)return found;}return null;}
function renderFinance(){const t=monthTotals();$("#financeIncome").textContent=money(t.income);$("#financeExpenses").textContent=money(t.expense);$("#financeNet").textContent=money(t.income-t.expense);const period=$("#financePeriod")?.value||"month";const list=state.transactions.filter(x=>period==="all"||x.date.slice(0,7)===today().slice(0,7)).sort((a,b)=>b.date.localeCompare(a.date));$("#transactionsList").className=list.length?"transaction-list":"transaction-list empty-state";$("#transactionsList").innerHTML=list.length?list.map(x=>`<div class="transaction-row"><div class="transaction-main"><strong>${esc(x.title)}</strong><div class="task-meta">${esc(x.category)} · ${dateFR(x.date)}</div></div><span class="amount ${x.kind==="Revenu"?"income":"expense"}">${x.kind==="Dépense"?"−":"+"}${money(x.amount)}</span><button class="icon-button" data-delete-transaction="${x.id}" aria-label="Supprimer">×</button></div>`).join(""):"Aucune opération enregistrée.";}
function renderSport(){const list=[...state.sports].sort((a,b)=>b.date.localeCompare(a.date));const month=list.filter(x=>x.date.slice(0,7)===today().slice(0,7));$("#sportCount").textContent=month.length;$("#sportTime").textContent=(month.reduce((s,x)=>s+Number(x.minutes||0),0)/60).toFixed(1)+" h";$("#sportDistance").textContent=month.reduce((s,x)=>s+Number(x.distance||0),0).toFixed(1)+" km";$("#sportList").className=list.length?"activity-list":"activity-list empty-state";$("#sportList").innerHTML=list.length?list.map(x=>`<div class="activity-row"><div class="task-main"><strong>${esc(x.type)}</strong><div class="task-meta">${dateFR(x.date)} · ${x.minutes} min${x.distance?` · ${x.distance} km`:""}</div></div><button class="icon-button" data-delete-sport="${x.id}">×</button></div>`).join(""):"Enregistre ta première séance.";}
function renderWork(){$("#habitsList").className=state.habits.length?"habit-list":"habit-list empty-state";$("#habitsList").innerHTML=state.habits.length?state.habits.map(h=>`<div class="habit-row"><label><input type="checkbox" data-habit="${h.id}" ${h.active?"checked":""}> ${esc(h.title)}</label><button class="icon-button" data-delete-habit="${h.id}">×</button></div>`).join(""):"Aucune habitude créée.";$("#projectsList").className=state.projects.length?"project-list":"project-list empty-state";$("#projectsList").innerHTML=state.projects.length?state.projects.map(p=>`<div class="project-row"><div><strong>${esc(p.title)}</strong><p>${esc(p.details||"Projet")} · ${p.status}</p></div><button data-delete-project="${p.id}">×</button></div>`).join(""):"Aucun projet pour le moment.";renderRoutines();}
function routinePeriodKey(r){if(r.frequency==="weekly"){const d=startOfWeek();return dateKey(d);}return today();}
function renderRoutines(){const host=$("#routinesList");if(!host)return;host.className=state.routines.length?"routines-list":"routines-list empty-state";if(!state.routines.length){host.textContent="Aucune routine créée. Ajoute une routine pour organiser tes habitudes récurrentes.";return;}host.innerHTML=state.routines.map(r=>{const key=routinePeriodKey(r),done=(r.logs&&r.logs[key])||[],steps=r.steps||[],pct=steps.length?Math.round(done.filter(id=>steps.some(s=>s.id===id)).length/steps.length*100):0;return `<article class="routine-card"><div class="routine-head"><div><h3>${esc(r.title)}</h3><span class="routine-frequency">${r.frequency==="weekly"?"Chaque semaine":"Chaque jour"} · ${pct}%</span></div><div class="routine-actions"><button class="text-button" data-routine-edit="${esc(r.id)}">Modifier</button><button class="icon-button" data-routine-delete="${esc(r.id)}" aria-label="Supprimer la routine">×</button></div></div><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div><div class="routine-steps">${steps.map(s=>`<label class="routine-step"><input type="checkbox" data-routine-check="${esc(s.id)}" data-routine-id="${esc(r.id)}" ${done.includes(s.id)?"checked":""}><span>${esc(s.title)}</span></label>`).join("")}</div><div class="routine-foot">${done.length>=steps.length&&steps.length?"Routine terminée pour cette période.":`${done.length} étape(s) sur ${steps.length} terminée(s)`}</div></article>`;}).join("");}

function insights(){const arr=[],todayKey=today(),over=state.tasks.filter(t=>!t.done&&t.date<todayKey),due=state.tasks.filter(t=>!t.done&&t.date===todayKey),goals=state.goals.filter(g=>g.progress<100);if(over.length)arr.push(["! ",`${over.length} tâche(s) en retard`,"Revois les échéances dépassées et replanifie les tâches qui restent pertinentes."]);if(due.length)arr.push(["▦",`${due.length} tâche(s) aujourd'hui`,"Commence par les tâches importantes et garde une marge pour les imprévus."]);if(goals.length){const g=[...goals].sort((a,b)=>a.date.localeCompare(b.date))[0];arr.push(["◎",`Objectif à suivre : ${g.title}`,`${Math.round(g.progress)} % réalisé · échéance ${dateFR(g.date)}.`]);}const m=monthTotals();if(state.transactions.some(x=>x.date.slice(0,7)===todayKey.slice(0,7)))arr.push(["€","Point financier du mois",`Revenus ${money(m.income)} · dépenses ${money(m.expense)} · solde ${money(m.income-m.expense)}.`]);if(!arr.length)arr.push(["✳","Ton espace est prêt","Ajoute des tâches, objectifs ou opérations pour obtenir des observations calculées localement."]);return arr;}
function renderAssistant(){$("#insightsList").innerHTML=insights().map(i=>`<div class="insight-card"><div class="insight-icon">${i[0]}</div><div><strong>${esc(i[1])}</strong><p>${esc(i[2])}</p></div></div>`).join("");}
function generateReview(){const mode=$("#reviewPeriod").value,from=mode==="week"?dateKey(startOfWeek()):today().slice(0,7)+"-01";const tasks=state.tasks.filter(t=>t.date>=from&& (mode==="month"?t.date.slice(0,7)===today().slice(0,7):t.date<=today()));const done=tasks.filter(t=>t.done).length;const tx=state.transactions.filter(x=>x.date>=from&&(mode==="month"?x.date.slice(0,7)===today().slice(0,7):x.date<=today()));const inc=tx.filter(x=>x.kind==="Revenu").reduce((s,x)=>s+Number(x.amount),0),exp=tx.filter(x=>x.kind==="Dépense").reduce((s,x)=>s+Number(x.amount),0);const activeGoals=state.goals.filter(g=>g.progress<100);const text=`BILAN ${mode==="week"?"HEBDOMADAIRE":"MENSUEL"}\n\nOrganisation : ${done} tâche(s) terminée(s) sur ${tasks.length} prévue(s) (${tasks.length?Math.round(done/tasks.length*100):0} %).\nFinances saisies : ${money(inc)} de revenus et ${money(exp)} de dépenses.\nSolde : ${money(inc-exp)}.\nObjectifs actifs : ${activeGoals.length}.\n\nPistes pour la suite :\n• Replanifier les tâches non terminées.\n• Choisir une priorité principale pour la période suivante.\n• Mettre à jour la progression des objectifs.\n\nCe bilan est calculé uniquement à partir des données enregistrées.`;$("#reviewOutput").textContent=text;state.reviews.unshift({id:uid(),date:today(),mode,text});save();}
const field=(label,name,type="text",value="",extra="")=>`<div class="field"><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" type="${type}" value="${esc(value)}" ${extra}></div>`;
function openForm(type){editing=type;let title="",fields="";if(type==="task"){title="Nouvelle tâche";fields=field("Nom de la tâche","title")+`<div class="field-inline">${field("Date","date","date",today())}<div class="field"><label>Priorité</label><select name="priority"><option>Basse</option><option selected>Normale</option><option>Haute</option></select></div></div><div class="field-inline"><div class="field"><label>Catégorie</label><select name="category">${["Personnel","Travail","Sport","Finances","Santé","Apprentissage"].map(x=>`<option>${x}</option>`).join("")}</select></div><div class="field"><label>Répétition</label><select name="repeat"><option value="none">Aucune</option><option value="daily">Quotidienne</option><option value="weekly">Hebdomadaire</option><option value="monthly">Mensuelle</option></select></div></div><div class="field"><label><input type="checkbox" name="reminder"> Rappel dans l'application</label></div>`;}
if(type==="goal"){title="Nouvel objectif";fields=field("Nom de l'objectif","title")+`<div class="field"><label>Description</label><textarea name="details"></textarea></div>`+field("Échéance","date","date",new Date(Date.now()+90*86400000).toISOString().slice(0,10))+`<div class="field"><label>Catégorie</label><select name="category">${["Personnel","Travail","Sport","Finances","Santé","Apprentissage"].map(x=>`<option>${x}</option>`).join("")}</select></div>`;}
if(type==="transaction"){title="Nouvelle opération";fields=field("Libellé","title")+field("Montant (€)","amount","number","",{step:"0.01" ,min:"0.01"})+`<div class="field-inline"><div class="field"><label>Type</label><select name="kind"><option>Dépense</option><option>Revenu</option></select></div><div class="field"><label>Catégorie</label><select name="category">${["Logement","Alimentation","Transport","Loisirs","Travail","Épargne","Autre"].map(x=>`<option>${x}</option>`).join("")}</select></div></div>`+field("Date","date","date",today());}
if(type==="sport"){title="Nouvelle séance";fields=`<div class="field"><label>Activité</label><select name="type">${["Tennis","Course à pied","Renforcement","Marche","Vélo","Autre"].map(x=>`<option>${x}</option>`).join("")}</select></div>`+field("Durée (minutes)","minutes","number","60",{min:"1"})+field("Distance (km, facultatif)","distance","number","",{min:"0",step:"0.1"})+field("Date","date","date",today());}
if(type==="habit"){title="Nouvelle habitude";fields=field("Nom de l'habitude","title")+`<div class="field"><label>Fréquence</label><select name="frequency"><option>Quotidienne</option><option>Hebdomadaire</option></select></div>`;}
if(type==="routine"||type==="routine-edit"){const r=type==="routine-edit"?state.routines.find(x=>x.id===editingRoutineId):null;title=r?"Modifier la routine":"Nouvelle routine";fields=field("Nom de la routine","title","text",r?.title||"")+`<div class="field"><label>Répétition</label><select name="frequency"><option value="daily" ${r?.frequency!=="weekly"?"selected":""}>Chaque jour</option><option value="weekly" ${r?.frequency==="weekly"?"selected":""}>Chaque semaine</option></select></div><div class="field"><label>Étapes (une par ligne)</label><textarea name="steps" rows="5" placeholder="Ex.
Boire un verre d'eau
Faire 10 minutes d'étirements
Lire 10 pages">${esc((r?.steps||[]).map(s=>s.title).join("\n"))}</textarea><small class="muted">Tu pourras cocher chaque étape et suivre la progression.</small></div>`;}
if(type==="project"){title="Nouveau projet";fields=field("Nom du projet","title")+`<div class="field"><label>Description</label><textarea name="details"></textarea></div>`;}
$("#dialogTitle").textContent=title;$("#dialogFields").innerHTML=fields;$("#editDialog").showModal();}
function formData(){return Object.fromEntries(new FormData($("#editForm")).entries());}
$("#saveDialog").addEventListener("click",e=>{e.preventDefault();const f=formData();if(!f.title?.trim()&&editing!=="sport"){toast("Ajoute un titre.");return;}if(editing==="task"){state.tasks.push({id:uid(),title:f.title.trim(),date:f.date,priority:f.priority,category:f.category,repeat:f.repeat,repeatLabel:({daily:"chaque jour",weekly:"chaque semaine",monthly:"chaque mois"})[f.repeat]||"",done:false,reminder:$("#dialogFields [name=reminder]").checked});}
if(editing==="goal")state.goals.push({id:uid(),title:f.title.trim(),details:f.details,date:f.date,category:f.category,progress:0,steps:[]});
if(editing==="transaction"){if(!(Number(f.amount)>0)){toast("Montant invalide.");return;}state.transactions.push({id:uid(),title:f.title.trim(),amount:Number(f.amount),kind:f.kind,category:f.category,date:f.date});}
if(editing==="sport")state.sports.push({id:uid(),type:f.type,minutes:Number(f.minutes),distance:Number(f.distance||0),date:f.date});
if(editing==="habit")state.habits.push({id:uid(),title:f.title.trim(),frequency:f.frequency,active:true});
if(editing==="project")state.projects.push({id:uid(),title:f.title.trim(),details:f.details,status:"En cours"});
if(editing==="routine"||editing==="routine-edit"){const steps=String(f.steps||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(title=>({id:uid(),title}));if(!steps.length){toast("Ajoute au moins une étape à la routine.");return;}if(editing==="routine-edit"){const r=state.routines.find(x=>x.id===editingRoutineId);if(r){r.title=f.title.trim();r.frequency=f.frequency;r.steps=steps;}}else state.routines.push({id:uid(),title:f.title.trim(),frequency:f.frequency,steps,logs:{}});editingRoutineId=null;}
save();$("#editDialog").close();render();toast("Enregistré sur cet appareil.");});
function completeTask(id){const t=state.tasks.find(x=>x.id===id);if(!t)return;t.done=!t.done;if(t.done&&t.repeat!=="none"){const d=new Date(t.date+"T12:00:00");if(t.repeat==="daily")d.setDate(d.getDate()+1);if(t.repeat==="weekly")d.setDate(d.getDate()+7);if(t.repeat==="monthly")d.setMonth(d.getMonth()+1);state.tasks.push({...t,id:uid(),date:dateKey(d),done:false});}save();render();}
document.addEventListener("click",e=>{const a=e.target.closest("[data-action]");if(a){openForm(({ "add-task":"task","add-goal":"goal","add-transaction":"transaction","add-sport":"sport","add-habit":"habit","add-project":"project","add-routine":"routine"})[a.dataset.action]);}
const go=e.target.closest("[data-go]");if(go)navigate(go.dataset.go);
const nav=e.target.closest("[data-page]");if(nav)navigate(nav.dataset.page);
const complete=e.target.closest("[data-complete]");if(complete)completeTask(complete.dataset.complete);
const routineEdit=e.target.closest("[data-routine-edit]");if(routineEdit){editingRoutineId=routineEdit.dataset.routineEdit;openForm("routine-edit");}
const routineDelete=e.target.closest("[data-routine-delete]");if(routineDelete&&confirm("Supprimer cette routine et son historique ?")){state.routines=state.routines.filter(r=>r.id!==routineDelete.dataset.routineDelete);save();render();}

const prog=e.target.closest("[data-progress]");if(prog){const g=state.goals.find(x=>x.id===prog.dataset.progress);g.progress=Math.max(0,Math.min(100,g.progress+Number(prog.dataset.delta)));save();render();}
const del=e.target.closest("[data-delete-goal]");if(del){state.goals=state.goals.filter(x=>x.id!==del.dataset.deleteGoal);save();render();}
const rootAdd=e.target.closest("[data-goal-add-root]");if(rootAdd){const g=state.goals.find(x=>x.id===rootAdd.dataset.goalAddRoot);const title=prompt("Nom de cette étape :");if(g&&title?.trim()){g.steps.push({id:uid(),title:title.trim(),done:false,collapsed:false,children:[]});updateGoalProgress(g);save();render();}}
const branchAdd=e.target.closest("[data-branch-add]");if(branchAdd){const g=state.goals.find(x=>x.id===branchAdd.dataset.branchGoal),parent=findGoalNode(g?.steps,branchAdd.dataset.branchAdd);const title=prompt("Nom de cette nouvelle branche :");if(g&&parent&&title?.trim()){parent.children.push({id:uid(),title:title.trim(),done:false,collapsed:false,children:[]});updateGoalProgress(g);save();render();}}
const branchEdit=e.target.closest("[data-branch-edit]");if(branchEdit){const g=state.goals.find(x=>x.id===branchEdit.dataset.branchGoal),node=findGoalNode(g?.steps,branchEdit.dataset.branchEdit);const title=node?prompt("Modifier le nom de l'étape :",node.title):null;if(g&&node&&title?.trim()){node.title=title.trim();save();render();}}
const branchDelete=e.target.closest("[data-branch-delete]");if(branchDelete){const g=state.goals.find(x=>x.id===branchDelete.dataset.branchGoal);if(g&&confirm("Supprimer cette branche et toutes ses sous-branches ?")){const parent=findGoalParent(g.steps,branchDelete.dataset.branchDelete);if(parent)parent.children=parent.children.filter(x=>x.id!==branchDelete.dataset.branchDelete);else g.steps=g.steps.filter(x=>x.id!==branchDelete.dataset.branchDelete);updateGoalProgress(g);save();render();}}
const branchToggle=e.target.closest("[data-branch-toggle]");if(branchToggle){const g=state.goals.find(x=>x.id===branchToggle.dataset.branchGoal),node=findGoalNode(g?.steps,branchToggle.dataset.branchToggle);if(node){node.collapsed=!node.collapsed;save();render();}}
for(const [attr,key] of [["data-delete-transaction","transactions"],["data-delete-sport","sports"],["data-delete-habit","habits"],["data-delete-project","projects"]]){const b=e.target.closest(`[${attr}]`);if(b){state[key]=state[key].filter(x=>x.id!==b.getAttribute(attr));save();render();}}
});
document.addEventListener("change",e=>{if(e.target.matches("[data-habit]")){const h=state.habits.find(x=>x.id===e.target.dataset.habit);if(h)h.active=e.target.checked;save();render();}
if(e.target.matches("[data-routine-check]")){const r=state.routines.find(x=>x.id===e.target.dataset.routineId);if(r){const key=routinePeriodKey(r);if(!r.logs)r.logs={};if(!r.logs[key])r.logs[key]=[];const id=e.target.dataset.routineCheck;r.logs[key]=e.target.checked?[...new Set([...r.logs[key],id])]:r.logs[key].filter(x=>x!==id);save();renderRoutines();}}
  if(e.target.matches("[data-branch-check]")){const g=state.goals.find(x=>x.id===e.target.dataset.branchGoal),node=findGoalNode(g?.steps,e.target.dataset.branchCheck);if(g&&node){node.done=e.target.checked;updateGoalProgress(g);save();render();}}
});
function navigate(page){$$(".page").forEach(x=>x.classList.toggle("active",x.id==="page-"+page));$$(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.page===page));window.scrollTo({top:0,behavior:"smooth"});}
$("#planningView").addEventListener("click",e=>{const b=e.target.closest("[data-view]");if(!b)return;planningMode=b.dataset.view;$$("[data-view]").forEach(x=>x.classList.toggle("selected",x===b));renderPlanning();});
$("#goalFilter").addEventListener("click",e=>{const b=e.target.closest("[data-filter]");if(!b)return;goalMode=b.dataset.filter;$$("[data-filter]").forEach(x=>x.classList.toggle("selected",x===b));renderGoals();});
$("#taskFilter").addEventListener("change",renderPlanning);$("#financePeriod").addEventListener("change",renderFinance);
$("#generateReview").addEventListener("click",generateReview);
$("#openSettings").addEventListener("click",()=>$("#settingsDialog").showModal());
$("#exportButton").addEventListener("click",()=>{const blob=new Blob([JSON.stringify({app:"LIFE TRACKER",version:2,exportedAt:new Date().toISOString(),data:state},null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="life-tracker-backup-"+today()+".json";a.click();URL.revokeObjectURL(a.href);toast("Sauvegarde exportée.");});
$("#importButton").addEventListener("click",()=>$("#importFile").click());
$("#importFile").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;try{const raw=JSON.parse(await file.text());const d=raw.data||raw;if(!d.tasks||!d.goals)throw new Error("Fichier non reconnu");for(const k of ["tasks","goals","transactions","sports","habits","projects","routines","reviews"])if(Array.isArray(d[k]))state[k]=d[k];if(d.settings)state.settings=d.settings;await save();render();toast("Sauvegarde restaurée.");}catch(err){toast("Fichier de sauvegarde invalide.");}e.target.value="";});
$("#resetButton").addEventListener("click",async()=>{if(confirm("Effacer définitivement toutes les données de cet appareil ?")){for(const k of ["tasks","goals","transactions","sports","habits","projects","routines","reviews"])state[k]=[];state.settings={pinHash:null};await save();render();$("#settingsDialog").close();toast("Données effacées.");}});
$("#notifyButton").addEventListener("click",async()=>{if(!("Notification"in window)){toast("Notifications non prises en charge ici.");return;}const p=await Notification.requestPermission();toast(p==="granted"?"Notifications autorisées.":"Autorisation non accordée.");});
async function hashPin(pin){const data=new TextEncoder().encode(pin);const digest=await crypto.subtle.digest("SHA-256",data);return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");}
$("#setPinButton").addEventListener("click",async()=>{const pin=prompt("Choisis un code de 4 à 8 chiffres :");if(!pin)return;if(!/^\d{4,8}$/.test(pin)){toast("Le code doit contenir 4 à 8 chiffres.");return;}state.settings.pinHash=await hashPin(pin);await save();toast("Code configuré.");});
async function checkPin(){if(!state.settings.pinHash)return;$("#pinOverlay").classList.remove("hidden");}
$("#unlockButton").addEventListener("click",async()=>{const pin=$("#pinInput").value;if(await hashPin(pin)===state.settings.pinHash){$("#pinOverlay").classList.add("hidden");$("#pinInput").value="";$("#pinError").textContent="";}else $("#pinError").textContent="Code incorrect.";});
window.addEventListener("online",()=>$("#connectionState").innerHTML="<i></i> Connecté");window.addEventListener("offline",()=>$("#connectionState").innerHTML="<i></i> Hors ligne prêt");
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstall=e;});
if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
(async()=>{await load();normalizeGoalTree();render();await checkPin();})()