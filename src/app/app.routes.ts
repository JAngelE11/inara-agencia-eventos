import { Routes } from '@angular/router';
import { Inicio } from './inicio/inicio';
import { Login } from './login/login';
import { Registro } from './registro/registro';
import { PanelCliente } from './panel-cliente/panel-cliente';
import { Calendario } from './calendario/calendario';
import { Admin } from './admin/admin';

// 👇 Importamos a nuestros dos vigilantes
import { authGuard, adminGuard } from './auth.guard'; 

export const routes: Routes = [
  // RUTAS PÚBLICAS (Cualquiera puede entrar)
  { path: '', redirectTo: 'inicio', pathMatch: 'full' },
  { path: 'inicio', component: Inicio },
  { path: 'login', component: Login },
  { path: 'registro', component: Registro },
  
  // 🛡️ RUTAS PROTEGIDAS PARA CLIENTES
  { path: 'panel-cliente', component: PanelCliente, canActivate: [authGuard] },
  { path: 'calendario', component: Calendario, canActivate: [authGuard] },
  
  // 👑 RUTA ULTRA PROTEGIDA PARA ADMINISTRADORA
  { path: 'admin', component: Admin, canActivate: [adminGuard] },
  
  // RUTA SALVAVIDAS (Si escriben algo raro, los manda al inicio)
  { path: '**', redirectTo: 'inicio' }
];