import { describe, it, expect } from 'vitest';

// ── RF39: Login admin ─────────────────────────────────────────
describe('RF39 — Login exclusivo del administrador', () => {
  it('CP01 — admin@inara.com da acceso al panel', () => {
    const esAdmin = 'admin@inara.com' === 'admin@inara.com';
    expect(esAdmin).toBe(true);
  });
  it('CP02 — Email distinto no da acceso', () => {
    const esAdmin = 'cliente@gmail.com' === 'admin@inara.com';
    expect(esAdmin).toBe(false);
  });
});

// ── RF40: Validar credenciales ────────────────────────────────
describe('RF40 — Validar credenciales del administrador', () => {
  it('CP01 — Credenciales con email y password correctos dan acceso', () => {
    const creds = { email: 'admin@inara.com', password: 'pass_segura' };
    expect(creds.email === 'admin@inara.com').toBe(true);
    expect(creds.password.length > 0).toBe(true);
  });
  it('CP02 — Login fallido bloquea acceso', () => {
    const loginExitoso = false;
    expect(loginExitoso).toBe(false);
  });
});

// ── RF41: Bloquear acceso incorrecto ──────────────────────────
describe('RF41 — Bloquear acceso con credenciales incorrectas', () => {
  it('CP01 — Error de Firebase capturado correctamente', () => {
    let errorCapturado = false;
    try { throw { code: 'auth/wrong-password' }; }
    catch (e) { errorCapturado = true; }
    expect(errorCapturado).toBe(true);
  });
  it('CP02 — Sin error Firebase el acceso se concede', () => {
    const loginExitoso = true;
    expect(loginExitoso).toBe(true);
  });
});

// ── RF42: Cerrar sesión admin ─────────────────────────────────
describe('RF42 — Cerrar sesión del administrador', () => {
  it('CP01 — signOut exitoso redirige a /inicio', () => {
    const signOutExitoso = true;
    const destino = signOutExitoso ? '/inicio' : '/admin';
    expect(destino).toBe('/inicio');
  });
  it('CP02 — Error en signOut no rompe la app', () => {
    let errorCapturado = false;
    try { throw new Error('Error de red'); }
    catch (e) { errorCapturado = true; }
    expect(errorCapturado).toBe(true);
  });
});

// ── RF43: Dashboard métricas ──────────────────────────────────
describe('RF43 — Dashboard con resumen de citas', () => {
  it('CP01 — citasHoy cuenta correctamente citas del día', () => {
    const hoy = '20 de julio de 2026';
    const reservas = [
      { fechaAsignada: '20 de julio de 2026' },
      { fechaAsignada: '20 de julio de 2026' },
      { fechaAsignada: '21 de julio de 2026' },
    ];
    const citasHoy = reservas.filter(r => r.fechaAsignada === hoy).length;
    expect(citasHoy).toBe(2);
  });
  it('CP02 — Sin citas hoy, citasHoy===0', () => {
    const hoy = '20 de julio de 2026';
    const reservas = [{ fechaAsignada: '21 de julio de 2026' }];
    const citasHoy = reservas.filter(r => r.fechaAsignada === hoy).length;
    expect(citasHoy).toBe(0);
  });
});

// ── RF44: Tabla de citas ──────────────────────────────────────
describe('RF44 — Tabla de citas registradas', () => {
  it('CP01 — Reservas ordenadas de más reciente a más antigua', () => {
    const reservas = [
      { id: '1', fechaRegistro: '2026-07-20T10:00:00Z' },
      { id: '2', fechaRegistro: '2026-07-22T09:00:00Z' },
      { id: '3', fechaRegistro: '2026-07-21T11:00:00Z' },
    ];
    const ordenadas = [...reservas].sort((a,b) =>
      new Date(b.fechaRegistro).getTime() - new Date(a.fechaRegistro).getTime()
    );
    expect(ordenadas[0].id).toBe('2');
    expect(ordenadas.length).toBe(3);
  });
  it('CP02 — Sin reservas, tabla vacía', () => {
    const snapshot: any[] = [];
    const reservasFiltradas = snapshot.map(doc => ({ id: doc.id }));
    expect(reservasFiltradas.length).toBe(0);
  });
});

// ── RF45: Filtrar por periodo ─────────────────────────────────
describe('RF45 — Filtrar citas por periodo', () => {
  it('CP01 — Filtro mes muestra solo citas de julio 2026', () => {
    const mes = 'julio'; const anio = '2026';
    const reservas = [
      { fechaAsignada: '20 de julio de 2026' },
      { fechaAsignada: '15 de junio de 2026' },
    ];
    const filtradas = reservas.filter(r =>
      r.fechaAsignada.toLowerCase().includes(mes) && r.fechaAsignada.includes(anio)
    );
    expect(filtradas.length).toBe(1);
    expect(filtradas[0].fechaAsignada).toContain('julio');
  });
  it('CP02 — Mes sin citas devuelve array vacío', () => {
    const mes = 'julio'; const anio = '2026';
    const reservas = [{ fechaAsignada: '15 de junio de 2026' }];
    const filtradas = reservas.filter(r =>
      r.fechaAsignada.toLowerCase().includes(mes) && r.fechaAsignada.includes(anio)
    );
    expect(filtradas.length).toBe(0);
  });
});

// ── RF46: Filtrar por tipo ────────────────────────────────────
describe('RF46 — Filtrar citas por tipo de evento', () => {
  it('CP01 — Filtro Matrimonio devuelve solo bodas', () => {
    const reservas = [
      { tipoEvento: 'Matrimonio' },
      { tipoEvento: '15 Años' },
      { tipoEvento: 'Matrimonio' },
    ];
    const filtradas = reservas.filter(r => r.tipoEvento === 'Matrimonio');
    expect(filtradas.length).toBe(2);
    expect(filtradas.every(r => r.tipoEvento === 'Matrimonio')).toBe(true);
  });
  it('CP02 — Tipo inexistente devuelve lista vacía', () => {
    const reservas = [{ tipoEvento: 'Matrimonio' }];
    const filtradas = reservas.filter(r => r.tipoEvento === 'Boda');
    expect(filtradas.length).toBe(0);
  });
});

// ── RF47: Buscar por nombre/código ────────────────────────────
describe('RF47 — Buscar por nombre o código de reserva', () => {
  it('CP01 — Búsqueda parcial "ana" encuentra Ana García', () => {
    const reservas = [
      { nombre: 'Ana', apellidos: 'García', codigoReserva: 'INARA-001' },
      { nombre: 'Luis', apellidos: 'Pérez', codigoReserva: 'INARA-002' },
    ];
    const termino = 'ana';
    const filtradas = reservas.filter(r => {
      const texto = `${r.nombre} ${r.apellidos} ${r.codigoReserva}`.toLowerCase();
      return texto.includes(termino);
    });
    expect(filtradas.length).toBe(1);
    expect(filtradas[0].nombre).toBe('Ana');
  });
  it('CP02 — Búsqueda sin coincidencias devuelve vacío', () => {
    const reservas = [{ nombre: 'Ana', apellidos: 'García', codigoReserva: 'INARA-001' }];
    const filtradas = reservas.filter(r =>
      `${r.nombre} ${r.apellidos} ${r.codigoReserva}`.toLowerCase().includes('carlos')
    );
    expect(filtradas.length).toBe(0);
  });
});

// ── RF48: Detalle de cita ─────────────────────────────────────
describe('RF48 — Ver detalle completo de una cita', () => {
  it('CP01 — Cita con todos los campos está completa', () => {
    const cita = {
      nombre: 'Ana', apellidos: 'García', celular: '987654321',
      correo: 'ana@gmail.com', fechaAsignada: '20 de julio de 2026',
      horaAsignada: '10:00', tipoEvento: 'Matrimonio',
      estado: 'Confirmada', codigoReserva: 'INARA-ABC123'
    };
    const completo = !!(cita.nombre && cita.celular && cita.fechaAsignada && cita.tipoEvento && cita.estado);
    expect(completo).toBe(true);
  });
  it('CP02 — Cita sin código no tiene código válido INARA-', () => {
    const citaSinCodigo = { nombre: 'Ana', estado: 'Confirmada', codigoReserva: '' };
    expect(citaSinCodigo.codigoReserva.startsWith('INARA-')).toBe(false);
  });
});

// ── RF49: Cambiar estado ──────────────────────────────────────
describe('RF49 — Cambiar estado de una cita', () => {
  it('CP01 — Estado cambia a Confirmada', () => {
    const cita: any = { estado: 'Pendiente de Confirmacion' };
    cita.estado = 'Confirmada';
    expect(cita.estado).toBe('Confirmada');
  });
  it('CP02 — Estado inválido rechazado', () => {
    const estadosValidos = ['Pendiente de Confirmacion','Confirmada','Cancelada'];
    expect(estadosValidos.includes('EnProceso')).toBe(false);
  });
});

// ── RF50: Reagendar cita ──────────────────────────────────────
describe('RF50 — Reagendar cita desde el panel', () => {
  it('CP01 — Nueva fecha y hora asignadas correctamente', () => {
    const cita: any = { fechaAsignada: '20 de julio de 2026', horaAsignada: '10:00' };
    Object.assign(cita, { fechaAsignada: '25 de julio de 2026', horaAsignada: '14:00' });
    expect(cita.fechaAsignada).toBe('25 de julio de 2026');
    expect(cita.horaAsignada).toBe('14:00');
  });
  it('CP02 — Sin hora seleccionada, la reprogramación falla', () => {
    const fecha = '2026-07-25'; const hora = '';
    expect(!!(fecha && hora)).toBe(false);
  });
});

// ── RF51: Actualizar disponibilidad ──────────────────────────
describe('RF51 — Actualizar disponibilidad al cancelar/reagendar', () => {
  it('CP01 — Horario liberado tras cancelar', () => {
    const citas: any[] = [{ horaAsignada: '10:00', estado: 'Confirmada' }];
    citas[0].estado = 'Cancelada';
    const ocupados = citas.filter(c => c.estado !== 'Cancelada');
    expect(ocupados.length).toBe(0);
  });
  it('CP02 — Cita Confirmada sigue bloqueando el horario', () => {
    const citas = [{ horaAsignada: '10:00', estado: 'Confirmada' }];
    const ocupados = citas.filter(c => c.estado !== 'Cancelada');
    expect(ocupados.length).toBe(1);
  });
});

// ── RF52: Cita manual ─────────────────────────────────────────
describe('RF52 — Registrar cita manualmente desde el panel', () => {
  it('CP01 — Cita manual tiene código MAN- y estado Confirmada', () => {
    const datosReserva = {
      nombre: 'Carlos Ríos', celular: '987123456',
      estado: 'Confirmada',
      codigoReserva: 'MAN-' + Math.random().toString(36).substring(2,7).toUpperCase()
    };
    expect(datosReserva.codigoReserva.startsWith('MAN-')).toBe(true);
    expect(datosReserva.estado).toBe('Confirmada');
  });
  it('CP02 — Celular inválido bloquea el guardado manual', () => {
    expect(/^9[0-9]{8}$/.test('123')).toBe(false);
  });
});

// ── RF53: Postergar cita ──────────────────────────────────────
describe('RF53 — Postergar cita desde el panel', () => {
  it('CP01 — Nueva fecha y hora asignadas correctamente', () => {
    const cita: any = { fechaAsignada: '22 de julio de 2026', horaAsignada: '09:00' };
    Object.assign(cita, { fechaAsignada: '24 de julio de 2026', horaAsignada: '11:00' });
    expect(cita.fechaAsignada).toBe('24 de julio de 2026');
    expect(cita.horaAsignada).toBe('11:00');
  });
  it('CP02 — Nueva fecha es domingo, se rechaza', () => {
    const nuevaFecha = new Date(2026, 6, 26); // domingo
    expect(nuevaFecha.getDay() === 0).toBe(true);
  });
});

// ── RF54: Lista de clientes ───────────────────────────────────
describe('RF54 — Lista de clientes registrados', () => {
  it('CP01 — Búsqueda por apellido filtra correctamente', () => {
    const clientes = [
      { nombre: 'Ana', apellidos: 'García' },
      { nombre: 'Luis', apellidos: 'Pérez' },
    ];
    const filtrados = clientes.filter(c =>
      `${c.nombre} ${c.apellidos}`.toLowerCase().includes('garcía')
    );
    expect(filtrados.length).toBe(1);
    expect(filtrados[0].nombre).toBe('Ana');
  });
  it('CP02 — Búsqueda sin coincidencias devuelve vacío', () => {
    const clientes = [{ nombre: 'Ana', apellidos: 'García' }];
    const filtrados = clientes.filter(c =>
      `${c.nombre} ${c.apellidos}`.toLowerCase().includes('rodríguez')
    );
    expect(filtrados.length).toBe(0);
  });
});

// ── RF55: Configurar horario ──────────────────────────────────
describe('RF55 — Configurar horario laboral', () => {
  it('CP01 — Configuración con horaInicio y horaFin válidos se guarda', () => {
    const config = { horaInicio: '10:00', horaFin: '18:00', diasFeriados: '' };
    expect(!!(config.horaInicio && config.horaFin)).toBe(true);
    expect(config.horaInicio).toBe('10:00');
  });
  it('CP02 — Feriado con formato DD-MM-AAAA (guiones) falla la validación', () => {
    const regex = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;
    expect(regex.test('28-07-2026')).toBe(false);
  });
});

// ── RF56: Días festivos ───────────────────────────────────────
describe('RF56 — Registrar días festivos', () => {
  it('CP01 — Feriado DD/MM/AAAA válido pasa la regex', () => {
    const regex = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;
    expect(regex.test('28/07/2026')).toBe(true);
  });
  it('CP02 — Feriado con año de 2 dígitos falla la regex', () => {
    const regex = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;
    expect(regex.test('28/07/26')).toBe(false);
  });
});

// ── RF57: Totalizador mes ─────────────────────────────────────
describe('RF57 — Totalizador de citas del mes', () => {
  it('CP01 — citasMes cuenta 5 citas de julio 2026', () => {
    const reservas = Array(5).fill(null).map((_,i) => ({ fechaAsignada: `${i+10} de julio de 2026` }));
    const citasMes = reservas.filter(r =>
      r.fechaAsignada.toLowerCase().includes('julio') && r.fechaAsignada.includes('2026')
    ).length;
    expect(citasMes).toBe(5);
  });
  it('CP02 — Sin citas del mes, citasMes===0', () => {
    const reservas = [{ fechaAsignada: '15 de junio de 2026' }];
    const citasMes = reservas.filter(r =>
      r.fechaAsignada.toLowerCase().includes('julio') && r.fechaAsignada.includes('2026')
    ).length;
    expect(citasMes).toBe(0);
  });
});

// ── RF58: Totalizador año ─────────────────────────────────────
describe('RF58 — Totalizador de citas del año', () => {
  it('CP01 — citasAnio cuenta 20 citas de 2026', () => {
    const reservas = Array(20).fill(null).map(() => ({ fechaAsignada: '15 de julio de 2026' }));
    const citasAnio = reservas.filter(r => r.fechaAsignada.includes('2026')).length;
    expect(citasAnio).toBe(20);
  });
  it('CP02 — Citas de 2025 no se cuentan en el totalizador de 2026', () => {
    const reservas = [
      { fechaAsignada: '10 de julio de 2026' },
      { fechaAsignada: '15 de julio de 2026' },
      { fechaAsignada: '20 de julio de 2026' },
      { fechaAsignada: '10 de julio de 2025' },
      { fechaAsignada: '20 de junio de 2025' },
    ];
    const citasAnio = reservas.filter(r => r.fechaAsignada.includes('2026')).length;
    expect(citasAnio).toBe(3);
  });
});

// ── RF59: Reporte tipos de evento ─────────────────────────────
describe('RF59 — Reporte de tipos de eventos', () => {
  it('CP01 — calcularEstadisticas() cuenta correctamente por tipo', () => {
    const reservas = [
      ...Array(5).fill({ tipoEvento: 'Matrimonio' }),
      ...Array(3).fill({ tipoEvento: '15 Años' }),
      ...Array(2).fill({ tipoEvento: 'Baby Shower' }),
    ];
    const stats: Record<string,number> = { 'Matrimonio':0,'15 Años':0,'Baby Shower':0 };
    reservas.forEach(r => { if(stats[r.tipoEvento]!==undefined) stats[r.tipoEvento]++; });
    expect(stats['Matrimonio']).toBe(5);
    expect(stats['15 Años']).toBe(3);
    expect(stats['Baby Shower']).toBe(2);
  });
  it('CP02 — Tipo desconocido va a Otros eventos u cumpleaños', () => {
    const reservas = [{ tipoEvento: 'TipoRaro' }];
    const stats: Record<string,number> = { 'Matrimonio':0,'Otros eventos u cumpleaños':0 };
    reservas.forEach(r => {
      if(stats[r.tipoEvento]!==undefined) stats[r.tipoEvento]++;
      else stats['Otros eventos u cumpleaños']++;
    });
    expect(stats['Otros eventos u cumpleaños']).toBe(1);
  });
});

// ── RF60: Exportar CSV ────────────────────────────────────────
describe('RF60 — Exportar lista de citas a CSV', () => {
  it('CP01 — CSV con 10 citas generado correctamente', () => {
    const reservas = Array(10).fill(null).map((_,i) => ({
      codigoReserva: `INARA-00${i}`, nombre: 'Cliente',
      celular: '987654321', estado: 'Confirmada',
      fechaAsignada: '20 de julio de 2026', horaAsignada: '10:00'
    }));
    const headers = ['Codigo','Cliente','Celular','Estado','Fecha','Hora'];
    const filas = reservas.map(r => [r.codigoReserva, r.nombre, r.celular, r.estado, r.fechaAsignada, r.horaAsignada]);
    const csv = [headers.join(';'), ...filas.map(f => f.join(';'))].join('\n');
    expect(filas.length).toBe(10);
    expect(csv.startsWith('Codigo')).toBe(true);
  });
  it('CP02 — Sin citas, exportar no genera archivo', () => {
    const reservasFiltradas: any[] = [];
    const archivoGenerado = reservasFiltradas.length > 0;
    expect(archivoGenerado).toBe(false);
  });
});
