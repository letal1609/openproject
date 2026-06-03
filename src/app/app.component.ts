import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

type Priority = 'Haute' | 'Moyenne' | 'Basse';

interface Project {
  id: string;
  name: string;
  owner: string;
  dueDate: string;
}

interface Task {
  id: string;
  projectId: string;
  title: string;
  priority: Priority;
  done: boolean;
}

interface ProjectFlowState {
  projects: Project[];
  tasks: Task[];
}

interface ProjectFormModel {
  name: string;
  owner: string;
  dueDate: string;
}

interface TaskFormModel {
  title: string;
  projectId: string;
  priority: Priority;
}

const STORAGE_KEY = 'projectflow-state';

function createSeedState(): ProjectFlowState {
  const projects: Project[] = [
    {
      id: crypto.randomUUID(),
      name: 'Lancement CRM',
      owner: 'Camille',
      dueDate: '2026-06-18'
    },
    {
      id: crypto.randomUUID(),
      name: 'Refonte portail client',
      owner: 'Nora',
      dueDate: '2026-07-05'
    },
    {
      id: crypto.randomUUID(),
      name: 'Automatisation reporting',
      owner: 'Yanis',
      dueDate: '2026-06-28'
    }
  ];

  return {
    projects,
    tasks: [
      {
        id: crypto.randomUUID(),
        projectId: projects[0].id,
        title: 'Valider le périmètre fonctionnel',
        priority: 'Haute',
        done: false
      },
      {
        id: crypto.randomUUID(),
        projectId: projects[0].id,
        title: 'Préparer la migration des contacts',
        priority: 'Moyenne',
        done: true
      },
      {
        id: crypto.randomUUID(),
        projectId: projects[1].id,
        title: 'Créer les maquettes de navigation',
        priority: 'Haute',
        done: false
      },
      {
        id: crypto.randomUUID(),
        projectId: projects[2].id,
        title: 'Lister les sources de données',
        priority: 'Basse',
        done: false
      }
    ]
  };
}

function loadState(): ProjectFlowState {
  const savedState = localStorage.getItem(STORAGE_KEY);

  if (!savedState) {
    return createSeedState();
  }

  return JSON.parse(savedState) as ProjectFlowState;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html'
})
export class AppComponent {
  readonly state = signal<ProjectFlowState>(loadState());
  readonly activeFilter = signal('all');
  readonly isProjectModalOpen = signal(false);
  readonly today = new Date().toISOString().slice(0, 10);

  readonly projectForm: ProjectFormModel = {
    name: '',
    owner: '',
    dueDate: this.today
  };

  readonly taskForm: TaskFormModel = {
    title: '',
    projectId: this.state().projects[0]?.id ?? '',
    priority: 'Moyenne'
  };

  readonly projects = computed(() => this.state().projects);
  readonly tasks = computed(() => this.state().tasks);

  readonly openTasksCount = computed(() => this.tasks().filter((task) => !task.done).length);
  readonly highPriorityCount = computed(() => this.tasks().filter((task) => !task.done && task.priority === 'Haute').length);

  readonly averageProgress = computed(() => {
    const progressValues = this.projects().map((project) => this.getProjectProgress(project.id));

    return progressValues.length
      ? Math.round(progressValues.reduce((total, progress) => total + progress, 0) / progressValues.length)
      : 0;
  });

  readonly filteredTasks = computed(() => {
    const filter = this.activeFilter();

    return filter === 'all'
      ? this.tasks()
      : this.tasks().filter((task) => task.projectId === filter);
  });

  readonly projectsByDueDate = computed(() =>
    [...this.projects()].sort((first, second) => new Date(first.dueDate).getTime() - new Date(second.dueDate).getTime())
  );

  addProject(): void {
    const project: Project = {
      id: crypto.randomUUID(),
      name: this.projectForm.name.trim(),
      owner: this.projectForm.owner.trim(),
      dueDate: this.projectForm.dueDate
    };

    if (!project.name || !project.owner || !project.dueDate) {
      return;
    }

    this.updateState((state) => ({
      ...state,
      projects: [...state.projects, project]
    }));
    this.taskForm.projectId ||= project.id;
    this.closeProjectForm();
  }

  addTask(): void {
    const title = this.taskForm.title.trim();

    if (!title || !this.taskForm.projectId) {
      return;
    }

    this.updateState((state) => ({
      ...state,
      tasks: [
        {
          id: crypto.randomUUID(),
          projectId: this.taskForm.projectId,
          title,
          priority: this.taskForm.priority,
          done: false
        },
        ...state.tasks
      ]
    }));
    this.taskForm.title = '';
    this.taskForm.priority = 'Moyenne';
  }

  closeProjectForm(): void {
    this.isProjectModalOpen.set(false);
    this.projectForm.name = '';
    this.projectForm.owner = '';
    this.projectForm.dueDate = this.today;
  }

  findProject(projectId: string): Project | undefined {
    return this.projects().find((project) => project.id === projectId);
  }

  formatDate(dateString: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(new Date(`${dateString}T12:00:00`));
  }

  getProjectProgress(projectId: string): number {
    const tasks = this.getProjectTasks(projectId);

    if (tasks.length === 0) {
      return 0;
    }

    const completedTasks = tasks.filter((task) => task.done).length;
    return Math.round((completedTasks / tasks.length) * 100);
  }

  getProjectTasks(projectId: string): Task[] {
    return this.tasks().filter((task) => task.projectId === projectId);
  }

  openProjectForm(): void {
    this.projectForm.dueDate = this.today;
    this.isProjectModalOpen.set(true);
  }

  priorityClass(priority: Priority): string {
    const classes: Record<Priority, string> = {
      Haute: 'bg-red-50 text-red-600 ring-red-100',
      Moyenne: 'bg-amber-50 text-amber-600 ring-amber-100',
      Basse: 'bg-emerald-50 text-emerald-600 ring-emerald-100'
    };

    return classes[priority];
  }

  setFilter(filter: string): void {
    this.activeFilter.set(filter);
  }

  toggleTask(taskId: string): void {
    this.updateState((state) => ({
      ...state,
      tasks: state.tasks.map((task) => task.id === taskId ? { ...task, done: !task.done } : task)
    }));
  }

  private saveState(state: ProjectFlowState): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  private updateState(projector: (state: ProjectFlowState) => ProjectFlowState): void {
    this.state.update((state) => {
      const nextState = projector(state);
      this.saveState(nextState);
      return nextState;
    });
  }
}
