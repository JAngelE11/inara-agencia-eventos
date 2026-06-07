import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
// ✅ Importamos Google y Facebook aquí también
import { Auth, createUserWithEmailAndPassword, GoogleAuthProvider, FacebookAuthProvider, signInWithPopup } from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc } from '@angular/fire/firestore';
import Swal from 'sweetalert2'; 

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
    if (!this.nombre || !this.apellidos || !this.celular || !this.correo || !this.contrasena) {
      Swal.fire({ icon: 'warning', title: 'Faltan datos', text: 'Por favor, llena todos los campos para crear tu cuenta.', confirmButtonColor: '#198754' });
      return;
    }

    Swal.fire({ title: 'Creando cuenta...', text: 'Preparando tu espacio en Inara.', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});

    try {
      const userCredential = await createUserWithEmailAndPassword(this.auth, this.correo, this.contrasena);
      const user = userCredential.user;

      await setDoc(doc(this.firestore, 'usuarios', user.uid), {
        nombre: this.nombre,
        apellidos: this.apellidos,
        celular: this.celular,
        correo: this.correo,
        rol: 'cliente',
        fechaRegistro: new Date().toISOString()
      });

      Swal.fire({ icon: 'success', title: '¡Bienvenido a Inara!', text: 'Tu cuenta ha sido creada con éxito. Vamos a planificar tu evento.', confirmButtonColor: '#198754', confirmButtonText: 'Ir a mi panel ✨' }).then(() => {
        this.router.navigate(['/panel-cliente']);
      });

    } catch (error: any) {
      console.error(error);
      Swal.fire({ icon: 'error', title: 'Oops...', text: 'Hubo un error al registrarte. Verifica tus datos o intenta con otro correo.', confirmButtonColor: '#d33' });
    }
  }

  // 🔥 REGISTRO CON GOOGLE (OAuth unificado)
  async iniciarSesionGoogle() {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(this.auth, provider);
      const user = result.user;

      Swal.fire({ title: 'Procesando cuenta...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
      const docRef = doc(this.firestore, 'usuarios', user.uid);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        await setDoc(docRef, {
          nombre: user.displayName || 'Usuario Google',
          apellidos: '',
          celular: '',
          correo: user.email,
          rol: 'cliente',
          fechaRegistro: new Date().toISOString()
        });
      }
      
      Swal.close();
      this.router.navigate(['/panel-cliente']);

    } catch (error) {
      console.error(error);
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo registrar con Google.', confirmButtonColor: '#d33' });
    }
  }

  // 🔥 REGISTRO CON FACEBOOK (Requerimiento 8)
  async iniciarSesionFacebook() {
    const provider = new FacebookAuthProvider();
    try {
      const result = await signInWithPopup(this.auth, provider);
      const user = result.user;

      Swal.fire({ title: 'Procesando cuenta de Facebook...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
      const docRef = doc(this.firestore, 'usuarios', user.uid);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        await setDoc(docRef, {
          nombre: user.displayName || 'Usuario Facebook',
          apellidos: '',
          celular: '',
          correo: user.email || '', 
          rol: 'cliente',
          fechaRegistro: new Date().toISOString()
        });
      }

      Swal.close();
      this.router.navigate(['/panel-cliente']);

    } catch (error: any) {
      console.error(error);
      if(error.code === 'auth/account-exists-with-different-credential') {
        Swal.fire({ icon: 'error', title: 'Correo ya registrado', text: 'Este correo ya está asociado a otra cuenta. Inicia sesión normalmente.', confirmButtonColor: '#d33' });
      } else {
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo conectar con Facebook.', confirmButtonColor: '#d33' });
      }
    }
  }
}