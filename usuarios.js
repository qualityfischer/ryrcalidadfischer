/* ============================================================================
   FISCHER MSA STUDIO - DIRECTORIO DE USUARIOS
   Para agregar o quitar personas, edite la lista (una línea por usuario) y suba el archivo de nuevo.
   ============================================================================ */
const USUARIOS = [
    { visa: 'XE', nombre: 'Axel Rosas', admin: true },
    { visa: 'HL', nombre: 'Humberto Montor' },
    { visa: 'LU', nombre: 'Luis Mejia' },
    { visa: 'LB', nombre: 'Juan Luis Martinez' },
    { visa: 'HT', nombre: 'Hector Aguilar' },
    { visa: 'CV', nombre: 'Javier Cervantes' },
    { visa: 'JV', nombre: 'Juan Vélez' },
    { visa: 'BS', nombre: 'Berenise Trujillo' },
    { visa: 'LX', nombre: 'Alexis Alvarez' },
    { visa: 'AV', nombre: 'Marco Avalos' },
    { visa: 'DM', nombre: 'Monserrat Domingo' },
    { visa: 'LP', nombre: 'Miguel A Lopez' },
    { visa: 'AN', nombre: 'Anilu Solano' },
    { visa: 'YR', nombre: 'Edgar Reyes' },
    { visa: 'VO', nombre: 'Maria de los Angeles Pavon' },
];

/* PIN del administrador: aquí solo se guarda la huella (SHA-256 de "msa-studio|VISA|PIN"), no el PIN.
   Es una barrera sencilla, no un candado de seguridad: cualquiera que lea este archivo puede intentar adivinarlo.
   Para cambiar el PIN, pida la nueva huella. */
const PIN_ADMIN = { XE: 'a0e8924f66b9401d6a4576d230bedc288cbce870c693588e36d7353349afa70e' };

        function msaSha256(texto) {
            const bytes = Array.from(unescape(encodeURIComponent(texto))).map(ch => ch.charCodeAt(0));
            const primos = []; for (let n = 2; primos.length < 64; n++) if (primos.every(p => n % p)) primos.push(n);
            const K = primos.map(p => Math.floor((Math.cbrt(p) % 1) * 4294967296));
            let H = primos.slice(0, 8).map(p => Math.floor((Math.sqrt(p) % 1) * 4294967296));
            const bits = bytes.length * 8; bytes.push(0x80); while (bytes.length % 64 !== 56) bytes.push(0);
            for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bits >>> (i * 8)) & 255);
            const rotr = (x, n) => (x >>> n) | (x << (32 - n));
            for (let o = 0; o < bytes.length; o += 64) {
                const w = new Array(64);
                for (let i = 0; i < 16; i++) w[i] = ((bytes[o + 4 * i] << 24) | (bytes[o + 4 * i + 1] << 16) | (bytes[o + 4 * i + 2] << 8) | bytes[o + 4 * i + 3]) >>> 0;
                for (let i = 16; i < 64; i++) {
                    const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
                    w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
                }
                let [a, b, c, d, e, f, g, h] = H;
                for (let i = 0; i < 64; i++) {
                    const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25), ch = (e & f) ^ (~e & g), t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
                    const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22), maj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + maj) >>> 0;
                    h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
                }
                H = [H[0] + a, H[1] + b, H[2] + c, H[3] + d, H[4] + e, H[5] + f, H[6] + g, H[7] + h].map(v => v >>> 0);
            }
            return H.map(v => v.toString(16).padStart(8, '0')).join('');
        }
