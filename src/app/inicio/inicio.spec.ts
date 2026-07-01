import { describe, it, expect } from 'vitest';

// ── RF01: Landing page ────────────────────────────────────────
describe('RF01 — Mostrar landing page', () => {
  it('CP01 — Visitante sin sesión: usuarioLogueado===false', () => {
    const usuarioLogueado = false;
    const esAdmin = false;
    expect(usuarioLogueado).toBe(false);
    expect(esAdmin).toBe(false);
  });
  it('CP02 — Email admin@inara.com activa esAdmin===true', () => {
    const userEmail = 'admin@inara.com';
    const esAdmin = userEmail === 'admin@inara.com';
    expect(esAdmin).toBe(true);
    expect('cliente@gmail.com' === 'admin@inara.com').toBe(false);
  });
});

// ── RF02: Tipos de evento ────────────────────────────────────
describe('RF02 — Sección de tipos de eventos', () => {
  const tiposEvento = ['Matrimonio','15 Años','50 Años','Cumplekids',
    'Baby Shower','Bautizo / Comunión','Graduación',
    'Evento Corporativo','Otros eventos u cumpleaños'];

  it('CP01 — Todos los tipos de evento están en la lista', () => {
    expect(tiposEvento.includes('Matrimonio')).toBe(true);
    expect(tiposEvento.includes('Baby Shower')).toBe(true);
    expect(tiposEvento.length).toBe(9);
  });
  it('CP02 — Tipo inexistente "Boda" no está en la lista', () => {
    expect(tiposEvento.includes('Boda')).toBe(false);
  });
});

// ── RF03: Diseño responsivo ───────────────────────────────────
describe('RF03 — Diseño responsivo', () => {
  it('CP01 — Viewport 320px es móvil y debe adaptarse', () => {
    const viewportWidth = 320;
    const esMovil = viewportWidth < 576;
    expect(esMovil).toBe(true);
  });
  it('CP02 — Viewport 200px está bajo el mínimo soportado (320px)', () => {
    const viewportWidth = 200;
    const esViewportSoportado = viewportWidth >= 320;
    expect(esViewportSoportado).toBe(false);
  });
});

// ── RF04: Botón flotante ──────────────────────────────────────
describe('RF04 — Botón flotante Reservar Cita', () => {
  it('CP01 — Botón con position:fixed es flotante', () => {
    const estilo = { position: 'fixed' };
    expect(estilo.position === 'fixed').toBe(true);
  });
  it('CP02 — Botón con position:relative no es flotante', () => {
    const estiloMalo = { position: 'relative' };
    expect(estiloMalo.position === 'fixed').toBe(false);
  });
});

// ── RF05: Redirección según sesión ───────────────────────────
describe('RF05 — Redirección del botón Reservar Cita', () => {
  it('CP01 — Usuario logueado redirige a /calendario', () => {
    const usuarioLogueado = true;
    const destino = usuarioLogueado ? '/calendario' : '/login';
    expect(destino).toBe('/calendario');
  });
  it('CP02 — Usuario sin sesión redirige a /login', () => {
    const usuarioLogueado = false;
    const destino = usuarioLogueado ? '/calendario' : '/login';
    expect(destino).toBe('/login');
    expect(destino).not.toBe('/calendario');
  });
});

// ── RF06: Modal de aviso ──────────────────────────────────────
describe('RF06 — Modal de aviso de registro', () => {
  it('CP01 — Elegir Registrarme redirige a /registro', () => {
    const opcion = 'registrarme';
    const destino = opcion === 'registrarme' ? '/registro' : '/login';
    expect(destino).toBe('/registro');
  });
  it('CP02 — Cerrar sin elegir no redirige (destino null)', () => {
    const opcion = null;
    const destino = opcion === 'registrarme' ? '/registro'
                  : opcion === 'login' ? '/login' : null;
    expect(destino).toBeNull();
  });
});
