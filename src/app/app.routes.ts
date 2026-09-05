import { Routes } from '@angular/router';
import { adminGuard, lifecycleGuard, organizerGuard, workflowGuard } from './core/auth/role.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/home/home.component').then((module) => module.HomeComponent),
  },
  {
    path: 'events',
    canActivate: [lifecycleGuard],
    loadComponent: () =>
      import('./features/events/event-list.component').then((module) => module.EventListComponent),
  },
  {
    path: 'events/new',
    canActivate: [lifecycleGuard, organizerGuard],
    loadComponent: () =>
      import('./features/events/event-editor.component').then((module) => module.EventEditorComponent),
  },
  {
    path: 'events/:id/edit',
    canActivate: [lifecycleGuard, organizerGuard],
    loadComponent: () =>
      import('./features/events/event-editor.component').then((module) => module.EventEditorComponent),
  },
  {
    path: 'events/:id',
    canActivate: [lifecycleGuard],
    loadComponent: () =>
      import('./features/events/event-detail.component').then((module) => module.EventDetailComponent),
  },
  {
    path: 'applications/:id/form',
    loadComponent: () =>
      import('./features/applications/dynamic-permit-form.component').then(
        (module) => module.DynamicPermitFormComponent,
      ),
  },
  {
    path: 'tasks',
    canActivate: [workflowGuard],
    loadComponent: () =>
      import('./features/tasks/task-queue.component').then((module) => module.TaskQueueComponent),
  },
  {
    path: 'tasks/:id',
    canActivate: [workflowGuard],
    loadComponent: () =>
      import('./features/tasks/task-review.component').then((module) => module.TaskReviewComponent),
  },
  {
    path: 'search',
    loadComponent: () =>
      import('./features/search/permit-search.component').then(
        (module) => module.PermitSearchComponent,
      ),
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./features/admin/admin-shell.component').then((module) => module.AdminShellComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./features/admin/admin-dashboard.component').then(
            (module) => module.AdminDashboardComponent,
          ),
      },
      {
        path: 'permit-types',
        loadComponent: () =>
          import('./features/admin/permit-types/permit-type-list.component').then(
            (module) => module.PermitTypeListComponent,
          ),
      },
      {
        path: 'permit-types/new',
        loadComponent: () =>
          import('./features/admin/permit-types/permit-type-editor.component').then(
            (module) => module.PermitTypeEditorComponent,
          ),
      },
      {
        path: 'permit-types/:code/edit',
        loadComponent: () =>
          import('./features/admin/permit-types/permit-type-editor.component').then(
            (module) => module.PermitTypeEditorComponent,
          ),
      },
      {
        path: 'permit-types/:code/review/:publicationId',
        redirectTo: 'definition-reviews/:code/:publicationId',
      },
      {
        path: 'definition-reviews',
        loadComponent: () => import('./features/admin/permit-types/definition-publications.component').then(m => m.DefinitionPublicationsComponent),
      },
      {
        path: 'definition-versions',
        data: { view: 'versions' },
        loadComponent: () => import('./features/admin/permit-types/definition-publications.component').then(m => m.DefinitionPublicationsComponent),
      },
      {
        path: 'definition-reviews/:code/:publicationId',
        loadComponent: () =>
          import('./features/admin/permit-types/permit-type-review.component').then(
            (module) => module.PermitTypeReviewComponent,
          ),
      },
      {
        path: 'lookups',
        loadComponent: () =>
          import('./features/admin/lookups/lookup-list.component').then(
            (module) => module.LookupListComponent,
          ),
      },
      {
        path: 'lookups/new',
        loadComponent: () =>
          import('./features/admin/lookups/lookup-editor.component').then(
            (module) => module.LookupEditorComponent,
          ),
      },
      {
        path: 'lookups/:code/edit',
        loadComponent: () =>
          import('./features/admin/lookups/lookup-editor.component').then(
            (module) => module.LookupEditorComponent,
          ),
      },
      {
        path: 'workflows',
        loadComponent: () =>
          import('./features/admin/workflows/workflow-list.component').then(
            (module) => module.WorkflowListComponent,
          ),
      },
      {
        path: 'workflows/new',
        loadComponent: () =>
          import('./features/admin/workflows/workflow-editor.component').then(
            (module) => module.WorkflowEditorComponent,
          ),
      },
      {
        path: 'workflows/:code/edit',
        loadComponent: () =>
          import('./features/admin/workflows/workflow-editor.component').then(
            (module) => module.WorkflowEditorComponent,
          ),
      },
      {
        path: 'change-history',
        loadComponent: () =>
          import('./features/admin/change-history/change-history.component').then(
            (module) => module.ChangeHistoryComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
