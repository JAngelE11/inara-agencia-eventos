import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

// ⚠️ ESTA ES LA ÚNICA LÍNEA DE FIRESTORE QUE DEBE EXISTIR
import { Firestore, collection, getDocs, doc, deleteDoc } from '@angular/fire/firestore';
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

  async ngOnInit() {
    try {
      const citasRef = collection(this.firestore, 'reservas');
      const snapshot = await getDocs(citasRef);
      
      const data = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));

      // 1. Ordenar por fecha de registro
      const datosOrdenados = data.sort((a: any, b: any) => {
        const fechaA = a.fechaRegistro ? new Date(a.fechaRegistro).getTime() : 0;
        const fechaB = b.fechaRegistro ? new Date(b.fechaRegistro).getTime() : 0;
        return fechaB - fechaA;
      });

      // 2. Guardar y mostrar todas por defecto
      this.reservas = datosOrdenados;
      this.reservasFiltradas = [...this.reservas];
      this.totalCitas = this.reservas.length;

      // 3. Calcular estadísticas y dibujar el gráfico
      this.calcularEstadisticas();
      this.cargando = false;

      setTimeout(() => this.renderizarGrafico(), 200);

    } catch (error) {
      console.error("Error en inicialización:", error);
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
      this.reservasFiltradas = [...this.reservas];
    }
  }

  calcularEstadisticas() {
    Object.keys(this.statsEventos).forEach(key => this.statsEventos[key] = 0);
    this.reservas.forEach(reserva => {
      const tipo = reserva.tipoEvento;
      if (tipo && this.statsEventos[tipo] !== undefined) {
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

      const etiquetasActivas: string[] = [];
      const datosActivos: number[] = [];

      for (const [key, value] of Object.entries(this.statsEventos)) {
         if (value > 0) {
            etiquetasActivas.push(key);
            datosActivos.push(value);
         }
      }

      if (etiquetasActivas.length === 0) return;

      this.chart = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: etiquetasActivas,
          datasets: [{
            data: datosActivos,
            backgroundColor: ['#198754', '#20c997', '#0dcaf0', '#ffc107', '#fd7e14', '#dc3545', '#6f42c1', '#d63384', '#6c757d']
          }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
      });
    } catch (error) {
      console.error("Error creando el gráfico:", error);
    }
  }

  exportarAExcel() {
    try {
      if (this.reservasFiltradas.length === 0) {
        Swal.fire({ icon: 'info', title: 'Sin datos', text: 'No hay registros para exportar.' });
        return;
      }
      const headers = ['Codigo Reserva', 'Cliente', 'Correo', 'Celular', 'Tipo Evento', 'Modalidad', 'Fecha', 'Hora'];
      const filas = this.reservasFiltradas.map(r => [
        `"${r.codigoReserva || ''}"`, `"${r.nombre || ''} ${r.apellidos || ''}"`, `"${r.correo || ''}"`, `"${r.celular || ''}"`,
        `"${r.tipoEvento || ''}"`, `"${r.modalidad || ''}"`, `"${r.fechaAsignada || ''}"`, `"${r.horaAsignada || ''}"`
      ]);
      const contenidoCsv = [headers.join(';'), ...filas.map(e => e.join(';'))].join('\n');
      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), contenidoCsv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Reporte_Citas_INARA_${new Date().toISOString().slice(0,10)}.csv`;
      link.click();
    } catch (error) {
      console.error("Error exportando CSV:", error);
    }
  }

  async cancelarCita(id: string, nombre: string) {
    const result = await Swal.fire({ title: `¿Cancelar cita de ${nombre}?`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí', cancelButtonText: 'No' });
    if (result.isConfirmed) {
      try {
        await deleteDoc(doc(this.firestore, 'reservas', id));
        Swal.fire('Cancelada', '', 'success');
        this.ngOnInit(); 
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