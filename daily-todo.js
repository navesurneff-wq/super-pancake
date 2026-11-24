/* LIFE TRACKER — module To Do List quotidienne.
   S'appuie sur les tâches et le stockage existants de app.js. */
(function () {
  // app.js initialise ses données de manière asynchrone. Ce script est chargé
  // juste après lui ; on enveloppe render pour actualiser la liste quotidienne
  // à chaque affichage, ajout ou changement de tâche.
  const previousRender = render;

  function renderDailyTodo() {
    const host = document.querySelector("#dailyTodoList");
    const count = document.querySelector("#dailyTodoCount");
    const percentLabel = document.querySelector("#dailyTodoPercent");
    const progress = document.querySelector("#dailyTodoProgress");
    if (!host || !count || !percentLabel || !progress) return;

    const key = today();
    const items = state.tasks
      .filter(task => task.date === key)
      .sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        const rank = { Haute: 0, Normale: 1, Basse: 2 };
        return (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1);
      });

    const total = items.length;
    const completed = items.filter(task => task.done).length;
    const percentage = total ? Math.round(completed / total * 100) : 0;

    count.textContent = `${completed} / ${total} tâche(s) terminée(s)`;
    percentLabel.textContent = `${percentage}%`;
    progress.style.width = `${percentage}%`;

    host.className = total ? "task-list" : "task-list empty-state";
    host.innerHTML = total
      ? items.map(taskHTML).join("")
      : "Aucune tâche prévue aujourd'hui. Utilise le bouton Ajouter pour commencer.";
  }

  render = function () {
    previousRender();
    renderDailyTodo();
  };

  // Premier affichage de la liste lorsque le script est chargé.
  // L'initialisation IndexedDB de app.js appellera ensuite render à nouveau.
  try { renderDailyTodo(); } catch (_) { /* app.js peut encore charger */ }
})();
