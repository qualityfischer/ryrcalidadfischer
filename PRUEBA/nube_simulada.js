/* ============================================================================
   NUBE SIMULADA - solo para pruebas.
   Reproduce, dentro del navegador, las mismas funciones y reglas que supabase_msa_flujo.sql
   (usuarios y PIN, sesiones, firmas, folios, estatus, historial y permisos por perfil).
   Los datos viven en este navegador (localStorage); no se envía nada a internet.
   ============================================================================ */
const NubeSim = (function () {
    const CLAVE = 'msa_pv_nubesim', PIN_INICIAL = '123456';
    const SEMILLA = [['XE', 'Axel Rosas', 'admin'], ['HL', 'Humberto Montor', 'inspector'], ['LU', 'Luis Mejia', 'gerente'], ['LB', 'Juan Luis Martinez', 'revisor'], ['HT', 'Hector Aguilar', 'inspector'],
        ['CV', 'Javier Cervantes', 'inspector'], ['JV', 'Juan Vélez', 'revisor'], ['BS', 'Berenise Trujillo', 'inspector'], ['LX', 'Alexis Alvarez', 'inspector'], ['AV', 'Marco Avalos', 'inspector'],
        ['DM', 'Monserrat Domingo', 'inspector'], ['LP', 'Miguel A Lopez', 'inspector'], ['AN', 'Anilu Solano', 'inspector'], ['YR', 'Edgar Reyes', 'inspector'], ['VO', 'Maria de los Angeles Pavon', 'inspector']];
    const sal = () => Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const hash = (s, p) => msaSha256(s + ':' + (p || ''));
    const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.floor(Math.random() * 16); return (c === 'x' ? r : (r & 3) | 8).toString(16); });
    const ahora = () => new Date().toISOString();
    function nueva() {
        const db = { usuarios: {}, sesiones: {}, firmas: {}, folios: {}, estudios: [], historial: [], hid: 0 };
        SEMILLA.forEach(([v, n, r]) => { const s = sal(); db.usuarios[v] = { visa: v, nombre: n, rol: r, sal: s, hash: hash(s, PIN_INICIAL), intentos: 0, bloqueado: 0, activo: true }; });
        return db;
    }
    function guardar(d) { localStorage.setItem(CLAVE, JSON.stringify(d)); }
    function leer() { try { const d = JSON.parse(localStorage.getItem(CLAVE)); if (d && d.usuarios) return d; } catch (e) { } const d = nueva(); guardar(d); return d; }
    const falla = m => { throw new Error(m); };
    function sesion(db, token) {
        const s = db.sesiones[token], u = s && new Date(s.expira) > new Date() && db.usuarios[s.visa];
        if (!u || !u.activo) falla('Sesión no válida o vencida. Vuelva a conectarse.');
        return u;
    }
    function pinOk(db, visa, pin) {
        const u = db.usuarios[visa]; if (!u || !u.activo) return false;
        if (u.bloqueado && u.bloqueado > Date.now()) return false;
        if (hash(u.sal, pin) === u.hash) { u.intentos = 0; u.bloqueado = 0; return true; }
        if (u.intentos + 1 >= 5) { u.intentos = 0; u.bloqueado = Date.now() + 15 * 60000; } else u.intentos += 1;
        return false;
    }
    const participo = (db, visa, e) => db.historial.some(h => h.estudio === e.id && h.por === visa);
    const visible = (db, rol, visa, e) => rol === 'admin' ? true : rol === 'revisor' ? (e.autor === visa || e.estatus === 'en_revision' || e.revisor === visa || participo(db, visa, e))
        : rol === 'gerente' ? (e.autor === visa || ['en_autorizacion', 'autorizado'].includes(e.estatus) || e.autorizador === visa || participo(db, visa, e)) : e.autor === visa;
    const pendiente = (rol, visa, e) => (e.estatus === 'en_revision' && ['revisor', 'admin'].includes(rol) && e.autor !== visa)
        || (e.estatus === 'en_autorizacion' && ['gerente', 'admin'].includes(rol) && e.autor !== visa && (e.revisor || '') !== visa) || (e.estatus === 'devuelto' && e.autor === visa);
    const F = {
        msa_login(db, a) {
            const visa = String(a.p_visa || '').trim().toUpperCase(), u = db.usuarios[visa];
            if (!u || !u.activo) return { ok: false, error: 'Usuario o PIN incorrecto.' };
            if (u.bloqueado && u.bloqueado > Date.now()) return { ok: false, error: 'Demasiados intentos. Intente de nuevo en unos minutos.' };
            if (!pinOk(db, visa, a.p_pin || '')) return { ok: false, error: 'Usuario o PIN incorrecto.' };
            Object.keys(db.sesiones).forEach(t => { if (new Date(db.sesiones[t].expira) < new Date()) delete db.sesiones[t]; });
            const token = (uuid() + uuid()).replace(/-/g, ''); db.sesiones[token] = { visa, expira: new Date(Date.now() + 12 * 3600000).toISOString() };
            return { ok: true, token, visa: u.visa, nombre: u.nombre, rol: u.rol, tiene_firma: !!db.firmas[visa] };
        },
        msa_cambiar_pin(db, a) {
            const u = sesion(db, a.p_token);
            if (!/^[0-9]{6,8}$/.test(a.p_pin_nuevo || '')) return { ok: false, error: 'El PIN nuevo debe tener de 6 a 8 dígitos.' };
            if (!pinOk(db, u.visa, a.p_pin_actual || '')) return { ok: false, error: 'El PIN actual es incorrecto.' };
            u.sal = sal(); u.hash = hash(u.sal, a.p_pin_nuevo); return { ok: true };
        },
        msa_guardar_firma(db, a) {
            const u = sesion(db, a.p_token), img = a.p_imagen;
            if (!img || img.length > 250000) return { ok: false, error: 'La imagen de la firma es demasiado grande.' };
            if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(img)) return { ok: false, error: 'La firma debe ser una imagen PNG.' };
            db.firmas[u.visa] = img; return { ok: true };
        },
        msa_enviar(db, a) {
            const u = sesion(db, a.p_token), reg = a.p_registro, pid = a.p_id || null;
            if (!reg || !reg.equipo || !['Variables', 'Atributos'].includes(reg.tipo) || !reg.snap) falla('El reporte no tiene el formato esperado.');
            if (JSON.stringify(reg).length > 3000000) falla('El reporte es demasiado grande.');
            const firma = db.firmas[u.visa]; if (!firma) falla('Registre su firma antes de enviar un reporte.');
            const fe = { elaboro: { visa: u.visa, nombre: u.nombre, img: firma, cuando: ahora() } }, clave = reg.id || '';
            if (pid) {
                const e = db.estudios.find(x => x.id === pid); if (!e || e.autor !== u.visa) falla('No se encontró el estudio a corregir.');
                if (e.estatus !== 'devuelto') falla('Solo se puede reenviar un estudio devuelto.');
                Object.assign(e, { registro: reg, firmas: fe, version: e.version + 1, estatus: 'en_revision', revisor: null, autorizador: null, clave_local: clave, equipo: reg.equipo, descripcion: reg.descripcion || null, tipo: reg.tipo, estatus_desde: ahora(), actualizado: ahora() });
                db.historial.push({ id: ++db.hid, estudio: pid, version: e.version, de: 'devuelto', a: 'en_revision', por: u.visa, comentario: 'Reenviado con correcciones', cuando: ahora() });
                return { ok: true, id: pid, folio: e.folio, estatus: 'en_revision', version: e.version };
            }
            if (clave && db.estudios.some(x => x.autor === u.visa && x.clave_local === clave)) falla('Este reporte ya fue enviado.');
            const anio = new Date().getFullYear(); db.folios[anio] = (db.folios[anio] || 0) + 1;
            const folio = 'RR-' + anio + '-' + String(db.folios[anio]).padStart(4, '0'), id = uuid();
            db.estudios.push({ id, folio, anio, equipo: reg.equipo, descripcion: reg.descripcion || null, tipo: reg.tipo, autor: u.visa, estatus: 'en_revision', version: 1, registro: reg, firmas: fe, revisor: null, autorizador: null, clave_local: clave, creado: ahora(), estatus_desde: ahora(), actualizado: ahora() });
            db.historial.push({ id: ++db.hid, estudio: id, version: 1, de: null, a: 'en_revision', por: u.visa, comentario: 'Enviado a revisión', cuando: ahora() });
            return { ok: true, id, folio, estatus: 'en_revision', version: 1 };
        },
        msa_listar(db, a) {
            const u = sesion(db, a.p_token);
            return db.estudios.filter(e => visible(db, u.rol, u.visa, e)).sort((x, y) => String(y.actualizado).localeCompare(String(x.actualizado))).map(e => ({
                id: e.id, folio: e.folio, equipo: e.equipo, descripcion: e.descripcion, tipo: e.tipo, autor: e.autor, autor_nombre: db.usuarios[e.autor].nombre, estatus: e.estatus, version: e.version, revisor: e.revisor, autorizador: e.autorizador,
                creado: e.creado, estatus_desde: e.estatus_desde, actualizado: e.actualizado, dias: Math.floor((Date.now() - new Date(e.estatus_desde)) / 86400000), nivel: e.registro.nivel || null, pendiente: pendiente(u.rol, u.visa, e) }));
        },
        msa_obtener(db, a) {
            const u = sesion(db, a.p_token), e = db.estudios.find(x => x.id === a.p_id);
            if (!e || !visible(db, u.rol, u.visa, e)) falla('No se encontró el estudio o no tiene permiso para verlo.');
            return Object.assign({}, e, { autor_nombre: db.usuarios[e.autor].nombre, pendiente: pendiente(u.rol, u.visa, e),
                historial: db.historial.filter(h => h.estudio === e.id).map(h => Object.assign({}, h, { por_nombre: db.usuarios[h.por].nombre })) });
        },
        msa_decidir(db, a) {
            const u = sesion(db, a.p_token), e = db.estudios.find(x => x.id === a.p_id); if (!e) falla('No se encontró el estudio.');
            const com = String(a.p_comentario || '').trim() || null, acc = a.p_accion;
            if (!['aprobar_revision', 'devolver', 'autorizar'].includes(acc)) falla('Acción no válida.');
            if (e.autor === u.visa) falla('Quien elabora un estudio no puede revisarlo ni aprobarlo.');
            if (acc === 'aprobar_revision') {
                if (e.estatus !== 'en_revision') falla('El estudio no está en revisión.');
                if (!['revisor', 'admin'].includes(u.rol)) falla('Su perfil no puede revisar estudios.');
            } else if (acc === 'autorizar') {
                if (e.estatus !== 'en_autorizacion') falla('El estudio no está en aprobación.');
                if (!['gerente', 'admin'].includes(u.rol)) falla('Su perfil no puede aprobar estudios.');
                if ((e.revisor || '') === u.visa) falla('Quien revisó el estudio no puede aprobarlo.');
            } else {
                if (e.estatus === 'en_revision') { if (!['revisor', 'admin'].includes(u.rol)) falla('Su perfil no puede devolver este estudio.'); }
                else if (e.estatus === 'en_autorizacion') {
                    if (!['gerente', 'admin'].includes(u.rol)) falla('Su perfil no puede devolver este estudio.');
                    if ((e.revisor || '') === u.visa) falla('Quien revisó el estudio no puede devolverlo desde aprobación.');
                } else falla('Este estudio no está pendiente de revisión ni de aprobación.');
                if (!com || com.length < 5) falla('Escriba los comentarios de la devolución (mínimo 5 caracteres).');
            }
            let firma = null;
            if (acc !== 'devolver') {
                if (!pinOk(db, u.visa, a.p_pin || '')) return { ok: false, error: 'PIN incorrecto.' };
                firma = db.firmas[u.visa]; if (!firma) return { ok: false, error: 'Registre su firma antes de firmar un estudio.' };
            }
            const cuando = ahora(), de = e.estatus; let nuevo;
            if (acc === 'aprobar_revision') { e.estatus = nuevo = 'en_autorizacion'; e.revisor = u.visa; e.firmas = Object.assign({}, e.firmas, { reviso: { visa: u.visa, nombre: u.nombre, img: firma, cuando } }); }
            else if (acc === 'autorizar') { e.estatus = nuevo = 'autorizado'; e.autorizador = u.visa; e.firmas = Object.assign({}, e.firmas, { autorizo: { visa: u.visa, nombre: u.nombre, img: firma, cuando } }); }
            else { e.estatus = nuevo = 'devuelto'; e.revisor = null; e.autorizador = null; e.firmas = { elaboro: e.firmas.elaboro }; }
            e.estatus_desde = cuando; e.actualizado = cuando;
            db.historial.push({ id: ++db.hid, estudio: e.id, version: e.version, de, a: nuevo, por: u.visa, comentario: com, cuando });
            return { ok: true, estatus: nuevo };
        },
        msa_admin_usuarios(db, a) {
            const u = sesion(db, a.p_token); if (u.rol !== 'admin') falla('Solo el administrador puede ver esta información.');
            return Object.keys(db.usuarios).sort().map(v => { const x = db.usuarios[v]; return { visa: x.visa, nombre: x.nombre, rol: x.rol, activo: x.activo, tiene_firma: !!db.firmas[v], bloqueado: !!(x.bloqueado && x.bloqueado > Date.now()) }; });
        },
        msa_admin_pin(db, a) {
            const u = sesion(db, a.p_token); if (u.rol !== 'admin') falla('Solo el administrador puede restablecer un PIN.');
            const v = String(a.p_visa || '').trim().toUpperCase();
            if (!/^[0-9]{6,8}$/.test(a.p_pin_nuevo || '')) return { ok: false, error: 'El PIN nuevo debe tener de 6 a 8 dígitos.' };
            if (!db.usuarios[v]) return { ok: false, error: 'No existe ese usuario.' };
            const x = db.usuarios[v]; x.sal = sal(); x.hash = hash(x.sal, a.p_pin_nuevo); x.intentos = 0; x.bloqueado = 0;
            Object.keys(db.sesiones).forEach(t => { if (db.sesiones[t].visa === v) delete db.sesiones[t]; });
            return { ok: true };
        }
    };
    return {
        rpc(fn, args) {
            return new Promise((res, rej) => {
                try { const db = leer(), f = F[fn]; if (!f) throw new Error('Función desconocida: ' + fn); const out = f(db, args || {}); guardar(db); res(JSON.parse(JSON.stringify(out === undefined ? null : out))); }
                catch (e) { rej(e); }       // como en la base de datos, un error deshace todo cambio
            });
        },
        reset() { localStorage.removeItem(CLAVE); }
    };
})();
