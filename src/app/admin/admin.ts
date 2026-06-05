import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Firestore, collection, getDocs, doc, deleteDoc } from '@angular/fire/firestore';
import { Auth, signOut } from '@angular/fire/auth';
import Swal from 'sweetalert2'; // ✅ SWEETALERT IMPORTADO

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin.html',
  styleUrl: './admin.css'
})
export class Admin implements OnInit {
  private firestore = inject(Firestore);
  private router = inject(Router);
  private auth = inject(Auth);
  private cdr = inject(ChangeDetectorRef);

  reservas: any[] = [];
  cargando: boolean = true;

  totalCitas: number = 0;
  
  statsEventos: any = {
    'Matrimonio': 0, '15 Años': 0, '50 Años': 0, 'Cumplekids': 0,
    'Baby Shower': 0, 'Bautizo / Comunión': 0, 'Graduación': 0,
    'Evento Corporativo': 0, 'Otros eventos u cumpleaños': 0
  };

  ngOnInit() {
    this.cargarReservas();
  }

  async cargarReservas() {
    this.cargando = true;
    this.cdr.detectChanges();

    try {
      const reservasRef = collection(this.firestore, 'reservas');
      const querySnapshot = await getDocs(reservasRef);
      this.reservas = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      this.calcularEstadisticas();
    } catch (error) {
      console.error("Error al cargar reservas:", error);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  calcularEstadisticas() {
    this.totalCitas = this.reservas.length;
    this.statsEventos = { 
      'Matrimonio': 0, '15 Años': 0, '50 Años': 0, 'Cumplekids': 0, 
      'Baby Shower': 0, 'Bautizo / Comunión': 0, 'Graduación': 0, 
      'Evento Corporativo': 0, 'Otros eventos u cumpleaños': 0 
    };

    this.reservas.forEach(reserva => {
      let tipo = reserva.tipoEvento;
      if (!tipo || tipo === 'Otros') tipo = 'Otros eventos u cumpleaños';

      if (this.statsEventos[tipo] !== undefined) {
        this.statsEventos[tipo]++;
      } else {
        this.statsEventos['Otros eventos u cumpleaños']++;
      }
    });
  }

  calcularPorcentaje(cantidad: number): number {
    if (this.totalCitas === 0) return 0;
    return Math.round((cantidad / this.totalCitas) * 100);
  }

  // ✅ CONFIRMACIÓN BONITA PARA ELIMINAR CITA
  async cancelarCita(idReserva: string, nombreCliente: string) {
    Swal.fire({
      title: '¿Cancelar esta cita?',
      text: `Estás a punto de eliminar la reserva de ${nombreCliente}. Esta acción liberará la hora en el calendario.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545', // Rojo peligro
      cancelButtonColor: '#6c757d', // Gris neutral
      confirmButtonText: 'Sí, cancelar cita',
      cancelButtonText: 'No, mantenerla'
    }).then(async (result) => {
      if (result.isConfirmed) {
        
        // Alerta de carga
        Swal.fire({
          title: 'Eliminando...',
          allowOutsideClick: false,
          didOpen: () => { Swal.showLoading(); }
        });

        try {
          await deleteDoc(doc(this.firestore, 'reservas', idReserva));
          
          Swal.fire({
            icon: 'success',
            title: '¡Cancelada!',
            text: 'La cita ha sido eliminada y el horario está libre de nuevo.',
            confirmButtonColor: '#198754'
          });
          
          this.cargarReservas();
        } catch (error) {
          console.error("Error al eliminar:", error);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Hubo un problema al intentar cancelar la cita.',
            confirmButtonColor: '#198754'
          });
        }
      }
    });
  }

  async cerrarSesion() {
    await signOut(this.auth);
    this.router.navigate(['/inicio']);
  }
}