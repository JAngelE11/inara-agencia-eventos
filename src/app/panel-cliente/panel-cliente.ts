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
        text: 'Faltan menos de 24 horas para tu evento. Por motivos de logística, las reprogramaciones de último minuto deben coordinarse directamente por teléfono con nuestro equipo.',
        confirmButtonColor: '#0d6efd',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    Swal.fire({
      title: '¿Reprogramar cita?',
      text: `Se cancelará tu reserva actual del ${cita.fechaAsignada}. Podrás agendar una nueva fecha inmediatamente desde tu panel.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#198754',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, continuar',
      cancelButtonText: 'No, mantener mi cita'
    }).then(async (result) => {
      if (result.isConfirmed) {
        Swal.fire({ title: 'Cancelando...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
        try {
          await deleteDoc(doc(this.firestore, 'reservas', cita.id));
          Swal.fire({ icon: 'success', title: '¡Listo!', text: 'El horario ha sido liberado.', confirmButtonColor: '#198754' });
          this.cargarReservas();
        } catch (error) {
          console.error("Error al cancelar cita:", error);
          Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cancelar la cita.', confirmButtonColor: '#198754' });
        }
      }
    });
  }

  async cerrarSesion() {
    await signOut(this.auth);
    this.router.navigate(['/inicio']);
  }
}