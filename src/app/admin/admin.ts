import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, getDocs, doc, deleteDoc, addDoc, updateDoc, getDoc, setDoc, query, where } from '@angular/fire/firestore';
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
  pestanaActual: string = 'agenda'; 

  reservas: any[] = [];
  reservasFiltradas: any[] = [];
  clientes: any[] = [];
  
  // Dashboard Metrics
  totalCitas: number = 0;
  citasHoy: number = 0;
  citasSemana: number = 0; 
  citasMes: number = 0;
  citasAnio: number = 0;

  terminoBusqueda: string = '';
  filtroEvento: string = '';
  filtroFecha: string = 'todos';
  mesEspecifico: string = ''; // <--- NUEVA VARIABLE PARA EL FILTRO

  nombresMeses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  statsEventos: { [key: string]: number } = {
    'Matrimonio': 0, '15 Años': 0, '50 Años': 0, 'Cumplekids': 0,
    'Baby Shower': 0, 'Bautizo / Comunión': 0, 'Graduación': 0,
    'Evento Corporativo': 0, 'Otros eventos u cumpleaños': 0
  };

  chart: any;

  configuracion: any = {
    horaInicio: '10:00',
    horaFin: '18:00',
    diasFeriados: ''
  };

  async ngOnInit() {
    await this.cargarDatos();
    await this.cargarClientes();
    await this.cargarConfiguracion();
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
      this.calcularMetricasDashboard();
      this.calcularEstadisticas(); 
      this.cargando = false;
      this.cdr.detectChanges();
      setTimeout(() => this.renderizarGrafico(), 200); 
    } catch (error) {
      console.error("Error cargando datos:", error);
      this.cargando = false;
    }
  }

  async cargarClientes() {
    try {
      const usuariosRef = collection(this.firestore, 'usuarios');
      const snapshot = await getDocs(usuariosRef);
      this.clientes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error("Error cargando clientes", error);
    }
  }

  async cargarConfiguracion() {
    try {
      const configRef = doc(this.firestore, 'configuracion', 'general');
      const docSnap = await getDoc(configRef);
      if (docSnap.exists()) {
        this.configuracion = docSnap.data();
      }
    } catch (error) {
      console.error("Error cargando config", error);
    }
  }

  async guardarConfiguracion() {
    // Validar formato DD/MM/AAAA antes de guardar
    if (this.configuracion && this.configuracion.diasFeriados) {
      const feriadosStr = String(this.configuracion.diasFeriados);
      const feriados = feriadosStr.split(',').map((f: string) => f.trim());
      const formatoValido = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;
      for (const fecha of feriados) {
        if (fecha !== '' && !formatoValido.test(fecha)) {
          Swal.fire({ icon: 'error', title: 'Formato Incorrecto', text: `La fecha "${fecha}" no tiene el formato DD/MM/AAAA. Revisa y vuelve a intentar.`, confirmButtonColor: '#198754' });
          return;
        }
      }
    }

    try {
      Swal.fire({ title: 'Guardando...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
      const configRef = doc(this.firestore, 'configuracion', 'general');
      await setDoc(configRef, this.configuracion);
      Swal.fire('¡Guardado!', 'La configuración de la agencia se actualizó.', 'success');
    } catch (error) {
      Swal.fire('Error', 'No se pudo guardar la configuración.', 'error');
    }
  }

  calcularMetricasDashboard() {
    const fechaHoy = new Date();
    const hoyFormateado = this.formatearFecha(fechaHoy.toISOString().split('T')[0]);
    const mesActual = this.nombresMeses[fechaHoy.getMonth()];
    const anioActual = fechaHoy.getFullYear().toString();

    const despiazamientoLunes = fechaHoy.getDay() === 0 ? -6 : 1 - fechaHoy.getDay();
    const lunesSemana = new Date(fechaHoy);
    lunesSemana.setDate(fechaHoy.getDate() + despiazamientoLunes);
    lunesSemana.setHours(0,0,0,0);

    const domingoSemana = new Date(lunesSemana);
    domingoSemana.setDate(lunesSemana.getDate() + 6);
    domingoSemana.setHours(23,59,59,999);

    this.citasHoy = this.reservas.filter(r => r.fechaAsignada === hoyFormateado).length;
    this.citasMes = this.reservas.filter(r => r.fechaAsignada?.toLowerCase().includes(mesActual) && r.fechaAsignada?.includes(anioActual)).length;
    this.citasAnio = this.reservas.filter(r => r.fechaAsignada?.includes(anioActual)).length;

    this.citasSemana = this.reservas.filter(r => {
      if (!r.fechaAsignada) return false;
      try {
        const partes = r.fechaAsignada.split(' de ');
        const dia = parseInt(partes[0]);
        const mesStr = partes[1].toLowerCase();
        const anio = parseInt(partes[2]);
        const mesIdx = this.nombresMeses.indexOf(mesStr);
        if (mesIdx === -1) return false;
        const fechaCita = new Date(anio, mesIdx, dia);
        return fechaCita >= lunesSemana && fechaCita <= domingoSemana;
      } catch (e) { return false; }
    }).length;
  }

  async cambiarEstado(reserva: any, evento: any) {
    const nuevoEstado = evento.target.value;
    try {
      const docRef = doc(this.firestore, 'reservas', reserva.id);
      await updateDoc(docRef, { estado: nuevoEstado });
      
      Swal.fire('Estado Actualizado', `La cita de ${reserva.nombre} ahora está ${nuevoEstado}.`, 'success');
      this.cargarDatos(); 
    } catch (error) {
      Swal.fire('Error', 'No se pudo actualizar el estado.', 'error');
      this.cargarDatos(); 
    }
  }

  // <--- LÓGICA DE FILTRADO CON MES ESPECÍFICO AÑADIDA AQUÍ --->
  aplicarFiltros() {
    this.reservasFiltradas = this.reservas.filter(reserva => {
      const busquedaTotal = `${reserva.nombre || ''} ${reserva.apellidos || ''} ${reserva.codigoReserva || ''}`.toLowerCase();
      const cumpleBusqueda = this.terminoBusqueda === '' || busquedaTotal.includes(this.terminoBusqueda.toLowerCase());
      const cumpleEvento = this.filtroEvento === '' || reserva.tipoEvento === this.filtroEvento;
      
      let cumpleFecha = true;
      const fechaHoy = new Date();
      const hoyFormateado = this.formatearFecha(fechaHoy.toISOString().split('T')[0]);
      const mesActualNombre = this.nombresMeses[fechaHoy.getMonth()];
      const anioActualStr = fechaHoy.getFullYear().toString();

      const despiazamientoLunes = fechaHoy.getDay() === 0 ? -6 : 1 - fechaHoy.getDay();
      const lunesSemana = new Date(fechaHoy);
      lunesSemana.setDate(fechaHoy.getDate() + despiazamientoLunes);
      lunesSemana.setHours(0,0,0,0);
      const domingoSemana = new Date(lunesSemana);
      domingoSemana.setDate(lunesSemana.getDate() + 6);
      domingoSemana.setHours(23,59,59,999);

      if (this.filtroFecha === 'hoy') {
        cumpleFecha = reserva.fechaAsignada === hoyFormateado;
      } else if (this.filtroFecha === 'semana') {
        if (!reserva.fechaAsignada) {
          cumpleFecha = false;
        } else {
          try {
            const partes = reserva.fechaAsignada.split(' de ');
            const dia = parseInt(partes[0]);
            const mesStr = partes[1].toLowerCase();
            const anio = parseInt(partes[2]);
            const mesIdx = this.nombresMeses.indexOf(mesStr);
            if (mesIdx !== -1) {
              const fechaCita = new Date(anio, mesIdx, dia);
              cumpleFecha = fechaCita >= lunesSemana && fechaCita <= domingoSemana;
            } else { cumpleFecha = false; }
          } catch (e) { cumpleFecha = false; }
        }
      } else if (this.filtroFecha === 'mes') {
        cumpleFecha = reserva.fechaAsignada?.toLowerCase().includes(mesActualNombre) && reserva.fechaAsignada?.includes(anioActualStr);
      } else if (this.filtroFecha === 'mes_especifico' && this.mesEspecifico) {
        const partesMes = this.mesEspecifico.split('-'); 
        if(partesMes.length === 2) {
          const anioEsp = partesMes[0];
          const mesEspIndex = parseInt(partesMes[1]) - 1;
          const nombreMesEsp = this.nombresMeses[mesEspIndex];
          cumpleFecha = reserva.fechaAsignada?.toLowerCase().includes(nombreMesEsp) && reserva.fechaAsignada?.includes(anioEsp);
        }
      } else if (this.filtroFecha === 'anio') {
        cumpleFecha = reserva.fechaAsignada?.includes(anioActualStr);
      }
      
      return cumpleBusqueda && cumpleEvento && cumpleFecha;
    });
    this.cdr.detectChanges();
  }

  esDiaFeriadoODomingo(fechaISO: string): boolean {
    if (!fechaISO) return false;
    const partes = fechaISO.split('-');
    const anio = partes[0];
    const mes = partes[1];
    const dia = partes[2];
    const formatoNumerico = `${dia}/${mes}/${anio}`;

    const d = new Date(Number(anio), Number(mes) - 1, Number(dia));
    if (d.getDay() === 0) return true;

    const feriados = (this.configuracion && this.configuracion.diasFeriados) ? String(this.configuracion.diasFeriados).split(',').map((f: string) => f.trim()) : [];
    return feriados.includes(formatoNumerico);
  }

  async crearCitaAdmin() {
    const { value: formValues } = await Swal.fire({
      title: '<h3 class="fw-bold" style="color: #198754; margin-bottom: 0;">Nueva Reserva Manual</h3>',
      width: '600px',
      html: `
        <style>
          .inara-input { width: 100%; padding: 10px; margin-bottom: 15px; border: 1px solid #ddd; border-radius: 8px; font-size: 0.9rem; }
          .time-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px; }
          .time-option { display: none; }
          .time-label { display: block; padding: 10px; text-align: center; border: 1px solid #6c757d; border-radius: 20px; cursor: pointer; font-weight: bold; font-size: 0.85rem; }
          .time-option:checked + .time-label { background-color: #198754; color: white; border-color: #198754; }
          .time-option:disabled + .time-label { background-color: #f8f9fa; color: #dc3545; border-color: #ddd; cursor: not-allowed; text-decoration: line-through; opacity: 0.6; }
        </style>
        <div class="text-start px-2">
          <input id="swal-nombre" class="inara-input m-0 mt-2" placeholder="Nombres del Cliente" oninput="this.value = this.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ ]/g, '')">
          <input id="swal-celular" class="inara-input mt-2" placeholder="Celular (9 dígitos)" maxlength="9" oninput="this.value = this.value.replace(/[^0-9]/g, '')">
          <input id="swal-fecha" type="date" class="inara-input" min="${new Date().toISOString().split('T')[0]}">
          
          <h6 class="fw-bold mb-2 small text-secondary">Selecciona Horario (10 AM a 6 PM)</h6>
          <div class="time-grid mt-2">
            <div><input type="radio" name="swal-hora" id="hora-10" value="10:00" class="time-option"><label for="hora-10" class="time-label">10:00 AM</label></div>
            <div><input type="radio" name="swal-hora" id="hora-11" value="11:00" class="time-option"><label for="hora-11" class="time-label">11:00 AM</label></div>
            <div><input type="radio" name="swal-hora" id="hora-12" value="12:00" class="time-option"><label for="hora-12" class="time-label">12:00 PM</label></div>
            <div><input type="radio" name="swal-hora" id="hora-13" value="13:00" class="time-option"><label for="hora-13" class="time-label">13:00 PM</label></div>
            <div><input type="radio" name="swal-hora" id="hora-14" value="14:00" class="time-option"><label for="hora-14" class="time-label">14:00 PM</label></div>
            <div><input type="radio" name="swal-hora" id="hora-15" value="15:00" class="time-option"><label for="hora-15" class="time-label">15:00 PM</label></div>
            <div><input type="radio" name="swal-hora" id="hora-16" value="16:00" class="time-option"><label for="hora-16" class="time-label">16:00 PM</label></div>
            <div><input type="radio" name="swal-hora" id="hora-17" value="17:00" class="time-option"><label for="hora-17" class="time-label">17:00 PM</label></div>
            <div><input type="radio" name="swal-hora" id="hora-18" value="18:00" class="time-option"><label for="hora-18" class="time-label">18:00 PM</label></div>
          </div>
          
          <select id="swal-tipo" class="inara-input">
            <option value="Matrimonio">Matrimonio</option>
            <option value="15 Años">15 Años</option>
            <option value="50 Años">50 Años</option>
            <option value="Cumplekids">Cumplekids</option>
            <option value="Baby Shower">Baby Shower</option>
            <option value="Bautizo / Comunión">Bautizo / Comunión</option>
            <option value="Graduación">Graduación</option>
            <option value="Evento Corporativo">Evento Corporativo</option>
            <option value="Otros eventos u cumpleaños">Otros eventos u cumpleaños</option>
          </select>
          <select id="swal-modalidad" class="inara-input">
            <option value="Presencial en oficina">Presencial en oficina</option>
            <option value="Virtual Zoom">Virtual Zoom</option>
          </select>
          <textarea id="swal-comentarios" class="inara-input" rows="2" placeholder="Comentarios adicionales..."></textarea>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      confirmButtonColor: '#198754',
      didOpen: () => {
        const fechaInput = document.getElementById('swal-fecha') as HTMLInputElement;
        fechaInput.addEventListener('change', async () => {
          const fechaVal = fechaInput.value;
          if (!fechaVal) return;
          
          const fechaObj = new Date(fechaVal + 'T00:00:00');
          const diaSemana = fechaObj.getDay();

          // Deshabilitamos todo temporalmente mientras carga
          const timeOptions = document.querySelectorAll('.time-option');
          timeOptions.forEach(opt => { 
            (opt as HTMLInputElement).disabled = true; 
            (opt as HTMLInputElement).checked = false; 
          });
          
          if (diaSemana === 0 || this.esDiaFeriadoODomingo(fechaVal)) {
            Swal.showValidationMessage('Este día es feriado o domingo y la agencia está cerrada.');
            return;
          } else {
            Swal.resetValidationMessage();
          }

          const fechaFormateada = this.formatearFecha(fechaVal);
          
          try {
            const checkSnapshot = await getDocs(query(collection(this.firestore, 'reservas'), where('fechaAsignada', '==', fechaFormateada)));
            const horasOcupadas = checkSnapshot.docs
              .filter(doc => doc.data()['estado'] !== 'Cancelada')
              .map(doc => doc.data()['horaAsignada']);
              
            timeOptions.forEach(opt => {
              const input = opt as HTMLInputElement;
              const horaFiltro = parseInt(input.value.split(':')[0], 10);
              
              if (diaSemana === 6 && horaFiltro > 15) {
                input.disabled = true;
              } else {
                input.disabled = horasOcupadas.includes(input.value);
              }
            });
          } catch (error) {
            console.error('Error verificando disponibilidad:', error);
          }
        });
      },
      preConfirm: () => {
        const nombre = (document.getElementById('swal-nombre') as HTMLInputElement).value;
        const celular = (document.getElementById('swal-celular') as HTMLInputElement).value;
        const fecha = (document.getElementById('swal-fecha') as HTMLInputElement).value;
        const tipo = (document.getElementById('swal-tipo') as HTMLInputElement).value;
        const modalidad = (document.getElementById('swal-modalidad') as HTMLInputElement).value;
        const comentarios = (document.getElementById('swal-comentarios') as HTMLTextAreaElement).value;
        const horaSeleccionada = document.querySelector('input[name="swal-hora"]:checked') as HTMLInputElement;
        const hora = horaSeleccionada ? horaSeleccionada.value : null;

        if (!nombre || !fecha || !hora) { Swal.showValidationMessage('Nombre, fecha y hora son obligatorios.'); return; }
        if (nombre.trim().length < 2) { Swal.showValidationMessage('El nombre debe tener al menos 2 caracteres.'); return; }
        if (!/^9[0-9]{8}$/.test(celular)) { Swal.showValidationMessage('El celular debe ser válido (9 dígitos y empezar con 9).'); return; }
        if (this.esDiaFeriadoODomingo(fecha)) { Swal.showValidationMessage('La fecha elegida es feriado o domingo.'); return; }

        return {
          nombre, apellidos: '', celular, correo: '',
          fechaAsignada: this.formatearFecha(fecha), horaAsignada: hora,
          tipoEvento: tipo, modalidad, comentarios: comentarios || 'Sin comentarios',
          estado: 'Confirmada', 
          codigoReserva: 'MAN-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
          fechaRegistro: new Date().toISOString()
        };
      }
    });

    if (formValues) {
      await addDoc(collection(this.firestore, 'reservas'), formValues);
      Swal.fire('¡Reservado!', 'La cita ha sido registrada.', 'success');
      this.cargarDatos();
    }
  }

  formatearFecha(fechaISO: string): string {
    const partes = fechaISO.split('-');
    const d = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
    return `${d.getDate()} de ${this.nombresMeses[d.getMonth()]} de ${d.getFullYear()}`;
  }

  async reprogramarCita(reserva: any) {
    const { value: formValues } = await Swal.fire({
      title: 'Reprogramar Cita',
      html: `
        <div class="text-start px-3">
          <input id="repro-fecha" type="date" class="swal2-input w-100 m-0 mb-3" min="${new Date().toISOString().split('T')[0]}">
          <select id="repro-hora" class="swal2-select w-100 m-0">
            <option value="10:00">10:00 AM</option>
            <option value="11:00">11:00 AM</option>
            <option value="12:00">12:00 MD</option>
            <option value="13:00">13:00 PM</option>
            <option value="14:00">14:00 PM</option>
            <option value="15:00">15:00 PM</option>
            <option value="16:00">16:00 PM</option>
            <option value="17:00">17:00 PM</option>
            <option value="18:00">18:00 PM</option>
          </select>
        </div>
      `,
      showCancelButton: true,
      preConfirm: async () => {
        const fecha = (document.getElementById('repro-fecha') as HTMLInputElement).value;
        const hora = (document.getElementById('repro-hora') as HTMLInputElement).value;
        if (!fecha || !hora) { Swal.showValidationMessage('Debes elegir fecha y hora'); return; }
        if (this.esDiaFeriadoODomingo(fecha)) { Swal.showValidationMessage('La fecha elegida es feriado o domingo.'); return; }
        const fechaFormateada = this.formatearFecha(fecha);
        const checkSnapshot = await getDocs(query(collection(this.firestore, 'reservas'), where('fechaAsignada', '==', fechaFormateada), where('horaAsignada', '==', hora)));
        if (!checkSnapshot.empty) { Swal.showValidationMessage('Este horario ya está ocupado.'); return; }
        return { fechaAsignada: fechaFormateada, horaAsignada: hora };
      }
    });

    if (formValues) {
      await updateDoc(doc(this.firestore, 'reservas', reserva.id), formValues);
      Swal.fire('¡Reprogramado!', 'El horario ha sido actualizado.', 'success');
      this.cargarDatos();
    }
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
    if (this.reservasFiltradas.length === 0) return;
    const headers = ['Codigo', 'Cliente', 'Celular', 'Estado', 'Fecha', 'Hora'];
    const filas = this.reservasFiltradas.map(r => [`"${r.codigoReserva}"`, `"${r.nombre}"`, `"${r.celular}"`, `"${r.estado}"`, `"${r.fechaAsignada}"`, `"${r.horaAsignada}"`]);
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), [headers.join(';'), ...filas.map(e => e.join(';'))].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `Reporte_Citas.csv`; link.click();
  }

  async cancelarCita(id: string, nombre: string) {
    const result = await Swal.fire({ title: `¿Eliminar cita?`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Eliminar', confirmButtonColor: '#dc3545' });
    if (result.isConfirmed) {
      await deleteDoc(doc(this.firestore, 'reservas', id));
      Swal.fire('Eliminada', 'La reserva ha sido borrada.', 'success');
      this.cargarDatos();
    }
  }

  async cerrarSesion() { await signOut(this.auth); this.router.navigate(['/login']); }
}