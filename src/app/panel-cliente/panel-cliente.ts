import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth, onAuthStateChanged, signOut } from '@angular/fire/auth';
import { Firestore, collection, query, where, getDocs, doc, getDoc, updateDoc, deleteDoc } from '@angular/fire/firestore';
import Swal from 'sweetalert2'; // ✅ SWEETALERT IMPORTADO

@Component({
  selector: 'app-panel-cliente',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './panel-cliente.html',
  styleUrl: './panel-cliente.css'
})
export class PanelCliente implements OnInit {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  usuarioId: string = '';
  nombreCliente: string = '';
  apellidosCliente: string = '';
  celularCliente: string = '';
  correoCliente: string = '';
  misReservas: any[] = [];
  cargando: boolean = true;

  editandoPerfil: boolean = false;
  nuevoNombre: string = '';
  nuevoApellidos: string = '';
  nuevoCelular: string = '';
  
  configuracion: any = {
    horaInicio: '10:00',
    horaFin: '18:00',
    diasFeriados: ''
  };

  ngOnInit() {
    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        this.usuarioId = user.uid;
        this.correoCliente = user.email || '';
        await this.cargarConfiguracion();
        await this.cargarPerfil();
        await this.cargarReservas();
      } else {
        this.router.navigate(['/login']);
      }
    });
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

  async cargarPerfil() {
    try {
      const usuarioRef = doc(this.firestore, 'usuarios', this.usuarioId);
      const usuarioSnap = await getDoc(usuarioRef);
      if (usuarioSnap.exists()) {
        const data = usuarioSnap.data();
        this.nombreCliente = data['nombre'] || '';
        this.apellidosCliente = data['apellidos'] || '';
        this.celularCliente = data['celular'] || '';
        
        this.nuevoNombre = this.nombreCliente;
        this.nuevoApellidos = this.apellidosCliente;
        this.nuevoCelular = this.celularCliente;
      }
    } catch (error) {
      console.error("Error obteniendo perfil:", error);
    }
  }

  async cargarReservas() {
    this.cargando = true;
    this.cdr.detectChanges();
    try {
      const reservasRef = collection(this.firestore, 'reservas');
      const q = query(reservasRef, where('correo', '==', this.correoCliente));
      const querySnapshot = await getDocs(q);
      
      this.misReservas = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      this.cdr.detectChanges();
    } catch (error) {
      console.error("Error obteniendo reservas:", error);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  // ✅ FILTROS EN TIEMPO REAL PARA LOS INPUTS
  filtrarNombre() {
    this.nuevoNombre = this.nuevoNombre.replace(/[^a-zA-Z\sñÑáéíóúÁÉÍÓÚ]/g, '');
  }

  filtrarApellidos() {
    this.nuevoApellidos = this.nuevoApellidos.replace(/[^a-zA-Z\sñÑáéíóúÁÉÍÓÚ]/g, '');
  }

  filtrarCelular() {
    // Solo permite números y recorta el texto a un máximo de 9 dígitos
    this.nuevoCelular = this.nuevoCelular.replace(/[^0-9]/g, '').slice(0, 9);
  }

  // ✅ ALERTA DE GUARDAR PERFIL
  async guardarPerfil() {
    if (!this.nuevoNombre.trim() || !this.nuevoApellidos.trim() || !this.nuevoCelular.trim()) {
      Swal.fire({ icon: 'warning', title: 'Faltan datos', text: 'Todos los campos son obligatorios.', confirmButtonColor: '#198754' });
      return;
    }

    // Regex para validar solo letras (incluye espacios, tildes y la letra ñ)
    const regexNombres = /^[a-zA-Z\sñÑáéíóúÁÉÍÓÚ]+$/;
    
    if (!regexNombres.test(this.nuevoNombre)) {
      Swal.fire({ icon: 'warning', title: 'Nombre inválido', text: 'El nombre solo puede contener letras.', confirmButtonColor: '#198754' });
      return;
    }

    if (!regexNombres.test(this.nuevoApellidos)) {
      Swal.fire({ icon: 'warning', title: 'Apellidos inválidos', text: 'Los apellidos solo pueden contener letras.', confirmButtonColor: '#198754' });
      return;
    }

    // Regex para validar celular: inicia con 9 y tiene exactamente 9 dígitos
    const regexCelular = /^9\d{8}$/;
    if (!regexCelular.test(this.nuevoCelular)) {
      Swal.fire({ icon: 'warning', title: 'Celular inválido', text: 'El número de celular debe tener exactamente 9 dígitos y empezar con 9.', confirmButtonColor: '#198754' });
      return;
    }
    
    Swal.fire({ title: 'Guardando...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});

    try {
      const usuarioRef = doc(this.firestore, 'usuarios', this.usuarioId);
      await updateDoc(usuarioRef, { 
        nombre: this.nuevoNombre,
        apellidos: this.nuevoApellidos,
        celular: this.nuevoCelular 
      });
      
      this.nombreCliente = this.nuevoNombre;
      this.apellidosCliente = this.nuevoApellidos;
      this.celularCliente = this.nuevoCelular;
      this.editandoPerfil = false;
      
      Swal.fire({ icon: 'success', title: '¡Actualizado!', text: 'Tu perfil ha sido guardado con éxito.', confirmButtonColor: '#198754' });
    } catch (error) {
      console.error("Error al actualizar perfil:", error);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Hubo un error al guardar los cambios.', confirmButtonColor: '#198754' });
    }
  }

  parsearFecha(fechaStr: string, horaStr: string): Date {
    const partes = fechaStr.split(' ');
    const dia = parseInt(partes[0]);
    const mesStr = partes[2].toLowerCase();
    const anio = parseInt(partes[4]);

    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const mesIndex = meses.indexOf(mesStr);
    const horaPartes = horaStr.split(':');
    const horas = parseInt(horaPartes[0]);
    
    return new Date(anio, mesIndex, dia, horas, 0);
  }

  evaluarRegla24Horas(fechaStr: string, horaStr: string): boolean {
    const fechaEvento = this.parsearFecha(fechaStr, horaStr);
    const ahora = new Date();
    const diferenciaMs = fechaEvento.getTime() - ahora.getTime();
    const horasRestantes = diferenciaMs / (1000 * 60 * 60);
    return horasRestantes >= 24; 
  }

  // ✅ ALERTAS DE CANCELACIÓN Y REGLA DE 24 HORAS
  async intentarCancelar(cita: any) {
    const puedeCancelar = this.evaluarRegla24Horas(cita.fechaAsignada, cita.horaAsignada);

    if (!puedeCancelar) {
      Swal.fire({
        icon: 'info',
        title: 'Política de Empresa',
        html: 'Faltan menos de 24 horas para tu evento. Por motivos de logística, las reprogramaciones de último minuto deben coordinarse directamente por teléfono con nuestro equipo.<br><br>Comunicarse al WhatsApp/Cel: <b>902701111</b>',
        confirmButtonColor: '#0d6efd',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    const result = await Swal.fire({
      title: 'Gestionar Cita',
      text: `¿Qué deseas hacer con tu reserva del ${cita.fechaAsignada}?`,
      icon: 'question',
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonColor: '#198754',
      denyButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: '📅 Reprogramar',
      denyButtonText: '🔴 Cancelar Cita',
      cancelButtonText: 'Regresar'
    });

    if (result.isDenied) {
      const confirmCancel = await Swal.fire({
        title: '¿Estás seguro?',
        text: 'Al cancelar, perderás tu horario y otra persona podría tomarlo.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, cancelar cita',
        cancelButtonText: 'Volver'
      });

      if (confirmCancel.isConfirmed) {
        Swal.fire({ title: 'Cancelando...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
        try {
          await deleteDoc(doc(this.firestore, 'reservas', cita.id));
          await this.cargarReservas();
          this.cdr.detectChanges();
          Swal.fire({ icon: 'success', title: 'Cancelada', text: 'Tu cita ha sido cancelada.', confirmButtonColor: '#198754' });
        } catch (error) {
          console.error("Error al cancelar cita:", error);
          Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cancelar la cita.', confirmButtonColor: '#198754' });
        }
      }
    } else if (result.isConfirmed) {
      
      // Ajuste para la fecha mínima del input basada en la hora local
      const hoyLocal = new Date();
      hoyLocal.setMinutes(hoyLocal.getMinutes() - hoyLocal.getTimezoneOffset());
      const minDate = hoyLocal.toISOString().split('T')[0];

      const { value: formValues } = await Swal.fire({
        title: 'Reprogramar Cita',
        html: `
          <div class="text-start px-3">
            <label class="form-label fw-bold text-secondary small">Selecciona la nueva fecha:</label>
            <input id="repro-fecha" type="date" class="form-control mb-3" min="${minDate}">
            <label class="form-label fw-bold text-secondary small">Horarios disponibles:</label>
            <select id="repro-hora" class="form-select m-0" disabled>
              <option value="">Primero elige una fecha...</option>
            </select>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Actualizar',
        confirmButtonColor: '#198754',
        didOpen: () => {
          const fechaInput = document.getElementById('repro-fecha') as HTMLInputElement;
          const horaSelect = document.getElementById('repro-hora') as HTMLSelectElement;

          fechaInput.addEventListener('change', async () => {
            if (!fechaInput.value) {
              horaSelect.disabled = true;
              horaSelect.innerHTML = '<option value="">Primero elige una fecha...</option>';
              return;
            }

            if (this.esDiaFeriadoODomingo(fechaInput.value)) {
              horaSelect.disabled = true;
              horaSelect.innerHTML = '<option value="">Cerrado (Feriado o Domingo)</option>';
              return;
            }

            horaSelect.disabled = true;
            horaSelect.innerHTML = '<option value="">Buscando disponibilidad...</option>';

            const partes = fechaInput.value.split('-');
            const anio = parseInt(partes[0]);
            const mesIndex = parseInt(partes[1]) - 1;
            const dia = parseInt(partes[2]);
            const nombresMeses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
            const fechaFormateada = `${dia} de ${nombresMeses[mesIndex]} de ${anio}`;

            try {
              const reservasRef = collection(this.firestore, 'reservas');
              const q = query(reservasRef, where('fechaAsignada', '==', fechaFormateada));
              const querySnapshot = await getDocs(q);
              
              // Filtramos la cita actual para no autobloquearnos nuestro propio turno
              const horasOcupadas = querySnapshot.docs
                .filter(doc => doc.data()['estado'] !== 'Cancelada' && doc.id !== cita.id)
                .map(doc => doc.data()['horaAsignada']);
              
              const horasAfectadas = new Set<string>();
              horasOcupadas.forEach(h => {
                horasAfectadas.add(h);
                const horaInt = parseInt(h.split(':')[0], 10);
                horasAfectadas.add(`${horaInt + 1}:00`);
              });

              const horasTotales = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
              
              horaSelect.innerHTML = '';
              let hayDisponibles = false;

              const diaSemana = new Date(fechaInput.value + 'T00:00:00').getDay();

              horasTotales.forEach(hora => {
                const option = document.createElement('option');
                option.value = hora;
                option.text = hora;
                const horaInt = parseInt(hora.split(':')[0], 10);
                
                if (diaSemana === 6 && horaInt > 15) {
                   option.disabled = true;
                   option.text = `${hora} (Sábado tarde cerrado)`;
                   option.style.color = '#dc3545';
                } else if (horasAfectadas.has(hora)) {
                  option.disabled = true;
                  option.text = `${hora} (Ocupado)`;
                  option.style.color = '#dc3545';
                } else {
                  hayDisponibles = true;
                }
                horaSelect.appendChild(option);
              });

              if (!hayDisponibles) {
                horaSelect.innerHTML = '<option value="">Día completamente lleno</option>';
              } else {
                horaSelect.disabled = false;
              }
            } catch (error) {
              console.error("Error al buscar disponibilidad", error);
              horaSelect.innerHTML = '<option value="">Error de conexión</option>';
            }
          });
        },
        preConfirm: async () => {
          const fecha = (document.getElementById('repro-fecha') as HTMLInputElement).value;
          const hora = (document.getElementById('repro-hora') as HTMLSelectElement).value;
          if (!fecha || !hora) { Swal.showValidationMessage('Debes elegir una fecha y un horario disponible'); return false; }
          if (this.esDiaFeriadoODomingo(fecha)) { Swal.showValidationMessage('La fecha elegida es feriado o domingo.'); return false; }
          
          const nombresMeses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
          const partes = fecha.split('-');
          const d = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
          const fechaFormateada = `${d.getDate()} de ${nombresMeses[d.getMonth()]} de ${d.getFullYear()}`;
          
          // VALIDACIÓN EN TIEMPO REAL: Re-comprobar justo antes de actualizar por si alguien ganó el cupo
          const checkSnapshot = await getDocs(query(collection(this.firestore, 'reservas'), where('fechaAsignada', '==', fechaFormateada), where('horaAsignada', '==', hora)));
          const ocupadasDB = checkSnapshot.docs.filter(doc => doc.data()['estado'] !== 'Cancelada' && doc.id !== cita.id).map(doc => doc.data()['horaAsignada']);
          
          const horaSeleccionadaInt = parseInt(hora.split(':')[0], 10);
          const horaAnterior = `${horaSeleccionadaInt - 1}:00`;

          if (ocupadasDB.includes(hora) || ocupadasDB.includes(horaAnterior)) { 
              Swal.showValidationMessage('¡Lo sentimos! Alguien acaba de reservar este horario o el turno anterior. Por favor, elige otro.'); 
              return false; 
          }

          return { fechaAsignada: fechaFormateada, horaAsignada: hora };
        }
      });

      if (formValues) {
        Swal.fire({ title: 'Reprogramando...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
        try {
          await updateDoc(doc(this.firestore, 'reservas', cita.id), { 
            fechaAsignada: formValues.fechaAsignada, 
            horaAsignada: formValues.horaAsignada,
            estado: 'Pendiente de Confirmacion'
          });
          await this.cargarReservas();
          Swal.fire('¡Reprogramado!', 'El horario ha sido actualizado y está pendiente de confirmación.', 'success');
        } catch (error) {
          console.error("Error al reprogramar:", error);
          Swal.fire('Error', 'No se pudo reprogramar la cita.', 'error');
        }
      }
    }
  }

  async cerrarSesion() {
    await signOut(this.auth);
    this.router.navigate(['/inicio']);
  }
}