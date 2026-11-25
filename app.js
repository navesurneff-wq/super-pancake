const DB_KEY = "life-tracker-v2";
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const today = () => new Date().toISOString().slice(0,10);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now()+"-"+Math.random().toString(16).slice(2));
const dateFR = d => new Date(d+"T12:00:00").toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"});
const state = {tasks:[],goals:[],sports:[],habits:[],projects:[],routines:[],reviews:[],settings:{pinHash:null}};
let goalMode="active", editing=null, editingRoutineId=null, editingTaskId=null, db=null, deferredInstall=null;
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
function startOfWeek(d=new Date()){const x=new Date(d);const day=(x.getDay()+6)%7;x.setDate(x.getDate()-day);x.setHours(0,0,0,0);return x;}
function dateKey(d){return d.toISOString().slice(0,10);}
function render(){
  const open=state.tasks.filter(t=>!t.done), goals=state.goals.filter(g=>g.progress<100);
  let branches=0;state.goals.forEach(g=>walkGoalNodes(g.steps||[],()=>branches++));
  $("#todayLabel").textContent=new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"}).toUpperCase();
  $("#statOpen").textContent=open.length;$("#statDue").textContent=`${state.tasks.length-open.length} terminée(s)`;
  $("#statGoals").textContent=goals.length;$("#statBranches").textContent=branches;$("#statHabits").textContent=state.routines.length;
  renderDashboardTasks();renderDashboardGoals();renderGoals();renderTodo();renderSport();renderWork();renderAssistant();
}
function taskHTML(t){return `<div class="task-row"><button class="task-check ${t.done?"done":""}" data-complete="${esc(t.id)}" aria-label="Terminer">${t.done?"✓":""}</button><div class="task-main"><div class="task-title ${t.done?"completed":""}">${esc(t.title)}</div></div></div>`;}
function taskRank(p){return ({Haute:0,Moyenne:1,Basse:2})[p]??1;}
function renderDashboardTasks(){const items=[...state.tasks].sort((a,b)=>(a.order??0)-(b.order??0)).slice(0,5);$("#dashboardTasks").className=items.length?"task-list":"task-list empty-state";$("#dashboardTasks").innerHTML=items.length?items.map(taskHTML).join(""):"Aucune tâche pour le moment.";}
function renderDashboardGoals(){
  const items=state.goals.filter(g=>g.progress<100).slice(0,3);
  const el=$("#dashboardGoals");
  if(!el)return;
  el.className=items.length?"goal-list":"goal-list empty-state";
  el.innerHTML=items.length?items.map(g=>`<button type="button" class="goal-mini goal-mini-button" data-dashboard-goal-open="${esc(g.id)}"><span class="goal-mini-head"><strong>${esc(g.title)}</strong><span>${Math.round(g.progress||0)}%</span></span><span class="progress-track"><span class="progress-fill" style="display:block;width:${Math.max(0,Math.min(100,Number(g.progress)||0))}%"></span></span><small>Appuie pour ouvrir les étapes</small></button>`).join(""):"Aucun objectif en cours.";
}
function renderTodo(){const items=[...state.tasks].sort((a,b)=>(a.order??0)-(b.order??0));const body=$("#todoTableBody");if(!body)return;$("#todoCount").textContent=`${items.length} tâche(s) · ${items.filter(x=>!x.done).length} restante(s)`;$("#todoEmpty").hidden=items.length>0;body.innerHTML=items.map(t=>`<tr class="${t.done?"todo-done":""}"><td><input type="checkbox" data-complete="${esc(t.id)}" ${t.done?"checked":""} aria-label="Marquer comme terminé"></td><td><strong>${esc(t.title)}</strong></td><td class="todo-actions"><button class="icon-button" data-task-edit="${esc(t.id)}" aria-label="Modifier la tâche" title="Modifier">✎</button><button class="delete-task-button" data-task-delete="${esc(t.id)}" aria-label="Supprimer la tâche" title="Supprimer">Supprimer</button></td></tr>`).join("");}
function normalizeGoalTree(){
  for(const g of state.goals){
    if(!Array.isArray(g.steps))g.steps=[];
    if(typeof g.branchesOpen!=="boolean")g.branchesOpen=false;
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
  $("#goalsList").innerHTML=list.length?list.map(g=>{const progress=updateGoalProgress(g);const opened=!!g.branchesOpen;return `<article class="goal-card"><button type="button" class="goal-open-button" data-goal-open="${esc(g.id)}"><div class="goal-card-head"><div><p class="eyebrow">${esc(g.category||"PERSONNEL")}</p><h3>${esc(g.title)}</h3></div><strong>${Math.round(g.progress)}%</strong><span class="goal-chevron">${opened?"▾":"›"}</span></div>${g.details?`<p>${esc(g.details)}</p>`:""}<div class="progress-track"><div class="progress-fill" style="width:${g.progress}%"></div></div><div class="goal-footer"><span>Échéance : ${g.date?dateFR(g.date):"Non définie"}</span><span>${g.progress>=100?"Terminé":"En cours"}</span></div></button>
  ${opened?`<div class="goal-branches"><div class="goal-branches-heading"><strong>Branches et sous-objectifs</strong><small>${progress.done}/${progress.total} étapes terminées</small></div>${g.steps.length?g.steps.map(node=>renderGoalBranch(g,node)).join(""):'<p class="task-meta">Aucune branche pour le moment.</p>'}<button type="button" data-goal-add-root="${esc(g.id)}" class="secondary-button">＋ Ajouter une branche</button><div class="goal-actions"><button data-delete-goal="${esc(g.id)}">Supprimer l’objectif</button></div></div>`:""}</article>`;}).join(""):'<div class="panel empty-state">Aucun objectif dans cette catégorie.</div>';
}
function findGoalNode(nodes,id){for(const node of nodes||[]){if(node.id===id)return node;const found=findGoalNode(node.children,id);if(found)return found;}return null;}
function findGoalParent(nodes,id){for(const node of nodes||[]){if((node.children||[]).some(x=>x.id===id))return node;const found=findGoalParent(node.children,id);if(found)return found;}return null;}
function renderSport(){const list=[...state.sports].sort((a,b)=>b.date.localeCompare(a.date));const month=list.filter(x=>x.date.slice(0,7)===today().slice(0,7));$("#sportCount").textContent=month.length;$("#sportTime").textContent=(month.reduce((s,x)=>s+Number(x.minutes||0),0)/60).toFixed(1)+" h";$("#sportDistance").textContent=month.reduce((s,x)=>s+Number(x.distance||0),0).toFixed(1)+" km";$("#sportList").className=list.length?"activity-list":"activity-list empty-state";$("#sportList").innerHTML=list.length?list.map(x=>`<div class="activity-row"><div class="task-main"><strong>${esc(x.type)}</strong><div class="task-meta">${dateFR(x.date)} · ${x.minutes} min${x.distance?` · ${x.distance} km`:""}</div></div><button class="icon-button" data-delete-sport="${x.id}">×</button></div>`).join(""):"Enregistre ta première séance.";}
function renderWork(){$("#habitsList").className=state.habits.length?"habit-list":"habit-list empty-state";$("#habitsList").innerHTML=state.habits.length?state.habits.map(h=>`<div class="habit-row"><label><input type="checkbox" data-habit="${h.id}" ${h.active?"checked":""}> ${esc(h.title)}</label><button class="icon-button" data-delete-habit="${h.id}">×</button></div>`).join(""):"Aucune habitude créée.";$("#projectsList").className=state.projects.length?"project-list":"project-list empty-state";$("#projectsList").innerHTML=state.projects.length?state.projects.map(p=>`<div class="project-row"><div><strong>${esc(p.title)}</strong><p>${esc(p.details||"Projet")} · ${p.status}</p></div><button data-delete-project="${p.id}">×</button></div>`).join(""):"Aucun projet pour le moment.";renderRoutines();}
function routinePeriodKey(r){if(r.frequency==="weekly"){const d=startOfWeek();return dateKey(d);}return today();}
function renderRoutines(){const host=$("#routinesList");if(!host)return;host.className=state.routines.length?"routines-list":"routines-list empty-state";if(!state.routines.length){host.textContent="Aucune routine créée. Ajoute une routine pour organiser tes habitudes récurrentes.";return;}host.innerHTML=state.routines.map(r=>{const key=routinePeriodKey(r),done=(r.logs&&r.logs[key])||[],steps=r.steps||[],pct=steps.length?Math.round(done.filter(id=>steps.some(s=>s.id===id)).length/steps.length*100):0;return `<article class="routine-card"><div class="routine-head"><div><h3>${esc(r.title)}</h3><span class="routine-frequency">${r.frequency==="weekly"?"Chaque semaine":"Chaque jour"} · ${pct}%</span></div><div class="routine-actions"><button class="text-button" data-routine-edit="${esc(r.id)}">Modifier</button><button class="icon-button" data-routine-delete="${esc(r.id)}" aria-label="Supprimer la routine">×</button></div></div><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div><div class="routine-steps">${steps.map(s=>`<label class="routine-step"><input type="checkbox" data-routine-check="${esc(s.id)}" data-routine-id="${esc(r.id)}" ${done.includes(s.id)?"checked":""}><span>${esc(s.title)}</span></label>`).join("")}</div><div class="routine-foot">${done.length>=steps.length&&steps.length?"Routine terminée pour cette période.":`${done.length} étape(s) sur ${steps.length} terminée(s)`}</div></article>`;}).join("");}

function insights(){const arr=[],open=state.tasks.filter(t=>!t.done),goals=state.goals.filter(g=>g.progress<100);if(open.length){const high=open.filter(t=>t.priority==="Haute").length;arr.push(["✓",`${open.length} tâche(s) à traiter`,high?`${high} priorité(s) haute(s). Commence par les plus importantes.`:"Classe tes tâches par importance pour clarifier tes priorités."]);}if(goals.length){const g=goals[0];arr.push(["◎",`Objectif à suivre : ${g.title}`,`${Math.round(g.progress)} % réalisé. Ouvre cet objectif pour développer ses branches et sous-objectifs.`]);}if(state.routines.length)arr.push(["↻","Tes routines",`${state.routines.length} routine(s) disponible(s). Coche les étapes au fil de la journée.`]);if(!arr.length)arr.push(["✳","Ton espace est prêt","Ajoute des tâches, des objectifs et tes routines quotidiennes."]);return arr;}
function renderAssistant(){$("#insightsList").innerHTML=insights().map(i=>`<div class="insight-card"><div class="insight-icon">${i[0]}</div><div><strong>${esc(i[1])}</strong><p>${esc(i[2])}</p></div></div>`).join("");}
function generateReview(){const tasks=state.tasks,done=tasks.filter(t=>t.done).length,activeGoals=state.goals.filter(g=>g.progress<100);const text=`BILAN PERSONNEL\n\nOrganisation : ${done} tâche(s) terminée(s) sur ${tasks.length} (${tasks.length?Math.round(done/tasks.length*100):0} %).\nObjectifs actifs : ${activeGoals.length}.\nRoutines créées : ${state.routines.length}.\n\nPistes pour la suite :\n• Choisir les tâches de priorité haute.\n• Décomposer un objectif en branches concrètes.\n• Faire le point sur les routines quotidiennes.`;$("#reviewOutput").textContent=text;state.reviews.unshift({id:uid(),date:today(),mode:"personal",text});save();}
const field=(label,name,type="text",value="",extra="")=>`<div class="field"><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" type="${type}" value="${esc(value)}" ${extra}></div>`;
function openForm(type){editing=type;let title="",fields="";if(type==="task"||type==="task-edit"){const t=type==="task-edit"?state.tasks.find(x=>String(x.id)===String(editingTaskId)):null;title=t?"Modifier la tâche":"Ajouter une tâche";fields=field("Nom de la tâche","title","text",t?.title||"");}

if(type==="goal"){title="Nouvel objectif";fields=field("Nom de l'objectif","title")+`<div class="field"><label>Description</label><textarea name="details"></textarea></div>`+field("Échéance","date","date",new Date(Date.now()+90*86400000).toISOString().slice(0,10))+`<div class="field"><label>Catégorie</label><select name="category">${["Personnel","Travail","Sport","Santé","Apprentissage"].map(x=>`<option>${x}</option>`).join("")}</select></div>`;}
if(type==="sport"){title="Nouvelle séance";fields=`<div class="field"><label>Activité</label><select name="type">${["Tennis","Course à pied","Renforcement","Marche","Vélo","Autre"].map(x=>`<option>${x}</option>`).join("")}</select></div>`+field("Durée (minutes)","minutes","number","60",{min:"1"})+field("Distance (km, facultatif)","distance","number","",{min:"0",step:"0.1"})+field("Date","date","date",today());}
if(type==="habit"){title="Nouvelle habitude";fields=field("Nom de l'habitude","title")+`<div class="field"><label>Fréquence</label><select name="frequency"><option>Quotidienne</option><option>Hebdomadaire</option></select></div>`;}
if(type==="routine"||type==="routine-edit"){const r=type==="routine-edit"?state.routines.find(x=>x.id===editingRoutineId):null;title=r?"Modifier la routine":"Nouvelle routine";fields=field("Nom de la routine","title","text",r?.title||"")+`<div class="field"><label>Répétition</label><select name="frequency"><option value="daily" ${r?.frequency!=="weekly"?"selected":""}>Chaque jour</option><option value="weekly" ${r?.frequency==="weekly"?"selected":""}>Chaque semaine</option></select></div><div class="field"><label>Étapes (une par ligne)</label><textarea name="steps" rows="5" placeholder="Ex.
Boire un verre d'eau
Faire 10 minutes d'étirements
Lire 10 pages">${esc((r?.steps||[]).map(s=>s.title).join("\n"))}</textarea><small class="muted">Tu pourras cocher chaque étape et suivre la progression.</small></div>`;}
if(type==="project"){title="Nouveau projet";fields=field("Nom du projet","title")+`<div class="field"><label>Description</label><textarea name="details"></textarea></div>`;}
$("#dialogTitle").textContent=title;$("#dialogFields").innerHTML=fields;$("#editDialog").showModal();}
function formData(){return Object.fromEntries(new FormData($("#editForm")).entries());}
$("#saveDialog").addEventListener("click",e=>{e.preventDefault();const f=formData();if(!f.title?.trim()&&editing!=="sport"){toast("Ajoute un titre.");return;}if(editing==="task"||editing==="task-edit"){if(editing==="task-edit"){const t=state.tasks.find(x=>String(x.id)===String(editingTaskId));if(t){t.title=f.title.trim();}}else state.tasks.push({id:uid(),title:f.title.trim(),done:false,order:state.tasks.length});editingTaskId=null;}
if(editing==="goal")state.goals.push({id:uid(),title:f.title.trim(),details:f.details,date:f.date,category:f.category,progress:0,steps:[]});
if(editing==="sport")state.sports.push({id:uid(),type:f.type,minutes:Number(f.minutes),distance:Number(f.distance||0),date:f.date});
if(editing==="habit")state.habits.push({id:uid(),title:f.title.trim(),frequency:f.frequency,active:true});
if(editing==="project")state.projects.push({id:uid(),title:f.title.trim(),details:f.details,status:"En cours"});
if(editing==="routine"||editing==="routine-edit"){const steps=String(f.steps||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(title=>({id:uid(),title}));if(!steps.length){toast("Ajoute au moins une étape à la routine.");return;}if(editing==="routine-edit"){const r=state.routines.find(x=>x.id===editingRoutineId);if(r){r.title=f.title.trim();r.frequency=f.frequency;r.steps=steps;}}else state.routines.push({id:uid(),title:f.title.trim(),frequency:f.frequency,steps,logs:{}});editingRoutineId=null;}
save();$("#editDialog").close();render();toast("Enregistré sur cet appareil.");});
function completeTask(id){const t=state.tasks.find(x=>String(x.id)===String(id));if(!t)return;t.done=!t.done;save();render();}
function moveTask(id,delta){const items=[...state.tasks].sort((a,b)=>(a.order??0)-(b.order??0));const i=items.findIndex(x=>String(x.id)===String(id)),j=i+delta;if(i<0||j<0||j>=items.length)return;const temp=items[i].order??i;items[i].order=items[j].order??j;items[j].order=temp;save();render();}

document.addEventListener("click",e=>{const a=e.target.closest("[data-action]");if(a){openForm(({ "add-task":"task","add-goal":"goal","add-sport":"sport","add-habit":"habit","add-project":"project","add-routine":"routine"})[a.dataset.action]);}
const go=e.target.closest("[data-go]");if(go)navigate(go.dataset.go);
const nav=e.target.closest("[data-page]");if(nav)navigate(nav.dataset.page);
const complete=e.target.closest("[data-complete]");if(complete)completeTask(complete.dataset.complete);
const taskEdit=e.target.closest("[data-task-edit]");if(taskEdit){editingTaskId=taskEdit.dataset.taskEdit;openForm("task-edit");}
const taskDelete=e.target.closest("[data-task-delete]");if(taskDelete&&confirm("Supprimer cette tâche ?")){state.tasks=state.tasks.filter(t=>String(t.id)!==taskDelete.dataset.taskDelete);save();render();}
const taskUp=e.target.closest("[data-task-up]");if(taskUp)moveTask(taskUp.dataset.taskUp,-1);
const taskDown=e.target.closest("[data-task-down]");if(taskDown)moveTask(taskDown.dataset.taskDown,1);
const dashboardGoal=e.target.closest("[data-dashboard-goal-open]");
if(dashboardGoal){const g=state.goals.find(x=>String(x.id)===dashboardGoal.dataset.dashboardGoalOpen);if(g){g.branchesOpen=true;save();renderGoals();navigate("goals");}}
const goalOpen=e.target.closest("[data-goal-open]");if(goalOpen){const g=state.goals.find(x=>String(x.id)===goalOpen.dataset.goalOpen);if(g){g.branchesOpen=!g.branchesOpen;save();renderGoals();}}
const routineEdit=e.target.closest("[data-routine-edit]");if(routineEdit){editingRoutineId=routineEdit.dataset.routineEdit;openForm("routine-edit");}
const routineDelete=e.target.closest("[data-routine-delete]");if(routineDelete&&confirm("Supprimer cette routine et son historique ?")){state.routines=state.routines.filter(r=>r.id!==routineDelete.dataset.routineDelete);save();render();}

const prog=e.target.closest("[data-progress]");if(prog){const g=state.goals.find(x=>x.id===prog.dataset.progress);g.progress=Math.max(0,Math.min(100,g.progress+Number(prog.dataset.delta)));save();render();}
const del=e.target.closest("[data-delete-goal]");if(del){state.goals=state.goals.filter(x=>x.id!==del.dataset.deleteGoal);save();render();}
const rootAdd=e.target.closest("[data-goal-add-root]");if(rootAdd){const g=state.goals.find(x=>x.id===rootAdd.dataset.goalAddRoot);const title=prompt("Nom de cette étape :");if(g&&title?.trim()){g.steps.push({id:uid(),title:title.trim(),done:false,collapsed:false,children:[]});updateGoalProgress(g);save();render();}}
const branchAdd=e.target.closest("[data-branch-add]");if(branchAdd){const g=state.goals.find(x=>x.id===branchAdd.dataset.branchGoal),parent=findGoalNode(g?.steps,branchAdd.dataset.branchAdd);const title=prompt("Nom de cette nouvelle branche :");if(g&&parent&&title?.trim()){parent.children.push({id:uid(),title:title.trim(),done:false,collapsed:false,children:[]});updateGoalProgress(g);save();render();}}
const branchEdit=e.target.closest("[data-branch-edit]");if(branchEdit){const g=state.goals.find(x=>x.id===branchEdit.dataset.branchGoal),node=findGoalNode(g?.steps,branchEdit.dataset.branchEdit);const title=node?prompt("Modifier le nom de l'étape :",node.title):null;if(g&&node&&title?.trim()){node.title=title.trim();save();render();}}
const branchDelete=e.target.closest("[data-branch-delete]");if(branchDelete){const g=state.goals.find(x=>x.id===branchDelete.dataset.branchGoal);if(g&&confirm("Supprimer cette branche et toutes ses sous-branches ?")){const parent=findGoalParent(g.steps,branchDelete.dataset.branchDelete);if(parent)parent.children=parent.children.filter(x=>x.id!==branchDelete.dataset.branchDelete);else g.steps=g.steps.filter(x=>x.id!==branchDelete.dataset.branchDelete);updateGoalProgress(g);save();render();}}
const branchToggle=e.target.closest("[data-branch-toggle]");if(branchToggle){const g=state.goals.find(x=>x.id===branchToggle.dataset.branchGoal),node=findGoalNode(g?.steps,branchToggle.dataset.branchToggle);if(node){node.collapsed=!node.collapsed;save();render();}}
for(const [attr,key] of [["data-delete-sport","sports"],["data-delete-habit","habits"],["data-delete-project","projects"]]){const b=e.target.closest(`[${attr}]`);if(b){state[key]=state[key].filter(x=>x.id!==b.getAttribute(attr));save();render();}}
});
document.addEventListener("change",e=>{if(e.target.matches("[data-habit]")){const h=state.habits.find(x=>x.id===e.target.dataset.habit);if(h)h.active=e.target.checked;save();render();}
if(e.target.matches("[data-routine-check]")){const r=state.routines.find(x=>x.id===e.target.dataset.routineId);if(r){const key=routinePeriodKey(r);if(!r.logs)r.logs={};if(!r.logs[key])r.logs[key]=[];const id=e.target.dataset.routineCheck;r.logs[key]=e.target.checked?[...new Set([...r.logs[key],id])]:r.logs[key].filter(x=>x!==id);save();renderRoutines();}}
  if(e.target.matches("[data-branch-check]")){const g=state.goals.find(x=>x.id===e.target.dataset.branchGoal),node=findGoalNode(g?.steps,e.target.dataset.branchCheck);if(g&&node){node.done=e.target.checked;updateGoalProgress(g);save();render();}}
});
function navigate(page){$$(".page").forEach(x=>x.classList.toggle("active",x.id==="page-"+page));$$(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.page===page));window.scrollTo({top:0,behavior:"smooth"});}
$("#goalFilter").addEventListener("click",e=>{const b=e.target.closest("[data-filter]");if(!b)return;goalMode=b.dataset.filter;$$("[data-filter]").forEach(x=>x.classList.toggle("selected",x===b));renderGoals();});

$("#generateReview").addEventListener("click",generateReview);
$("#openSettings").addEventListener("click",()=>$("#settingsDialog").showModal());
$("#exportButton").addEventListener("click",()=>{const blob=new Blob([JSON.stringify({app:"LIFE TRACKER",version:2,exportedAt:new Date().toISOString(),data:state},null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="life-tracker-backup-"+today()+".json";a.click();URL.revokeObjectURL(a.href);toast("Sauvegarde exportée.");});
$("#importButton").addEventListener("click",()=>$("#importFile").click());
$("#importFile").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;try{const raw=JSON.parse(await file.text());const d=raw.data||raw;if(!d.tasks||!d.goals)throw new Error("Fichier non reconnu");for(const k of ["tasks","goals","sports","habits","projects","routines","reviews"])if(Array.isArray(d[k]))state[k]=d[k];if(d.settings)state.settings=d.settings;await save();render();toast("Sauvegarde restaurée.");}catch(err){toast("Fichier de sauvegarde invalide.");}e.target.value="";});
$("#resetButton").addEventListener("click",async()=>{if(confirm("Effacer définitivement toutes les données de cet appareil ?")){for(const k of ["tasks","goals","sports","habits","projects","routines","reviews"])state[k]=[];state.settings={pinHash:null};await save();render();$("#settingsDialog").close();toast("Données effacées.");}});
$("#notifyButton").addEventListener("click",async()=>{if(!("Notification"in window)){toast("Notifications non prises en charge ici.");return;}const p=await Notification.requestPermission();toast(p==="granted"?"Notifications autorisées.":"Autorisation non accordée.");});
async function hashPin(pin){const data=new TextEncoder().encode(pin);const digest=await crypto.subtle.digest("SHA-256",data);return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");}
$("#setPinButton").addEventListener("click",async()=>{const pin=prompt("Choisis un code de 4 à 8 chiffres :");if(!pin)return;if(!/^\d{4,8}$/.test(pin)){toast("Le code doit contenir 4 à 8 chiffres.");return;}state.settings.pinHash=await hashPin(pin);await save();toast("Code configuré.");});
async function checkPin(){if(!state.settings.pinHash)return;$("#pinOverlay").classList.remove("hidden");}
$("#unlockButton").addEventListener("click",async()=>{const pin=$("#pinInput").value;if(await hashPin(pin)===state.settings.pinHash){$("#pinOverlay").classList.add("hidden");$("#pinInput").value="";$("#pinError").textContent="";}else $("#pinError").textContent="Code incorrect.";});
window.addEventListener("online",()=>$("#connectionState").innerHTML="<i></i> Connecté");window.addEventListener("offline",()=>$("#connectionState").innerHTML="<i></i> Hors ligne prêt");
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstall=e;});
if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
(async()=>{await load();normalizeGoalTree();state.tasks=state.tasks.map((t,i)=>({...t,title:t.title||t.name||"Tâche",notes:t.notes||"",priority:["Haute","Moyenne","Basse"].includes(t.priority)?t.priority:"Moyenne",order:Number.isFinite(t.order)?t.order:i}));render();await checkPin();})()