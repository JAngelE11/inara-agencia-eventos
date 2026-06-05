import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Firestore, collection, addDoc, query, where, getDocs, doc, getDoc } from '@angular/fire/firestore';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import Swal from 'sweetalert2'; // ✅ LA MAGIA DE LAS ALERTAS

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
  modalidad: string = ''; // ✅ NUEVA VARIABLE
  usuarioDatos: any = {}; 

  mesActual: number = new Date().getMonth();
  anioActual: number = new Date().getFullYear();
  nombresMeses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

  diasVacios: number[] = [];
  dias: number[] = [];
  diaSeleccionado: number | null = null;

  horasDisponibles: string[] = [];
  horaSeleccionada: string = '';
  cargandoHoras: boolean = false;

  ngOnInit() {
    this.generarCalendario();

    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        this.usuarioDatos.correo = user.email;
        try {
          const docRef = doc(this.firestore, 'usuarios', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            this.usuarioDatos.nombre = docSnap.data()['nombre'];
            this.usuarioDatos.apellidos = docSnap.data()['apellidos'];
            this.usuarioDatos.celular = docSnap.data()['celular'];
          }
        } catch (error) {
          console.error("Error obteniendo perfil:", error);
        }
      } else {
        this.router.navigate(['/login']);
      }
    });
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
    this.cdr.detectChanges();

    const fechaSeleccionada = new Date(this.anioActual, this.mesActual, this.diaSeleccionado!);
    const diaSemana = fechaSeleccionada.getDay();

    const baseHoras = diaSemana === 6
      ? ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00']
      : ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

    const fechaCompleta = `${this.diaSeleccionado} de ${this.nombreMesActual.toLowerCase()} de ${this.anioActual}`;
    const hoy = new Date();

    try {
      const reservasRef = collection(this.firestore, 'reservas');
      const q = query(reservasRef, where('fechaAsignada', '==', fechaCompleta));
      const querySnapshot = await getDocs(q);

      const horasOcupadas = querySnapshot.docs.map(doc => doc.data()['horaAsignada']);

      const esHoy = (this.diaSeleccionado === hoy.getDate() && this.mesActual === hoy.getMonth() && this.anioActual === hoy.getFullYear());
      const horaActual = hoy.getHours();

      this.horasDisponibles = baseHoras.filter(horaStr => {
        const horaNum = parseInt(horaStr.split(':')[0]);
        if (esHoy && horaNum < (horaActual + 2)) return false;

        const seCruza = horasOcupadas.some(ocupadaStr => {
          const ocupadaNum = parseInt(ocupadaStr.split(':')[0]);
          return Math.abs(horaNum - ocupadaNum) < 2;
        });
        if (seCruza) return false;
        return true;
      });

    } catch (e) {
      console.error('Error consultando base de datos:', e);
      // ✅ ALERTA DE ERROR MODERNA
      Swal.fire({
        icon: 'error',
        title: 'Error de conexión',
        text: 'Hubo un error al conectar con la agenda. Revisa tu conexión a internet.',
        confirmButtonColor: '#198754'
      });
    } finally {
      this.cargandoHoras = false;
      this.cdr.detectChanges();
    }
  }

  seleccionarHora(hora: string) {
    this.horaSeleccionada = hora;
  }

  async confirmarCita() {
    if (!this.diaSeleccionado || !this.horaSeleccionada) {
      // ❌ ALERTA DE ERROR BONITA
      Swal.fire({
        icon: 'warning',
        title: 'Faltan datos',
        text: 'Por favor, selecciona un día y una hora en el calendario primero.',
        confirmButtonColor: '#198754'
      });
      return;
    }

    if (!this.tipoEvento || !this.modalidad) {
      // ❌ ALERTA DE ERROR BONITA
      Swal.fire({
        icon: 'warning',
        title: 'Casi listo',
        text: 'Por favor, selecciona el Tipo de Evento y la Modalidad de la reunión.',
        confirmButtonColor: '#198754'
      });
      return;
    }

    const fechaCompleta = `${this.diaSeleccionado} de ${this.nombreMesActual.toLowerCase()} de ${this.anioActual}`;

    // ⏳ ALERTA DE CARGA (Bloquea la pantalla para que no hagan doble clic)
    Swal.fire({
      title: 'Procesando reserva...',
      text: 'Estamos guardando tu espacio, un momento por favor.',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      await addDoc(collection(this.firestore, 'reservas'), {
        nombre: this.usuarioDatos.nombre || 'Sin Nombre',
        apellidos: this.usuarioDatos.apellidos || '',
        celular: this.usuarioDatos.celular || '',
        correo: this.usuarioDatos.correo || '',
        tipoEvento: this.tipoEvento, 
        modalidad: this.modalidad, // ✅ SE GUARDA EN FIREBASE
        fechaAsignada: fechaCompleta,
        horaAsignada: this.horaSeleccionada,
        fechaRegistro: new Date().toISOString()
      });

      // ✅ ALERTA DE ÉXITO GIGANTE Y ANIMADA
      Swal.fire({
        icon: 'success',
        title: '¡Reserva Confirmada!',
        text: 'Tu cita ha sido agendada con éxito. Te esperamos.',
        confirmButtonColor: '#198754',
        confirmButtonText: 'Ir a mi panel ✨'
      }).then((result) => {
        if (result.isConfirmed) {
          this.router.navigate(['/panel-cliente']);
        }
      });

    } catch (e) {
      console.error(e);
      // ❌ ALERTA DE FALLO EN FIREBASE
      Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: 'Hubo un problema de conexión. Inténtalo de nuevo.',
        confirmButtonColor: '#d33'
      });
    }
  }
}