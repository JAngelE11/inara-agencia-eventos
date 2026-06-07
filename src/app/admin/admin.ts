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

  // ✅ Lista de meses necesaria para el filtro
  nombresMeses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  statsEventos: { [key: string]: number } = {
    'Matrimonio': 0, '15 Años': 0, '50 Años': 0, 'Cumplekids': 0,
    'Baby Shower': 0, 'Bautizo / Comunión': 0, 'Graduación': 0,
    'Evento Corporativo': 0, 'Otros eventos u cumpleaños': 0
  };

  chart: any;

  ngOnInit() {
    const citasRef = collection(this.firestore, 'reservas');
    collectionData(citasRef, { idField: 'id' }).subscribe({
      next: (data: any[]) => {
        this.reservas = data;
        this.totalCitas = data.length;
        this.calcularEstadisticas();
        this.aplicarFiltros(); 
        this.cargando = false;
        
        setTimeout(() => this.renderizarGrafico(), 100);
      },
      error: (err) => {
        console.error(err);
        this.cargando = false;
      }
    });
  }

  calcularEstadisticas() {
    // Resetear stats
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
    if (this.totalCitas === 0) return 0;
    return Math.round((cantidad / this.totalCitas) * 100);
  }

  renderizarGrafico() {
    const canvas = document.getElementById('graficoEventos') as HTMLCanvasElement;
    if (!canvas) return;
    if (this.chart) this.chart.destroy();

    this.chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: Object.keys(this.statsEventos),
        datasets: [{
          data: Object.values(this.statsEventos),
          backgroundColor: ['#198754', '#20c997', '#0dcaf0', '#ffc107', '#fd7e14', '#dc3545', '#6f42c1', '#d63384', '#6c757d'],
          borderWidth: 2
        }]
      },
      options: { responsive: true, plugins: { legend: { display: false } } }
    });
  }

  aplicarFiltros() {
    this.reservasFiltradas = this.reservas.filter(reserva => {
      // Búsqueda segura (protegida contra valores null)
      const nombre = `${reserva.nombre || ''} ${reserva.apellidos || ''}`.toLowerCase();
      const codigo = (reserva.codigoReserva || '').toLowerCase();
      const busquedaTotal = `${nombre} ${codigo} ${reserva.id || ''}`.toLowerCase();
      
      const cumpleBusqueda = this.terminoBusqueda === '' || busquedaTotal.includes(this.terminoBusqueda.toLowerCase());
      const cumpleEvento = this.filtroEvento === '' || reserva.tipoEvento === this.filtroEvento;
      
      // Filtro de fecha seguro
      let cumpleFecha = true;
      if (this.filtroFecha !== 'todos' && reserva.fechaAsignada) {
        const hoy = new Date();
        const mesActualNombre = this.nombresMeses[hoy.getMonth()];
        
        if (this.filtroFecha === 'mes') {
            cumpleFecha = reserva.fechaAsignada.toLowerCase().includes(mesActualNombre);
        }
      }
      
      return cumpleBusqueda && cumpleEvento && cumpleFecha;
    });
  }

  exportarAExcel() {
    if (this.reservasFiltradas.length === 0) {
      Swal.fire({ icon: 'info', title: 'Sin datos', text: 'No hay registros para exportar.' });
      return;
    }
    const headers = ['ID Reserva', 'Cliente', 'Correo', 'Celular', 'Tipo Evento', 'Modalidad', 'Fecha', 'Hora'];
    const filas = this.reservasFiltradas.map(r => [
      `"${r.codigoReserva || ''}"`, `"${r.nombre} ${r.apellidos}"`, `"${r.correo || ''}"`, `"${r.celular || ''}"`,
      `"${r.tipoEvento || ''}"`, `"${r.modalidad || ''}"`, `"${r.fechaAsignada || ''}"`, `"${r.horaAsignada || ''}"`
    ]);
    const contenidoCsv = [headers.join(';'), ...filas.map(e => e.join(';'))].join('\n');
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), contenidoCsv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Reporte_Citas_INARA_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  }

  async cancelarCita(id: string, nombre: string) {
    const result = await Swal.fire({
      title: `¿Cancelar cita de ${nombre}?`,
      text: "Esta acción liberará el horario permanentemente.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonText: 'Volver',
      confirmButtonText: 'Sí, cancelar'
    });
    if (result.isConfirmed) {
      try {
        await deleteDoc(doc(this.firestore, 'reservas', id));
        Swal.fire('¡Cancelada!', 'La reserva fue eliminada.', 'success');
      } catch (error) {
        Swal.fire('Error', 'No se pudo cancelar la cita.', 'error');
      }
    }
  }

  async cerrarSesion() {
    await signOut(this.auth);
    this.router.navigate(['/login']);
  }
}