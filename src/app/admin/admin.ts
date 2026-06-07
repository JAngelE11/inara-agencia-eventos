import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, getDocs, doc, deleteDoc, addDoc, updateDoc, query, where } from '@angular/fire/firestore';
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
    await this.cargarDatos();
  }

  async cargarDatos() {
    try {
      this.cargando = true;
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
      console.error("Error cargando datos:", error);
      this.cargando = false;
    }
  }

  // ==========================================
  // LOGICA MEJORADA: CREAR CITA PARA CLIENTE
  // ==========================================
  async crearCitaAdmin() {
    const { value: formValues } = await Swal.fire({
      title: '<h3 class="fw-bold" style="color: #198754;">Nueva Reserva Manual</h3>',
      html: `
        <div class="text-start px-3">
          <label class="small fw-bold text-muted">Datos del Cliente</label>
          <input id="swal-nombre" class="swal2-input m-0 w-100 mb-2" style="font-size: 1rem;" placeholder="Nombres">
          <input id="swal-apellidos" class="swal2-input m-0 w-100 mb-2" style="font-size: 1rem;" placeholder="Apellidos">
          <input id="swal-celular" class="swal2-input m-0 w-100 mb-3" style="font-size: 1rem;" placeholder="Celular (9 dígitos)">
          
          <label class="small fw-bold text-muted">Detalles del Evento</label>
          <select id="swal-tipo" class="swal2-select w-100 m-0 mb-2">
            <option value="Matrimonio">Matrimonio</option>
            <option value="15 Años">15 Años</option>
            <option value="Cumplekids">Cumplekids</option>
            <option value="Graduación">Graduación</option>
            <option value="Otros eventos u cumpleaños">Otros</option>
          </select>
          <select id="swal-modalidad" class="swal2-select w-100 m-0 mb-3">
            <option value="Presencial en oficina">Presencial en oficina</option>
            <option value="Virtual Zoom">Virtual Zoom</option>
          </select>

          <label class="small fw-bold text-muted">Programación</label>
          <input id="swal-fecha" type="date" class="swal2-input m-0 w-100 mb-2" min="${new Date().toISOString().split('T')[0]}">
          <select id="swal-hora" class="swal2-select w-100 m-0">
            <option value="13:00">13:00 PM</option>
            <option value="14:00">14:00 PM</option>
            <option value="15:00">15:00 PM</option>
            <option value="16:00">16:00 PM</option>
          </select>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Confirmar Reserva',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#198754',
      preConfirm: async () => {
        const nombre = (document.getElementById('swal-nombre') as HTMLInputElement).value;
        const apellidos = (document.getElementById('swal-apellidos') as HTMLInputElement).value;
        const celular = (document.getElementById('swal-celular') as HTMLInputElement).value;
        const fecha = (document.getElementById('swal-fecha') as HTMLInputElement).value;
        const hora = (document.getElementById('swal-hora') as HTMLInputElement).value;
        const tipo = (document.getElementById('swal-tipo') as HTMLInputElement).value;
        const modalidad = (document.getElementById('swal-modalidad') as HTMLInputElement).value;

        if (!nombre || !apellidos || !celular || !fecha || !hora) {
          Swal.showValidationMessage('Por favor rellena todos los campos');
          return;
        }

        // --- VALIDACIÓN DE DISPONIBILIDAD ---
        const citasRef = collection(this.firestore, 'reservas');
        const q = query(citasRef, where('fechaAsignada', '==', this.formatearFecha(fecha)), where('horaAsignada', '==', hora));
        const checkSnapshot = await getDocs(q);

        if (!checkSnapshot.empty) {
          Swal.showValidationMessage('Este horario ya está ocupado. Elige otra hora o fecha.');
          return;
        }

        return {
          nombre, apellidos, celular, 
          fechaAsignada: this.formatearFecha(fecha), 
          horaAsignada: hora,
          tipoEvento: tipo,
          modalidad: modalidad,
          fechaRegistro: new Date().toISOString(),
          codigoReserva: 'MAN-' + Math.random().toString(36).substring(2, 7).toUpperCase()
        };
      }
    });

    if (formValues) {
      try {
        await addDoc(collection(this.firestore, 'reservas'), formValues);
        await Swal.fire('¡Reservado!', 'La cita ha sido registrada con éxito.', 'success');
        this.cargarDatos();
      } catch (e) {
        Swal.fire('Error', 'No se pudo guardar la reserva.', 'error');
      }
    }
  }

  // Auxiliar para que la fecha se guarde como "12 de junio de 2026" igual que el cliente
  formatearFecha(fechaISO: string): string {
    const partes = fechaISO.split('-');
    const d = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
    return `${d.getDate()} de ${this.nombresMeses[d.getMonth()]} de ${d.getFullYear()}`;
  }

  // ==========================================
  // REPROGRAMAR CITA
  // ==========================================
  async reprogramarCita(reserva: any) {
    const { value: formValues } = await Swal.fire({
      title: 'Reprogramar Cita',
      html: `
        <div class="text-start px-3">
          <p class="small text-muted mb-3">Cliente: <b>${reserva.nombre} ${reserva.apellidos}</b></p>
          <label class="small fw-bold text-muted">Nueva Fecha</label>
          <input id="repro-fecha" type="date" class="swal2-input w-100 m-0 mb-3" min="${new Date().toISOString().split('T')[0]}">
          <label class="small fw-bold text-muted">Nueva Hora</label>
          <select id="repro-hora" class="swal2-select w-100 m-0">
            <option value="13:00">13:00 PM</option>
            <option value="14:00">14:00 PM</option>
            <option value="15:00">15:00 PM</option>
            <option value="16:00">16:00 PM</option>
          </select>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Actualizar Horario',
      confirmButtonColor: '#0d6efd',
      preConfirm: async () => {
        const fecha = (document.getElementById('repro-fecha') as HTMLInputElement).value;
        const hora = (document.getElementById('repro-hora') as HTMLInputElement).value;

        if (!fecha || !hora) {
          Swal.showValidationMessage('Debes elegir fecha y hora');
          return;
        }

        const fechaFormateada = this.formatearFecha(fecha);
        
        // Verificar si el nuevo horario no choca con otra cita
        const citasRef = collection(this.firestore, 'reservas');
        const q = query(citasRef, where('fechaAsignada', '==', fechaFormateada), where('horaAsignada', '==', hora));
        const checkSnapshot = await getDocs(q);

        if (!checkSnapshot.empty) {
          Swal.showValidationMessage('Este horario ya está ocupado por otra cita.');
          return;
        }

        return { fechaAsignada: fechaFormateada, horaAsignada: hora };
      }
    });

    if (formValues) {
      try {
        const docRef = doc(this.firestore, 'reservas', reserva.id);
        await updateDoc(docRef, formValues);
        Swal.fire('¡Reprogramado!', 'El horario ha sido actualizado.', 'success');
        this.cargarDatos();
      } catch (e) {
        Swal.fire('Error', 'No se pudo actualizar.', 'error');
      }
    }
  }

  // --- RESTO DE FUNCIONES (FILTROS, GRAFICOS, ETC) ---
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
    const headers = ['Codigo', 'Cliente', 'Correo', 'Celular', 'Tipo Evento', 'Modalidad', 'Fecha', 'Hora'];
    const filas = this.reservasFiltradas.map(r => [`"${r.codigoReserva || ''}"`, `"${r.nombre} ${r.apellidos}"`, `"${r.correo || ''}"`, `"${r.celular || ''}"`, `"${r.tipoEvento}"`, `"${r.modalidad}"`, `"${r.fechaAsignada}"`, `"${r.horaAsignada}"`]);
    const contenidoCsv = [headers.join(';'), ...filas.map(e => e.join(';'))].join('\n');
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), contenidoCsv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Reporte_Citas_INARA.csv`;
    link.click();
  }

  async cancelarCita(id: string, nombre: string) {
    const result = await Swal.fire({
      title: `¿Cancelar cita de ${nombre}?`,
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Volver',
      confirmButtonColor: '#dc3545'
    });
    if (result.isConfirmed) {
      try {
        await deleteDoc(doc(this.firestore, 'reservas', id));
        Swal.fire('Eliminada', 'La reserva ha sido borrada.', 'success');
        this.cargarDatos();
      } catch (e) { Swal.fire('Error', 'No se pudo eliminar.', 'error'); }
    }
  }

  async cerrarSesion() { await signOut(this.auth); this.router.navigate(['/login']); }
}