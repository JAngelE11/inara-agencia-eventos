import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth, createUserWithEmailAndPassword } from '@angular/fire/auth';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import Swal from 'sweetalert2'; // ✅ MAGIA DE LAS ALERTAS

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './registro.html',
  styleUrl: './registro.css'
})
export class Registro {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);

  nombre: string = '';
  apellidos: string = '';
  celular: string = '';
  correo: string = '';
  contrasena: string = '';

  async registrar() {
    // 1. Verificamos que no haya campos vacíos
    if (!this.nombre || !this.apellidos || !this.celular || !this.correo || !this.contrasena) {
      Swal.fire({ 
        icon: 'warning', 
        title: 'Faltan datos', 
        text: 'Por favor, llena todos los campos para crear tu cuenta.', 
        confirmButtonColor: '#198754' 
      });
      return;
    }

    // 2. Bloqueamos la pantalla para evitar múltiples clics
    Swal.fire({ 
      title: 'Creando cuenta...', 
      text: 'Preparando tu espacio en Inara.',
      allowOutsideClick: false, 
      didOpen: () => { Swal.showLoading(); }
    });

    try {
      // 3. Creamos el usuario en la bóveda de Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(this.auth, this.correo, this.contrasena);
      const user = userCredential.user;

      // 4. Guardamos sus datos personales en la base de datos
      await setDoc(doc(this.firestore, 'usuarios', user.uid), {
        nombre: this.nombre,
        apellidos: this.apellidos,
        celular: this.celular,
        correo: this.correo,
        rol: 'cliente',
        fechaRegistro: new Date().toISOString()
      });

      // 5. ¡Éxito! Lo mandamos a su nuevo panel
      Swal.fire({ 
        icon: 'success', 
        title: '¡Bienvenido a Inara!', 
        text: 'Tu cuenta ha sido creada con éxito. Vamos a planificar tu evento.', 
        confirmButtonColor: '#198754', 
        confirmButtonText: 'Ir a mi panel ✨' 
      }).then(() => {
        this.router.navigate(['/panel-cliente']);
      });

    } catch (error: any) {
      console.error(error);
      Swal.fire({ 
        icon: 'error', 
        title: 'Oops...', 
        text: 'Hubo un error al registrarte. Verifica tus datos o intenta con otro correo.', 
        confirmButtonColor: '#d33' 
      });
    }
  }
}