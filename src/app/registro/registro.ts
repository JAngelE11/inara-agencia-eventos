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
  password: string = '';
  repetirPassword: string = '';
  mostrarPassword = false;
  mostrarRepetirPassword = false;

  // Getters para validación de contraseña en tiempo real
  get tieneMinimoOchoCharacters(): boolean { return this.password.length >= 8; }
  get tieneMayuscula(): boolean { return /[A-ZÁÉÍÓÚÑ]/.test(this.password); }
  get tieneNumero(): boolean { return /[0-9]/.test(this.password); }
  get passwordValida(): boolean { return this.tieneMinimoOchoCharacters && this.tieneMayuscula && this.tieneNumero; }
  get contrasenasCoinciden(): boolean { return this.password === this.repetirPassword && this.password !== ''; }

  filtrarSoloLetras(campo: 'nombre' | 'apellidos') {
    this[campo] = this[campo].replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ ]/g, '');
  }

  filtrarSoloNumeros(campo: 'celular') {
    this[campo] = this[campo].replace(/[^0-9]/g, '');
  }

  async registrar() {
    if (!this.nombre || !this.apellidos || !this.celular || !this.correo || !this.password || !this.repetirPassword) {
      Swal.fire({ icon: 'warning', title: 'Faltan datos', text: 'Por favor, llena todos los campos para crear tu cuenta.', confirmButtonColor: '#198754' });
      return;
    }

    if (!this.passwordValida) {
      Swal.fire({ icon: 'error', title: 'Contraseña débil', text: 'La contraseña debe tener al menos 8 caracteres, incluir una mayúscula y un número.', confirmButtonColor: '#d33' });
      return;
    }

    if (!this.contrasenasCoinciden) {
      Swal.fire({ icon: 'error', title: 'Las contraseñas no coinciden', text: 'Asegúrate de escribir la misma contraseña en ambos campos.', confirmButtonColor: '#d33' });
      return;
    }

    Swal.fire({ title: 'Creando cuenta...', text: 'Preparando tu espacio en Inara.', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});

    try {
      const userCredential = await createUserWithEmailAndPassword(this.auth, this.correo, this.password);
      const user = userCredential.user;

      await setDoc(doc(this.firestore, 'usuarios', user.uid), {
        nombre: this.nombre,
        apellidos: this.apellidos,
        celular: this.celular,
        correo: this.correo,
        rol: 'cliente',
        fechaRegistro: new Date().toISOString()
      });

      Swal.fire({ 
        icon: 'success', 
        title: '¡Registro Exitoso! 🎉', 
        html: "Tu cuenta ha sido creada correctamente.<br><br><small class='text-muted'><b>Nota importante:</b> Cuando reserves una cita, te llegarán los detalles al correo y si no es Gmail, recuerda revisar tu bandeja de spam.</small>", 
        confirmButtonColor: '#198754', 
        confirmButtonText: 'Ir a mi panel ✨' 
      }).then(() => {
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