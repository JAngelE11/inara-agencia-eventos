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

  ngOnInit() {
    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        this.usuarioId = user.uid;
        this.correoCliente = user.email || '';
        await this.cargarPerfil();
        await this.cargarReservas();
      } else {
        this.router.navigate(['/login']);
      }
    });
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

  // ✅ ALERTA DE GUARDAR PERFIL
  async guardarPerfil() {
    if (!this.nuevoNombre.trim() || !this.nuevoCelular.trim()) {
      Swal.fire({ icon: 'warning', title: 'Faltan datos', text: 'El nombre y el celular no pueden estar vacíos.', confirmButtonColor: '#198754' });
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
        confirmButtonText: 'Actualizar',
        confirmButtonColor: '#198754',
        preConfirm: async () => {
          const fecha = (document.getElementById('repro-fecha') as HTMLInputElement).value;
          const hora = (document.getElementById('repro-hora') as HTMLInputElement).value;
          if (!fecha || !hora) { Swal.showValidationMessage('Debes elegir fecha y hora'); return; }
          
          const nombresMeses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
          const partes = fecha.split('-');
          const d = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
          const fechaFormateada = `${d.getDate()} de ${nombresMeses[d.getMonth()]} de ${d.getFullYear()}`;
          
          const checkSnapshot = await getDocs(query(collection(this.firestore, 'reservas'), where('fechaAsignada', '==', fechaFormateada), where('horaAsignada', '==', hora)));
          if (!checkSnapshot.empty) { Swal.showValidationMessage('Este horario ya está ocupado.'); return; }
          
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