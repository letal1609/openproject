const STORAGE_KEY = "projectflow-state";

const seedState = {
  projects: [
    {
      id: crypto.randomUUID(),
      name: "Lancement CRM",
      owner: "Camille",
      dueDate: "2026-06-18"
    },
    {
      id: crypto.randomUUID(),
      name: "Refonte portail client",
      owner: "Nora",
      dueDate: "2026-07-05"
    },
    {
      id: crypto.randomUUID(),
      name: "Automatisation reporting",
      owner: "Yanis",
      dueDate: "2026-06-28"
    }
  ],
  tasks: []
};

seedState.tasks = [
  {
    id: crypto.randomUUID(),
    projectId: seedState.projects[0].id,
    title: "Valider le périmètre fonctionnel",
    priority: "Haute",
    done: false
  },
  {
    id: crypto.randomUUID(),
    projectId: seedState.projects[0].id,
    title: "Préparer la migration des contacts",
    priority: "Moyenne",
    done: true
  },
  {
    id: crypto.randomUUID(),
    projectId: seedState.projects[1].id,
    title: "Créer les maquettes de navigation",
    priority: "Haute",
    done: false
  },
  {
    id: crypto.randomUUID(),
    projectId: seedState.projects[2].id,
    title: "Lister les sources de données",
    priority: "Basse",
    done: false
  }
];

let state = loadState();
let activeFilter = "all";

const elements = {
  activeProjectsCount: document.querySelector("#activeProjectsCount"),
  openTasksCount: document.querySelector("#openTasksCount"),
  averageProgress: document.querySelector("#averageProgress"),
  highPriorityCount: document.querySelector("#highPriorityCount"),
  projectList: document.querySelector("#projectList"),
  projectFilter: document.querySelector("#projectFilter"),
  taskProject: document.querySelector("#taskProject"),
  taskList: document.querySelector("#taskList"),
  taskForm: document.querySelector("#taskForm"),
  taskTitle: document.querySelector("#taskTitle"),
  taskPriority: document.querySelector("#taskPriority"),
  timeline: document.querySelector("#timeline"),
  projectModal: document.querySelector("#projectModal"),
  projectForm: document.querySelector("#projectForm"),
  projectName: document.querySelector("#projectName"),
  projectOwner: document.querySelector("#projectOwner"),
  projectDueDate: document.querySelector("#projectDueDate")
};

function loadState() {
  const savedState = localStorage.getItem(STORAGE_KEY);

  if (!savedState) {
    return seedState;
  }

  return JSON.parse(savedState);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${dateString}T12:00:00`));
}

function getProjectTasks(projectId) {
  return state.tasks.filter((task) => task.projectId === projectId);
}

function getProjectProgress(projectId) {
  const tasks = getProjectTasks(projectId);

  if (tasks.length === 0) {
    return 0;
  }

  const completedTasks = tasks.filter((task) => task.done).length;
  return Math.round((completedTasks / tasks.length) * 100);
}

function findProject(projectId) {
  return state.projects.find((project) => project.id === projectId);
}

function renderStats() {
  const openTasks = state.tasks.filter((task) => !task.done);
  const highPriorityOpenTasks = openTasks.filter((task) => task.priority === "Haute");
  const progressValues = state.projects.map((project) => getProjectProgress(project.id));
  const averageProgress = progressValues.length
    ? Math.round(progressValues.reduce((total, progress) => total + progress, 0) / progressValues.length)
    : 0;

  elements.activeProjectsCount.textContent = state.projects.length;
  elements.openTasksCount.textContent = openTasks.length;
  elements.averageProgress.textContent = `${averageProgress}%`;
  elements.highPriorityCount.textContent = highPriorityOpenTasks.length;
}

function renderProjectOptions() {
  const options = state.projects
    .map((project) => `<option value="${project.id}">${project.name}</option>`)
    .join("");

  elements.taskProject.innerHTML = options;
  elements.projectFilter.innerHTML = `<option value="all">Tous les projets</option>${options}`;
  elements.projectFilter.value = activeFilter;
}

function renderProjects() {
  if (state.projects.length === 0) {
    elements.projectList.innerHTML = `<p class="empty-state">Aucun projet pour le moment.</p>`;
    return;
  }

  elements.projectList.innerHTML = state.projects
    .map((project) => {
      const tasks = getProjectTasks(project.id);
      const progress = getProjectProgress(project.id);

      return `
        <article class="project-card">
          <div class="project-card__top">
            <div>
              <h3>${project.name}</h3>
              <p class="project-card__meta">Responsable : ${project.owner} · ${tasks.length} tâche(s)</p>
            </div>
            <strong>${progress}%</strong>
          </div>
          <div class="progress" aria-label="Avancement ${progress}%">
            <span style="width: ${progress}%"></span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderTasks() {
  const tasks = activeFilter === "all"
    ? state.tasks
    : state.tasks.filter((task) => task.projectId === activeFilter);

  if (tasks.length === 0) {
    elements.taskList.innerHTML = `<p class="empty-state">Aucune tâche dans cette sélection.</p>`;
    return;
  }

  elements.taskList.innerHTML = tasks
    .map((task) => {
      const project = findProject(task.projectId);
      const priorityClass = task.priority.toLowerCase();
      const doneClass = task.done ? " task-card--done" : "";

      return `
        <article class="task-card${doneClass}">
          <label>
            <input type="checkbox" data-task-id="${task.id}" ${task.done ? "checked" : ""} />
            <span>
              <h3>${task.title}</h3>
              <p class="task-card__meta">${project?.name ?? "Projet supprimé"}</p>
            </span>
          </label>
          <span class="priority priority--${priorityClass}">${task.priority}</span>
        </article>
      `;
    })
    .join("");
}

function renderTimeline() {
  const projectsByDueDate = [...state.projects].sort((first, second) => new Date(first.dueDate) - new Date(second.dueDate));

  if (projectsByDueDate.length === 0) {
    elements.timeline.innerHTML = `<p class="empty-state">Ajoute un projet pour afficher le planning.</p>`;
    return;
  }

  elements.timeline.innerHTML = projectsByDueDate
    .map((project) => `
      <article class="timeline__item">
        <span class="timeline__date">${formatDate(project.dueDate)}</span>
        <strong>${project.name}</strong>
        <span>${getProjectProgress(project.id)}%</span>
      </article>
    `)
    .join("");
}

function render() {
  renderStats();
  renderProjectOptions();
  renderProjects();
  renderTasks();
  renderTimeline();
}

function addProject(event) {
  event.preventDefault();

  const project = {
    id: crypto.randomUUID(),
    name: elements.projectName.value.trim(),
    owner: elements.projectOwner.value.trim(),
    dueDate: elements.projectDueDate.value
  };

  state.projects.push(project);
  saveState();
  elements.projectForm.reset();
  elements.projectModal.close();
  render();
}

function addTask(event) {
  event.preventDefault();

  state.tasks.unshift({
    id: crypto.randomUUID(),
    projectId: elements.taskProject.value,
    title: elements.taskTitle.value.trim(),
    priority: elements.taskPriority.value,
    done: false
  });

  saveState();
  elements.taskForm.reset();
  render();
}

function toggleTask(taskId) {
  state.tasks = state.tasks.map((task) => task.id === taskId ? { ...task, done: !task.done } : task);
  saveState();
  render();
}

function openProjectForm() {
  const today = new Date().toISOString().slice(0, 10);
  elements.projectDueDate.min = today;
  elements.projectDueDate.value = today;
  elements.projectModal.showModal();
}

for (const button of [document.querySelector("#openProjectForm"), document.querySelector("#addProjectInline")]) {
  button.addEventListener("click", openProjectForm);
}

document.querySelector("#closeProjectForm").addEventListener("click", () => elements.projectModal.close());

elements.projectFilter.addEventListener("change", (event) => {
  activeFilter = event.target.value;
  renderTasks();
});

elements.taskList.addEventListener("change", (event) => {
  if (event.target.matches("[data-task-id]")) {
    toggleTask(event.target.dataset.taskId);
  }
});

elements.taskForm.addEventListener("submit", addTask);
elements.projectForm.addEventListener("submit", addProject);

render();
