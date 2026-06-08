import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Firestore, doc, getDoc, updateDoc } from '@angular/fire/firestore';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-cancelar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="container d-flex justify-content-center align-items-center" style="min-height: 80vh;">
      <div class="card shadow border-0 p-4 text-center" style="width: 100%; max-width: 500px; border-radius: 20px;">
        
        <div *ngIf="cargando">
          <div class="spinner-border text-danger" role="status"></div>
          <p class="mt-3 text-muted fw-bold">Buscando tu reserva...</p>
        </div>
        
        <div *ngIf="!cargando && !reserva">
          <h1 style="font-size: 3rem;">🔍</h1>
          <h3 class="text-danger fw-bold mt-2">Enlace Inválido</h3>
          <p class="text-muted">No hemos encontrado la reserva en el sistema o el enlace está corrupto.</p>
          <a routerLink="/inicio" class="btn btn-outline-dark mt-3 fw-bold w-100">Volver al Inicio</a>
        </div>

        <div *ngIf="!cargando && reserva && reserva.estado === 'Cancelada'">
          <h1 style="font-size: 3rem;">✔️</h1>
          <h3 class="text-secondary fw-bold mt-2">Ya Cancelada</h3>
          <p class="text-muted">Esta reserva ya se encuentra anulada en nuestro sistema.</p>
          <a routerLink="/inicio" class="btn btn-outline-dark mt-3 fw-bold w-100">Volver al Inicio</a>
        </div>

        <div *ngIf="!cargando && reserva && reserva.estado !== 'Cancelada'">
          <h3 class="text-danger fw-bold mb-3">¿Cancelar Reserva?</h3>
          <p class="text-muted mb-4 small">Estás a punto de cancelar tu asesoría. Esta acción liberará el horario de forma inmediata y <b>no se puede deshacer</b>.</p>
          
          <div class="bg-light p-3 rounded mb-4 text-start border">
            <p class="mb-1 small"><b>Cliente:</b> {{ reserva.nombre }} {{ reserva.apellidos }}</p>
            <p class="mb-1 small"><b>Evento:</b> {{ reserva.tipoEvento }}</p>
            <p class="mb-1 small text-success"><b>Fecha:</b> {{ reserva.fechaAsignada }}</p>
            <p class="mb-0 small text-success"><b>Hora:</b> {{ reserva.horaAsignada }}</p>
          </div>

          <div class="d-flex gap-2">
            <a routerLink="/inicio" class="btn btn-secondary w-50 fw-bold">No, mantener</a>
            <button class="btn btn-danger w-50 fw-bold shadow-sm" (click)="confirmarCancelacion()">Sí, Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class Cancelar implements OnInit {
  private route = inject(ActivatedRoute);
  private firestore = inject(Firestore);
  
  idReserva: string | null = null;
  reserva: any = null;
  cargando: boolean = true;

  ngOnInit() {
    // REQ 36: Lee el ID que viene en la URL desde el correo sin iniciar sesión
    this.idReserva = this.route.snapshot.queryParamMap.get('id');
    if (this.idReserva) {
      this.buscarReserva();
    } else {
      this.cargando = false;
    }
  }

  async buscarReserva() {
    try {
      const docRef = doc(this.firestore, 'reservas', this.idReserva!);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        this.reserva = docSnap.data();
      }
    } catch (e) { console.error(e); } finally { this.cargando = false; }
  }

  async confirmarCancelacion() {
    Swal.showLoading();
    try {
      const docRef = doc(this.firestore, 'reservas', this.idReserva!);
      // REQ 38 y 39: Se actualiza a Cancelada y el calendario del cliente ya filtra este estado para liberar horas
      await updateDoc(docRef, { estado: 'Cancelada' });
      this.reserva.estado = 'Cancelada';
      Swal.fire('¡Cancelada!', 'Tu reserva ha sido anulada exitosamente y el horario ha sido liberado.', 'success');
    } catch (error) {
      Swal.fire('Error', 'No pudimos procesar la cancelación. Contáctanos.', 'error');
    }
  }
}