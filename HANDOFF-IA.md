# Traspaso técnico: Bi-guay-Di

Documento de contexto para que otra IA pueda continuar el proyecto sin repetir decisiones ni pedir al usuario pasos que ya completó. Actualizado el 4 de octubre de 2026.

## 1. Objetivo del producto

Crear una PWA en español, de uso sencillo desde el móvil, llamada **Bi-guay-Di**, para consultar los datos disponibles de un BYD Dolphin Surf usando la API comunitaria de nube BYD (ingeniería inversa de la app oficial), sin instalar software en el coche.

El usuario quiere:

- Interfaz moderna, high-tech, clara, con todos los datos que la fuente realmente proporcione.
- Comparar el gasto del coche eléctrico con gasolina, usando precios españoles próximos al inicio del trayecto; mostrar CO₂ evitado.
- Ajustar el cálculo según la fuente eléctrica (red, placas solares o mezcla).
- Ver consumo en kW/kWh, historial de trayectos, comparativas y récords/KPIs.
- Poder adaptar el texto con un deslizador de cinco niveles y escoger hasta cinco temas de color; mostrar la imagen del coche que corresponde al tema desde `PICTURES/`.
- Mantener la telemetría del vehículo independiente del panel de impacto/ahorro.
- Minimizar al máximo pasos técnicos para el usuario final. El usuario final no debe instalar herramientas ni conocer informática: idealmente conectar BYD y usar.
- Mantener el coste en cero siempre que sea posible. El usuario no ha autorizado añadir facturación ni cambiar a Blaze.

## 2. Decisiones ya tomadas

- El proyecto dejó de usar Trip Stats como fuente principal. Se descartó esa vía por excesiva complejidad para el usuario.
- La fuente prevista es `pyBYD`, cliente Python comunitario y no oficial, ejecutado en un backend. El frontend estático nunca debe recibir la contraseña BYD ni controlar el coche.
- Hosting estático previsto: GitHub Pages. Base de datos: Firestore Standard (plan gratuito Spark por ahora).
- El flujo BYD es **solo lectura**. No recoger `control_pin`, no ejecutar comandos remotos y no pedir/guardar GPS por defecto.
- Se había planteado Cloud KMS para cifrar las credenciales BYD almacenadas. Backend + KMS exige habilitar facturación/Blaze; esa transición está detenida hasta decidir costes.
- Para reducir consumo/coste, se eliminó la tarea automática de sondeo cada 15 minutos. BYD se consulta al conectar o al pulsar «Actualizar ahora». No anunciar sincronización en segundo plano.
- No inventar datos de viajes, ahorros ni CO₂. La API cloud investigada no proporciona un historial fiable por trayecto con kWh exactos. SoC, autonomía, odómetro, velocidad, GPS y estadísticas de energía varían por vehículo y respuesta; GPS está expresamente filtrado en backend.
- Precio de gasolina/electricidad en tiempo real o histórico, precio al comienzo del viaje, CO₂ por trayecto y cálculo solar real aún no están implementados. No anunciar estos cálculos como datos reales sin fuentes, método y datos por viaje.

## 3. Estado de las cuentas y consola Firebase

- El usuario creó el proyecto Firebase **Bi-guay-Di**.
- Firebase Project ID: `bi-guay-di`.
- Registró una aplicación Web. La configuración pública de Firebase ya se copió a `firebase-config.js`; no volver a pedirla ni dictarla. La clave Web de Firebase no es la contraseña BYD, pero no hay que pegar secretos de backend en archivos públicos.
- En la consola, Firestore Standard se creó correctamente, base `(default)`, modo de producción, sin copias programadas. En el flujo guiado se indicó `europe-west1 (Belgium)`; la última captura confirma que la base está lista, pero no muestra su ubicación, por lo que conviene verificar la ubicación en consola antes de desplegar funciones en esa región.
- El proyecto sigue en **Spark**. No se ha vinculado cuenta de facturación ni se ha añadido tarjeta. No actualizar el plan sin aprobación explícita del usuario.
- La consola quedó en Firestore → Datos, mostrando la base vacía lista. **No es necesario crear colecciones manualmente**; las funciones las crearían al conectarse.
- No se ha activado Firebase Authentication manualmente. El código usa tokens personalizados generados por backend tras validar BYD.

## 4. Estado local del código

Workspace: `D:\APP BYD DOLPHIN SURF` (Windows/PowerShell). No se encontró `.git` en la raíz durante la preparación; no se ha creado ni publicado repositorio remoto.

- `index.html`: interfaz existente de Bi-guay-Di; se añadió formulario de conexión BYD, selección de coche, métricas y catálogo expandible de campos retornados por la API. La antigua importación Trip Stats está oculta. Los paneles de muestra del dashboard se ocultan al conectar.
- `cloud-app.js`: SDK web Firebase modular cargado desde CDN, estado de sesión, llamadas callable, lectura Firestore en tiempo real, renderizado de telemetría/campos, conectar/seleccionar/actualizar/desconectar.
- `firebase-config.js`: configuración Firebase pública del proyecto `bi-guay-di`, región prevista `europe-west1`.
- `functions/main.py`: Firebase Functions Python. Callable endpoints: `connect_byd`, `choose_vehicle`, `get_vehicle_data`, `refresh_vehicle_data`, `disconnect_byd`. Verifica cuenta con `pyBYD`, produce Firebase custom token, cifra la contraseña por KMS, almacena telemetría sin ubicación y limita intentos de login. No hay función programada después del cambio de coste.
- `functions/requirements.txt`: `firebase-functions`, `firebase-admin`, `google-cloud-kms`, `pybyd==0.0.73`.
- `firebase.json`: Functions Python 3.13 y reglas Firestore.
- `firestore.rules`: clientes autenticados solo leen su propio documento `vehicleData/{uid}` y muestras; credenciales `bydConnections` y límites de login son servidor solamente. El resto queda denegado.
- `.firebaserc.example`: plantilla con ID pendiente de rellenar; no existe `.firebaserc` real.
- `functions/.env.example`: placeholders `BGUAYDI_ALLOWED_ORIGIN` y `KMS_KEY_NAME`; no existe `.env.<projectId>` real.
- `.gitignore`: excluye `.env`, `.firebase`, `.venv`, claves de servicio y archivos de credenciales.
- `.github/workflows/pages.yml`: workflow preparado para GitHub Pages Actions; construye una lista permitida de archivos estáticos y copia `PICTURES/`, no publica `functions/` ni `.env`.
- `sw.js`: caché PWA actualizada con los archivos web. Firebase CDN y llamadas de backend requieren conexión de red.
- `GUIA-FIREBASE.md`: pasos técnicos de despliegue.
- `PRIVACIDAD.md`: información de tratamiento de credenciales/telemetría y límites.
- `GUIA-DE-INTEGRACION.md`: explica que la guía Trip Stats quedó obsoleta.
- `trip-import.js`: archivo antiguo permanece en el directorio, pero ya no se carga desde `index.html`.
- `app.js`, `app.css`, `customize.css`, `manifest.webmanifest`, `icon.svg`, `PICTURES/`: interfaz, temas, imágenes y PWA preexistentes.

## 5. Límites de integración/API que debe respetar el siguiente agente

- `pyBYD` es una interfaz comunitaria, no oficial, y puede romperse cuando BYD cambie protocolo o autenticación.
- El usuario está en España (`country_code=ES`, timezone `Europe/Madrid`, región Firebase propuesta `europe-west1`).
- Código ya configurado con `mqtt_enabled=False` y sin control PIN; mantenerlo read-only.
- `refresh_vehicle_data` guarda el snapshot actual y un sample manual en `vehicleData/{uid}`. No confundir samples con trayectos reales.
- No usar campos de ejemplo (velocidad/carga/temperatura/etc.) como si fueran datos del coche; el panel de datos reales debe mostrar guiones si la API no los retorna.
- La vista de comparación de gasolina/CO₂ de la maqueta contiene cifras de ejemplo. Deben quedar claramente como muestra o ser sustituidas por cálculos verificables antes de publicar la app conectada.
- El frontend tiene que convertir solo valores conocidos a métricas etiquetadas, pero el catálogo completo puede mostrar los campos JSON no vacíos devueltos por los objetos `realtime` y `energy`.

## 6. Costes y alternativas

- GitHub Pages está disponible gratis con una cuenta Free si el repositorio es público; publicar código hace público el código, no los documentos de Firestore. Evitar subir cualquier credencial, `.env`, service account o datos del coche.
- Firestore Standard Spark tiene cuotas gratuitas oficiales (actualmente 1 GiB, 50.000 lecturas/día, 20.000 escrituras/día y 20.000 borrados/día). El uso individual debe mantenerse bajo esos límites, pero verificar facturación/consumo real.
- Cloud Functions for Firebase requiere Blaze/cuenta de Cloud Billing aunque haya cuota de invocaciones gratuita; el despliegue también puede generar costes pequeños de almacenamiento/build. Cloud KMS requiere billing; una versión de clave simétrica software cuesta aproximadamente 0,06 USD/mes más operaciones (los precios pueden cambiar).
- No se ha diseñado ni validado un backend alternativo completamente gratuito. No prometer coste cero ni migrar a otro proveedor sin comparar seguridad, límites vigentes, compatibilidad Python/`pyBYD`, almacenamiento y la preferencia del usuario por Firebase.
- Antes de cualquier paso que active o vincule facturación, explicar el uso de pago por consumo, límites, tarifas y riesgo de cargos; pedir aprobación explícita. Los avisos de presupuesto son alertas, no necesariamente un tope duro.
- Opción de menor coste dentro del Firebase actual: conservar GitHub Pages + Firestore Spark, desactivar sondeo programado (ya hecho), mantener lectura bajo demanda y posponer deploy del backend hasta decisión sobre Blaze. Esto significa que BYD cloud no conectará mientras la función backend no esté desplegada.

## 7. Qué falta para que funcione de extremo a extremo

1. Confirmar con el usuario si acepta el requisito de pago por uso para desplegar backend y KMS. No pedir datos de tarjeta al agente ni por chat.
2. Confirmar ubicación real de Firestore y si admite/conviene alinear las funciones `europe-west1`.
3. Si acepta facturación, el usuario tendría que asociar una cuenta de facturación desde consola. Guiarlo con capturas, una acción cada vez; no manipular el alta de pago por su cuenta.
4. Crear key ring/clave KMS, asignar IAM mínimo al service account de ejecución, configurar `APP_UID_PEPPER` en Secret Manager/Firebase Functions, completar env local y `.firebaserc` sin subir secretos.
5. Verificar el código Firebase Functions y compatibilidad real con la versión instalada de `pyBYD` antes de desplegar. Hasta ahora **no se han ejecutado tests, lint, emuladores ni deploy**.
6. Crear cuenta/repositorio GitHub y habilitar Pages Actions. Para plan gratuito, el repo debe ser público; explicar que se expone código pero no secretos/datos almacenados en Firebase.
7. Configurar dominios autorizados de Firebase Auth y CORS de Functions con origen exacto de Pages, desplegar reglas seguras y backend.
8. Con consentimiento del usuario, validar un login BYD y revisar campos reales del Dolphin Surf. No solicitar que comparta su contraseña BYD con el agente.
9. Después, priorizar si se puede implementar historial aproximado con snapshots, etiquetándolo como estimación y nunca como viaje exacto. Diseñar el acceso manual sin gastos innecesarios.

## 8. Cómo colaborar con el usuario

- El usuario no tiene experiencia tecnológica. Continuar en español sencillo, con pasos cortos de uno en uno, apoyados en las capturas que envía. Evitar pedirle abrir terminal, ejecutar comandos o editar archivos manualmente cuando el agente pueda hacerlo.
- No volver a pedirle que cree el proyecto ni registre la app web ni cree Firestore: ya lo hizo.
- No pedir ni reproducir contraseña de BYD, contraseña Google, datos bancarios, códigos de verificación, tokens, secreto `APP_UID_PEPPER` o material de KMS.
- El nombre final es **Bi-guay-Di** (mayúsculas exactas). El nombre anterior B-guay-D fue sustituido.
- El usuario pidió minimizar al máximo pasos y coste. Evitar la vía Trip Stats, ADB/sideload, APIs inseguras desde navegador y polling frecuente.

## 9. Fuentes principales

- `pyBYD`: https://github.com/jkaberg/pyBYD
- Docs Firebase pricing plans: https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
- Cloud Functions cuotas/Blaze: https://firebase.google.com/docs/functions/quotas
- Firestore pricing/free quota: https://firebase.google.com/docs/firestore/pricing
- Cloud KMS pricing: https://cloud.google.com/kms/pricing
- GitHub Pages requirements: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
