import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Firestore, collection, query, where, getDocs, doc, getDoc, runTransaction, setDoc } from '@angular/fire/firestore';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import emailjs from '@emailjs/browser';
import Swal from 'sweetalert2'; 

@Component({
  selector: 'app-calendario',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './calendario.html',
  styleUrl: './calendario.css'
})
export class Calendario implements OnInit {
  private firestore = inject(Firestore);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private auth = inject(Auth);

  tipoEvento: string = ''; 
  modalidad: string = ''; 
  comentariosCliente: string = ''; 
  usuarioDatos: any = {}; 

  configuracionAgencia: any = null;
  feriadosArray: string[] = [];

  mesActual: number = new Date().getMonth();
  anioActual: number = new Date().getFullYear();
  nombresMeses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

  diasVacios: number[] = [];
  dias: number[] = [];
  diaSeleccionado: number | null = null;

  horasDisponibles: string[] = [];
  horasOcupadas: string[] = [];
  horaSeleccionada: string = '';
  cargandoHoras: boolean = false;
  cargandoCalendario: boolean = true;

  async ngOnInit() {
    await this.cargarConfiguracion();

    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        this.usuarioDatos.correo = user.email;
        this.usuarioDatos.uid = user.uid;
        try {
          const docRef = doc(this.firestore, 'usuarios', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            this.usuarioDatos.nombre = docSnap.data()['nombre'];
            this.usuarioDatos.apellidos = docSnap.data()['apellidos'];
            this.usuarioDatos.celular = docSnap.data()['celular'] || '';
          }
          this.cdr.detectChanges();
        } catch (error) {
          console.error("Error obteniendo perfil:", error);
        }
      } else {
        this.router.navigate(['/login']);
      }
    });
  }

  async cargarConfiguracion() {
    this.cargandoCalendario = true;
    try {
      const configRef = doc(this.firestore, 'configuracion', 'general');
      const docSnap = await getDoc(configRef);
      if (docSnap.exists()) {
        this.configuracionAgencia = docSnap.data();
        if (this.configuracionAgencia.diasFeriados) {
          this.feriadosArray = String(this.configuracionAgencia.diasFeriados).split(',').map((f: string) => f.trim());
        }
      }
    } catch (e) { console.error("Error obteniendo configuración", e); }
      finally {
        this.generarCalendario();
        this.cargandoCalendario = false;
        this.cdr.detectChanges();
      }
  }

  generarCalendario() {
    const primerDia = new Date(this.anioActual, this.mesActual, 1).getDay();
    const totalDias = new Date(this.anioActual, this.mesActual + 1, 0).getDate();

    this.diasVacios = Array(primerDia).fill(0).map((x, i) => i);
    this.dias = Array.from({length: totalDias}, (_, i) => i + 1);
    this.diaSeleccionado = null;
    this.horasDisponibles = [];
  }

  cambiarMes(direccion: number) {
    this.mesActual += direccion;
    if (this.mesActual > 11) {
      this.mesActual = 0;
      this.anioActual++;
    } else if (this.mesActual < 0) {
      this.mesActual = 11;
      this.anioActual--;
    }
    this.generarCalendario();
  }

  get nombreMesActual() {
    return this.nombresMeses[this.mesActual];
  }

  esDiaInvalido(dia: number): boolean {
    const fecha = new Date(this.anioActual, this.mesActual, dia);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    if (fecha < hoy) return true; 
    if (fecha.getDay() === 0) return true; 

    const diaStr = dia.toString().padStart(2, '0');
    const mesStr = (this.mesActual + 1).toString().padStart(2, '0');
    const formatoNumerico = `${diaStr}/${mesStr}/${this.anioActual}`;

    if (this.feriadosArray.includes(formatoNumerico)) {
      return true;
    }

    return false;
  }

  async seleccionarDia(dia: number) {
    if (this.esDiaInvalido(dia)) return;
    this.diaSeleccionado = dia;
    this.horaSeleccionada = '';
    await this.cargarHorasDisponibles();
  }

  async cargarHorasDisponibles() {
    this.cargandoHoras = true;
    this.horasDisponibles = [];
    this.horasOcupadas = [];
    this.cdr.detectChanges();

    const fechaSeleccionada = new Date(this.anioActual, this.mesActual, this.diaSeleccionado!);
    const diaSemana = fechaSeleccionada.getDay();

    let baseHoras: string[] = [];
    if (this.configuracionAgencia && this.configuracionAgencia.horaInicio && this.configuracionAgencia.horaFin) {
      const horaInicioNum = parseInt(this.configuracionAgencia.horaInicio.split(':')[0]);
      let horaFinNum = parseInt(this.configuracionAgencia.horaFin.split(':')[0]);
      
      if (diaSemana === 6) horaFinNum = Math.min(horaFinNum, 15);

      for (let i = horaInicioNum; i <= horaFinNum; i++) {
        baseHoras.push(`${i}:00`);
      }
    } else {
      baseHoras = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
    }

    const fechaCompleta = `${this.diaSeleccionado} de ${this.nombreMesActual.toLowerCase()} de ${this.anioActual}`;
    const hoy = new Date();

    try {
      const reservasRef = collection(this.firestore, 'reservas');
      const q = query(reservasRef, where('fechaAsignada', '==', fechaCompleta));
      const querySnapshot = await getDocs(q);

      this.horasOcupadas = querySnapshot.docs
        .filter(doc => doc.data()['estado'] !== 'Cancelada') 
        .map(doc => doc.data()['horaAsignada']);
        
      this.cdr.detectChanges(); // Forzamos la vista a reaccionar en cuanto llegan las horas ocupadas

      const esHoy = (this.diaSeleccionado === hoy.getDate() && this.mesActual === hoy.getMonth() && this.anioActual === hoy.getFullYear());
      const horaActual = hoy.getHours();

      this.horasDisponibles = baseHoras.filter(horaStr => {
        const horaNum = parseInt(horaStr.split(':')[0]);
        if (esHoy && horaNum < (horaActual + 2)) return false;

        const seCruza = this.horasOcupadas.some(ocupadaStr => {
          const ocupadaNum = parseInt(ocupadaStr.split(':')[0]);
          return Math.abs(horaNum - ocupadaNum) < 2;
        });
        if (seCruza) return false;
        return true;
      });

    } catch (e) {
      console.error('Error consultando BD:', e);
    } finally {
      this.cargandoHoras = false;
      this.cdr.detectChanges();
    }
  }

  seleccionarHora(hora: string) {
    this.horaSeleccionada = hora;
  }

  async confirmarCita() {
    if (!this.diaSeleccionado || !this.horaSeleccionada || !this.tipoEvento || !this.modalidad || !this.usuarioDatos.celular) {
      Swal.fire({ icon: 'warning', title: 'Faltan datos', text: 'Completa todos los campos obligatorios.', confirmButtonColor: '#198754' });
      return;
    }

    const fechaCompleta = `${this.diaSeleccionado} de ${this.nombreMesActual.toLowerCase()} de ${this.anioActual}`;

    try {
      if (this.usuarioDatos.correo) {
        const reservasRef = collection(this.firestore, 'reservas');
        const qConcurrencia = query(reservasRef, where('correo', '==', this.usuarioDatos.correo), where('fechaAsignada', '==', fechaCompleta));
        const prevReservas = await getDocs(qConcurrencia);
        
        const tieneCitas = prevReservas.docs.some(d => d.data()['estado'] !== 'Cancelada');
        
        if (tieneCitas) {
          const respuesta = await Swal.fire({
            icon: 'question',
            title: 'Ya tienes una cita hoy',
            text: '¿La nueva cita corresponde al mismo evento o a uno diferente?',
            showCancelButton: true,
            confirmButtonText: 'Mismo evento',
            cancelButtonText: 'Otro evento',
            confirmButtonColor: '#198754',
            cancelButtonColor: '#6c757d'
          });
          
          if (respuesta.isConfirmed) {
            Swal.fire({ icon: 'info', title: '¡Todo bajo control! ✨', text: '¡No te preocupes! Tenemos tiempo de sobra para charlar tranquilas en tu primera cita. No es necesario duplicar el horario.', confirmButtonColor: '#198754' });
            return;
          }
        }
      }
    } catch (error) {
      console.error('Error al validar concurrencia:', error);
    }

    // ✅ MOSTRAR RESUMEN ANTES DE PROCESAR
    const confirmacion = await Swal.fire({
      title: 'Resumen de tu Reserva',
      html: `
        <div class="text-start fs-6 mt-3 px-3">
          <p class="mb-2"><strong>📅 Fecha:</strong> ${fechaCompleta}</p>
          <p class="mb-2"><strong>⏰ Hora:</strong> ${this.horaSeleccionada}</p>
          <p class="mb-2"><strong>🎉 Evento:</strong> ${this.tipoEvento}</p>
          <p class="mb-2"><strong>🤝 Modalidad:</strong> ${this.modalidad}</p>
          <p class="mb-0"><strong>📝 Detalles:</strong> ${this.comentariosCliente || 'Ninguno'}</p>
        </div>
      `,
      icon: 'info',
      showCancelButton: true,
      confirmButtonColor: '#198754',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Confirmar Reserva',
      cancelButtonText: 'Regresar a editar'
    });

    // Si el usuario decide regresar a editar, salimos de la función
    if (!confirmacion.isConfirmed) {
      return;
    }

    Swal.fire({ title: 'Procesando reserva...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    try {
      const idFormateado = fechaCompleta.replace(/\s+/g, '-'); 
      const horaFormateada = this.horaSeleccionada.replace(':', ''); 
      const ID_UNICO_BLOQUEO = `CITA_${idFormateado}_${horaFormateada}`;
      const codigoReservaGenerado = 'INARA-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const citaDocRef = doc(this.firestore, 'reservas', ID_UNICO_BLOQUEO);

      await runTransaction(this.firestore, async (transaction) => {
        const citaSnapshot = await transaction.get(citaDocRef);
        if (citaSnapshot.exists() && citaSnapshot.data()['estado'] !== 'Cancelada') {
          throw new Error('HORARIO_OCUPADO');
        }

        transaction.set(citaDocRef, {
          nombre: this.usuarioDatos.nombre || 'Cliente web',
          apellidos: this.usuarioDatos.apellidos || '',
          celular: this.usuarioDatos.celular,
          correo: this.usuarioDatos.correo || '',
          tipoEvento: this.tipoEvento, 
          modalidad: this.modalidad, 
          comentarios: this.comentariosCliente || 'Sin comentarios',
          fechaAsignada: fechaCompleta,
          horaAsignada: this.horaSeleccionada,
          estado: 'Pendiente de Confirmacion',
          codigoReserva: codigoReservaGenerado,
          fechaRegistro: new Date().toISOString()
        });
      });

      if (this.usuarioDatos.uid) {
        await setDoc(doc(this.firestore, 'usuarios', this.usuarioDatos.uid), { celular: this.usuarioDatos.celular }, { merge: true });
      }

      const parametrosEmail = {
        nombre_cliente: `${this.usuarioDatos.nombre} ${this.usuarioDatos.apellidos}`,
        correo_cliente: this.usuarioDatos.correo,
        celular_cliente: this.usuarioDatos.celular,
        codigo_reserva: codigoReservaGenerado,
        tipo_evento: this.tipoEvento,
        fecha: fechaCompleta,
        hora: this.horaSeleccionada,
        id_reserva: ID_UNICO_BLOQUEO,
        link_cancelacion: `https://inara-agencia.web.app/cancelar?id=${ID_UNICO_BLOQUEO}`
      };

      try {
        const SERVICE_ID = 'service_0u27b6y'; 
        const PUBLIC_KEY = 'jXgYL3f-YQRCWnt73';
        await emailjs.send(SERVICE_ID, 'template_ryb35pl', parametrosEmail, PUBLIC_KEY);
        await emailjs.send(SERVICE_ID, 'template_57r1qmt', parametrosEmail, PUBLIC_KEY);
      } catch (emailError) { console.error(emailError); }
      
      Swal.fire('¡Reserva Confirmada!', 'Tu cita ha sido agendada con éxito.', 'success')
      .then((r) => { if (r.isConfirmed) this.router.navigate(['/panel-cliente']); });

    } catch (e: any) {
      if (e.message === 'HORARIO_OCUPADO') {
        Swal.fire('Horario no disponible', 'Otro cliente acaba de reservar esta hora.', 'error');
        this.cargarHorasDisponibles();
      } else {
        Swal.fire('Oops...', 'Hubo un problema de conexión.', 'error');
      }
    }
  }
}