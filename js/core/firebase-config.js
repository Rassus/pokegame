/* ============ firebase-config.js — conexión con tu proyecto de Firebase ============
 * Pega aquí la configuración de tu app web de Firebase (Consola de Firebase >
 * Configuración del proyecto > Tus apps > SDK setup and configuration > Config).
 * Los pasos completos están en docs/FIREBASE.md.
 *
 * Estos datos NO son secretos: Firebase los diseña para ir en la web. Lo que
 * protege las partidas son las reglas de Firestore (firestore.rules).
 *
 * Si se pone a null, el juego funciona en modo local (sólo en el navegador).
 */
// Proyecto pokesurvivor-free (desde el 12-10-2026): autenticación normal de Firebase,
// SIN Identity Platform, así las cuentas son gratis sin límite. ¡No pulsar nunca
// "Actualizar a Identity Platform" en su consola! (El viejo era pokesurvivor-jpter.)
G.FIREBASE_CONFIG = {
  apiKey: "AIzaSyACBxyiwm9xL_VkVmG3IR0p41okYFcD5bI",
  authDomain: "pokegame-5ce5c.firebaseapp.com",
  databaseURL: "https://pokegame-5ce5c-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "pokegame-5ce5c",
  storageBucket: "pokegame-5ce5c.firebasestorage.app",
  messagingSenderId: "202886845924",
  appId: "1:202886845924:web:3e97c22aa9166aa4cfe3f1",
  measurementId: "G-9LVBL91V7L"
};

/* Ejemplo de cómo debe quedar:
G.FIREBASE_CONFIG = {
  apiKey: 'AIza...',
  authDomain: 'tu-proyecto.firebaseapp.com',
  projectId: 'tu-proyecto',
  storageBucket: 'tu-proyecto.firebasestorage.app',
  messagingSenderId: '1234567890',
  appId: '1:1234567890:web:abc123'
};
*/
