import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

// ✅ Agregamos addDoc y updateDoc
import { Firestore, collection, getDocs, doc, deleteDoc, addDoc, updateDoc } from '@angular/fire/firestore';
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
  private cdr = inject(ChangeDetectorRef);

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

      this.reservas = data.sort((a: any, b: any) => {
        const fechaA = a.fechaRegistro ? new Date(a.fechaRegistro).getTime() : 0;
        const fechaB = b.fechaRegistro ? new Date(b.fechaRegistro).getTime() : 0;
        return fechaB - fechaA;
      });

      this.reservasFiltradas = [...this.reservas];
      this.totalCitas = this.reservas.length;
      this.calcularEstadisticas();
      this.cargando = false;
      this.cdr.detectChanges();
      setTimeout(() => this.renderizarGrafico(), 200);
    } catch (error) {
      console.error("Error en inicialización:", error);
      this.cargando = false;
    }
  }

  // ✅ 1. CREAR CITA MANUALMENTE
  async crearCitaAdmin() {
    const { value: formValues } = await Swal.fire({
      title: 'Nueva Reserva Manual',
      html: `
        <input id="swal-nombre" class="swal2-input" placeholder="Nombre">
        <input id="swal-apellidos" class="swal2-input" placeholder="Apellidos">
        <input id="swal-celular" class="swal2-input" placeholder="Celular">
        <input id="swal-fecha" type="date" class="swal2-input">
        <input id="swal-hora" type="time" class="swal2-input">
      `,
      preConfirm: () => {
        return {
          nombre: (document.getElementById('swal-nombre') as HTMLInputElement).value,
          apellidos: (document.getElementById('swal-apellidos') as HTMLInputElement).value,
          celular: (document.getElementById('swal-celular') as HTMLInputElement).value,
          fechaAsignada: (document.getElementById('swal-fecha') as HTMLInputElement).value,
          horaAsignada: (document.getElementById('swal-hora') as HTMLInputElement).value,
          tipoEvento: 'Otros eventos u cumpleaños',
          modalidad: 'Presencial',
          fechaRegistro: new Date().toISOString(),
          codigoReserva: 'MAN-' + Math.floor(Math.random() * 9999)
        }
      }
    });

    if (formValues) {
      try {
        await addDoc(collection(this.firestore, 'reservas'), formValues);
        Swal.fire('¡Éxito!', 'Reserva creada.', 'success');
        this.ngOnInit();
      } catch (e) { Swal.fire('Error', 'No se pudo crear.', 'error'); }
    }
  }

  // ✅ 2. REPROGRAMAR CITA
  async reprogramarCita(reserva: any) {
    const { value: formValues } = await Swal.fire({
      title: 'Reprogramar Cita',
      html: `
        <label>Nueva Fecha:</label>
        <input id="swal-fecha" type="date" class="swal2-input" value="${reserva.fechaAsignada || ''}">
        <label>Nueva Hora:</label>
        <input id="swal-hora" type="time" class="swal2-input" value="${reserva.horaAsignada || ''}">
      `,
      preConfirm: () => {
        return {
          fechaAsignada: (document.getElementById('swal-fecha') as HTMLInputElement).value,
          horaAsignada: (document.getElementById('swal-hora') as HTMLInputElement).value
        }
      }
    });

    if (formValues && formValues.fechaAsignada) {
      try {
        const docRef = doc(this.firestore, 'reservas', reserva.id);
        await updateDoc(docRef, formValues);
        Swal.fire('¡Actualizado!', 'Cita reprogramada.', 'success');
        this.ngOnInit();
      } catch (e) { Swal.fire('Error', 'No se pudo actualizar.', 'error'); }
    }
  }

  aplicarFiltros() {
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
    this.cdr.detectChanges();
  }

  calcularEstadisticas() {
    Object.keys(this.statsEventos).forEach(key => this.statsEventos[key] = 0);
    this.reservas.forEach(reserva => {
      const tipo = reserva.tipoEvento;
      if (tipo && this.statsEventos[tipo] !== undefined) this.statsEventos[tipo]++;
      else this.statsEventos['Otros eventos u cumpleaños']++;
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
         if (value > 0) { etiquetasActivas.push(key); datosActivos.push(value); }
      }
      if (etiquetasActivas.length === 0) return;
      this.chart = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: etiquetasActivas,
          datasets: [{ data: datosActivos, backgroundColor: ['#198754', '#20c997', '#0dcaf0', '#ffc107', '#fd7e14', '#dc3545', '#6f42c1', '#d63384', '#6c757d'] }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
      });
    } catch (error) { console.error("Error gráfico:", error); }
  }

  exportarAExcel() {
    if (this.reservasFiltradas.length === 0) { Swal.fire({ icon: 'info', title: 'Sin datos', text: 'No hay registros.' }); return; }
    const headers = ['Codigo', 'Cliente', 'Fecha', 'Hora'];
    const filas = this.reservasFiltradas.map(r => [`"${r.codigoReserva || ''}"`, `"${r.nombre} ${r.apellidos}"`, `"${r.fechaAsignada}"`, `"${r.horaAsignada}"`]);
    const contenidoCsv = [headers.join(';'), ...filas.map(e => e.join(';'))].join('\n');
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), contenidoCsv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Reporte_INARA.csv`;
    link.click();
  }

  async cancelarCita(id: string, nombre: string) {
    const result = await Swal.fire({ title: `¿Cancelar cita de ${nombre}?`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí' });
    if (result.isConfirmed) {
      try { await deleteDoc(doc(this.firestore, 'reservas', id)); Swal.fire('Cancelada', '', 'success'); this.ngOnInit(); }
      catch (e) { Swal.fire('Error', '', 'error'); }
    }
  }

  async cerrarSesion() { await signOut(this.auth); this.router.navigate(['/login']); }
}