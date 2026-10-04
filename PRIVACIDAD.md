# Privacidad de Bi-guay-Di

## Qué se guarda

Al conectar la cuenta, el backend guarda la contraseña BYD cifrada mediante Cloud KMS para que pueda volver a consultar los datos. El servidor la descifra solo en memoria durante la consulta. La app web y GitHub Pages no reciben ni almacenan esa contraseña. Las credenciales BYD no se envían a GitHub.

Bi-guay-Di consulta la telemetría que devuelve la nube de BYD y guarda una lectura actual y las muestras solicitadas manualmente en Firestore, propiedad del proyecto Firebase que despliegue el administrador. Por defecto no pide ni conserva GPS. Solo el usuario autenticado puede leer sus lecturas; las escrituras y credenciales se reservan al backend.

## Acceso y eliminación

La conexión usa HTTPS y una sesión de Firebase Authentication. El usuario puede usar «Desconectar y borrar mis datos» para eliminar la conexión cifrada, las lecturas, muestras e historial guardados en Bi-guay-Di y su identidad de acceso. La eliminación afecta al proyecto Firebase de esta instalación; no borra registros que BYD mantenga en sus propios sistemas ni cambia la cuenta BYD.

El administrador de la instalación debe proteger el proyecto Firebase, restringir los orígenes permitidos y otorgar a las funciones solo los permisos necesarios. Cloud KMS protege la contraseña almacenada; el proveedor del proyecto sigue teniendo acceso operativo a los recursos y metadatos. Esta app usa una API no oficial de BYD y su disponibilidad puede cambiar.

## Límites actuales

La API consultada no ofrece un historial verificable por trayecto con energía exacta consumida. Por ello esta versión muestra telemetría y estadísticas de energía disponibles, pero no inventa kWh por viaje, costes históricos ni ahorro de CO₂ por viaje. Para limitar consultas y costes, BYD solo se consulta al conectar y cuando el usuario solicita una actualización; no hay sincronización programada en segundo plano.
