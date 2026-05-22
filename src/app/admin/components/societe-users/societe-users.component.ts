import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SocieteService } from '../../services/societe.service';
import { RoleSociete, UserSociete } from '../../services/user-societe.model';
import { UserSocieteService } from '../../services/user-societe.service';

@Component({
  selector: 'app-societe-users',
  templateUrl: './societe-users.component.html',
  styleUrls: ['./societe-users.component.css']
})
export class SocieteUsersComponent implements OnInit {

  societeId: number | null = null;
  societeName = 'Société';
  users: UserSociete[] = [];
  loading = false;
  errorMessage: string | null = null;

  showFormModal = false;
  editing: UserSociete | null = null;
  form: FormGroup;

  roles = [
    { value: 0 as RoleSociete, label: 'Direction générale' },
    { value: 1 as RoleSociete, label: 'Comptable' }
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private userService: UserSocieteService,
    private societeService: SocieteService
  ) {
    this.form = this.fb.group({
      nom: ['', Validators.required],
      prenom: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      telephone: [''],
      adresse: [''],
      password: [''],
      active: [true],
      role: [1 as RoleSociete]
    });
  }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id || Number.isNaN(id)) {
      this.router.navigate(['/admin/societes']);
      return;
    }
    this.societeId = id;
    this.loadSociete(id);
    this.loadUsers(id);
  }

  get modalTitle(): string {
    return this.editing ? 'Modifier utilisateur' : 'Ajouter utilisateur';
  }

  loadSociete(id: number): void {
    this.societeService.getById(id).subscribe({
      next: (s) => (this.societeName = s.nom ?? 'Société'),
      error: () => (this.societeName = 'Société')
    });
  }

  loadUsers(societeId: number): void {
    this.loading = true;
    this.errorMessage = null;

    this.userService.getAll().subscribe({
      next: (list) => {
        this.users = (list ?? []).filter((u) => u.societeId === societeId);
        this.loading = false;
      },
      error: () => {
        this.users = [];
        this.loading = false;
        this.errorMessage = 'Impossible de charger les utilisateurs.';
      }
    });
  }

  getRoleLabel(role: RoleSociete): string {
    return role === 0 ? 'Direction générale' : 'Comptable';
  }

  openCreate(): void {
    this.editing = null;
    this.form.reset({ active: true, role: 1 });
    this.form.get('password')?.setValidators([Validators.required, Validators.minLength(4)]);
    this.form.get('password')?.updateValueAndValidity();
    this.showFormModal = true;
  }

  openEdit(user: UserSociete): void {
    this.editing = user;
    this.form.patchValue({
      nom: user.nom ?? '',
      prenom: user.prenom ?? '',
      email: user.email ?? '',
      telephone: user.telephone ?? '',
      adresse: user.adresse ?? '',
      password: '',
      active: user.active,
      role: user.role ?? 1
    });
    this.form.get('password')?.clearValidators();
    this.form.get('password')?.updateValueAndValidity();
    this.showFormModal = true;
  }

  closeFormModal(): void {
    this.showFormModal = false;
    this.editing = null;
  }

  save(): void {
    if (this.form.invalid || !this.societeId) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: UserSociete = {
      societeId: this.societeId,
      nom: raw.nom.trim(),
      prenom: raw.prenom.trim(),
      email: raw.email.trim(),
      telephone: raw.telephone?.trim() || undefined,
      adresse: raw.adresse?.trim() || undefined,
      password: raw.password?.trim() || undefined,
      active: !!raw.active,
      role: raw.role as RoleSociete,
      dateAffectation: new Date().toISOString()
    };

    if (this.editing?.id) {
      const updatePayload: UserSociete = { ...this.editing, ...payload };
      if (!raw.password?.trim()) {
        delete updatePayload.password;
      }
      this.userService.update(this.editing.id, updatePayload).subscribe({
        next: () => {
          this.loadUsers(this.societeId!);
          this.closeFormModal();
        },
        error: () => (this.errorMessage = 'Erreur lors de la modification.')
      });
      return;
    }

    this.userService.create(payload).subscribe({
      next: () => {
        this.loadUsers(this.societeId!);
        this.closeFormModal();
      },
      error: () => (this.errorMessage = 'Erreur lors de la création.')
    });
  }

  remove(user: UserSociete): void {
    if (!user.id || !this.societeId) {
      return;
    }
    if (!confirm(`Supprimer ${user.prenom} ${user.nom} ?`)) {
      return;
    }

    this.userService.delete(user.id).subscribe({
      next: () => this.loadUsers(this.societeId!),
      error: () => (this.errorMessage = 'Erreur lors de la suppression.')
    });
  }

  isInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!(control && control.invalid && control.touched);
  }
}
