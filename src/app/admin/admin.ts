import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, collectionData, doc, deleteDoc } from '@angular/fire/firestore';
import { Auth, signOut } from '@angular/fire/auth';
import Swal from 'sweetalert2';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './admin.html',
  styleUrl: './admin.css'
})
export class Admin implements OnInit {
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private router = inject(Router);

  cargando: boolean = true;
  reservas: any[] = [];
  reservasFiltradas: any[] = []; 
  totalCitas: number = 0;

  terminoBusqueda: string = '';
  filtroEvento: string = '';
  filtroFecha: string = 'todos';
  nombresMeses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  statsEventos: { [key: string]: number } = {
    'Matrimonio': 0, '15 Años': 0, '50 Años': 0, 'Cumplekids': 0,
    'Baby Shower': 0, 'Bautizo / Comunión': 0, 'Graduación': 0,
    'Evento Corporativo': 0, 'Otros eventos u cumpleaños': 0
  };

  chart: any;

  ngOnInit() {
    try {
      const citasRef = collection(this.firestore, 'reservas');
      collectionData(citasRef, { idField: 'id' }).subscribe({
        next: (data: any[]) => {
          this.reservas = data || [];
          this.reservasFiltradas = [...this.reservas];
          this.totalCitas = this.reservas.length;
          this.calcularEstadisticas();
          this.cargando = false;
          
          setTimeout(() => this.renderizarGrafico(), 150);
        },
        error: (err) => {
          console.error("Error cargando de Firebase:", err);
          this.cargando = false;
        }
      });
    } catch (error) {
      console.error("Error crítico en inicialización:", error);
      this.cargando = false;
    }
  }

  aplicarFiltros() {
    try {
      this.reservasFiltradas = this.reservas.filter(reserva => {
        const busquedaTotal = `${reserva.nombre || ''} ${reserva.apellidos || ''} ${reserva.codigoReserva || ''}`.toLowerCase();
        const cumpleBusqueda = this.terminoBusqueda === '' || busquedaTotal.includes(this.terminoBusqueda.toLowerCase());
        const cumpleEvento = this.filtroEvento === '' || reserva.tipoEvento === this.filtroEvento;
        
        let cumpleFecha = true;
        if (this.filtroFecha === 'mes' && reserva.fechaAsignada) {
          const mesActual = this.nombresMeses[new Date().getMonth()];
          cumpleFecha = reserva.fechaAsignada.toLowerCase().includes(mesActual);
        }
        
        return cumpleBusqueda && cumpleEvento && cumpleFecha;
      });
    } catch (error) {
      console.error("Error al filtrar:", error);
      this.reservasFiltradas = [...this.reservas]; // Si falla el filtro, muestra todo
    }
  }

  calcularEstadisticas() {
    Object.keys(this.statsEventos).forEach(key => this.statsEventos[key] = 0);
    this.reservas.forEach(reserva => {
      const tipo = reserva.tipoEvento;
      if (this.statsEventos[tipo] !== undefined) {
        this.statsEventos[tipo]++;
      } else {
        this.statsEventos['Otros eventos u cumpleaños']++;
      }
    });
  }

  calcularPorcentaje(cantidad: number): number {
    return this.totalCitas === 0 ? 0 : Math.round((cantidad / this.totalCitas) * 100);
  }

  renderizarGrafico() {
    try {
      const canvas = document.getElementById('graficoEventos') as HTMLCanvasElement;
      if (!canvas) return;
      if (this.chart) this.chart.destroy();
      this.chart = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: Object.keys(this.statsEventos),
          datasets: [{ data: Object.values(this.statsEventos), backgroundColor: ['#198754', '#20c997', '#0dcaf0', '#ffc107', '#fd7e14', '#dc3545', '#6f42c1', '#d63384', '#6c757d'] }]
        }
      });
    } catch (error) {
      console.error("Error creando el gráfico:", error);
    }
  }

  async cancelarCita(id: string, nombre: string) {
    const result = await Swal.fire({ title: `¿Cancelar cita?`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí', cancelButtonText: 'No' });
    if (result.isConfirmed) {
      try { 
        await deleteDoc(doc(this.firestore, 'reservas', id)); 
        Swal.fire('Cancelada', '', 'success'); 
      } catch (e) { 
        Swal.fire('Error', '', 'error'); 
      }
    }
  }

  async cerrarSesion() { 
    await signOut(this.auth); 
    this.router.navigate(['/login']); 
  }
}