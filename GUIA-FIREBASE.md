# Puesta en marcha de Bi-guay-Di

La web se publica como sitio estático en GitHub Pages. Las credenciales BYD, el acceso a BYD y el almacenamiento viven en Firebase/Google Cloud. El navegador no puede conectar la cuenta de forma segura por sí solo.

## Lo que hace falta

- Una cuenta Google para crear un proyecto Firebase.
- Una cuenta GitHub y un repositorio para esta carpeta.
- Una cuenta BYD válida en España.
- Para publicar el backend seguro que inicia sesión en BYD hará falta vincular facturación de Google Cloud (plan Blaze). La versión económica consulta BYD solo al conectar o cuando el usuario pulsa «Actualizar ahora»; no ejecuta consultas programadas en segundo plano.

No compartas la contraseña BYD, claves privadas, clave de servicio ni valores secretos por correo, GitHub o este chat.

## 1. Crear el proyecto Firebase

1. En Firebase Console crea un proyecto nuevo para Bi-guay-Di.
2. En «Configuración del proyecto → Tus apps», añade una aplicación web. Copia `apiKey`, `authDomain`, `projectId` y `appId` a `firebase-config.js`; conserva `functionsRegion` como `europe-west1`.
3. Crea Firestore en la ubicación `europe-west1` y conserva las reglas del archivo `firestore.rules`.
4. La aplicación usa Firebase Authentication con tokens personalizados. No hace falta habilitar acceso por correo/contraseña: el backend emite la sesión únicamente después de validar la cuenta BYD.
5. Firebase Functions y Cloud KMS requieren el plan Blaze con cuenta de facturación. No actives facturación hasta decidirlo; el plan es de pago por uso y puede generar cargos.

## 2. Crear la clave de cifrado

1. En Google Cloud Console, crea un key ring llamado `biguaydi` en `europe-west1`.
2. Crea una clave simétrica llamada `byd-credentials` con propósito de cifrado/descifrado.
3. En IAM localiza la cuenta de servicio de ejecución de Cloud Functions/Cloud Run asociada al proyecto y concédele en esa clave el rol `Cloud KMS CryptoKey Encrypter/Decrypter` (`roles/cloudkms.cryptoKeyEncrypterDecrypter`). No concedas ese permiso a GitHub Pages ni al navegador.
4. El nombre completo de la clave tiene esta forma: `projects/PROJECT_ID/locations/europe-west1/keyRings/biguaydi/cryptoKeys/byd-credentials`.

## 3. Preparar el backend

En un ordenador con Node.js y Python 3.13 instalados, abre PowerShell en la carpeta del proyecto. Instala Firebase CLI y autentícate:

```powershell
npm install -g firebase-tools
firebase login
```

Copia `.firebaserc.example` a `.firebaserc` y reemplaza `SUSTITUIR_POR_PROJECT_ID` por el ID real del proyecto. Copia `functions/.env.example` a `functions/.env.PROJECT_ID` (sustituye `PROJECT_ID` por el ID real) y configura la URL exacta de Pages y el nombre completo de la clave KMS. No subas los archivos `.env` a GitHub.

Genera el secreto interno que se utiliza para derivar la identidad privada de la cuenta BYD y guárdalo directamente como secreto de Firebase:

```powershell
$pepper = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
firebase functions:secrets:set APP_UID_PEPPER
```

Cuando Firebase solicite el valor, pega el contenido de `$pepper` en la consola. No lo guardes en el código ni lo publiques. El identificador de usuario resultante es un HMAC; el correo BYD no se usa como ID público.

## 4. Publicar backend y reglas

Desde la carpeta del proyecto:

```powershell
firebase deploy --only functions,firestore:rules
```

La primera publicación puede pedir habilitar APIs de Google Cloud. Revisa que el origen CORS configurado coincida exactamente con el dominio que Pages mostrará, incluyendo `https://` y sin rutas. `firebase.json` fija la región `europe-west1`.

## 5. Publicar la PWA en GitHub Pages

1. Crea un repositorio GitHub y sube el contenido del proyecto. No incluyas `.env`, `.firebaserc` con información privada, claves de servicio ni archivos de credenciales.
2. En el repositorio abre `Settings → Pages` y elige `GitHub Actions` como fuente. El workflow de este proyecto publica únicamente los archivos estáticos de la PWA, sin la carpeta de backend.
3. Espera a que termine el workflow y abre la URL Pages. Si usas un dominio personalizado, configúralo en Pages y pon exactamente ese origen en `BGUAYDI_ALLOWED_ORIGIN` antes de desplegar de nuevo las funciones.
4. En Firebase Authentication, añade el dominio `OWNER.github.io` (o tu dominio personalizado) a los dominios autorizados.

La configuración de Firebase web es pública por diseño y no es una contraseña. Las reglas de Firestore y las funciones protegen los datos. Nunca pongas aquí secretos de BYD, KMS ni cuentas de servicio.

## 6. Conectar y usar

En la web abre «Conecta tu BYD», marca el consentimiento y escribe las credenciales BYD. El formulario las envía por HTTPS a la función de Firebase. La función valida el acceso y guarda el secreto cifrado con KMS. Si hay varios coches en la cuenta, elige uno. La primera actualización se realiza inmediatamente. Para limitar costes, esta versión no se sincroniza en segundo plano: pulsa «Actualizar ahora» cuando quieras consultar el coche.

Si la conexión falla, revisa el mensaje, que la cuenta funcione en la app oficial, la URL permitida, el secreto `APP_UID_PEPPER`, los permisos KMS y los registros de Cloud Functions. Nunca copies contraseñas o tokens a un issue público.

## Alcance de datos

La integración está limitada a lecturas de nube, no incluye comandos remotos. No consulta GPS. SoC, autonomía, velocidad, odómetro y estadísticas de energía aparecen solo si BYD devuelve esos campos para el vehículo/cuenta. La API comunitaria no proporciona por ahora un registro fiable de cada trayecto y su kWh exactos, así que esta primera fase no presenta historiales ni ahorros por trayecto como datos reales.

Este proyecto usa `pyBYD`, una biblioteca comunitaria no oficial cuya API puede cambiar. La cuenta BYD podría requerir autenticarse de nuevo y BYD puede cambiar sus protocolos. La conexión con un único coche concreto y la cobertura de campos deben validarse al configurar la cuenta. No se crea una tarea de sincronización periódica para reducir costes.
